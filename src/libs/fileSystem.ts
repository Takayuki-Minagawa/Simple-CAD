import { decodeDxfBytes } from '@/domain/dxf/format';

export function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
}

export function supportsFileSystemSave(): boolean {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

export function createAbortError(message = 'File selection cancelled'): DOMException {
  return new DOMException(message, 'AbortError');
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError');
}

export async function openJsonFile(): Promise<{
  content: string;
  handle?: FileSystemFileHandle;
}> {
  if (supportsFileSystemAccess()) {
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'JSON files',
          accept: { 'application/json': ['.json'] },
        },
      ],
    });
    const file = await handle.getFile();
    const content = await file.text();
    return { content, handle };
  }
  return openFileViaInput('.json');
}

export async function openDxfFile(): Promise<{ content: string }> {
  if (supportsFileSystemAccess()) {
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'DXF files',
          accept: { 'application/dxf': ['.dxf'] },
        },
      ],
    });
    const file = await handle.getFile();
    const content = await readDxfFile(file);
    return { content };
  }
  return openFileViaInput('.dxf', readDxfFile);
}

export async function openIfcFile(): Promise<{ content: string }> {
  if (supportsFileSystemAccess()) {
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'IFC files',
          accept: { 'application/octet-stream': ['.ifc'] },
        },
      ],
    });
    const file = await handle.getFile();
    const content = await file.text();
    return { content };
  }
  return openFileViaInput('.ifc');
}

async function readDxfFile(file: File): Promise<string> {
  return decodeDxfBytes(new Uint8Array(await file.arrayBuffer()));
}

export function openFileViaInput(
  accept: string,
  read: (file: File) => Promise<string> = (file) => file.text(),
): Promise<{ content: string }> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.append(input);

    let settled = false;
    let focusTimer: number | undefined;
    const cleanup = () => {
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
      window.removeEventListener('focus', handleWindowFocus);
      input.remove();
    };
    const finish = (
      outcome: { ok: true; value: { content: string } } | { ok: false; error: unknown },
    ) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (outcome.ok) resolve(outcome.value);
      else reject(outcome.error);
    };
    const cancel = () => finish({ ok: false, error: createAbortError() });

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return cancel();
      try {
        const content = await read(file);
        finish({ ok: true, value: { content } });
      } catch (error) {
        finish({ ok: false, error });
      }
    };
    input.addEventListener('cancel', cancel, { once: true });

    function handleWindowFocus() {
      focusTimer = window.setTimeout(() => {
        if (!input.files?.length) cancel();
      }, 500);
    }
    window.addEventListener('focus', handleWindowFocus, { once: true });
    input.click();
  });
}

export async function saveFile(
  content: string,
  fileName: string,
  mimeType: string,
  handle?: FileSystemFileHandle | null,
): Promise<FileSystemFileHandle | null> {
  if (handle) {
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    return handle;
  }
  if (supportsFileSystemSave()) {
    const ext = fileName.split('.').pop() ?? 'json';
    const newHandle = await window.showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          description: `${ext.toUpperCase()} file`,
          accept: { [mimeType]: [`.${ext}`] },
        },
      ],
    });
    const writable = await newHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return newHandle;
  }
  downloadBlob(content, fileName, mimeType);
  return null;
}

export function downloadBlob(content: string | Blob, fileName: string, mimeType: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
