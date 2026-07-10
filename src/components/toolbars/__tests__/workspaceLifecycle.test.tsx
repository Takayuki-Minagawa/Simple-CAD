import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';
import { useProjectStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { useFileActions } from '../useFileActions';
import { MainToolbar } from '../MainToolbar';

const mocks = vi.hoisted(() => ({
  openJsonFile: vi.fn(),
  openDxfFile: vi.fn(),
  openIfcFile: vi.fn(),
  saveFile: vi.fn(),
  runImportWorker: vi.fn(),
  saveWorkspace: vi.fn(),
  listRecentProjects: vi.fn(),
  removeRecentProject: vi.fn(),
  showAlert: vi.fn(),
  showConfirm: vi.fn(),
  showPrompt: vi.fn(),
}));

vi.mock('@/libs/fileSystem', () => ({
  isAbortError: (error: unknown) =>
    Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError'),
  openJsonFile: mocks.openJsonFile,
  openDxfFile: mocks.openDxfFile,
  openIfcFile: mocks.openIfcFile,
  saveFile: mocks.saveFile,
}));

vi.mock('@/libs/importWorkerClient', () => ({ runImportWorker: mocks.runImportWorker }));

vi.mock('@/libs/persistence', () => ({
  saveWorkspace: mocks.saveWorkspace,
  listRecentProjects: mocks.listRecentProjects,
  removeRecentProject: mocks.removeRecentProject,
}));

vi.mock('@/app/browserDialogs', () => ({
  showAlert: mocks.showAlert,
  showConfirm: mocks.showConfirm,
  showPrompt: mocks.showPrompt,
}));

function cloneSample(): ProjectData {
  return structuredClone(sampleProject) as unknown as ProjectData;
}

function loadDirtyProject() {
  const project = cloneSample();
  useProjectStore.getState().loadProject(project);
  useProjectStore.getState().addAnnotation({
    id: 'dirty-note',
    type: 'text',
    story: project.stories[0].id,
    x: 0,
    y: 0,
    text: 'unsaved',
    fontSize: 250,
  });
  expect(useProjectStore.getState().isDirty).toBe(true);
}

const toolbarProps = {
  onExport: vi.fn(),
  onMasters: vi.fn(),
  onAiAssist: vi.fn(),
  onHelp: vi.fn(),
  onTransform: vi.fn(),
  onPrintPreview: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  useI18n.getState().setLocale('en');
  useProjectStore.getState().loadProject(cloneSample());
  mocks.saveFile.mockResolvedValue(null);
  mocks.saveWorkspace.mockResolvedValue(undefined);
  mocks.listRecentProjects.mockResolvedValue([]);
  mocks.removeRecentProject.mockResolvedValue(undefined);
  mocks.showConfirm.mockReturnValue(true);
});

