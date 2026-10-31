/**
 * The graphic library: named copies of templates kept in the browser's
 * IndexedDB, next to (not instead of) the autosaved project in localStorage.
 *
 * A library entry is the same JSON a `.kcs` export writes (`exportProject`),
 * and opening one goes through the same validated `importProject` path, which
 * adds it as a new template tab — opening never replaces the current work.
 * IndexedDB holds far more than localStorage's ~5 MB, so graphics with
 * embedded images fit. Entries are this browser's only; Export moves them
 * between machines.
 */

export interface LibraryEntry {
  id: string;
  name: string;
  /** ms since epoch */
  updatedAt: number;
  layerCount: number;
  /** The `.kcs` JSON of the template. */
  scene: string;
}

/** A listing row: everything but the (possibly large) scene. */
export type LibraryEntrySummary = Omit<LibraryEntry, 'scene'>;

/** Where entries live; IndexedDB in the browser, a Map in tests. */
export interface LibraryBackend {
  all(): Promise<LibraryEntry[]>;
  get(id: string): Promise<LibraryEntry | undefined>;
  put(entry: LibraryEntry): Promise<void>;
  remove(id: string): Promise<void>;
}

const DB_NAME = 'kcs-library';
const STORE = 'graphics';

const request = <T,>(req: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
});

export const createIndexedDbBackend = (factory: IDBFactory = indexedDB): LibraryBackend => {
  let opened: Promise<IDBDatabase> | null = null;
  const db = () => {
    opened ??= new Promise((resolve, reject) => {
      const open = factory.open(DB_NAME, 1);
      open.onupgradeneeded = () => { open.result.createObjectStore(STORE, { keyPath: 'id' }); };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => { opened = null; reject(open.error ?? new Error('The library could not be opened')); };
    });
    return opened;
  };
  const store = async (mode: IDBTransactionMode) => (await db()).transaction(STORE, mode).objectStore(STORE);
  return {
    all: async () => request((await store('readonly')).getAll() as IDBRequest<LibraryEntry[]>),
    get: async (id) => request((await store('readonly')).get(id) as IDBRequest<LibraryEntry | undefined>),
    put: async (entry) => { await request((await store('readwrite')).put(entry)); },
    remove: async (id) => { await request((await store('readwrite')).delete(id)); },
  };
};

export const createMemoryBackend = (): LibraryBackend => {
  const entries = new Map<string, LibraryEntry>();
  return {
    all: async () => [...entries.values()].map((entry) => ({ ...entry })),
    get: async (id) => { const entry = entries.get(id); return entry && { ...entry }; },
    put: async (entry) => { entries.set(entry.id, { ...entry }); },
    remove: async (id) => { entries.delete(id); },
  };
};

const layerCountOf = (scene: string): number => {
  try {
    const layers = (JSON.parse(scene) as { layers?: unknown }).layers;
    return Array.isArray(layers) ? layers.length : 0;
  } catch {
    return 0;
  }
};

const newId = () => `lib_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const createProjectLibrary = (backend: LibraryBackend, now: () => number = Date.now) => ({
  /** Newest first, without the scenes. */
  list: async (): Promise<LibraryEntrySummary[]> => (await backend.all())
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(({ scene: _scene, ...summary }) => summary),
  /** Saves `scene` under `name`: a new entry, or over `id` when given. */
  save: async (name: string, scene: string, id?: string): Promise<LibraryEntrySummary> => {
    const entry: LibraryEntry = { id: id ?? newId(), name: name.trim() || 'Untitled', updatedAt: now(), layerCount: layerCountOf(scene), scene };
    await backend.put(entry);
    const { scene: _scene, ...summary } = entry;
    return summary;
  },
  /** The scene JSON of an entry, or `undefined` when it is gone. */
  open: async (id: string): Promise<{ name: string; scene: string } | undefined> => {
    const entry = await backend.get(id);
    return entry && { name: entry.name, scene: entry.scene };
  },
  duplicate: async (id: string): Promise<LibraryEntrySummary | undefined> => {
    const entry = await backend.get(id);
    if (!entry) return undefined;
    const copy: LibraryEntry = { ...entry, id: newId(), name: `${entry.name} copy`, updatedAt: now() };
    await backend.put(copy);
    const { scene: _scene, ...summary } = copy;
    return summary;
  },
  rename: async (id: string, name: string): Promise<void> => {
    const entry = await backend.get(id);
    if (entry && name.trim()) await backend.put({ ...entry, name: name.trim(), updatedAt: now() });
  },
  remove: (id: string): Promise<void> => backend.remove(id),
});

export type ProjectLibrary = ReturnType<typeof createProjectLibrary>;
