import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * Twee stores: de ruwe bestanden uit de repo (met hun sha, zodat de sync weet
 * wat er veranderd is) en een sleutel-waardeopslag voor alles wat lokaal blijft,
 * zoals de selectie en de afvinkstatus.
 */
export interface CachedFile {
  path: string;
  sha: string;
  text: string;
}

interface ReceptenDB extends DBSchema {
  files: { key: string; value: CachedFile };
  kv: { key: string; value: unknown };
}

const DB_NAME = 'recepten';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ReceptenDB>> | null = null;

export const getDb = (): Promise<IDBPDatabase<ReceptenDB>> => {
  dbPromise ??= openDB<ReceptenDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('files'))
        db.createObjectStore('files', { keyPath: 'path' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    },
  });
  return dbPromise;
};

export const readAllFiles = async (): Promise<CachedFile[]> => (await getDb()).getAll('files');

export const writeFiles = async (files: CachedFile[], removedPaths: string[]): Promise<void> => {
  const db = await getDb();
  const tx = db.transaction('files', 'readwrite');
  await Promise.all([
    ...files.map((file) => tx.store.put(file)),
    ...removedPaths.map((path) => tx.store.delete(path)),
    tx.done,
  ]);
};

export const kvGet = async <T>(key: string): Promise<T | undefined> =>
  (await getDb()).get('kv', key) as Promise<T | undefined>;

export const kvSet = async (key: string, value: unknown): Promise<void> => {
  await (await getDb()).put('kv', value, key);
};

export const kvDelete = async (key: string): Promise<void> => {
  await (await getDb()).delete('kv', key);
};

/** Alles wat lokaal is opgeslagen, voor de exportknop. */
export const kvDump = async (): Promise<Record<string, unknown>> => {
  const db = await getDb();
  const keys = await db.getAllKeys('kv');
  const values = await db.getAll('kv');
  return Object.fromEntries(keys.map((key, index) => [String(key), values[index]]));
};

export const kvRestore = async (data: Record<string, unknown>): Promise<void> => {
  const db = await getDb();
  const tx = db.transaction('kv', 'readwrite');
  await Promise.all([
    ...Object.entries(data).map(([key, value]) => tx.store.put(value, key)),
    tx.done,
  ]);
};
