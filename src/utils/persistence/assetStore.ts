/**
 * Content-addressed media for the autosave.
 *
 * Images and videos live in the scene as data URLs, so a few photos filled the
 * browser's ~5 MB localStorage and the autosave failed with a quota error. The
 * autosave now keeps each medium once, in IndexedDB, under the SHA-256 of its
 * data URL, and the stored scene names it `kcs-asset:sha256-<hex>`.
 *
 * Only the autosave changes. The editor, history, exported .kcs files, the
 * graphic library and OGraf packages (`assets/`) keep the data URLs, so every
 * other path is untouched and a file still carries its own media.
 *
 * Safety: a medium is replaced by its reference only after IndexedDB confirmed
 * the write (the transaction completed); until then it stays inline. A stored
 * reference whose bytes are missing is kept as it is, never dropped, so a later
 * save cannot erase it.
 *
 * Collection: a stored medium no saved text names any more is deleted at
 * startup, and only by a tab that is alone. Every tab holds a shared session
 * lock for its lifetime; the sweep needs that lock exclusively, so it never
 * runs while another tab may still hold a medium in its undo history.
 */

export const ASSET_REF_PREFIX = 'kcs-asset:';

/** Media fields of a scene layer that can hold a data URL. */
const MEDIA_FIELDS = ['imageUrl', 'videoUrl'] as const;

/** Data URLs shorter than this stay inline: a reference would not save space. */
const MIN_EXTERNAL_LENGTH = 1024;

export interface AssetBackend {
  get(ref: string): Promise<string | undefined>;
  /** Resolves once the value is durably stored. */
  put(ref: string, dataUrl: string): Promise<void>;
  /** Every stored reference; a backend without it is never swept. */
  keys?(): Promise<string[]>;
  /** Resolves once the deletions are durable. */
  delete?(refs: string[]): Promise<void>;
}

const ASSET_REF_PATTERN = /kcs-asset:sha256-[0-9a-f]{64}/gu;

export const isAssetRef = (value: unknown): value is string => typeof value === 'string' && value.startsWith(ASSET_REF_PREFIX);

const isExternalizable = (value: unknown): value is string => typeof value === 'string' && value.startsWith('data:') && value.length >= MIN_EXTERNAL_LENGTH;

const sha256Hex = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

type SceneLike = { layers?: Array<Record<string, unknown>> };

export interface AssetStore {
  /** Stores every not-yet-stored medium of these layers; resolves true when one was added. */
  ingest(layers: ReadonlyArray<Record<string, unknown>>): Promise<boolean>;
  /** The scene as the autosave stores it: confirmed media replaced by their references. */
  externalize<T extends SceneLike>(scene: T): T;
  /** A stored scene with its references resolved; unresolved references are listed and kept. */
  internalize(json: string): Promise<{ json: string; missing: string[] }>;
  /** Deletes every stored medium none of these texts names; resolves the number deleted. */
  sweep(liveTexts: ReadonlyArray<string>): Promise<number>;
}

export const createAssetStore = (backend: AssetBackend | null): AssetStore => {
  /** data URL -> reference, for media IndexedDB has confirmed. */
  const confirmed = new Map<string, string>();
  const pending = new Map<string, Promise<void>>();

  const ingestOne = (dataUrl: string): Promise<void> => {
    let running = pending.get(dataUrl);
    if (!running) {
      running = (async () => {
        const ref = `${ASSET_REF_PREFIX}sha256-${await sha256Hex(dataUrl)}`;
        await backend!.put(ref, dataUrl);
        confirmed.set(dataUrl, ref);
      })().finally(() => pending.delete(dataUrl));
      pending.set(dataUrl, running);
    }
    return running;
  };

  return {
    async ingest(layers) {
      if (!backend) return false;
      const fresh = new Set<string>();
      for (const layer of layers) {
        for (const field of MEDIA_FIELDS) {
          const value = layer[field];
          if (isExternalizable(value) && !confirmed.has(value)) fresh.add(value);
        }
      }
      if (fresh.size === 0) return false;
      const results = await Promise.allSettled([...fresh].map(ingestOne));
      for (const result of results) if (result.status === 'rejected') console.warn('[Assets] A medium stays inline in the autosave:', result.reason);
      return results.some((result) => result.status === 'fulfilled');
    },

    externalize(scene) {
      if (!scene.layers || confirmed.size === 0) return scene;
      let changed = false;
      const layers = scene.layers.map((layer) => {
        let next = layer;
        for (const field of MEDIA_FIELDS) {
          const value = layer[field];
          const ref = typeof value === 'string' ? confirmed.get(value) : undefined;
          if (ref) {
            if (next === layer) next = { ...layer };
            next[field] = ref;
            changed = true;
          }
        }
        return next;
      });
      return changed ? { ...scene, layers } : scene;
    },

    async internalize(json) {
      if (!json.includes(ASSET_REF_PREFIX)) return { json, missing: [] };
      const scene = JSON.parse(json) as SceneLike;
      const missing: string[] = [];
      for (const layer of scene.layers ?? []) {
        for (const field of MEDIA_FIELDS) {
          const ref = layer[field];
          if (!isAssetRef(ref)) continue;
          const dataUrl = backend ? await backend.get(ref).catch(() => undefined) : undefined;
          if (dataUrl === undefined) {
            missing.push(ref);
            continue;
          }
          layer[field] = dataUrl;
          // Resolved media are stored already: the next save keeps the reference.
          confirmed.set(dataUrl, ref);
        }
      }
      return { json: JSON.stringify(scene), missing };
    },

    async sweep(liveTexts) {
      if (!backend?.keys || !backend.delete || pending.size > 0) return 0;
      const live = new Set(liveTexts.flatMap((text) => text.match(ASSET_REF_PATTERN) ?? []));
      const unused = (await backend.keys()).filter((ref) => isAssetRef(ref) && !live.has(ref));
      if (unused.length === 0) return 0;
      await backend.delete(unused);
      const deleted = new Set(unused);
      for (const [dataUrl, ref] of confirmed) if (deleted.has(ref)) confirmed.delete(dataUrl);
      return unused.length;
    },
  };
};

