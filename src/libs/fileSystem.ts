export function supportsFileSystemAccess(): boolean {
  return 'showOpenFilePicker' in window;
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
  return openViaInput('.json');
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
    const content = await file.text();
    return { content };
  }
  return openViaInput('.dxf');
}

function openViaInput(accept: string): Promise<{ content: string }> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error('No file selected'));
      const content = await file.text();
      resolve({ content });
    };
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
  if (supportsFileSystemAccess()) {
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
  a.click();
  URL.revokeObjectURL(url);
}
