/**
 * Corner resize geometry: the dragged corner follows the pointer and the
 * diagonally opposite corner stays fixed in world space.
 *
 * The helper answers in world space (the evaluator's space); the canvas write
 * authority converts the patch into the layer's container-local space, so the
 * parented cases here feed the composed world transform and assert the world
 * result — exactly what the composition inverse round-trips.
 */
import { describe, expect, it } from 'vitest';
import {
  MIN_CORNER_SCALE,
  resolveCornerResize,
  type CornerBounds,
  type CornerId,
  type CornerResizeResult,
} from '../utils/cornerResize';

const BOUNDS: CornerBounds = { minX: -60, minY: -30, maxX: 60, maxY: 30 };
const OPPOSITE: Record<CornerId, CornerId> = { tl: 'br', tr: 'bl', bl: 'tr', br: 'tl' };
const CORNERS: CornerId[] = ['tl', 'tr', 'bl', 'br'];

interface World { x: number; y: number; rotation: number; scaleX: number; scaleY: number; }
interface Point { x: number; y: number; }

const localCorner = (corner: CornerId, bounds: CornerBounds = BOUNDS): Point => ({
  x: corner === 'tl' || corner === 'bl' ? bounds.minX : bounds.maxX,
  y: corner === 'tl' || corner === 'tr' ? bounds.minY : bounds.maxY,
});

