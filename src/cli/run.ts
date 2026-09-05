/**
 * simple-cad CLI implementation.
 *
 * Kept free of `process.exit` and of the ambient streams so every command can
 * be exercised from unit tests; `src/cli/index.ts` wires this to the real
 * process. Like that entry point, this module must only depend on
 * `@/domain/**` (pure TypeScript) and Node built-ins.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { exportSvg } from '@/domain/export/svgExport';
import { isDxfVersion, type DxfVersion } from '@/domain/dxf/format';
import { exportDxfWithWarnings } from '@/domain/export/dxfExport';
import { validateProject } from '@/domain/validation';
import type { ProjectData } from '@/domain/structural/types';

export const USAGE = `simple-cad — headless drawing export for Simple-CAD projects

Usage:
  simple-cad list <project.json>
      List sheets and stories in the project.

  simple-cad validate <project.json>
      Run the full validation pipeline. Exits non-zero on errors.

  simple-cad export <project.json> [options]
      Render a drawing.
      --format svg|dxf   Output format (default: svg)
      --sheet <id>       Sheet id for SVG export (default: first sheet)
      --dxf-version AC1015|AC1027|AC1032
                        DXF generation: 2000 / 2015–2017 / 2018+ (default: AC1032)
      --story <id>       Story id for DXF export (default: first story)
      -o, --output <f>   Output file (default: stdout)
`;

/** Streams the CLI writes to; injected so tests can capture output. */
export interface CliStreams {
  out: (text: string) => void;
  err: (text: string) => void;
}

/** A message meant for the user, with the exit code the process should use. */
export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

function fail(message: string, code = 1): never {
  throw new CliError(message, code);
}

function loadProject(path: string): ProjectData {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    fail(`cannot read file: ${path}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`invalid JSON in ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  // Only the shape the commands below index into is checked here; run
  // `simple-cad validate` for the full schema + semantic pipeline.
  const candidate = parsed as Partial<ProjectData> | null;
  if (
    typeof candidate !== 'object' ||
    candidate === null ||
    !Array.isArray(candidate.sheets) ||
    !Array.isArray(candidate.stories)
  ) {
    fail(`${path} is not a Simple-CAD project (expected "sheets" and "stories" arrays)`);
  }
  return candidate as ProjectData;
}

/**
 * Resolve the sheet/story to render. An id the project does not contain is a
 * hard error: exporting it would otherwise emit a plausible-looking drawing
 * (frame, grids and title block survive the per-story filtering) from a typo.
 */
function resolveTargetId(
  label: 'sheet' | 'story',
  requested: string | undefined,
  available: string[],
): string {
  if (available.length === 0) {
    fail(`project has no ${label}s`);
  }
  if (requested === undefined) {
    return available[0];
  }
  if (!available.includes(requested)) {
    fail(`unknown ${label} "${requested}" (available: ${available.join(', ')})`);
  }
  return requested;
}

function writeOutput(content: string, outputPath: string | undefined, streams: CliStreams): void {
  if (!outputPath) {
    streams.out(content);
    if (!content.endsWith('\n')) streams.out('\n');
    return;
  }
  const target = resolve(outputPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
  streams.err(`wrote ${target}\n`);
}

interface ExportOptions {
  input: string;
  format: 'svg' | 'dxf';
  dxfVersion?: DxfVersion;
  sheet?: string;
  story?: string;
  output?: string;
}

function parseExportArgs(args: string[]): ExportOptions {
  const options: ExportOptions = { input: '', format: 'svg' };
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = (): string => {
      const value = args[++i];
      if (value === undefined) fail(`missing value for ${arg}`, 2);
      return value;
    };
    switch (arg) {
      case '--format': {
        const value = next();
        if (value !== 'svg' && value !== 'dxf') {
          fail(`unsupported format "${value}" (svg|dxf; for PDF convert the SVG downstream)`, 2);
        }
        options.format = value;
        break;
      }
      case '--dxf-version': {
        const value = next();
        if (!isDxfVersion(value))
          fail(`unsupported DXF version "${value}" (AC1015|AC1027|AC1032)`, 2);
        options.dxfVersion = value;
        break;
      }
      case '--sheet':
        options.sheet = next();
        break;
      case '--story':
        options.story = next();
        break;
      case '-o':
      case '--output':
        options.output = next();
        break;
      default:
        if (arg.startsWith('-')) fail(`unknown option ${arg}`, 2);
        positional.push(arg);
    }
  }
  if (positional.length !== 1) fail('export needs exactly one <project.json> argument', 2);
  if (options.dxfVersion && options.format !== 'dxf')
    fail('--dxf-version requires --format dxf', 2);
  options.input = positional[0];
  return options;
}

function commandList(args: string[], streams: CliStreams): void {
  if (args.length !== 1) fail('list needs exactly one <project.json> argument', 2);
  const data = loadProject(args[0]);
  const lines: string[] = [];
  lines.push(`project: ${data.project.name} (${data.project.id})`);
  lines.push('sheets:');
  for (const sheet of data.sheets) {
    lines.push(`  ${sheet.id}\t${sheet.name}\t${sheet.paperSize}\t${sheet.scale}`);
  }
  lines.push('stories:');
  for (const story of data.stories) {
    lines.push(`  ${story.id}\t${story.name}\televation=${story.elevation}`);
  }
  streams.out(lines.join('\n') + '\n');
}

function commandValidate(args: string[], streams: CliStreams): void {
  if (args.length !== 1) fail('validate needs exactly one <project.json> argument', 2);
  const data = loadProject(args[0]);
  const result = validateProject(data);
  for (const issue of result.errors) {
    streams.err(`[${issue.level}] ${issue.message}\n`);
  }
  if (!result.ok) fail('validation failed');
  streams.out('validation OK\n');
}

function commandExport(args: string[], streams: CliStreams): void {
  const options = parseExportArgs(args);
  const data = loadProject(options.input);

  if (options.format === 'svg') {
    const sheetId = resolveTargetId(
      'sheet',
      options.sheet,
      data.sheets.map((sheet) => sheet.id),
    );
    writeOutput(exportSvg(data, sheetId), options.output, streams);
    return;
  }

  const storyId = resolveTargetId(
    'story',
    options.story,
    data.stories.map((story) => story.id),
  );
  const { content, warnings } = exportDxfWithWarnings(data, storyId, {
    version: options.dxfVersion,
  });
  for (const warning of warnings) {
    streams.err(`warning: ${warning}\n`);
  }
  writeOutput(content, options.output, streams);
}

/**
 * Run one CLI invocation and return the process exit code. Only `CliError` is
 * translated into a message; anything else is a bug and is left to the caller
 * so the stack survives.
 */
export function runCli(argv: string[], streams: CliStreams): number {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case 'list':
        commandList(rest, streams);
        return 0;
      case 'validate':
        commandValidate(rest, streams);
        return 0;
      case 'export':
        commandExport(rest, streams);
        return 0;
      case '--help':
      case '-h':
      case 'help':
        streams.out(USAGE);
        return 0;
      case undefined:
        streams.out(USAGE);
        return 2;
      default:
        fail(`unknown command "${command}"\n\n${USAGE}`, 2);
    }
  } catch (error) {
    if (error instanceof CliError) {
      streams.err(`simple-cad: ${error.message}\n`);
      return error.exitCode;
    }
    throw error;
  }
}
