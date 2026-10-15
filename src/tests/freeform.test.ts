import { describe, it, expect } from 'vitest';
import type { CharacterPart, Transform } from '../types/animator';
import { affineOfTransform, composeAffine } from '../utils/containerMath';
import { evaluateTransform } from '../utils/evaluateTransform';
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
  normalizeClosedPoints,
  MIN_FREEFORM_POINTS,
} from '../utils/freeform';

/** A 90°-rotated child inside a container with scaleX 2 — the sheared nesting. */
const STRETCHED_CONTAINER: Transform = { x: 40, y: 0, rotation: 0, scaleX: 2, scaleY: 1, opacity: 1 };
const ROTATED_CHILD: Transform = { x: -100, y: 0, rotation: 90, scaleX: 1, scaleY: 1, opacity: 1 };
const SHEARED_WORLD_AFFINE = composeAffine(affineOfTransform(STRETCHED_CONTAINER), affineOfTransform(ROTATED_CHILD));
/** The same map as the evaluator's world transform: `(x, y) -> (−2y − 160, x)`. */
const SHEARED_WORLD = { x: -160, y: 0, rotation: 90, scaleX: 2, scaleY: 1, affine: SHEARED_WORLD_AFFINE };

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

  describe('normalizeClosedPoints', () => {
    it('removes only the repeated closing vertex', () => {
      expect(normalizeClosedPoints([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 0 },
      ])).toEqual([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]);
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

    it('follows the DERIVED affine of a sheared nesting (display fields match the drawn vertex)', () => {
      // The exact map is `(x, y) -> (−2y − 160, x)`, so the display (Y-up)
      // reading is `(−2y − 160, −x)`.
      //
      // Failing-before (hand-rolled TRS display map): local (1, 0) read
      // (−160, −2) — the container's stretch folded into the child's own Y axis
      // — and local (0, 1) read (−161, 0) instead of (−162, 0).
      expect(freeformVertexToDisplay({ x: 1, y: 0 }, SHEARED_WORLD)).toEqual({ x: -160, y: -1 });
      expect(freeformVertexToDisplay({ x: 0, y: 1 }, SHEARED_WORLD).x).toBeCloseTo(-162, 9);
      expect(freeformVertexToDisplay({ x: 0, y: 1 }, SHEARED_WORLD).y).toBeCloseTo(0, 9);
    });

    it('inverts the sheared display map exactly', () => {
      // Only the exact affine inverse puts the edit back on the drawn vertex.
      // Failing-before (TRS inverse of the same world transform): the typed
      // display point (−162, 0) became local (0, 2), not (0, 1).
      const local = freeformVertexToLocal(-162, 0, SHEARED_WORLD);
      expect(local.x).toBeCloseTo(0, 9);
      expect(local.y).toBeCloseTo(1, 9);
      expect(local.y).not.toBeCloseTo(2, 3);
      // Round trip: display -> local -> display is identity.
      const back = freeformVertexToDisplay(local, SHEARED_WORLD);
      expect(back.x).toBeCloseTo(-162, 9);
      expect(back.y).toBeCloseTo(0, 9);
    });
  });

  describe('the evaluated world map of a sheared layer', () => {
    const TRS = (over: Partial<Transform> = {}): Transform => ({
      x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, ...over,
    });
    const scene: CharacterPart[] = [
      {
        id: 'g', name: 'g', type: 'custom_freeform', zIndex: 0, isGroup: true, points: [],
        baseTransform: TRS({ x: 40, scaleX: 2 }),
      } as unknown as CharacterPart,
      {
        id: 'free', name: 'free', type: 'custom_freeform', zIndex: 1, parentId: 'g',
        baseTransform: TRS({ x: -100, rotation: 90 }),
        path: {
          version: 1 as const, coordinateSpace: 'local' as const, closed: true,
          points: [{ id: 'p0', x: 1, y: 0 }, { id: 'p1', x: 0, y: 1 }, { id: 'p2', x: -1, y: 0 }],
        },
      } as unknown as CharacterPart,
    ];

    it('reads the derived affine the evaluator attached, not the folded TRS', () => {
      const world = evaluateTransform(scene, [], 'Sequence', 'free', 0);
      expect(world.affine).toBeDefined();

      // Local +x -> world +y one unit long, riding on the layer's world position
      // (e = −160); local +y -> world −x two units long.
      const right = getFreeformVertexWorldPositions([{ x: 1, y: 0 }], world, { x: 0, y: 0 })[0];
      expect(right.x).toBeCloseTo(-160, 9);
      expect(right.y).toBeCloseTo(1, 9);
      const up = getFreeformVertexWorldPositions([{ x: 0, y: 1 }], world, { x: 0, y: 0 })[0];
      expect(up.x).toBeCloseTo(-162, 9);
      expect(up.y).toBeCloseTo(0, 9);
      // The folded reading a TRS would draw: +x at (−160, 2), +y at (−161, 0).
      expect(right.y).not.toBeCloseTo(2, 3);
      expect(up.x).not.toBeCloseTo(-161, 3);
      // The Inspector's vertex fields read the same map.
      expect(freeformVertexToDisplay({ x: 1, y: 0 }, world)).toEqual({ x: -160, y: -1 });
    });
  });

  describe('getFreeformVertexWorldPositions', () => {
    const ORIGIN = { x: 0, y: 0 };

    it('maps local points through scale and translation (no rotation)', () => {
      const world = getFreeformVertexWorldPositions(
        [
          { x: -10, y: -10 },
          { x: 10, y: 10 },
        ],
        { x: 100, y: 200, scaleX: 2, scaleY: 2, rotation: 0 },
        ORIGIN,
      );
      expect(world).toEqual([
        { x: 80, y: 180 },
        { x: 120, y: 220 },
      ]);
    });

    it('applies rotation after scaling (SVG order)', () => {
      const world = getFreeformVertexWorldPositions(
        [{ x: 10, y: 0 }],
        { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 90 },
        ORIGIN,
      );
      // (10, 0) rotated 90° -> (0, 10)
      expect(world[0].x).toBeCloseTo(0, 5);
      expect(world[0].y).toBeCloseTo(10, 5);
    });

    it('folds the output origin in on top of the world position', () => {
      const world = getFreeformVertexWorldPositions(
        [{ x: 1, y: -2 }],
        { x: 10, y: 20, scaleX: 1, scaleY: 1, rotation: 0 },
        { x: 300, y: 240 },
      );
      expect(world).toEqual([{ x: 311, y: 258 }]);
    });

    it('maps through the DERIVED affine of a sheared nesting, not the authored TRS', () => {
      // A 90°-rotated child inside a container with scaleX 2: the exact nesting
      // is `scale(2,1)·rotate(90)`, so local +x reaches world +y one unit long
      // while local +y reaches world −x TWO units long.
      //
      // Failing-before (hand-rolled `R(90)·(local ⊙ (2,1))`): local +x reached
      // (0, 2) — world +y scaled by 2 — and local +y reached (−1, 0).
      const affine = composeAffine(
        affineOfTransform({ x: 40, y: 0, rotation: 0, scaleX: 2, scaleY: 1 }),
        affineOfTransform({ x: -100, y: 0, rotation: 90, scaleX: 1, scaleY: 1 }),
      );
      const world = getFreeformVertexWorldPositions(
        [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 0 }],
        { x: -160, y: 0, scaleX: 2, scaleY: 1, rotation: 90, affine },
        ORIGIN,
      );
      // Exact map: (x, y) -> (−2y − 160, x); the layer's world position is the
      // map origin, so local (0,0) lands on (−160, 0).
      expect(world[0].x).toBeCloseTo(-160, 9);
      expect(world[0].y).toBeCloseTo(1, 9);
      expect(world[1].x).toBeCloseTo(-162, 9);
      expect(world[1].y).toBeCloseTo(0, 9);
      expect(world[2]).toEqual({ x: -160, y: 0 });
      // The bug's own spelling, never the drawn position:
      expect(world[0].y).not.toBeCloseTo(2, 3);
      expect(world[1].x).not.toBeCloseTo(-161, 3);
    });

    it('returns empty array for no points', () => {
      expect(getFreeformVertexWorldPositions([], { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }, ORIGIN)).toEqual([]);
    });
  });
});
