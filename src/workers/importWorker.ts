/// <reference lib="webworker" />

import type { ImportWorkerRequest, ImportWorkerResponse } from '@/libs/importWorkerClient';

const workerScope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

workerScope.onmessage = async (event: MessageEvent<ImportWorkerRequest>) => {
  const request = event.data;
  const post = (message: ImportWorkerResponse) => workerScope.postMessage(message);
  try {
    post({ id: request.id, type: 'progress', progress: 0.05 });
    if (request.kind === 'dxf') {
      const { importDxf } = await import('@/domain/import/dxfImport');
      post({ id: request.id, type: 'progress', progress: 0.25 });
      const result = importDxf(request.content, request.storyId, request.options);
      post({ id: request.id, type: 'result', result: { kind: 'dxf', result } });
      return;
    }
    if (request.kind === 'ifc') {
      const { importIfc } = await import('@/domain/integration/ifc');
      post({ id: request.id, type: 'progress', progress: 0.25 });
      const result = importIfc(request.content);
      post({ id: request.id, type: 'result', result: { kind: 'ifc', result } });
      return;
    }

    let structural = false;
    try {
      const parsed = JSON.parse(request.content) as { schema?: unknown };
      structural = parsed.schema === 'simple-cad.structural-analysis/v1';
    } catch {
      // The selected importer returns the detailed parse error.
    }
    post({ id: request.id, type: 'progress', progress: 0.2 });
    if (structural) {
      const { importStructuralAnalysisJson } =
        await import('@/domain/integration/structuralAnalysisJson');
      const result = importStructuralAnalysisJson(request.content);
      post({
        id: request.id,
        type: 'result',
        result: { kind: 'json', sourceKind: 'structural', result },
      });
    } else {
      const { importProjectJson } = await import('@/domain/import/jsonImport');
      const result = importProjectJson(request.content);
      post({
        id: request.id,
        type: 'result',
        result: { kind: 'json', sourceKind: 'project', result },
      });
    }
  } catch (error) {
    post({ id: request.id, type: 'error', error: String(error) });
  }
};

export {};
