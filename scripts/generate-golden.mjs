#!/usr/bin/env node
/**
 * Regenerate the golden SVG/DXF files consumed by the Python port's
 * byte-parity tests (simple-cad-py/tests/golden).
 *
 * Usage:
 *   npm run build:cli
 *   node scripts/generate-golden.mjs [path-to-simple-cad-py]
 *
 * Default target: ../simple-cad-py (sibling checkout).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const cli = resolve(repoRoot, 'dist-cli/index.js');
const target = resolve(process.argv[2] ?? resolve(repoRoot, '../simple-cad-py'));

if (!existsSync(cli)) {
  console.error('dist-cli/index.js not found — run "npm run build:cli" first.');
  process.exit(1);
}
if (!existsSync(target)) {
  console.error(`target not found: ${target}`);
  process.exit(1);
}

const goldenDir = resolve(target, 'tests/golden');
const cases = [
  // [project file, output prefix, format, id]
  [resolve(repoRoot, 'src/samples/sample-project.json'), 'sample', 'svg', 'S-001'],
  [resolve(repoRoot, 'src/samples/sample-project.json'), 'sample', 'svg', 'S-002'],
  [resolve(repoRoot, 'src/samples/sample-project.json'), 'sample', 'dxf', '1F'],
  [resolve(repoRoot, 'src/samples/sample-project.json'), 'sample', 'dxf', '2F'],
  [resolve(target, 'tests/data/torture-project.json'), 'torture', 'svg', 'SHT-COMPACT'],
  [resolve(target, 'tests/data/torture-project.json'), 'torture', 'svg', 'SHT-MIN'],
  [resolve(target, 'tests/data/torture-project.json'), 'torture', 'svg', 'SHT-NOVIEW'],
  [resolve(target, 'tests/data/torture-project.json'), 'torture', 'dxf', '1F'],
  [resolve(target, 'tests/data/torture-project.json'), 'torture', 'dxf', '2F'],
];

for (const [project, prefix, format, id] of cases) {
  const selector = format === 'svg' ? '--sheet' : '--story';
  const out = resolve(goldenDir, `${prefix}-${id}.${format}`);
  execFileSync('node', [cli, 'export', project, '--format', format, selector, id, '-o', out], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
}
console.log('golden files regenerated. Now run pytest in the Python repo.');
