import { describe, expect, it } from 'vitest';
import type { Transform } from '../types/animator';
import { applyAffine, worldAffineOf } from '../utils/geometry/containerMath';
import { rotateAboutWorldPivot } from '../utils/geometry/rotationGesture';

/**
 * The arrange commands turn a selection ±90° about ONE world pivot captured
 * before the command, so the selection turns as one rigid body. These are the
 * pure statements they rely on. (The canvas rotation handle turns one layer
 * about its own origin and does not move it; see transformGizmo.)
 */
const transform = (patch: Partial<Transform> = {}): Transform => ({
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  ...patch,
});

/** Where a point fixed in the layer's own axes is drawn. */
const worldOfLocal = (t: Transform, local: { x: number; y: number }) => applyAffine(worldAffineOf(t), local);

const expectPoint = (point: { x: number; y: number }, expected: { x: number; y: number }) => {
  expect(point.x).toBeCloseTo(expected.x, 6);
  expect(point.y).toBeCloseTo(expected.y, 6);
};

describe('rotateAboutWorldPivot', () => {
  it('leaves the transform untouched at the starting rotation', () => {
    const start = transform({ x: 12, y: -4, rotation: 25, scaleX: 2 });
    const result = rotateAboutWorldPivot({ transform: start, pivot: worldOfLocal(start, { x: 8, y: 3 }), rotation: 25 });

    expect(result.rotation).toBe(25);
    expect(result.x).toBeCloseTo(start.x, 6);
    expect(result.y).toBeCloseTo(start.y, 6);
  });

  it('keeps an off-origin pivot exactly fixed through a full sweep', () => {
    const start = transform({ x: 40, y: 15, rotation: 30, scaleX: 1.5, scaleY: 0.5 });
    const local = { x: 30, y: -12 };
    const pivot = worldOfLocal(start, local);

    for (let rotation = -180; rotation <= 180; rotation += 15) {
      const result = rotateAboutWorldPivot({ transform: start, pivot, rotation });
      expectPoint(worldOfLocal({ ...start, ...result }, local), pivot);
    }
  });

  it('is a pure rotation: distances from the pivot are preserved', () => {
    const start = transform({ x: -60, y: 90, rotation: 15 });
    const result = rotateAboutWorldPivot({ transform: start, pivot: { x: 0, y: 0 }, rotation: 105 });

    expect(Math.hypot(result.x, result.y)).toBeCloseTo(Math.hypot(start.x, start.y), 6);
  });

  it('reports the requested rotation, so one command is one authored value', () => {
    const start = transform({ rotation: 10 });
    expect(rotateAboutWorldPivot({ transform: start, pivot: { x: 0, y: 0 }, rotation: 130 }).rotation).toBe(130);
  });

  it('is independent of a mirrored scale sign', () => {
    const start = transform({ x: 25, scaleX: -1, scaleY: 1 });
    const local = { x: 40, y: 0 };
    const pivot = worldOfLocal(start, local);
    expectPoint(pivot, { x: -15, y: 0 });

    const result = rotateAboutWorldPivot({ transform: start, pivot, rotation: 90 });
    expectPoint(worldOfLocal({ ...start, ...result }, local), pivot);
  });

  it('turning about the layer origin moves nothing but the rotation', () => {
    const start = transform({ x: 33, y: -7, rotation: 12, scaleX: 2 });
    const result = rotateAboutWorldPivot({ transform: start, pivot: { x: start.x, y: start.y }, rotation: 80 });
    expect(result.x).toBeCloseTo(start.x, 9);
    expect(result.y).toBeCloseTo(start.y, 9);
  });
});
