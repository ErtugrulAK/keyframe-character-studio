import { describe, expect, it } from 'vitest';
import type { CharacterPart, Track } from '../types/animator';
import { contoursToPolygons, flattenBooleanGroup } from '../utils/geometry/booleanFlatten';
import { isBooleanEligible, partToWorldPolygons } from '../utils/geometry/booleanGeometry';

const pose = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
const square = (size: number, clockwise: boolean) => {
  const ring = [{ x: -size, y: -size }, { x: size, y: -size }, { x: size, y: size }, { x: -size, y: size }];
  return clockwise ? ring : [...ring].reverse();
};
const scene = () => {
  const parts = [
    { id: 'a', name: 'A', type: 'custom_rect', zIndex: 1, baseTransform: pose, booleanGroupId: 'g' },
    { id: 'b', name: 'B', type: 'custom_circle', zIndex: 2, baseTransform: pose, booleanGroupId: 'g' },
    { id: 'g', name: 'A + B · Union', type: 'custom_freeform', zIndex: 3, baseTransform: { ...pose, x: 40 }, booleanOperation: 'union', booleanOperandIds: ['a', 'b'], booleanContours: [square(10, true)], fillColor: '#f00' },
    { id: 'c', name: 'C', type: 'custom_rect', zIndex: 4, baseTransform: pose },
  ] as CharacterPart[];
  const tracks = parts.map((part) => ({ id: `t-${part.id}`, partId: part.id })) as Track[];
  return { parts, tracks };
};

describe('a Boolean result becomes its own shape', () => {
  it('one region: an editable path, the operands and their tracks go, the look and pose stay', () => {
    const { parts, tracks } = scene();
    const result = flattenBooleanGroup(parts, tracks, 'g', [square(10, true)])!;
    expect(result.parts.map((part) => part.id)).toEqual(['g', 'c']);
    expect(result.tracks.map((track) => track.partId)).toEqual(['g', 'c']);
    const shape = result.parts[0];
    expect(shape.booleanOperandIds).toBeUndefined();
    expect(shape.booleanContours).toBeUndefined();
    expect(shape.path?.points).toHaveLength(4);
    expect(shape.fillColor).toBe('#f00');
    expect(shape.baseTransform.x).toBe(40);
    // ...and it can join another Boolean.
    expect(isBooleanEligible(shape)).toBe(true);
  });

  it('a region with a hole stays a compound shape that still has its hole as a Boolean operand', () => {
    const { parts, tracks } = scene();
    const result = flattenBooleanGroup(parts, tracks, 'g', [square(20, true), square(5, false)])!;
    const shape = result.parts[0];
    expect(shape.booleanContours).toHaveLength(2);
    expect(isBooleanEligible(shape)).toBe(true);
    const polygons = partToWorldPolygons(shape, pose)!;
    // One polygon: an outer ring and its hole.
    expect(polygons).toHaveLength(1);
    expect(polygons[0]).toHaveLength(2);
  });

  it('separate islands are separate polygons', () => {
    const islandA = square(5, true);
    const islandB = square(5, true).map(({ x, y }) => ({ x: x + 50, y }));
    expect(contoursToPolygons([islandA, islandB])).toHaveLength(2);
  });

  it('refuses an empty result or a layer that is not a Boolean', () => {
    const { parts, tracks } = scene();
    expect(flattenBooleanGroup(parts, tracks, 'g', [])).toBeNull();
    expect(flattenBooleanGroup(parts, tracks, 'c', [square(1, true)])).toBeNull();
  });
});