/** The renderer's world corner: origin + R(rotation)·(local ⊙ scale). */
function worldCorner(world: World, corner: CornerId, bounds: CornerBounds = BOUNDS): Point {
  const local = localCorner(corner, bounds);
  const radians = (world.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: world.x + local.x * world.scaleX * cos - local.y * world.scaleY * sin,
    y: world.y + local.x * world.scaleX * sin + local.y * world.scaleY * cos,
  };
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * The solver only answers position and scale — rotation is preserved by
 * contract, so the caller keeps the authored one. This is what the layer would
 * look like after the write.
 */
function resolved(world: World, result: CornerResizeResult): World {
  return { ...result, rotation: world.rotation };
}

/** Runs one drag from the exact corner handle and reports the resolved world transform. */
function drag(
  world: World,
  corner: CornerId,
  travel: Point,
  options: { uniform?: boolean; bounds?: CornerBounds } = {},
): CornerResizeResult {
  const bounds = options.bounds ?? BOUNDS;
  const startPointer = worldCorner(world, corner, bounds);
  return resolveCornerResize({
    transform: world,
    bounds,
    corner,
    startPointer,
    pointer: { x: startPointer.x + travel.x, y: startPointer.y + travel.y },
    uniform: options.uniform,
  });
}

/** World travel that produces the requested per-axis scale factors. */
function travelForFreeScale(world: World, corner: CornerId, factorX: number, factorY: number): Point {
  const local = localCorner(corner);
  const opposite = localCorner(OPPOSITE[corner]);
  const radians = (world.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const localTravelX = (local.x - opposite.x) * world.scaleX * (factorX - 1);
  const localTravelY = (local.y - opposite.y) * world.scaleY * (factorY - 1);
  return {
    x: localTravelX * cos - localTravelY * sin,
    y: localTravelX * sin + localTravelY * cos,
  };
}

/** Asserts the anchor is untouched and reports how far the dragged corner travelled. */
function expectAnchorHeld(world: World, corner: CornerId, result: CornerResizeResult, tolerance = 1e-9): Point {
  const after = resolved(world, result);
  expect(
    distance(worldCorner(after, OPPOSITE[corner]), worldCorner(world, OPPOSITE[corner])),
  ).toBeLessThanOrEqual(tolerance);
  const before = worldCorner(world, corner);
  const moved = worldCorner(after, corner);
  return { x: moved.x - before.x, y: moved.y - before.y };
}

const BASE: World = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };

describe('resolveCornerResize — unrotated rectangle', () => {
  CORNERS.forEach((corner) => {
    it(`dragging ${corner.toUpperCase()} keeps ${OPPOSITE[corner].toUpperCase()} fixed and follows the pointer`, () => {
      const travel = { x: 24, y: -18 };
      const startPointer = worldCorner(BASE, corner);
      const result = drag(BASE, corner, travel);

      expectAnchorHeld(BASE, corner, result);
      expect(
        distance(worldCorner(resolved(BASE, result), corner), { x: startPointer.x + travel.x, y: startPointer.y + travel.y }),
      ).toBeLessThanOrEqual(1e-9);
    });
  });

  it('moves the centre by half the size change and keeps the rotation', () => {
    const result = drag(BASE, 'br', { x: 30, y: 30 });
    // 120 local units wide and 60 tall: the travel is half of each axis.
    expect(result.scaleX).toBeCloseTo(1.25, 12);
    expect(result.scaleY).toBeCloseTo(1.5, 12);
    expect(result.x).toBeCloseTo(15, 12);
    expect(result.y).toBeCloseTo(15, 12);
    expect(expectAnchorHeld(BASE, 'br', result).x).toBeCloseTo(30, 12);
  });
});

describe('resolveCornerResize — rotated rectangle', () => {
  const ROTATED: World = { x: 40, y: -20, rotation: 30, scaleX: 1, scaleY: 1 };

  CORNERS.forEach((corner) => {
    it(`rotation-safe: ${corner.toUpperCase()} keeps ${OPPOSITE[corner].toUpperCase()} fixed`, () => {
      const startPointer = worldCorner(ROTATED, corner);
      const travel = { x: 18, y: 26 };
      const result = drag(ROTATED, corner, travel);

      expectAnchorHeld(ROTATED, corner, result);
      expect(
        distance(worldCorner(resolved(ROTATED, result), corner), { x: startPointer.x + travel.x, y: startPointer.y + travel.y }),
      ).toBeLessThanOrEqual(1e-9);
    });
  });

  it('solves the dragged corner in the layer basis, not on the world axes', () => {
    const result = drag(ROTATED, 'tl', { x: 0, y: -30 });
    // A pure world −Y travel is a rotated local travel, so both axes change.
    expect(Math.abs(result.scaleX - ROTATED.scaleX)).toBeGreaterThan(0.01);
    expect(Math.abs(result.scaleY - ROTATED.scaleY)).toBeGreaterThan(0.01);
  });
});

describe('resolveCornerResize — non-uniform and mirrored scale', () => {
  it('preserves the opposite corner with independent axis scales', () => {
    const world: World = { x: 0, y: 0, rotation: 20, scaleX: 2.4, scaleY: 0.6 };
    const result = drag(world, 'br', travelForFreeScale(world, 'br', 1.5, 0.75));
    expect(result.scaleX).toBeCloseTo(3.6, 9);
    expect(result.scaleY).toBeCloseTo(0.45, 9);
    expectAnchorHeld(world, 'br', result);
  });

  it('crosses zero into a mirrored scale instead of collapsing the anchor', () => {
    const world: World = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    // Past the fixed corner: 150 world units for a 120-wide layer.
    const result = drag(world, 'br', { x: -150, y: 0 });
    expect(result.scaleX).toBeCloseTo(-0.25, 12);
    expectAnchorHeld(world, 'br', result);
  });

  it('clamps the minimum size while keeping the fixed corner', () => {
    const world: World = { x: 0, y: 0, rotation: 12, scaleX: 1, scaleY: 1 };
    // Past the fixed corner: the solve wants a mirrored sliver, the clamp holds it open.
    const result = drag(world, 'br', travelForFreeScale(world, 'br', -0.02, -0.02));
    expect(result.scaleX).toBeCloseTo(-MIN_CORNER_SCALE, 12);
    expect(result.scaleY).toBeCloseTo(-MIN_CORNER_SCALE, 12);
    expectAnchorHeld(world, 'br', result);
  });
});

describe('resolveCornerResize — aspect-ratio lock (uniform)', () => {
  it('preserves the authored aspect ratio and the opposite corner', () => {
    const world: World = { x: 10, y: -10, rotation: 25, scaleX: 2, scaleY: 0.5 };
    const startPointer = worldCorner(world, 'tl');
    const fixed = worldCorner(world, 'br');
    const dragged = worldCorner(world, 'tl');
    // Target on the layer diagonal: 0.6 of the way from the fixed corner.
    const target = { x: fixed.x + (dragged.x - fixed.x) * 0.6, y: fixed.y + (dragged.y - fixed.y) * 0.6 };
    const result = resolveCornerResize({
      transform: world,
      bounds: BOUNDS,
      corner: 'tl',
      startPointer,
      pointer: target,
      uniform: true,
    });

    expect(result.scaleX / result.scaleY).toBeCloseTo(world.scaleX / world.scaleY, 12);
    expect(result.scaleX).toBeCloseTo(world.scaleX * 0.6, 12);
    expectAnchorHeld(world, 'tl', result);
    expect(distance(worldCorner(resolved(world, result), 'tl'), target)).toBeLessThanOrEqual(1e-9);
  });

  it('does not scale at all before the pointer moves', () => {
    const world: World = { x: 5, y: 7, rotation: 15, scaleX: 1.2, scaleY: 1.2 };
    const startPointer = worldCorner(world, 'br');
    const result = resolveCornerResize({
      transform: world,
      bounds: BOUNDS,
      corner: 'br',
      startPointer,
      pointer: startPointer,
      uniform: true,
    });
    expect(result.x).toBeCloseTo(world.x, 12);
    expect(result.y).toBeCloseTo(world.y, 12);
    expect(result.scaleX).toBeCloseTo(world.scaleX, 12);
    expect(result.scaleY).toBeCloseTo(world.scaleY, 12);
  });

  it('clamps a collapsing uniform drag without moving the fixed corner', () => {
    const world: World = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    const result = drag(world, 'tl', { x: 120, y: 60 }, { uniform: true });
    expect(Math.abs(result.scaleX)).toBeCloseTo(MIN_CORNER_SCALE, 12);
    expect(result.scaleY).toBeCloseTo(result.scaleX, 12);
    expectAnchorHeld(world, 'tl', result);
  });
});

/** The write authority's world→container-local conversion (containerMath). */
function toLocal(world: World, parent: World): World {
  const radians = (parent.rotation * Math.PI) / 180;
  const dx = world.x - parent.x;
  const dy = world.y - parent.y;
  return {
    x: (dx * Math.cos(radians) + dy * Math.sin(radians)) / (parent.scaleX || 1),
    y: (-dx * Math.sin(radians) + dy * Math.cos(radians)) / (parent.scaleY || 1),
    rotation: world.rotation - parent.rotation,
    scaleX: world.scaleX / (parent.scaleX || 1),
    scaleY: world.scaleY / (parent.scaleY || 1),
  };
}

/** World composition of the evaluator: parent scale, then rotation, then translation. */
function compose(child: World, parent: World): World {
  const radians = (parent.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const scaledX = child.x * parent.scaleX;
  const scaledY = child.y * parent.scaleY;
  return {
    x: parent.x + scaledX * cos - scaledY * sin,
    y: parent.y + scaledX * sin + scaledY * cos,
    rotation: parent.rotation + child.rotation,
    scaleX: parent.scaleX * child.scaleX,
    scaleY: parent.scaleY * child.scaleY,
  };
}

describe('resolveCornerResize — parented layers', () => {
  it('translated parent: the child keeps its opposite corner in world space', () => {
    const parent: World = { x: 90, y: -40, rotation: 0, scaleX: 1, scaleY: 1 };
    const child: World = { x: 30, y: -20, rotation: 0, scaleX: 1, scaleY: 1 };
    const world = compose(child, parent);
    const result = drag(world, 'tl', { x: -20, y: 14 });
    expectAnchorHeld(world, 'tl', result);
    const rebuilt = compose(toLocal(resolved(world, result), parent), parent);
    expect(rebuilt.x).toBeCloseTo(result.x, 9);
    expect(rebuilt.y).toBeCloseTo(result.y, 9);
  });

  it('rotated parent: the child keeps its opposite corner in world space', () => {
    const parent: World = { x: 60, y: 30, rotation: 35, scaleX: 1, scaleY: 1 };
    const child: World = { x: 40, y: -25, rotation: 0, scaleX: 1, scaleY: 1 };
    const world = compose(child, parent);
    const result = drag(world, 'br', { x: -22, y: 18 });
    expectAnchorHeld(world, 'br', result);
  });

  it('non-uniformly scaled parent: the child keeps its opposite corner in world space', () => {
    const parent: World = { x: -70, y: 20, rotation: 25, scaleX: 1.6, scaleY: 0.7 };
    const child: World = { x: 45, y: -18, rotation: 15, scaleX: 1.2, scaleY: 0.8 };
    const world = compose(child, parent);
    const result = drag(world, 'tr', { x: 26, y: -14 });
    expectAnchorHeld(world, 'tr', result);
  });

  it('the container-local inverse reproduces the authored world transform', () => {
    const parent: World = { x: 20, y: -10, rotation: 40, scaleX: 1.3, scaleY: 0.9 };
    const world: World = { x: 100, y: 60, rotation: 55, scaleX: 2, scaleY: 1.5 };
    const result = drag(world, 'bl', { x: 12, y: 20 });
    const rebuilt = compose(toLocal(resolved(world, result), parent), parent);
    expect(rebuilt.x).toBeCloseTo(result.x, 9);
    expect(rebuilt.y).toBeCloseTo(result.y, 9);
    // The solver never answers a rotation: the authored one survives the write.
    expect(rebuilt.rotation).toBeCloseTo(world.rotation, 9);
    expect(rebuilt.scaleX).toBeCloseTo(result.scaleX, 9);
    expect(rebuilt.scaleY).toBeCloseTo(result.scaleY, 9);
  });
});

describe('resolveCornerResize — degenerate geometry', () => {
  it('keeps the axis that has no local span intact', () => {
    const flat: CornerBounds = { minX: -60, minY: 0, maxX: 60, maxY: 0 };
    const world: World = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    const startPointer = worldCorner(world, 'br', flat);
    const result = resolveCornerResize({
      transform: world,
      bounds: flat,
      corner: 'br',
      startPointer,
      pointer: { x: startPointer.x + 20, y: startPointer.y + 20 },
    });
    expect(result.scaleY).toBe(1);
    expect(result.scaleX).toBeCloseTo(1 + 20 / 120, 12);
  });

  it('is a no-op for a handle that did not move', () => {
    const world: World = { x: -8, y: 4, rotation: -37, scaleX: 1.7, scaleY: 0.4 };
    const startPointer = worldCorner(world, 'tr');
    const result = resolveCornerResize({
      transform: world,
      bounds: BOUNDS,
      corner: 'tr',
      startPointer,
      pointer: startPointer,
    });
    expect(result.x).toBeCloseTo(world.x, 12);
    expect(result.y).toBeCloseTo(world.y, 12);
    expect(result.scaleX).toBeCloseTo(world.scaleX, 12);
    expect(result.scaleY).toBeCloseTo(world.scaleY, 12);
  });
});
