import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';

const assetsDir = join(process.cwd(), 'dist', 'assets');
// Three.js remains isolated behind the lazy-loaded 3D viewer. Its minified raw
// chunk is ~1.1 MB while transfer size stays below the stricter 350 kB budget.
function readBudget(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    process.stderr.write(`${name} must be a positive integer byte count; received "${raw}".\n`);
    process.exit(1);
  }
  return value;
}

const maxRawBytes = readBudget('MAX_CHUNK_BYTES', 1_200_000);
const maxGzipBytes = readBudget('MAX_CHUNK_GZIP_BYTES', 350_000);

const files = (await readdir(assetsDir)).filter((file) => file.endsWith('.js'));
if (files.length === 0) {
  process.stderr.write(`No JavaScript chunks found in ${assetsDir}; build output is incomplete.\n`);
  process.exit(1);
}
const failures = [];

for (const file of files) {
  const path = join(assetsDir, file);
  const rawBytes = (await stat(path)).size;
  const gzipBytes = gzipSync(await readFile(path)).byteLength;
  if (rawBytes > maxRawBytes || gzipBytes > maxGzipBytes) {
    failures.push({ file, rawBytes, gzipBytes });
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    process.stderr.write(
      `${failure.file}: ${failure.rawBytes} bytes raw, ${failure.gzipBytes} bytes gzip\n`,
    );
  }
  process.stderr.write(
    `Bundle budget exceeded (raw <= ${maxRawBytes}, gzip <= ${maxGzipBytes}).\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `Bundle budget passed for ${files.length} JavaScript chunks (raw <= ${maxRawBytes}, gzip <= ${maxGzipBytes}).\n`,
);
