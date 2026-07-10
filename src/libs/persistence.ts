import type { ProjectData } from '@/domain/structural/types';
import type { Locale } from '@/i18n';
import type { ThemeMode } from '@/app/store/editorStore';

const DB_NAME = 'simple-cad-workspace';
const DB_VERSION = 1;
const AUTOSAVE_STORE = 'autosave';
const RECENT_STORE = 'recentProjects';
const PREFERENCES_STORE = 'preferences';
const LEGACY_AUTOSAVE_KEY = 'latest';
const AUTOSAVE_KEY_PREFIX = 'workspace';
const AUTOSAVE_PRESENCE_CHANNEL = 'simple-cad-autosave-presence';
const SESSION_STORAGE_KEY = 'simple-cad-workspace-session';
const SESSION_LOCK_PREFIX = 'simple-cad-autosave-session:';
const AUTOSAVE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_AUTOSAVE_RECORDS = 20;
const PREFERENCES_KEY = 'editor';

export interface AutosaveRecord {
  key: string;
  projectId: string;
  sessionId: string;
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
let inMemorySessionId: string | null = null;
let presenceChannel: BroadcastChannel | null | undefined;
let claimedSessionPromise: Promise<string> | null = null;

function createSessionId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * A logical tab identifier, stable across reload/crash restoration. A Web
 * Lock (or BroadcastChannel fallback) detects the one case where browsers copy
 * this value into a duplicated/opener-created tab and rotates the clone before
 * it can write.
 */
export function getWorkspaceSessionId(): string {
  if (inMemorySessionId) return inMemorySessionId;
  try {
    const existing = globalThis.sessionStorage?.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      inMemorySessionId = existing;
      return existing;
    }
    const created = createSessionId();
    globalThis.sessionStorage?.setItem(SESSION_STORAGE_KEY, created);
    inMemorySessionId = created;
    return created;
  } catch {
    inMemorySessionId = createSessionId();
    return inMemorySessionId;
  }
}

function replaceWorkspaceSessionId(): string {
  const created = createSessionId();
  inMemorySessionId = created;
  try {
    globalThis.sessionStorage?.setItem(SESSION_STORAGE_KEY, created);
  } catch {
    // The in-memory ID still prevents this page instance from colliding.
  }
  return created;
}

type PresenceMessage =
  | { type: 'query'; requestId: string }
  | { type: 'active'; requestId: string; sessionId: string };

function getPresenceChannel(): BroadcastChannel | null {
  if (presenceChannel !== undefined) return presenceChannel;
  if (typeof BroadcastChannel === 'undefined') {
    presenceChannel = null;
    return null;
  }
  const channel = new BroadcastChannel(AUTOSAVE_PRESENCE_CHANNEL);
  // Node exposes BroadcastChannel during tests; do not let it retain the test
  // process. Browsers simply ignore this optional method.
  (channel as BroadcastChannel & { unref?: () => void }).unref?.();
  channel.addEventListener('message', (event: MessageEvent<PresenceMessage>) => {
    if (event.data?.type !== 'query') return;
    channel.postMessage({
      type: 'active',
      requestId: event.data.requestId,
      sessionId: getWorkspaceSessionId(),
    } satisfies PresenceMessage);
  });
  presenceChannel = channel;
  return channel;
}

async function collectActiveSessions(): Promise<Set<string>> {
  const active = new Set<string>();
  const channel = getPresenceChannel();
  if (!channel) return active;

  const requestId = createSessionId();
  const listener = (event: MessageEvent<PresenceMessage>) => {
    if (event.data?.type === 'active' && event.data.requestId === requestId) {
      active.add(event.data.sessionId);
    }
  };
  channel.addEventListener('message', listener);
  channel.postMessage({ type: 'query', requestId } satisfies PresenceMessage);
  await new Promise((resolve) => globalThis.setTimeout(resolve, 75));
  channel.removeEventListener('message', listener);
  return active;
}

function getLockManager(): LockManager | null {
  return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks : null;
}

