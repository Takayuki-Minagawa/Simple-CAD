#!/usr/bin/env node
/**
 * Smoke test for the built headless CLI (dist-cli/index.js).
 *
 * Unit tests cover `runCli` directly; this checks the *bundled* artifact, which
 * is what the Python port and downstream tooling actually invoke.
 *
 * Usage:
 *   npm run build:cli
 *   node scripts/cli-smoke.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const cli = resolve(repoRoot, 'dist-cli/index.js');
const project = resolve(repoRoot, 'src/samples/sample-project.json');

if (!existsSync(cli)) {
  console.error('dist-cli/index.js not found — run "npm run build:cli" first.');
  process.exit(1);
}

const workDir = mkdtempSync(join(tmpdir(), 'simple-cad-smoke-'));
const failures = [];

function run(args) {
  const result = spawnSync('node', [cli, ...args], { encoding: 'utf8' });
  return { code: result.status, out: result.stdout ?? '', err: result.stderr ?? '' };
}

function check(name, args, expect) {
  const result = run(args);
  const problem = expect(result);
  if (problem) {
    failures.push(`${name}: ${problem}\n  exit=${result.code}\n  stderr=${result.err.trim()}`);
  } else {
    console.log(`ok  ${name}`);
  }
}

const expectOk = (contains) => (r) =>
  r.code !== 0
    ? `expected exit 0`
    : contains && !r.out.includes(contains)
      ? `stdout missing ${JSON.stringify(contains)}`
      : null;

check('list', ['list', project], expectOk('sheets:'));
check('validate', ['validate', project], expectOk('validation OK'));
check('export svg (default sheet)', ['export', project, '--format', 'svg'], expectOk('<svg'));
check('export dxf (default story)', ['export', project, '--format', 'dxf'], expectOk('SECTION'));

const svgOut = join(workDir, 'plan.svg');
check('export svg to file', ['export', project, '--format', 'svg', '--sheet', 'S-001', '-o', svgOut], (r) =>
  r.code !== 0 ? 'expected exit 0' : existsSync(svgOut) ? null : 'output file not written',
);

const dxfOut = join(workDir, 'plan.dxf');
check('export dxf to file', ['export', project, '--format', 'dxf', '--story', '1F', '-o', dxfOut], (r) =>
  r.code !== 0 ? 'expected exit 0' : existsSync(dxfOut) ? null : 'output file not written',
);

// Regression: an unknown id must fail loudly instead of emitting a
// plausible-looking drawing built from grids and the title block alone.
const badDxf = join(workDir, 'bad.dxf');
check(
  'unknown story fails without writing a file',
  ['export', project, '--format', 'dxf', '--story', 'DOES-NOT-EXIST', '-o', badDxf],
  (r) =>
    r.code === 0
      ? 'expected non-zero exit'
      : !r.err.includes('unknown story')
        ? 'stderr missing "unknown story"'
        : existsSync(badDxf)
          ? 'wrote an output file for an unknown story'
          : null,
);

const badSvg = join(workDir, 'bad.svg');
check(
  'unknown sheet fails without writing a file',
  ['export', project, '--format', 'svg', '--sheet', 'DOES-NOT-EXIST', '-o', badSvg],
  (r) =>
    r.code === 0
      ? 'expected non-zero exit'
      : !r.err.includes('unknown sheet')
        ? 'stderr missing "unknown sheet"'
        : r.err.includes('at ')
          ? 'leaked a stack trace'
          : existsSync(badSvg)
            ? 'wrote an output file for an unknown sheet'
            : null,
);

check('unsupported format exits 2', ['export', project, '--format', 'pdf'], (r) =>
  r.code === 2 ? null : 'expected exit 2',
);

rmSync(workDir, { recursive: true, force: true });

if (failures.length > 0) {
  console.error(`\n${failures.length} smoke check(s) failed:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log('\nCLI smoke tests passed.');
