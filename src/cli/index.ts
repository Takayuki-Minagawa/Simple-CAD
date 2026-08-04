#!/usr/bin/env node
/**
 * simple-cad CLI — headless drawing export over the browser-free domain core.
 *
 * This entry must only depend on `@/domain/**` (pure TypeScript, via ./run) and
 * Node built-ins. Browser-only adapters (pdfExport, React UI, stores) are out
 * of bounds; SVG→PDF conversion is delegated to downstream tooling.
 *
 * Usage:
 *   simple-cad list <project.json>
 *   simple-cad validate <project.json>
 *   simple-cad export <project.json> [--format svg|dxf] [--sheet ID] [--story ID] [-o FILE]
 */
import process from 'node:process';
import { runCli } from './run';

let exitCode: number;
try {
  exitCode = runCli(process.argv.slice(2), {
    out: (text) => void process.stdout.write(text),
    err: (text) => void process.stderr.write(text),
  });
} catch (error) {
  // Unexpected failures are bugs, not user errors — keep the stack.
  process.stderr.write(
    `simple-cad: internal error\n${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  exitCode = 70; // EX_SOFTWARE
}
process.exit(exitCode);
