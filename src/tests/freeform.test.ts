import { describe, it, expect } from 'vitest';
import {
  buildFreeformPath,
  freeformVertexToDisplay,
  freeformVertexToLocal,
  getFreeformBounds,
  getFreeformExtents,
  getFreeformPerimeter,
  getFreeformVertexWorldPositions,
  hasValidFreeformPoints,
  normalizeFreeformPoints,
  simplifyFreeformPoints,
  MIN_FREEFORM_POINTS,
} from '../utils/freeform';

describe('freeform utils', () => {
  describe('buildFreeformPath', () => {
    it('builds a closed polygon path from points', () => {
      const d = buildFreeformPath([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]);
      expect(d).toBe('M 0 0 L 10 0 L 10 10 Z');
    });

    it('returns empty string for fewer than 2 points', () => {
      expect(buildFreeformPath([])).toBe('');
      expect(buildFreeformPath([{ x: 1, y: 1 }])).toBe('');
      expect(buildFreeformPath(undefined as any)).toBe('');
    });

    it('omits the closing Z when closed=false', () => {
      const d = buildFreeformPath([{ x: 0, y: 0 }, { x: 5, y: 5 }], false);
      expect(d).toBe('M 0 0 L 5 5');
    });
  });

  describe('getFreeformBounds', () => {
    it('computes symmetric half extents from the bounding box', () => {
      const { halfW, halfH } = getFreeformBounds([
        { x: 10, y: -10 },
        { x: 30, y: -10 },
        { x: 30, y: 10 },
        { x: 10, y: 10 },
      ]);
      expect(halfW).toBe(10);
      expect(halfH).toBe(10);
    });

    it('falls back to a default for empty input', () => {
      expect(getFreeformBounds([])).toEqual({ halfW: 32, halfH: 32 });
    });
  });

  describe('getFreeformExtents', () => {
    it('finds the min/max of the points', () => {
      const ext = getFreeformExtents([
        { x: -5, y: 2 },
        { x: 8, y: -3 },
        { x: 0, y: 7 },
      ]);
      expect(ext).toEqual({ minX: -5, minY: -3, maxX: 8, maxY: 7 });
    });
  });

  describe('getFreeformPerimeter', () => {
    it('sums edges including the closing edge', () => {
      // Square of side 10 -> perimeter 40
      const perimeter = getFreeformPerimeter([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ]);
      expect(perimeter).toBeCloseTo(40, 5);
    });

    it('returns 0 for degenerate input', () => {
      expect(getFreeformPerimeter([])).toBe(0);
      expect(getFreeformPerimeter([{ x: 1, y: 1 }])).toBe(0);
    });
  });

  describe('hasValidFreeformPoints', () => {
    it('requires at least 3 points', () => {
      expect(hasValidFreeformPoints(undefined)).toBe(false);
      expect(hasValidFreeformPoints([])).toBe(false);
      expect(hasValidFreeformPoints([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
      expect(hasValidFreeformPoints([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }])).toBe(true);
    });

    it('exports a sensible minimum constant', () => {
      expect(MIN_FREEFORM_POINTS).toBe(3);
    });
  });

  describe('normalizeFreeformPoints', () => {
    it('shifts the bounding box center to the origin', () => {
      const { points, centerX, centerY } = normalizeFreeformPoints([
        { x: 10, y: 10 },
        { x: 30, y: 10 },
        { x: 30, y: 30 },
        { x: 10, y: 30 },
      ]);
      expect(centerX).toBe(20);
      expect(centerY).toBe(20);
      expect(points).toEqual([
        { x: -10, y: -10 },
        { x: 10, y: -10 },
        { x: 10, y: 10 },
        { x: -10, y: 10 },
      ]);
    });
  });

  describe('simplifyFreeformPoints', () => {
    it('thins consecutive points closer than the minimum distance', () => {
      const simplified = simplifyFreeformPoints(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 0 }, // duplicate
          { x: 10, y: 5 },
        ],
        3
      );
      expect(simplified).toEqual([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 5 },
      ]);
    });

    it('returns empty array for empty input and keeps single points', () => {
      expect(simplifyFreeformPoints([])).toEqual([]);
      expect(simplifyFreeformPoints([{ x: 1, y: 1 }])).toEqual([{ x: 1, y: 1 }]);
    });
  });

  describe('freeformVertexToDisplay / freeformVertexToLocal', () => {
    const baseTransform = { x: 120, y: 80, scaleX: 1, scaleY: 1, rotation: 0 };

    it('converts local points to canvas-center-relative display coords (Y-up)', () => {
      // Local (45, 30) with shape center (120, 80): display = (165, -110)
      expect(freeformVertexToDisplay({ x: 45, y: 30 }, baseTransform)).toEqual({ x: 165, y: -110 });
    });

    it('typing X=0 moves the vertex onto the canvas center line (round-trip)', () => {
      const local = { x: 45, y: 30 };
      const disp = freeformVertexToDisplay(local, baseTransform);
      // User types X = 0, keeping the displayed Y
      const edited = freeformVertexToLocal(0, disp.y, baseTransform);
      // New display X must be exactly 0
      expect(freeformVertexToDisplay(edited, baseTransform).x).toBeCloseTo(0, 5);
      // The marker world x lands on the canvas center (300 + t.x + localX = 300)
      expect(300 + baseTransform.x + edited.x).toBeCloseTo(300, 5);
    });

    it('round-trips local -> display -> local for scaled shapes', () => {
      const scaled = { x: 40, y: -55, scaleX: 1.5, scaleY: 0.5, rotation: 0 };
      const local = { x: 10, y: 20 };
      const disp = freeformVertexToDisplay(local, scaled);
      const back = freeformVertexToLocal(disp.x, disp.y, scaled);
      expect(back.x).toBeCloseTo(local.x, 5);
      expect(back.y).toBeCloseTo(local.y, 5);
    });

    it('round-trips for rotated shapes', () => {
      const rotated = { x: 200, y: -100, scaleX: 1, scaleY: 1, rotation: 90 };
      const local = { x: 10, y: -25 };
      const disp = freeformVertexToDisplay(local, rotated);
      const back = freeformVertexToLocal(disp.x, disp.y, rotated);
      expect(back.x).toBeCloseTo(local.x, 5);
      expect(back.y).toBeCloseTo(local.y, 5);
    });

    it('mirrors vertex coordinates for a Mirror Y copy (negative scaleX)', () => {
      // Mirror Y duplicate: x -> -x, scaleX -> -scaleX, rotation -> -rotation
      const mirrored = { x: -109.16, y: 148.79, scaleX: -1, scaleY: 1, rotation: 0 };
      const local = { x: -44.86, y: -59.81 };
      const disp = freeformVertexToDisplay(local, mirrored);
      // x must flip: tx + p.x * (-1) — NOT collapsed to tx (regression guard)
      expect(disp.x).toBeCloseTo(-109.16 + 44.86, 3);
      expect(disp.x).not.toBeCloseTo(-109.16, 1);
      expect(disp.y).toBeCloseTo(-(148.79 - 59.81), 3);
      // Editing back must restore the original local point
      const back = freeformVertexToLocal(disp.x, disp.y, mirrored);
      expect(back.x).toBeCloseTo(local.x, 5);
      expect(back.y).toBeCloseTo(local.y, 5);
    });
  });

  describe('getFreeformVertexWorldPositions', () => {
    it('maps local points through scale and translation (no rotation)', () => {
      const world = getFreeformVertexWorldPositions(
        [
          { x: -10, y: -10 },
          { x: 10, y: 10 },
        ],
        100,
        200,
        2,
        2,
        0
      );
      expect(world).toEqual([
        { x: 80, y: 180 },
        { x: 120, y: 220 },
      ]);
    });

    it('applies rotation after scaling (SVG order)', () => {
      const world = getFreeformVertexWorldPositions([{ x: 10, y: 0 }], 0, 0, 1, 1, 90);
      // (10, 0) rotated 90° -> (0, 10)
      expect(world[0].x).toBeCloseTo(0, 5);
      expect(world[0].y).toBeCloseTo(10, 5);
    });

    it('returns empty array for no points', () => {
      expect(getFreeformVertexWorldPositions([], 0, 0, 1, 1, 0)).toEqual([]);
    });
  });
});
