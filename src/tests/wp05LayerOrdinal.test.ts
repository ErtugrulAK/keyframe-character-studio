/**
 * WP-05 — the derived display ordinal: 1..N over the authored outliner order,
 * gapless after delete, unaffected by zIndex gaps, groups numbered with their
 * children, and never written back into the scene.
 */
import { describe, expect, it } from 'vitest';
import type { CharacterPart } from '../types/animator';
import { projectLayerOrdinals } from '../utils/layers/layerOrdinal';
import { deleteParts } from '../utils/layers/partDeletion';

const part = (id: string, overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id.toUpperCase(),
  type: 'custom_image',
  zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  ...overrides,
});

const numbered = (parts: CharacterPart[]) => [...projectLayerOrdinals(parts)].map(([id, ordinal]) => `${ordinal}:${id}`);

describe('WP-05 layer ordinal projection', () => {
  it('numbers five independent layers 1..5, then 1..4 after deleting C, with IDs unchanged', () => {
    const parts = ['a', 'b', 'c', 'd', 'e'].map((id, index) => part(id, { zIndex: 5 - index }));
    expect(numbered(parts)).toEqual(['1:a', '2:b', '3:c', '4:d', '5:e']);

    const tracks = parts.map((candidate) => ({ id: `t-${candidate.id}`, partId: candidate.id, name: candidate.id, channels: {} as never }));
    const deletion = deleteParts(parts, tracks as never, ['c']);
    expect(numbered(deletion.parts)).toEqual(['1:a', '2:b', '3:d', '4:e']);
    // zIndex is not renormalized: the gap stays, no phantom row appears.
    expect(deletion.parts.map((candidate) => candidate.zIndex)).toEqual([5, 4, 2, 1]);

    // A new layer gets a fresh identity and the next free position — C's
    // identity and number are not reused as a reference.
    const withF = [part('f', { zIndex: 6 }), ...deletion.parts];
    expect(numbered(withF)).toEqual(['1:f', '2:a', '3:b', '4:d', '5:e']);
  });

  it('numbers a container before its children, depth-first, in authored order', () => {
    const parts = [
      part('g', { isGroup: true, type: 'custom_rect' }),
      part('x'),
      part('g1', { parentId: 'g' }),
      part('bool', { type: 'custom_rect', booleanOperandIds: ['o1', 'o2'], booleanOperation: 'union' }),
      part('g2', { parentId: 'g' }),
      part('o1', { booleanGroupId: 'bool' }),
      part('o2', { booleanGroupId: 'bool' }),
    ];
    expect(numbered(parts)).toEqual(['1:g', '2:g1', '3:g2', '4:x', '5:bool', '6:o1', '7:o2']);
  });

  it('treats a missing parent as a root and survives a parent cycle', () => {
    expect(numbered([part('orphan', { parentId: 'gone' }), part('b')])).toEqual(['1:orphan', '2:b']);
    const cyclic = [part('p', { parentId: 'q' }), part('q', { parentId: 'p' }), part('r')];
    const ordinals = projectLayerOrdinals(cyclic);
    expect([...ordinals.values()].sort()).toEqual([1, 2, 3]);
    expect(ordinals.get('r')).toBeDefined();
  });

  it('is a pure projection: the parts are not mutated', () => {
    const parts = [part('a'), part('b')];
    const snapshot = structuredClone(parts);
    projectLayerOrdinals(parts);
    expect(parts).toEqual(snapshot);
  });
});
