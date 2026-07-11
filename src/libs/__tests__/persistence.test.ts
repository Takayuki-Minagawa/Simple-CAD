import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';
import {
  clearAutosave,
  listRecentProjects,
  loadAutosave,
  loadPreferences,
  removeRecentProject,
  savePreferences,
  saveWorkspace,
} from '../persistence';

function deleteWorkspaceDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('simple-cad-workspace');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Workspace database deletion was blocked'));
  });
}

describe.sequential('workspace persistence', () => {
  beforeEach(async () => {
    await deleteWorkspaceDatabase();
  });

  it('keeps dirty recovery separate from the clean recent-project snapshot', async () => {
    const data = sampleProject as unknown as ProjectData;
    await saveWorkspace(data, true);

    const autosave = await loadAutosave();
    expect(autosave?.dirty).toBe(true);
    expect(autosave?.data.project.id).toBe(data.project.id);
    expect(await listRecentProjects()).toEqual([]);

    await saveWorkspace(data, false);
    expect(await loadAutosave()).toBeNull();

    const recent = await listRecentProjects();
    expect(recent).toHaveLength(1);
    expect(recent[0].name).toBe(data.project.name);

    await removeRecentProject(data.project.id);
    expect(await listRecentProjects()).toEqual([]);
    await clearAutosave();
    expect(await loadAutosave()).toBeNull();
  });

  it('isolates autosaves by tab session and clears only the selected record', async () => {
    const tabA = structuredClone(sampleProject) as unknown as ProjectData;
    tabA.project.id = 'project-tab-a';
    tabA.project.name = 'Tab A';
    const tabB = structuredClone(sampleProject) as unknown as ProjectData;
    tabB.project.id = 'project-tab-b';
    tabB.project.name = 'Tab B';

    await saveWorkspace(tabA, true, 'session-a');
    await saveWorkspace(tabB, true, 'session-b');

    const recordA = await loadAutosave('session-a');
    const recordB = await loadAutosave('session-b');
    expect(recordA).toMatchObject({ projectId: 'project-tab-a', sessionId: 'session-a' });
    expect(recordB).toMatchObject({ projectId: 'project-tab-b', sessionId: 'session-b' });

    await clearAutosave(recordA!.key, 'session-a');
    expect((await loadAutosave('session-a'))?.key).not.toBe(recordA!.key);
    expect((await loadAutosave('session-b'))?.projectId).toBe('project-tab-b');
  });

  it('replaces only the current session snapshot when that tab switches projects', async () => {
    const abandoned = structuredClone(sampleProject) as unknown as ProjectData;
    abandoned.project.id = 'abandoned-project';
    const opened = structuredClone(sampleProject) as unknown as ProjectData;
    opened.project.id = 'opened-project';

    await saveWorkspace(abandoned, true, 'switching-session');
    await saveWorkspace(opened, false, 'switching-session');

    // A clean snapshot is kept in recents and removes the tab's dirty
    // recovery record instead of leaving a useless autosave behind.
    expect(await loadAutosave('switching-session')).toBeNull();
    expect((await listRecentProjects())[0]).toMatchObject({ id: 'opened-project' });
  });

  it('offers a dirty autosave from a session that is no longer active', async () => {
    const abandoned = structuredClone(sampleProject) as unknown as ProjectData;
    abandoned.project.id = 'crashed-project';
    await saveWorkspace(abandoned, true, 'crashed-session');

    const recovered = await loadAutosave('replacement-session');

    expect(recovered).toMatchObject({
      projectId: 'crashed-project',
      sessionId: 'crashed-session',
      dirty: true,
    });
  });

  it('round-trips editor preferences', async () => {
    const preferences = {
      locale: 'ja' as const,
      theme: 'dark' as const,
      viewMode: '3d' as const,
      statusDecimals: 3,
      statusUnit: 'm' as const,
      wireframe: true,
      orthographic: false,
    };
    await savePreferences(preferences);
    expect(await loadPreferences()).toEqual(preferences);
  });
});
