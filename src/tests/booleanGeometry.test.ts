import { describe, expect, it } from 'vitest';
import type { CharacterPart } from '../types/animator';
import { computeBooleanContours, dissolveBooleanGroup, isBooleanEligible, transformBooleanContours } from '../utils/booleanGeometry';

const part = (id: string, type: CharacterPart['type'], x: number, y: number): CharacterPart => ({
  id,
  name: id,
  type,
  zIndex: 1,
  fillColor: '#fff',
  strokeColor: '#000',
  pivot: { x: 0, y: 0 },
  baseTransform: { x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
});

describe('boolean geometry', () => {
  it('supports union and intersect for transformed closed shapes', () => {
    const a = part('a', 'custom_rect', 0, 0);
    const b = part('b', 'custom_rect', 40, 0);
    const union = computeBooleanContours('union', [a, b]);
    const intersect = computeBooleanContours('intersect', [a, b]);
    expect(union.length).toBeGreaterThan(0);
    expect(intersect.length).toBeGreaterThan(0);
  });
  it('recomputes when evaluated operand transforms change between frames', () => {
    const a = part('a', 'custom_rect', 0, 0);
    const b = part('b', 'custom_rect', 0, 0);
    const frameA = computeBooleanContours('subtract', [a, b], {
      a: { ...a.baseTransform, x: 0 },
      b: { ...b.baseTransform, x: 20 },
    });
    const frameB = computeBooleanContours('subtract', [a, b], {
      a: { ...a.baseTransform, x: 0 },
      b: { ...b.baseTransform, x: 80, rotation: 30, scaleX: 1.5 },
    });
    expect(frameA).not.toEqual(frameB);
  });

  it('keeps subtract operand order deterministic and supports exclude holes/contours', () => {
    const subject = part('subject', 'custom_box', 0, 0);
    const cutter = part('cutter', 'custom_circle', 0, 0);
    const subtract = computeBooleanContours('subtract', [subject, cutter]);
    const reverse = computeBooleanContours('subtract', [cutter, subject]);
    const exclude = computeBooleanContours('exclude', [subject, cutter]);
    expect(subtract).not.toEqual(reverse);
    expect(exclude.length).toBeGreaterThan(0);
  });
  it('applies group transforms without mutating authored contours', () => {
    const contours = [[{ x: 1, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 4 }]];
    const transformed = transformBooleanContours(contours, {
      x: 10, y: -5, rotation: 0, scaleX: 2, scaleY: 3, opacity: 1,
    });
    expect(transformed).toEqual([[
      { x: 12, y: 1 },
      { x: 16, y: 1 },
      { x: 16, y: 7 },
    ]]);
    expect(contours[0][0]).toEqual({ x: 1, y: 2 });
  });

  it('dissolves a Boolean group while preserving operand parts and tracks', () => {
    const a = { ...part('a', 'custom_rect', 0, 0), booleanGroupId: 'group' };
    const b = { ...part('b', 'custom_circle', 40, 0), booleanGroupId: 'group' };
    const group = {
      ...part('group', 'custom_freeform', 0, 0),
      booleanOperandIds: ['a', 'b'],
      booleanOperation: 'union' as const,
      booleanContours: [],
    };
    const tracks = [
      { id: 'a-track', partId: 'a', name: 'A', color: '#fff', visible: true, locked: false, channels: {} },
      { id: 'group-track', partId: 'group', name: 'Group', color: '#fff', visible: true, locked: false, channels: {} },
    ] as never[];
    const result = dissolveBooleanGroup([a, b, group], tracks, 'group');
    expect(result.parts.map((item) => item.id)).toEqual(['a', 'b']);
    expect(result.parts.every((item) => item.booleanGroupId === undefined)).toBe(true);
    expect(result.tracks.map((item) => item.partId)).toEqual(['a']);
  });

  it('rejects raster and open/freeform parts', () => {
    expect(isBooleanEligible(part('image', 'custom_image', 0, 0))).toBe(false);
    expect(isBooleanEligible(part('freeform', 'custom_freeform', 0, 0))).toBe(false);
    expect(isBooleanEligible(part('circle', 'custom_circle', 0, 0))).toBe(true);
  });
});
