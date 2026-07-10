import type { ProjectData } from '@/domain/structural/types';
import type { Locale } from '@/i18n';
import type { ThemeMode } from '@/app/store/editorStore';

const DB_NAME = 'simple-cad-workspace';
const DB_VERSION = 1;
const AUTOSAVE_STORE = 'autosave';
const RECENT_STORE = 'recentProjects';
const PREFERENCES_STORE = 'preferences';
const AUTOSAVE_KEY = 'latest';
const PREFERENCES_KEY = 'editor';

export interface AutosaveRecord {
  key: typeof AUTOSAVE_KEY;
  updatedAt: number;
  dirty: boolean;
  data: ProjectData;
}

export interface RecentProjectRecord {
  id: string;
  name: string;
  updatedAt: number;
  data: ProjectData;
}

export interface AppPreferences {
  locale: Locale;
  theme: ThemeMode;
  viewMode: '2d' | '3d';
  statusDecimals: number;
  statusUnit: 'mm' | 'm';
  wireframe: boolean;
  orthographic: boolean;
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined')
    return Promise.reject(new Error('IndexedDB is unavailable'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Could not open workspace database'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AUTOSAVE_STORE))
        db.createObjectStore(AUTOSAVE_STORE, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(RECENT_STORE))
        db.createObjectStore(RECENT_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(PREFERENCES_STORE))
        db.createObjectStore(PREFERENCES_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Workspace transaction aborted'));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Workspace transaction failed'));
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Workspace request failed'));
  });
}

let workspaceWriteQueue: Promise<void> = Promise.resolve();

async function writeWorkspace(data: ProjectData, dirty: boolean): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction([AUTOSAVE_STORE, RECENT_STORE], 'readwrite');
    const updatedAt = Date.now();
    transaction
      .objectStore(AUTOSAVE_STORE)
      .put({ key: AUTOSAVE_KEY, updatedAt, dirty, data } satisfies AutosaveRecord);
    transaction.objectStore(RECENT_STORE).put({
      id: data.project.id,
      name: data.project.name,
      updatedAt,
      data,
    } satisfies RecentProjectRecord);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
  await trimRecentProjects();
}

/** Serialize autosave writes so an older dirty snapshot can never overwrite a newer clean one. */
export function saveWorkspace(data: ProjectData, dirty: boolean): Promise<void> {
  const write = workspaceWriteQueue.catch(() => undefined).then(() => writeWorkspace(data, dirty));
  workspaceWriteQueue = write;
  return write;
}

export async function loadAutosave(): Promise<AutosaveRecord | null> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(AUTOSAVE_STORE, 'readonly');
    const value = await requestValue(
      transaction.objectStore(AUTOSAVE_STORE).get(AUTOSAVE_KEY) as IDBRequest<
        AutosaveRecord | undefined
      >,
    );
    return value ?? null;
  } finally {
    db.close();
  }
}

export async function clearAutosave(): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(AUTOSAVE_STORE, 'readwrite');
    transaction.objectStore(AUTOSAVE_STORE).delete(AUTOSAVE_KEY);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function listRecentProjects(): Promise<RecentProjectRecord[]> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(RECENT_STORE, 'readonly');
    const records = await requestValue(
      transaction.objectStore(RECENT_STORE).getAll() as IDBRequest<RecentProjectRecord[]>,
    );
    return records.sort((a, b) => b.updatedAt - a.updatedAt);
  } finally {
    db.close();
  }
}

export async function removeRecentProject(id: string): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(RECENT_STORE, 'readwrite');
    transaction.objectStore(RECENT_STORE).delete(id);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

async function trimRecentProjects(limit = 10): Promise<void> {
  const records = await listRecentProjects();
  if (records.length <= limit) return;
  const db = await openDatabase();
  try {
    const transaction = db.transaction(RECENT_STORE, 'readwrite');
    const store = transaction.objectStore(RECENT_STORE);
    for (const record of records.slice(limit)) store.delete(record.id);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function savePreferences(value: AppPreferences): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(PREFERENCES_STORE, 'readwrite');
    transaction.objectStore(PREFERENCES_STORE).put({ key: PREFERENCES_KEY, value });
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

function isAppPreferences(value: unknown): value is AppPreferences {
  if (!value || typeof value !== 'object') return false;
  const preferences = value as Record<string, unknown>;
  return (
    (preferences.locale === 'ja' || preferences.locale === 'en') &&
    (preferences.theme === 'light' || preferences.theme === 'dark') &&
    (preferences.viewMode === '2d' || preferences.viewMode === '3d') &&
    Number.isInteger(preferences.statusDecimals) &&
    Number(preferences.statusDecimals) >= 0 &&
    Number(preferences.statusDecimals) <= 4 &&
    (preferences.statusUnit === 'mm' || preferences.statusUnit === 'm') &&
    typeof preferences.wireframe === 'boolean' &&
    typeof preferences.orthographic === 'boolean'
  );
}

export async function loadPreferences(): Promise<AppPreferences | null> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(PREFERENCES_STORE, 'readonly');
    const record = await requestValue(
      transaction.objectStore(PREFERENCES_STORE).get(PREFERENCES_KEY) as IDBRequest<
        { key: string; value: AppPreferences } | undefined
      >,
    );
    return isAppPreferences(record?.value) ? record.value : null;
  } finally {
    db.close();
  }
}
