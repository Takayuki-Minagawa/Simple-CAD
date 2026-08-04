/**
 * simple-cad CLI — headless drawing export over the browser-free domain core.
 *
 * This entry must only depend on `@/domain/**` (pure TypeScript) and Node
 * built-ins. Browser-only adapters (pdfExport, React UI, stores) are out of
 * bounds; SVG→PDF conversion is delegated to downstream tooling.
 *
 * Usage:
 *   simple-cad list <project.json>
 *   simple-cad validate <project.json>
 *   simple-cad export <project.json> [--format svg|dxf] [--sheet ID] [--story ID] [-o FILE]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { exportSvg } from '@/domain/export/svgExport';
import { exportDxfWithWarnings } from '@/domain/export/dxfExport';
import { validateProject } from '@/domain/validation';
import type { ProjectData } from '@/domain/structural/types';

const USAGE = `simple-cad — headless drawing export for Simple-CAD projects

Usage:
  simple-cad list <project.json>
      List sheets and stories in the project.

  simple-cad validate <project.json>
      Run the full validation pipeline. Exits non-zero on errors.

  simple-cad export <project.json> [options]
      Render a drawing.
      --format svg|dxf   Output format (default: svg)
      --sheet <id>       Sheet id for SVG export (default: first sheet)
      --story <id>       Story id for DXF export (default: first story)
      -o, --output <f>   Output file (default: stdout)
`;

function fail(message: string, code = 1): never {
  process.stderr.write(`simple-cad: ${message}\n`);
  process.exit(code);
}

function loadProject(path: string): ProjectData {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    fail(`cannot read file: ${path}`);
  }
  try {
    return JSON.parse(raw) as ProjectData;
  } catch (error) {
    fail(`invalid JSON in ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function writeOutput(content: string, outputPath: string | undefined): void {
  if (!outputPath) {
    process.stdout.write(content);
    if (!content.endsWith('\n')) process.stdout.write('\n');
    return;
  }
  const target = resolve(outputPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
  process.stderr.write(`wrote ${target}\n`);
}

interface ExportOptions {
  input: string;
  format: 'svg' | 'dxf';
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
  options.input = positional[0];
  return options;
}

function commandList(args: string[]): void {
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
  process.stdout.write(lines.join('\n') + '\n');
}

function commandValidate(args: string[]): void {
  if (args.length !== 1) fail('validate needs exactly one <project.json> argument', 2);
  const data = loadProject(args[0]);
  const result = validateProject(data);
  for (const issue of result.errors) {
    process.stderr.write(`[${issue.level}] ${issue.message}\n`);
  }
  if (!result.ok) fail('validation failed');
  process.stdout.write('validation OK\n');
}

function commandExport(args: string[]): void {
  const options = parseExportArgs(args);
  const data = loadProject(options.input);

  if (options.format === 'svg') {
    const sheetId = options.sheet ?? data.sheets[0]?.id;
    if (!sheetId) fail('project has no sheets; specify --sheet');
    writeOutput(exportSvg(data, sheetId), options.output);
    return;
  }

  const storyId = options.story ?? data.stories[0]?.id;
  if (!storyId) fail('project has no stories; specify --story');
  const { content, warnings } = exportDxfWithWarnings(data, storyId);
  for (const warning of warnings) {
    process.stderr.write(`warning: ${warning}\n`);
  }
  writeOutput(content, options.output);
}

function main(): void {
  const [command, ...rest] = process.argv.slice(2);
  switch (command) {
    case 'list':
      commandList(rest);
      break;
    case 'validate':
      commandValidate(rest);
      break;
    case 'export':
      commandExport(rest);
      break;
    case '--help':
    case '-h':
    case 'help':
    case undefined:
      process.stdout.write(USAGE);
      if (command === undefined) process.exit(2);
      break;
    default:
      fail(`unknown command "${command}"\n\n${USAGE}`, 2);
  }
}

main();
