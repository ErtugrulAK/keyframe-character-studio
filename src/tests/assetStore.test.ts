import { describe, expect, it } from 'vitest';
import { createAssetStore, createMemoryAssetBackend, isAssetRef } from '../utils/persistence/assetStore';

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
});
