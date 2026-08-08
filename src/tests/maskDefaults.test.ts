import { describe, it, expect } from 'vitest';
import type { CharacterPart } from '../types/animator';
import { getDefaultMaskPoints } from '../utils/maskDefaults';

const makePart = (overrides: Partial<CharacterPart>): CharacterPart =>
  ({
    id: 'part_test',
    type: 'custom_diamond',
    name: 'Test',
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1,
    fillColor: '#ffffff',
    strokeColor: '#101218',
    ...overrides,
  }) as CharacterPart;

describe('getDefaultMaskPoints', () => {
  it('returns the diamond (rhombus) outline, not a bounding-box square', () => {
    const pts = getDefaultMaskPoints(makePart({ type: 'custom_diamond' }));
    expect(pts).toHaveLength(4);
    // Diamond vertices: top, right, bottom, left.
    expect(pts[0]).toEqual({ x: 0, y: -35 });
    expect(pts[1]).toEqual({ x: 35, y: 0 });
    expect(pts[2]).toEqual({ x: 0, y: 35 });
    expect(pts[3]).toEqual({ x: -35, y: 0 });
  });

  it('follows the triangle outline', () => {
    const pts = getDefaultMaskPoints(makePart({ type: 'custom_triangle' }));
    expect(pts).toHaveLength(3);
    expect(pts).toEqual([
      { x: 0, y: -35 },
      { x: 35, y: 25 },
      { x: -35, y: 25 },
    ]);
  });

  it('samples points on the circle radius', () => {
    const pts = getDefaultMaskPoints(makePart({ type: 'custom_circle' }));
    expect(pts.length).toBeGreaterThanOrEqual(12);
    for (const p of pts) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(30, 3);
    }
  });

  it('uses the freeform part vertices when available', () => {
    const points = [
      { x: 10, y: 10 },
      { x: 40, y: 10 },
      { x: 25, y: 45 },
    ];
    const pts = getDefaultMaskPoints(makePart({ type: 'custom_freeform', points }));
    expect(pts).toEqual(points);
  });

  it('falls back to a bounding-box rectangle for unknown types', () => {
    const pts = getDefaultMaskPoints(makePart({ type: 'custom_video' as CharacterPart['type'] }));
    expect(pts).toHaveLength(4);
    expect(pts[0].x).toBeLessThan(0);
    expect(pts[0].y).toBeLessThan(0);
    expect(pts[2].x).toBeGreaterThan(0);
    expect(pts[2].y).toBeGreaterThan(0);
  });

  it('keeps the legacy bbox fallback for freeforms without points', () => {
    const pts = getDefaultMaskPoints(makePart({ type: 'custom_freeform', points: [] }));
    expect(pts).toHaveLength(4);
  });
});
