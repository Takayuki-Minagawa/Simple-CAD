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

  it('stores an autosave and updates the recent-project list', async () => {
    const data = sampleProject as unknown as ProjectData;
    await saveWorkspace(data, true);

    const autosave = await loadAutosave();
    expect(autosave?.dirty).toBe(true);
    expect(autosave?.data.project.id).toBe(data.project.id);

    const recent = await listRecentProjects();
    expect(recent).toHaveLength(1);
    expect(recent[0].name).toBe(data.project.name);

    await removeRecentProject(data.project.id);
    expect(await listRecentProjects()).toEqual([]);
    await clearAutosave();
    expect(await loadAutosave()).toBeNull();
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
