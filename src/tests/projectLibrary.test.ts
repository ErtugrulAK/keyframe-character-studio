import { describe, expect, it } from 'vitest';
import { createMemoryBackend, createProjectLibrary } from '../utils/persistence/projectLibrary';

const scene = (layers: number) => JSON.stringify({ version: 1, layers: Array.from({ length: layers }, (_, i) => ({ id: `l${i}` })), tracks: [] });

describe('project library', () => {
  const library = () => {
    let clock = 1000;
    return createProjectLibrary(createMemoryBackend(), () => (clock += 10));
  };

  it('saves, lists newest first without the scenes, and opens the exact JSON', async () => {
    const lib = library();
    const a = await lib.save('Lower third', scene(3));
    const b = await lib.save('Scoreboard', scene(5));
    const listed = await lib.list();
    expect(listed.map((entry) => entry.name)).toEqual(['Scoreboard', 'Lower third']);
    expect(listed[0]).not.toHaveProperty('scene');
    expect(listed.map((entry) => entry.layerCount)).toEqual([5, 3]);
    expect((await lib.open(a.id))?.scene).toBe(scene(3));
    expect(b.id).not.toBe(a.id);
  });

  it('saving with an id overwrites that entry', async () => {
    const lib = library();
    const a = await lib.save('Card', scene(1));
    await lib.save('Card v2', scene(2), a.id);
    const listed = await lib.list();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ id: a.id, name: 'Card v2', layerCount: 2 });
  });

  it('duplicates, renames and removes', async () => {
    const lib = library();
    const a = await lib.save('Ticker', scene(2));
    const copy = await lib.duplicate(a.id);
    expect(copy?.name).toBe('Ticker copy');
    await lib.rename(a.id, '  Ticker final ');
    await lib.remove(copy!.id);
    const listed = await lib.list();
    expect(listed.map((entry) => entry.name)).toEqual(['Ticker final']);
    expect(await lib.open(copy!.id)).toBeUndefined();
  });

  it('names an unnamed entry "Untitled" and counts no layers in unreadable JSON', async () => {
    const lib = library();
    const entry = await lib.save('   ', '{not json');
    expect(entry).toMatchObject({ name: 'Untitled', layerCount: 0 });
  });
});