describe('workspace autosave lifecycle', () => {
  it('writes a clean snapshot immediately after an explicit save', async () => {
    loadDirtyProject();
    const { result } = renderHook(() => useFileActions());

    await act(async () => result.current.handleSave());

    expect(mocks.saveFile).toHaveBeenCalledOnce();
    expect(mocks.saveWorkspace).toHaveBeenCalledWith(expect.any(Object), false);
    expect(useProjectStore.getState().isDirty).toBe(false);
  });

  it('keeps edits made while a save is in flight dirty', async () => {
    loadDirtyProject();
    const handle = { kind: 'file', name: 'project.json' } as FileSystemFileHandle;
    mocks.saveFile.mockImplementation(async () => {
      useProjectStore.getState().addAnnotation({
        id: 'during-save',
        type: 'text',
        story: '1F',
        x: 100,
        y: 200,
        text: 'newer than snapshot',
        fontSize: 250,
      });
      return handle;
    });
    const { result } = renderHook(() => useFileActions());

    await act(async () => result.current.handleSave());

    expect(useProjectStore.getState().isDirty).toBe(true);
    expect(useProjectStore.getState().fileHandle).toBe(handle);
    expect(mocks.saveWorkspace).toHaveBeenLastCalledWith(
      expect.objectContaining({
        annotations: expect.arrayContaining([
          expect.objectContaining({ id: 'during-save' }),
        ]),
      }),
      true,
    );
    expect(mocks.showAlert).toHaveBeenCalledWith(
      expect.stringContaining('Changes made after saving started'),
    );
  });

  it('serializes explicit saves so an older snapshot cannot overwrite a newer save', async () => {
    loadDirtyProject();
    let finishSave: (() => void) | undefined;
    mocks.saveFile.mockReturnValue(
      new Promise((resolve) => {
        finishSave = () => resolve(null);
      }),
    );
    const { result } = renderHook(() => useFileActions());

    let firstSave: Promise<void> | undefined;
    act(() => {
      firstSave = result.current.handleSave();
    });
    await waitFor(() => expect(mocks.saveFile).toHaveBeenCalledOnce());
    act(() => {
      useProjectStore.getState().addAnnotation({
        id: 'between-saves',
        type: 'text',
        story: '1F',
        x: 0,
        y: 0,
        text: 'newer',
        fontSize: 250,
      });
      void result.current.handleSave();
    });

    expect(mocks.saveFile).toHaveBeenCalledOnce();
    finishSave?.();
    await act(async () => firstSave);
    expect(useProjectStore.getState().isDirty).toBe(true);
  });

  it('replaces an old dirty autosave with the newly opened clean project', async () => {
    loadDirtyProject();
    const imported = cloneSample();
    imported.project.id = 'opened-project';
    imported.project.name = 'Opened project';
    mocks.openJsonFile.mockResolvedValue({ content: '{}' });
    mocks.runImportWorker.mockResolvedValue({
      kind: 'json',
      sourceKind: 'project',
      result: { ok: true, data: imported, warnings: [] },
    });
    const { result } = renderHook(() => useFileActions());

    await act(async () => result.current.handleOpen());

    expect(useProjectStore.getState().data?.project.id).toBe('opened-project');
    expect(mocks.saveWorkspace).toHaveBeenLastCalledWith(imported, false);
  });

  it('does not apply an import that finishes after the document was replaced', async () => {
    const imported = cloneSample();
    imported.project.id = 'stale-import';
    const replacement = cloneSample();
    replacement.project.id = 'replacement';
    mocks.openJsonFile.mockResolvedValue({ content: '{}' });
    let finishImport: ((result: unknown) => void) | undefined;
    mocks.runImportWorker.mockReturnValue(
      new Promise((resolve) => {
        finishImport = resolve;
      }),
    );
    const { result } = renderHook(() => useFileActions());

    let openPromise: Promise<void> | undefined;
    act(() => {
      openPromise = result.current.handleOpen();
    });
    await waitFor(() => expect(mocks.runImportWorker).toHaveBeenCalledOnce());
    act(() => useProjectStore.getState().loadProject(replacement));
    finishImport?.({
      kind: 'json',
      sourceKind: 'project',
      result: { ok: true, data: imported, warnings: [] },
    });
    await act(async () => openPromise);

    expect(useProjectStore.getState().data?.project.id).toBe('replacement');
    expect(mocks.showAlert).toHaveBeenCalledWith(
      expect.stringContaining('project changed during import'),
    );
  });

  it('cannot attach a stale opened-file handle after persistence finishes', async () => {
    const imported = cloneSample();
    imported.project.id = 'opened-with-handle';
    const replacement = cloneSample();
    replacement.project.id = 'replacement-after-open';
    const handle = { kind: 'file', name: 'opened.json' } as FileSystemFileHandle;
    mocks.openJsonFile.mockResolvedValue({ content: '{}', handle });
    mocks.runImportWorker.mockResolvedValue({
      kind: 'json',
      sourceKind: 'project',
      result: { ok: true, data: imported, warnings: [] },
    });
    let finishPersistence: (() => void) | undefined;
    mocks.saveWorkspace.mockReturnValueOnce(
      new Promise((resolve) => {
        finishPersistence = () => resolve(undefined);
      }),
    );
    const { result } = renderHook(() => useFileActions());

    let openPromise: Promise<void> | undefined;
    act(() => {
      openPromise = result.current.handleOpen();
    });
    await waitFor(() => expect(useProjectStore.getState().fileHandle).toBe(handle));
    act(() => useProjectStore.getState().loadProject(replacement));
    expect(useProjectStore.getState().fileHandle).toBeNull();

    finishPersistence?.();
    await act(async () => openPromise);
    expect(useProjectStore.getState().data?.project.id).toBe('replacement-after-open');
    expect(useProjectStore.getState().fileHandle).toBeNull();
  });

  it('commits a confirmed DXF batch as one undo step', async () => {
    mocks.openDxfFile.mockResolvedValue({ content: 'DXF' });
    mocks.showPrompt.mockReturnValue('mm');
    mocks.runImportWorker.mockResolvedValue({
      kind: 'dxf',
      result: {
        annotations: [
          {
            id: 'DXF-NOTE',
            type: 'text',
            story: '1F',
            x: 10,
            y: 20,
            text: 'imported',
            fontSize: 250,
          },
        ],
        members: [],
        dimensions: [],
        grids: [{ id: 'DXF-GRID', axis: 'X', name: 'DXF-X', position: 12_345 }],
        constructionLines: [
          {
            id: 'DXF-CL',
            story: '1F',
            type: 'xline',
            origin: { x: 0, y: 0 },
            direction: { x: 1, y: 0 },
          },
        ],
        autoSections: [],
        primitiveCount: 3,
        warnings: [],
      },
    });
    const { result } = renderHook(() => useFileActions());

    await act(async () => result.current.handleImportDxf());

    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(1);
    expect(
      useProjectStore.getState().data?.annotations.some((item) => item.id === 'DXF-NOTE'),
    ).toBe(true);
    expect(
      useProjectStore.getState().data?.constructionLines?.some((item) => item.id === 'DXF-CL') ??
        false,
    ).toBe(true);

    act(() => useProjectStore.temporal.getState().undo());
    expect(
      useProjectStore.getState().data?.annotations.some((item) => item.id === 'DXF-NOTE'),
    ).toBe(false);
    expect(
      useProjectStore.getState().data?.constructionLines?.some((item) => item.id === 'DXF-CL') ??
        false,
    ).toBe(false);
  });

  it('persists a new blank project as clean before the old dirty snapshot can recover', async () => {
    loadDirtyProject();
    render(<MainToolbar {...toolbarProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Blank Project' }));

    await waitFor(() =>
      expect(mocks.saveWorkspace).toHaveBeenCalledWith(expect.any(Object), false),
    );
    expect(useProjectStore.getState().isDirty).toBe(false);
  });

  it('persists a recent project as clean when replacing a dirty project', async () => {
    loadDirtyProject();
    const recent = cloneSample();
    recent.project.id = 'recent-project';
    recent.project.name = 'Recent design';
    const record = {
      id: recent.project.id,
      name: recent.project.name,
      updatedAt: Date.now(),
      data: recent,
    };
    mocks.listRecentProjects.mockResolvedValue([record]);
    render(<MainToolbar {...toolbarProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Recent projects' }));
    const recentName = await screen.findByText('Recent design');
    fireEvent.click(recentName.closest('button')!);

    await waitFor(() => expect(useProjectStore.getState().data?.project.id).toBe('recent-project'));
    expect(mocks.saveWorkspace).toHaveBeenLastCalledWith(recent, false);
  });
});
