import { describe, expect, it } from 'vitest';
import { ASSET_SESSION_LOCK, createAssetStore, createMemoryAssetBackend, isAssetRef, startAssetSession, type AssetLockManager } from '../utils/persistence/assetStore';

const photo = `data:image/png;base64,${'A'.repeat(4096)}`;
const other = `data:image/png;base64,${'B'.repeat(4096)}`;
const tiny = 'data:image/png;base64,AAAA';

const sceneWith = (...urls: string[]) => ({ version: 1, layers: urls.map((imageUrl, index) => ({ id: `l${index}`, type: 'custom_image', imageUrl })) });

describe('asset store', () => {
  it('names a stored medium by the SHA-256 of its data URL, once', async () => {
    const backend = createMemoryAssetBackend();
    const store = createAssetStore(backend);
    expect(await store.ingest(sceneWith(photo, photo).layers)).toBe(true);
    const stored = store.externalize(sceneWith(photo, photo));
    expect(stored.layers[0].imageUrl).toMatch(/^kcs-asset:sha256-[0-9a-f]{64}$/u);
    expect(stored.layers[1].imageUrl).toBe(stored.layers[0].imageUrl);
    expect(backend.entries.size).toBe(1);
    expect(await store.ingest(sceneWith(photo).layers)).toBe(false);
  });

  it('keeps a medium inline until its write is confirmed, and small ones always', async () => {
    const store = createAssetStore(createMemoryAssetBackend());
    const scene = sceneWith(photo, tiny);
    expect(store.externalize(scene)).toBe(scene);
    await store.ingest(scene.layers);
    const stored = store.externalize(scene);
    expect(isAssetRef(stored.layers[0].imageUrl)).toBe(true);
    expect(stored.layers[1].imageUrl).toBe(tiny);
    // The scene itself is never changed.
    expect(scene.layers[0].imageUrl).toBe(photo);
  });

  it('resolves stored references back to the same data URLs', async () => {
    const backend = createMemoryAssetBackend();
    const writer = createAssetStore(backend);
    await writer.ingest(sceneWith(photo, other).layers);
    const json = JSON.stringify(writer.externalize(sceneWith(photo, other)));

    const reader = createAssetStore(backend);
    const { json: resolved, missing } = await reader.internalize(json);
    expect(missing).toEqual([]);
    expect(JSON.parse(resolved)).toEqual(sceneWith(photo, other));
    // The reader already knows them: its next save keeps the references.
    expect(reader.externalize(sceneWith(photo)).layers[0].imageUrl).toBe(JSON.parse(json).layers[0].imageUrl);
  });

  it('keeps a reference whose bytes are missing instead of dropping it', async () => {
    const backend = createMemoryAssetBackend();
    const writer = createAssetStore(backend);
    await writer.ingest(sceneWith(photo).layers);
    const json = JSON.stringify(writer.externalize(sceneWith(photo)));
    backend.entries.clear();

    const { json: resolved, missing } = await createAssetStore(backend).internalize(json);
    expect(missing).toHaveLength(1);
    expect(JSON.parse(resolved).layers[0].imageUrl).toBe(missing[0]);
  });

  it('leaves media inline when the store cannot write or is unavailable', async () => {
    const failing = createAssetStore({ get: async () => undefined, put: async () => { throw new Error('quota'); } });
    expect(await failing.ingest(sceneWith(photo).layers)).toBe(false);
    expect(failing.externalize(sceneWith(photo)).layers[0].imageUrl).toBe(photo);

    const unavailable = createAssetStore(null);
    expect(await unavailable.ingest(sceneWith(photo).layers)).toBe(false);
    expect(unavailable.externalize(sceneWith(photo)).layers[0].imageUrl).toBe(photo);
  });

  it('deletes the stored media no saved text names, and forgets them', async () => {
    const backend = createMemoryAssetBackend();
    const store = createAssetStore(backend);
    await store.ingest(sceneWith(photo, other).layers);
    const kept = JSON.stringify(store.externalize(sceneWith(photo)));
    expect(await store.sweep([kept, 'unrelated'])).toBe(1);
    expect([...backend.entries.keys()]).toEqual([JSON.parse(kept).layers[0].imageUrl]);
    // The deleted medium is no longer named by a reference: it is saved inline until stored again.
    expect(store.externalize(sceneWith(other)).layers[0].imageUrl).toBe(other);
    expect(await store.sweep([kept])).toBe(0);
  });

  it('does not sweep while a medium is still being stored', async () => {
    let release = () => {};
    const started = new Promise<void>((markStarted) => { release = markStarted; });
    let finish = () => {};
    const backend = createMemoryAssetBackend();
    const slow = { ...backend, put: (ref: string, dataUrl: string) => { release(); return new Promise<void>((resolve) => { finish = () => { void backend.put(ref, dataUrl).then(resolve); }; }); } };
    const store = createAssetStore(slow);
    backend.entries.set('kcs-asset:sha256-' + '0'.repeat(64), other);
    const storing = store.ingest(sceneWith(photo).layers);
    expect(await store.sweep([])).toBe(0);
    await started;
    expect(await store.sweep([])).toBe(0);
    finish();
    await storing;
    expect(backend.entries.size).toBe(2);
  });
});