function holdSessionLock(
  locks: LockManager,
  sessionId: string,
): Promise<'held' | 'unavailable' | 'error'> {
  return new Promise((resolve) => {
    let settled = false;
    void locks
      .request(
        `${SESSION_LOCK_PREFIX}${sessionId}`,
        { ifAvailable: true },
        async (lock) => {
          if (!lock) {
            settled = true;
            resolve('unavailable');
            return;
          }
          settled = true;
          resolve('held');
          // The browser releases the lock when this page is destroyed. Keeping
          // the callback pending makes liveness independent of timer throttling.
          await new Promise<void>(() => undefined);
        },
      )
      .catch(() => {
        if (!settled) resolve('error');
      });
  });
}

async function claimSessionWithPresenceFallback(): Promise<string> {
  const active = await collectActiveSessions();
  const candidate = getWorkspaceSessionId();
  return active.has(candidate) ? replaceWorkspaceSessionId() : candidate;
}

async function claimWorkspaceSession(): Promise<string> {
  const locks = getLockManager();
  if (locks) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = getWorkspaceSessionId();
      const result = await holdSessionLock(locks, candidate);
      if (result === 'held') return candidate;
      if (result === 'error') return claimSessionWithPresenceFallback();
      replaceWorkspaceSessionId();
    }
    throw new Error('Could not allocate an isolated autosave session');
  }

  // Compatibility fallback: another live tab responds with the copied token,
  // in which case this clone rotates to a fresh value before its first write.
  return claimSessionWithPresenceFallback();
}

function getClaimedWorkspaceSessionId(): Promise<string> {
  claimedSessionPromise ??= claimWorkspaceSession();
  return claimedSessionPromise;
}

async function activeAutosaveSessions(
  candidates: AutosaveRecord[],
  currentSessionId: string,
): Promise<Set<string>> {
  const active = new Set([currentSessionId]);
  const locks = getLockManager();
  const sessionIds = [...new Set(candidates.map((record) => record.sessionId))]
    .filter((sessionId) => sessionId !== currentSessionId);

  if (!locks) {
    for (const sessionId of await collectActiveSessions()) active.add(sessionId);
    return active;
  }

  try {
    await Promise.all(
      sessionIds.map(async (sessionId) => {
        let available = false;
        await locks.request(
          `${SESSION_LOCK_PREFIX}${sessionId}`,
          { ifAvailable: true },
          (lock) => {
            available = Boolean(lock);
          },
        );
        if (!available) active.add(sessionId);
      }),
    );
  } catch {
    for (const sessionId of await collectActiveSessions()) active.add(sessionId);
  }
  return active;
}

function autosaveKey(sessionId: string, projectId: string): string {
  return `${AUTOSAVE_KEY_PREFIX}:${encodeURIComponent(sessionId)}:${encodeURIComponent(projectId)}`;
}

async function writeWorkspace(
  data: ProjectData,
  dirty: boolean,
  sessionId: string,
): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction([AUTOSAVE_STORE, RECENT_STORE], 'readwrite');
    const done = transactionDone(transaction);
    const updatedAt = Date.now();
    const autosaves = transaction.objectStore(AUTOSAVE_STORE);
    const existingRequest = autosaves.getAll() as IDBRequest<
      Array<Partial<AutosaveRecord> & { key: string }>
    >;
    existingRequest.onsuccess = () => {
      // A tab owns one current document snapshot. Switching documents replaces
      // only that tab's record and never a concurrently open tab's autosave.
      const now = Date.now();
      const retained = existingRequest.result
        .filter((record) => record.key !== LEGACY_AUTOSAVE_KEY && record.sessionId !== sessionId)
        .filter(
          (record) =>
            record.dirty === true &&
            typeof record.updatedAt === 'number' &&
            now - record.updatedAt <= AUTOSAVE_RETENTION_MS,
        )
        .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
      const retainedKeys = new Set(
        retained.slice(0, Math.max(0, MAX_AUTOSAVE_RECORDS - (dirty ? 1 : 0)))
          .map((record) => record.key),
      );
      for (const record of existingRequest.result) {
        if (!retainedKeys.has(record.key)) {
          autosaves.delete(record.key);
        }
      }
      // Clean documents already live in recentProjects. Keeping a clean
      // autosave only creates stale records and cannot help crash recovery.
      if (dirty) {
        autosaves.put({
          key: autosaveKey(sessionId, data.project.id),
          projectId: data.project.id,
          sessionId,
          updatedAt,
          dirty: true,
          data,
        } satisfies AutosaveRecord);
      }
      // Recent projects represent an explicitly opened/saved clean snapshot,
      // not whichever dirty tab happened to autosave last.
      if (!dirty) {
        const recentProjects = transaction.objectStore(RECENT_STORE);
        recentProjects.put({
          id: data.project.id,
          name: data.project.name,
          updatedAt,
          data,
        } satisfies RecentProjectRecord);
        const recentRequest = recentProjects.getAll() as IDBRequest<RecentProjectRecord[]>;
        recentRequest.onsuccess = () => {
          const ordered = recentRequest.result.sort((left, right) => right.updatedAt - left.updatedAt);
          for (const record of ordered.slice(10)) recentProjects.delete(record.id);
        };
        recentRequest.onerror = () => transaction.abort();
      }
    };
    existingRequest.onerror = () => transaction.abort();
    await done;
  } finally {
    db.close();
  }
}

