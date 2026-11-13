import { describe, expect, it } from 'vitest';
import type { CharacterPart } from '../types/animator';
import { orderTracksByLayerTree } from '../utils/layers/layerTreeOrder';

const part = (id: string, parentId?: string) => ({ id, name: id, type: 'custom_circle', zIndex: 1, baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, ...(parentId ? { parentId } : {}) } as CharacterPart);
const track = (partId: string) => ({ id: `t-${partId}`, partId });

describe('timeline rows follow the Layers tree', () => {
  it('lists a parent, then its children under it, with their depth', () => {
    // Stacking order puts the child first; the tree puts it under its parent.
    const parts = [part('child', 'parent'), part('parent'), part('other'), part('grandchild', 'child')];
    const tracks = [track('child'), track('other'), track('grandchild'), track('parent')];
    const { ordered, depth } = orderTracksByLayerTree(parts, tracks);
    expect(ordered.map((entry) => entry.partId)).toEqual(['parent', 'child', 'grandchild', 'other']);
    expect([...depth.entries()]).toEqual([['parent', 0], ['child', 1], ['grandchild', 2], ['other', 0]]);
  });

  it('keeps a track whose layer is missing, at the end', () => {
    const { ordered } = orderTracksByLayerTree([part('a')], [track('ghost'), track('a')]);
    expect(ordered.map((entry) => entry.partId)).toEqual(['a', 'ghost']);
  });
});
