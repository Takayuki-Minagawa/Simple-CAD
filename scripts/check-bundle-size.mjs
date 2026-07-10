import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';

const assetsDir = join(process.cwd(), 'dist', 'assets');
// Three.js remains isolated behind the lazy-loaded 3D viewer. Its minified raw
// chunk is ~1.1 MB while transfer size stays below the stricter 350 kB budget.
const maxRawBytes = Number(process.env.MAX_CHUNK_BYTES ?? 1_200_000);
const maxGzipBytes = Number(process.env.MAX_CHUNK_GZIP_BYTES ?? 350_000);

const files = (await readdir(assetsDir)).filter((file) => file.endsWith('.js'));
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