describe('asset session', () => {
  /** An in-process Web Locks model: one exclusive holder, or any number of shared ones. */
  const lockManager = () => {
    const held: Array<'shared' | 'exclusive'> = [];
    const manager: AssetLockManager = {
      request: async (_name, { mode = 'exclusive', ifAvailable }, callback) => {
        const free = mode === 'shared' ? !held.includes('exclusive') : held.length === 0;
        if (!free) return ifAvailable ? callback(null) : new Promise(() => {});
        held.push(mode);
        const result = callback({ name: _name, mode });
        if (result instanceof Promise) {
          // A shared session lock is never released; an exclusive one is released when its work ends.
          // A rejected callback releases the lock too, as Web Locks do.
          if (mode === 'exclusive') { try { await result; } finally { held.splice(held.indexOf('exclusive'), 1); } }
          return undefined;
        }
        if (mode === 'exclusive') held.splice(held.indexOf('exclusive'), 1);
        return result;
      },
    };
    return { manager, held };
  };

  it('sweeps when the tab is alone, then holds the shared session lock', async () => {
    const backend = createMemoryAssetBackend();
    backend.entries.set('kcs-asset:sha256-' + 'a'.repeat(64), photo);
    const { manager, held } = lockManager();
    expect(await startAssetSession(createAssetStore(backend), manager, () => [])).toBe(1);
    expect(held).toEqual(['shared']);
    expect(ASSET_SESSION_LOCK).toBe('kcs-assets-session');
  });

  it('does not sweep while another tab holds its session', async () => {
    const backend = createMemoryAssetBackend();
    backend.entries.set('kcs-asset:sha256-' + 'a'.repeat(64), photo);
    const { manager } = lockManager();
    await startAssetSession(createAssetStore(backend), manager, () => []);
    backend.entries.set('kcs-asset:sha256-' + 'b'.repeat(64), other);
    expect(await startAssetSession(createAssetStore(backend), manager, () => [])).toBe(0);
    expect(backend.entries.size).toBe(1);
  });

  it('does not sweep without Web Locks or when the saved texts cannot be read', async () => {
    const backend = createMemoryAssetBackend();
    backend.entries.set('kcs-asset:sha256-' + 'a'.repeat(64), photo);
    expect(await startAssetSession(createAssetStore(backend), null, () => [])).toBe(0);
    const { manager } = lockManager();
    expect(await startAssetSession(createAssetStore(backend), manager, () => { throw new Error('denied'); })).toBe(0);
    expect(backend.entries.size).toBe(1);
  });
});