/** The part of the Web Locks API the collection uses. */
export interface AssetLockManager {
  request(name: string, options: { mode?: 'shared' | 'exclusive'; ifAvailable?: boolean }, callback: (lock: unknown) => unknown): Promise<unknown>;
}

export const ASSET_SESSION_LOCK = 'kcs-assets-session';

/**
 * Sweeps unused media when no other tab is open, then holds the shared session
 * lock until the page closes. Resolves once this tab may store media. Without
 * Web Locks no tab can prove it is alone, so nothing is swept.
 */
export const startAssetSession = async (store: AssetStore, locks: AssetLockManager | null, readLiveTexts: () => string[]): Promise<number> => {
  if (!locks) return 0;
  let removed = 0;
  try {
    await locks.request(ASSET_SESSION_LOCK, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
      if (lock) removed = await store.sweep(readLiveTexts());
    });
  } catch (error) {
    console.warn('[Assets] Unused media were not collected:', error);
  }
  await new Promise<void>((resolve) => {
    void locks.request(ASSET_SESSION_LOCK, { mode: 'shared' }, () => {
      resolve();
      return new Promise(() => {});
    }).catch(() => resolve());
  });
  return removed;
};

const DB_NAME = 'kcs-assets';
const STORE = 'assets';

export const createIndexedDbAssetBackend = (factory: IDBFactory | undefined = globalThis.indexedDB): AssetBackend | null => {
  if (!factory || typeof crypto === 'undefined' || !crypto.subtle) return null;
  let opened: Promise<IDBDatabase> | null = null;
  const db = () => {
    opened ??= new Promise((resolve, reject) => {
      const open = factory.open(DB_NAME, 1);
      open.onupgradeneeded = () => { open.result.createObjectStore(STORE); };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => { opened = null; reject(open.error ?? new Error('The asset store could not be opened')); };
    });
    return opened;
  };
  return {
    get: async (ref) => {
      const request = (await db()).transaction(STORE, 'readonly').objectStore(STORE).get(ref) as IDBRequest<string | undefined>;
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },
    put: async (ref, dataUrl) => {
      const transaction = (await db()).transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(dataUrl, ref);
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error ?? new Error('The asset write was aborted'));
      });
    },
    keys: async () => {
      const request = (await db()).transaction(STORE, 'readonly').objectStore(STORE).getAllKeys();
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result.filter((key): key is string => typeof key === 'string'));
        request.onerror = () => reject(request.error);
      });
    },
    delete: async (refs) => {
      const transaction = (await db()).transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      for (const ref of refs) store.delete(ref);
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error ?? new Error('The asset deletion was aborted'));
      });
    },
  };
};

export const createMemoryAssetBackend = (): AssetBackend & { entries: Map<string, string> } => {
  const entries = new Map<string, string>();
  return {
    entries,
    get: async (ref) => entries.get(ref),
    put: async (ref, dataUrl) => { entries.set(ref, dataUrl); },
    keys: async () => [...entries.keys()],
    delete: async (refs) => { for (const ref of refs) entries.delete(ref); },
  };
};
