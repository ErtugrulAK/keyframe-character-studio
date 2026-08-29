import { describe, expect, it } from 'vitest';
import type { CharacterPart, Track } from '../types/animator';
import { collectOwnedDeletionIds, deleteParts } from '../utils/partDeletion';

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

const track = (partId: string): Track => ({
  id: `${partId}-track`,
  partId,
  name: `${partId} track`,
  channels: {},
  keyframes: [],
});

describe('Boolean-aware part deletion', () => {
  const parts = [
    part('group', { booleanOperandIds: ['a', 'b'], booleanOperation: 'union' }),
    part('a', { booleanGroupId: 'group' }),
    part('b', { booleanGroupId: 'group' }),
    part('unrelated'),
  ];

  it('deletes a Boolean parent and all owned operands while preserving unrelated parts', () => {
    const result = deleteParts(parts, [track('group'), track('a'), track('b'), track('unrelated')], ['group']);

    expect(result.deletedIds).toEqual(['group', 'a', 'b']);
    expect(result.parts.map((item) => item.id)).toEqual(['unrelated']);
    expect(result.tracks.map((item) => item.partId)).toEqual(['unrelated']);
  });

  it('deletes a selected Boolean parent plus an unrelated part exactly once', () => {
    const result = deleteParts(parts, [], ['group', 'unrelated', 'a']);

    expect(result.parts).toEqual([]);
    expect(new Set(result.deletedIds).size).toBe(4);
  });

  it('deduplicates parent and operand requests and tolerates missing ownership references', () => {
    const malformed = part('malformed', { booleanOperandIds: ['a', 'missing', 'a'] });
    const ids = collectOwnedDeletionIds([...parts, malformed], ['a', 'group', 'malformed', 'missing']);

    expect([...ids]).toEqual(['a', 'group', 'malformed', 'b']);
  });


  it('cleans remaining Boolean references to deleted parts without deleting unrelated owners', () => {
    const malformedParent = part('unrelated-group', { booleanOperandIds: ['a', 'missing'] });
    const result = deleteParts([...parts, malformedParent], [track('a'), track('unrelated-group')], ['a']);
    const remaining = result.parts.find((item) => item.id === 'unrelated-group');

    expect(remaining).toBeDefined();
    expect(remaining?.booleanOperandIds).toBeUndefined();
    expect(result.parts.map((item) => item.id)).toContain('unrelated-group');
  });
  it('expands nested Boolean ownership without looping on malformed cycles', () => {
    const nested = [
      part('outer', { booleanOperandIds: ['inner'] }),
      part('inner', { booleanOperandIds: ['leaf'] }),
      part('leaf', { booleanGroupId: 'inner' }),
    ];
    const cyclic = [
      part('a', { booleanOperandIds: ['b'] }),
      part('b', { booleanOperandIds: ['a'] }),
    ];

    expect([...collectOwnedDeletionIds(nested, ['outer'])]).toEqual(['outer', 'inner', 'leaf']);
    expect([...collectOwnedDeletionIds(cyclic, ['a'])]).toEqual(['a', 'b']);
  });
});