/** Serialize autosave writes so an older dirty snapshot can never overwrite a newer clean one. */
export function saveWorkspace(
  data: ProjectData,
  dirty: boolean,
  sessionId?: string,
): Promise<void> {
  const write = workspaceWriteQueue
    .catch(() => undefined)
    .then(async () => writeWorkspace(data, dirty, sessionId ?? await getClaimedWorkspaceSessionId()));
  workspaceWriteQueue = write;
  return write;
}

export async function loadAutosave(
  sessionId?: string,
): Promise<AutosaveRecord | null> {
  const resolvedSessionId = sessionId ?? await getClaimedWorkspaceSessionId();
  const db = await openDatabase();
  try {
    const transaction = db.transaction(AUTOSAVE_STORE, 'readonly');
    const records = await requestValue(
      transaction.objectStore(AUTOSAVE_STORE).getAll() as IDBRequest<
        Array<Partial<AutosaveRecord> & { key: string; data?: ProjectData }>
      >,
    );
    const candidates = records.flatMap((record): AutosaveRecord[] => {
      if (!record.data || typeof record.updatedAt !== 'number' || typeof record.dirty !== 'boolean') {
        return [];
      }
      return [{
        key: record.key,
        projectId: record.projectId ?? record.data.project.id,
        sessionId: record.sessionId ?? resolvedSessionId,
        updatedAt: record.updatedAt,
        dirty: record.dirty,
        data: record.data,
      }];
    });
    const activeSessions = await activeAutosaveSessions(candidates, resolvedSessionId);
    const latest = (items: AutosaveRecord[]) =>
      items.sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null;
    const own = latest(
      candidates.filter((record) => record.dirty && record.sessionId === resolvedSessionId),
    );
    if (own) return own;

    // A new page instance can adopt the newest dirty record whose owner no
    // longer responds. Active tabs are excluded, so opening another tab never
    // presents or overwrites work that is still being edited there.
    return latest(
      candidates.filter(
        (record) =>
          record.dirty &&
          (record.key === LEGACY_AUTOSAVE_KEY || !activeSessions.has(record.sessionId)),
      ),
    );
  } finally {
    db.close();
  }
}

export async function clearAutosave(
  key?: string,
  sessionId?: string,
): Promise<void> {
  const resolvedSessionId = sessionId ?? await getClaimedWorkspaceSessionId();
  const db = await openDatabase();
  try {
    const transaction = db.transaction(AUTOSAVE_STORE, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(AUTOSAVE_STORE);
    if (key) {
      store.delete(key);
    } else {
      const recordsRequest = store.getAll() as IDBRequest<
        Array<Partial<AutosaveRecord> & { key: string }>
      >;
      recordsRequest.onsuccess = () => {
        for (const record of recordsRequest.result) {
          if (record.key === LEGACY_AUTOSAVE_KEY || record.sessionId === resolvedSessionId) {
            store.delete(record.key);
          }
        }
      };
      recordsRequest.onerror = () => transaction.abort();
    }
    await done;
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
