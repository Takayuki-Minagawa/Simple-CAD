import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const script = join(dirname(fileURLToPath(import.meta.url)), 'check-bundle-size.mjs');
const temporaryDirectories = [];

async function bundleDirectory() {
  const cwd = await mkdtemp(join(tmpdir(), 'simple-cad-bundle-'));
  temporaryDirectories.push(cwd);
  await mkdir(join(cwd, 'dist', 'assets'), { recursive: true });
  return cwd;
}

function run(cwd, env = {}) {
  return spawnSync(process.execPath, [script], {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) =>
      rm(path, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

describe('check-bundle-size script', () => {
  it('fails fast for a non-numeric budget instead of silently comparing with NaN', async () => {
    const cwd = await bundleDirectory();
    await writeFile(join(cwd, 'dist', 'assets', 'index.js'), 'export {};');

    const result = run(cwd, { MAX_CHUNK_BYTES: 'not-a-number' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('MAX_CHUNK_BYTES must be a positive integer');
  });

  it('fails when the build contains no JavaScript chunks', async () => {
    const cwd = await bundleDirectory();
    await writeFile(join(cwd, 'dist', 'assets', 'index.css'), 'body{}');

    const result = run(cwd);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('No JavaScript chunks found');
  });
});
