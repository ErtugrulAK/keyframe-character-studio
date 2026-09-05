import { describe, expect, it } from 'vitest';
import type { CharacterPart } from '../types/animator';
import { bindParts, isRelationshipChainRelated, resolveBondGroup, resolveBoundPartners, unbindPart } from '../utils/partBinding';

const part = (id: string, overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id,
  type: 'custom_box',
  zIndex: 1,
  fillColor: '#fff',
  strokeColor: '#000',
  pivot: { x: 0, y: 0 },
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  ...overrides,
});

describe('part binding', () => {
  it('bonds the selected layers to each other symmetrically', () => {
    const bound = bindParts([part('a'), part('b')], ['a', 'b']);

    expect(bound.find((entry) => entry.id === 'a')?.boundPartIds).toEqual(['b']);
    expect(bound.find((entry) => entry.id === 'b')?.boundPartIds).toEqual(['a']);
    expect(resolveBoundPartners(bound, 'a').map((entry) => entry.id)).toEqual(['b']);
    expect(resolveBondGroup(bound, 'b')).toEqual(['b', 'a']);
  });

  it('reads the bond from either side of the list', () => {
    // A bond written by one side only still resolves both ways.
    const oneSided = [part('a', { boundPartIds: ['b'] }), part('b')];

    expect(resolveBoundPartners(oneSided, 'a').map((entry) => entry.id)).toEqual(['b']);
    expect(resolveBoundPartners(oneSided, 'b').map((entry) => entry.id)).toEqual(['a']);
  });

  it('replaces a previous bond when the group changes, and refuses fewer than two', () => {
    const parts = [part('a'), part('b'), part('c')];
    const bound = bindParts(parts, ['a', 'b']);
    const rebound = bindParts(bound, ['a', 'c']);

    expect(rebound.find((entry) => entry.id === 'a')?.boundPartIds).toEqual(['c']);
    expect(rebound.find((entry) => entry.id === 'c')?.boundPartIds).toEqual(['a']);
    // The layer left outside the new group keeps no stale link.
    expect(rebound.find((entry) => entry.id === 'b')?.boundPartIds).toBeUndefined();
    expect(resolveBoundPartners(rebound, 'b')).toEqual([]);

    expect(bindParts(parts, ['a'])).toBe(parts);
  });

  it('releases one layer from the whole bond', () => {
    const bound = bindParts([part('a'), part('b'), part('c')], ['a', 'b', 'c']);
    const released = unbindPart(bound, 'b');

    expect(released.find((entry) => entry.id === 'b')?.boundPartIds).toBeUndefined();
    expect(released.find((entry) => entry.id === 'a')?.boundPartIds).toEqual(['c']);
    expect(released.find((entry) => entry.id === 'c')?.boundPartIds).toEqual(['a']);
    expect(resolveBoundPartners(released, 'b')).toEqual([]);
  });

  it('detects an ancestor/descendant pair, which would move twice', () => {
    const parts = [part('parent'), part('child', { parentId: 'parent' }), part('grandchild', { parentId: 'child' }), part('free')];

    expect(isRelationshipChainRelated(parts, 'parent', 'child')).toBe(true);
    expect(isRelationshipChainRelated(parts, 'parent', 'grandchild')).toBe(true);
    expect(isRelationshipChainRelated(parts, 'child', 'grandchild')).toBe(true);
    expect(isRelationshipChainRelated(parts, 'parent', 'free')).toBe(false);
    expect(isRelationshipChainRelated(parts, 'parent', 'parent')).toBe(false);
  });

  it('treats a boolean group and its operands as one chain', () => {
    const parts = [part('group'), part('operand', { booleanGroupId: 'group' })];

    expect(isRelationshipChainRelated(parts, 'group', 'operand')).toBe(true);
  });

  it('does not loop when a chain is cyclic', () => {
    const parts = [part('a', { parentId: 'b' }), part('b', { parentId: 'a' })];

    expect(isRelationshipChainRelated(parts, 'a', 'b')).toBe(true);
  });
});
