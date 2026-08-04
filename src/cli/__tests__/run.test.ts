import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sampleProject from '@/samples/sample-project.json';
import { runCli, type CliStreams } from '../run';

let workDir: string;
let projectPath: string;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), 'simple-cad-cli-'));
  projectPath = join(workDir, 'project.json');
  writeFileSync(projectPath, JSON.stringify(sampleProject), 'utf8');
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

interface RunResult {
  code: number;
  out: string;
  err: string;
}

function run(...argv: string[]): RunResult {
  let out = '';
  let err = '';
  const streams: CliStreams = {
    out: (text) => {
      out += text;
    },
    err: (text) => {
      err += text;
    },
  };
  return { code: runCli(argv, streams), out, err };
}

describe('simple-cad CLI', () => {
  it('lists sheets and stories', () => {
    const result = run('list', projectPath);
    expect(result.code).toBe(0);
    expect(result.out).toContain('S-001');
    expect(result.out).toContain('1F');
  });

  it('exports SVG for an explicit sheet and defaults to the first one', () => {
    const explicit = run('export', projectPath, '--format', 'svg', '--sheet', 'S-002');
    expect(explicit.code).toBe(0);
    expect(explicit.out).toContain('<svg');

    const defaulted = run('export', projectPath, '--format', 'svg');
    expect(defaulted.code).toBe(0);
    expect(defaulted.out).toBe(run('export', projectPath, '--format', 'svg', '--sheet', 'S-001').out);
  });

  it('exports DXF for an explicit story and defaults to the first one', () => {
    const explicit = run('export', projectPath, '--format', 'dxf', '--story', '2F');
    expect(explicit.code).toBe(0);
    expect(explicit.out).toContain('SECTION');

    const defaulted = run('export', projectPath, '--format', 'dxf');
    expect(defaulted.code).toBe(0);
    expect(defaulted.out).toBe(run('export', projectPath, '--format', 'dxf', '--story', '1F').out);
  });

  // A missing story used to fall through to exportDxfWithWarnings, which only
  // filters members by story: the header, grids and layers still rendered, so a
  // typo produced a plausible-looking file and exit code 0.
  it('rejects an unknown story instead of writing a partial DXF', () => {
    const outPath = join(workDir, 'unknown-story.dxf');
    const result = run(
      'export',
      projectPath,
      '--format',
      'dxf',
      '--story',
      'DOES-NOT-EXIST',
      '-o',
      outPath,
    );
    expect(result.code).not.toBe(0);
    expect(result.err).toContain('unknown story "DOES-NOT-EXIST"');
    expect(result.err).toContain('1F');
    expect(existsSync(outPath)).toBe(false);
  });

  it('rejects an unknown sheet with a plain message rather than an exception', () => {
    const outPath = join(workDir, 'unknown-sheet.svg');
    const result = run('export', projectPath, '--sheet', 'NOPE', '-o', outPath);
    expect(result.code).not.toBe(0);
    expect(result.err).toContain('simple-cad: unknown sheet "NOPE"');
    expect(existsSync(outPath)).toBe(false);
  });

  it('writes to the requested output file on success', () => {
    const outPath = join(workDir, 'nested', 'plan.svg');
    const result = run('export', projectPath, '--format', 'svg', '-o', outPath);
    expect(result.code).toBe(0);
    expect(existsSync(outPath)).toBe(true);
  });

  it('validates a well-formed project', () => {
    const result = run('validate', projectPath);
    expect(result.code).toBe(0);
    expect(result.out).toContain('validation OK');
  });

  it('rejects malformed input before touching the exporters', () => {
    const brokenJson = join(workDir, 'broken.json');
    writeFileSync(brokenJson, '{ not json', 'utf8');
    expect(run('export', brokenJson).code).toBe(1);
    expect(run('export', brokenJson).err).toContain('invalid JSON');

    const notAProject = join(workDir, 'other.json');
    writeFileSync(notAProject, '{"hello":"world"}', 'utf8');
    expect(run('list', notAProject).err).toContain('not a Simple-CAD project');

    expect(run('export', join(workDir, 'missing.json')).err).toContain('cannot read file');
  });

  it('reports usage errors with exit code 2', () => {
    expect(run('export', projectPath, '--format', 'pdf').code).toBe(2);
    expect(run('export', projectPath, '--nope').code).toBe(2);
    expect(run('export', projectPath, '--sheet').err).toContain('missing value for --sheet');
    expect(run('export').code).toBe(2);
    expect(run('frobnicate').code).toBe(2);
    expect(run().code).toBe(2);
  });

  it('prints usage on --help with exit code 0', () => {
    const result = run('--help');
    expect(result.code).toBe(0);
    expect(result.out).toContain('simple-cad export');
  });
});
