import { describe, it, expect } from 'vitest';
import {
  buildFreeformPath,
  getFreeformBounds,
  getFreeformExtents,
  getFreeformPerimeter,
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
});
