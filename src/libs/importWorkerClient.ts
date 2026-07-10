import type { DxfImportOptions, DxfImportResult } from '@/domain/import/dxfImport';
import type { ProjectData } from '@/domain/structural/types';
import type { ValidationError } from '@/domain/validation';
import { createAbortError } from './fileSystem';

export type ProjectImportResult =
  | { ok: true; data: ProjectData; warnings?: string[] }
  | { ok: false; errors: ValidationError[] };

export type ImportWorkerRequest =
  | { id: string; kind: 'json'; content: string }
  | { id: string; kind: 'ifc'; content: string }
  | {
      id: string;
      kind: 'dxf';
      content: string;
      storyId: string;
      options: DxfImportOptions;
    };

export type ImportWorkerResult =
  | { kind: 'json'; sourceKind: 'project' | 'structural'; result: ProjectImportResult }
  | { kind: 'ifc'; result: ProjectImportResult }
  | { kind: 'dxf'; result: DxfImportResult };

export type ImportWorkerResponse =
  | { id: string; type: 'progress'; progress: number }
  | { id: string; type: 'result'; result: ImportWorkerResult }
  | { id: string; type: 'error'; error: string };

interface RunOptions {
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

let requestSequence = 0;
type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;
export type ImportWorkerPayload = WithoutId<ImportWorkerRequest>;

/** Parse/validate imports off the main thread, with a dynamic-import fallback for tests/older browsers. */
export async function runImportWorker(
  request: ImportWorkerPayload,
  options: RunOptions = {},
): Promise<ImportWorkerResult> {
  if (options.signal?.aborted) throw createAbortError('Import cancelled');
  if (typeof Worker === 'undefined') return runWithoutWorker(request, options);

  const id = `import-${Date.now()}-${++requestSequence}`;
  const worker = new Worker(new URL('../workers/importWorker.ts', import.meta.url), {
    type: 'module',
  });
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      options.signal?.removeEventListener('abort', handleAbort);
      worker.terminate();
    };
    const handleAbort = () => {
      cleanup();
      reject(createAbortError('Import cancelled'));
    };
    options.signal?.addEventListener('abort', handleAbort, { once: true });
    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || 'Import worker failed'));
    };
    worker.onmessage = (event: MessageEvent<ImportWorkerResponse>) => {
      const message = event.data;
      if (message.id !== id) return;
      if (message.type === 'progress') {
        options.onProgress?.(message.progress);
        return;
      }
      cleanup();
      if (message.type === 'error') reject(new Error(message.error));
      else resolve(message.result);
    };
    worker.postMessage({ ...request, id } satisfies ImportWorkerRequest);
  });
}

async function runWithoutWorker(
  request: ImportWorkerPayload,
  options: RunOptions,
): Promise<ImportWorkerResult> {
  options.onProgress?.(0.1);
  await Promise.resolve();
  if (options.signal?.aborted) throw createAbortError('Import cancelled');
  if (request.kind === 'dxf') {
    const { importDxf } = await import('@/domain/import/dxfImport');
    return { kind: 'dxf', result: importDxf(request.content, request.storyId, request.options) };
  }
  if (request.kind === 'ifc') {
    const { importIfc } = await import('@/domain/integration/ifc');
    return { kind: 'ifc', result: importIfc(request.content) };
  }

  let structural = false;
  try {
    const parsed = JSON.parse(request.content) as { schema?: unknown };
    structural = parsed.schema === 'simple-cad.structural-analysis/v1';
  } catch {
    // Importer supplies the parse error.
  }
  if (structural) {
    const { importStructuralAnalysisJson } =
      await import('@/domain/integration/structuralAnalysisJson');
    return {
      kind: 'json',
      sourceKind: 'structural',
      result: importStructuralAnalysisJson(request.content),
    };
  }
  const { importProjectJson } = await import('@/domain/import/jsonImport');
  return { kind: 'json', sourceKind: 'project', result: importProjectJson(request.content) };
}
