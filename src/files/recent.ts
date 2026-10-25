/**
 * Finished files, kept only on this device (IndexedDB) so they can be saved
 * again later. Each entry expires after RETAIN_DAYS; the user can turn keeping
 * off or clear everything in Settings.
 */
export interface RecentFile {
  id: string;
  name: string;
  type: string;
  size: number;
  /** Tool that made it, e.g. "merge". */
  tool: string;
  createdAt: number;
  blob: Blob;
}

export const RETAIN_DAYS = 7;
const DB = 'happy-pdf';
const STORE = 'recent';
const PREF = 'hp.keepRecent';
const CHANGED = 'hp:recent-changed';

export function keepRecent(): boolean {
  try { return localStorage.getItem(PREF) !== 'off'; } catch { return false; }
}
export function setKeepRecent(on: boolean) {
  try { if (on) localStorage.removeItem(PREF); else localStorage.setItem(PREF, 'off'); } catch { /* storage unavailable */ }
}

function open(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('createdAt', 'createdAt');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const announce = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED)); };
export const onRecentChange = (fn: () => void) => {
  window.addEventListener(CHANGED, fn);
  return () => window.removeEventListener(CHANGED, fn);
};

export async function addRecent(entry: Omit<RecentFile, 'id' | 'createdAt'>, now = Date.now()): Promise<RecentFile | null> {
  if (!keepRecent()) return null;
  const file: RecentFile = { ...entry, id: crypto.randomUUID(), createdAt: now };
  await run('readwrite', (store) => store.put(file));
  announce();
  return file;
}

/** Newest first, with expired entries removed. */
export async function listRecent(now = Date.now()): Promise<RecentFile[]> {
  await pruneRecent(now);
  const all = (await run<RecentFile[]>('readonly', (store) => store.getAll())) ?? [];
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function removeRecent(id: string) {
  await run('readwrite', (store) => store.delete(id));
  announce();
}

export async function clearRecent() {
  await run('readwrite', (store) => store.clear());
  announce();
}

export async function pruneRecent(now = Date.now()) {
  const cutoff = now - RETAIN_DAYS * 24 * 60 * 60 * 1000;
  await run('readwrite', (store) => {
    const range = IDBKeyRange.upperBound(cutoff, true);
    const cursor = store.index('createdAt').openCursor(range);
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) { c.delete(); c.continue(); }
    };
  });
}
