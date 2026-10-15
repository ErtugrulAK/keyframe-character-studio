import { describe, expect, it } from 'vitest';
import type { Transform } from '../types/animator';
import type { PartLocalBounds } from '../utils/bounds';
import { affineOfTransform, composeAffine, composeWorldTransform, withWorldAffine } from '../utils/containerMath';
import { rotateAboutWorldPivot, selectionFrameCenterWorld } from '../utils/rotationGesture';

/**
 * R2-05 — a rotation gesture turns the layer about ONE world pivot captured at
 * pointerdown, so the frame's visible centre never wanders while the gesture
 * runs. These are the two pure statements the stage relies on.
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

const box = (patch: Partial<PartLocalBounds> = {}): PartLocalBounds => ({
  minX: -40,
  minY: -20,
  maxX: 60,
  maxY: 20,
  halfW: 50,
  halfH: 20,
  offsetX: 10,
  offsetY: 0,
  ...patch,
});

const expectPoint = (point: { x: number; y: number }, expected: { x: number; y: number }) => {
  expect(point.x).toBeCloseTo(expected.x, 6);
  expect(point.y).toBeCloseTo(expected.y, 6);
};

describe('selectionFrameCenterWorld', () => {
  it('reports the transform origin when the box is centred on it', () => {
    expectPoint(selectionFrameCenterWorld(transform({ x: 30, y: -10 }), box({ offsetX: 0, offsetY: 0 })), { x: 30, y: -10 });
  });

  it('rotates the box offset into world space (asymmetric geometry)', () => {
    // offset (10, 0) at 90° → (0, 10).
    expectPoint(selectionFrameCenterWorld(transform({ rotation: 90 }), box()), { x: 0, y: 10 });
  });

  it('applies the SIGNED scale, so a mirrored layer keeps the drawn centre', () => {
    expectPoint(selectionFrameCenterWorld(transform({ scaleX: -2 }), box()), { x: -20, y: 0 });
  });

  it('reads the derived affine, so a sheared frame pivots on the centre it draws', () => {
    // A 30° child of a container scaled (2, 1): the exact nesting is sheared, so
    // the drawn centre is the affine image of the local box centre — the child's
    // offset rotated by the child, then the container's own anisotropic scale.
    const parent = transform({ scaleX: 2, scaleY: 1 });
    const child = transform({ x: 40, rotation: 30 });
    const world = withWorldAffine(
      composeWorldTransform(parent, child),
      composeAffine(affineOfTransform(parent), affineOfTransform(child)),
    );

    // The TRS reading of the same numbers would put the centre at y = 10
    // (offset ⊙ scale, rotated once). The affine puts it where it is drawn.
    expectPoint(selectionFrameCenterWorld(world, box({ offsetX: 10, offsetY: 0 })), {
      x: 80 + 2 * 10 * Math.cos(Math.PI / 6),
      y: 10 * Math.sin(Math.PI / 6),
    });
  });
});

describe('rotateAboutWorldPivot', () => {
  it('leaves the transform untouched at the starting rotation', () => {
    const start = transform({ x: 12, y: -4, rotation: 25, scaleX: 2 });
    const result = rotateAboutWorldPivot({
      transform: start,
      pivot: selectionFrameCenterWorld(start, box({ offsetX: 8, offsetY: 3 })),
      rotation: 25,
    });

    expect(result.rotation).toBe(25);
    expect(result.x).toBeCloseTo(start.x, 6);
    expect(result.y).toBeCloseTo(start.y, 6);
  });

  it('keeps an off-origin pivot exactly fixed through a full sweep', () => {
    const start = transform({ x: 40, y: 15, rotation: 30, scaleX: 1.5, scaleY: 0.5 });
    const pivot = selectionFrameCenterWorld(start, box({ offsetX: 30, offsetY: -12 }));

    for (let rotation = -180; rotation <= 180; rotation += 15) {
      const result = rotateAboutWorldPivot({ transform: start, pivot, rotation });
      // Where the frame's centre lands after the write is the pivot itself.
      const landed = selectionFrameCenterWorld({ ...start, x: result.x, y: result.y, rotation: result.rotation }, box({ offsetX: 30, offsetY: -12 }));
      expectPoint(landed, pivot);
    }
  });

  it('is a pure rotation: distances from the pivot are preserved', () => {
    const start = transform({ x: -60, y: 90, rotation: 15 });
    const pivot = { x: 0, y: 0 };
    const result = rotateAboutWorldPivot({ transform: start, pivot, rotation: 105 });

    expect(Math.hypot(result.x, result.y)).toBeCloseTo(Math.hypot(start.x, start.y), 6);
  });

  it('reports the requested rotation, so one gesture is one authored value', () => {
    const start = transform({ rotation: 10 });
    expect(rotateAboutWorldPivot({ transform: start, pivot: { x: 0, y: 0 }, rotation: 130 }).rotation).toBe(130);
  });

  it('is independent of a mirrored scale sign in the drawn box', () => {
    const start = transform({ x: 25, scaleX: -1, scaleY: 1 });
    const mirrored = box({ offsetX: 40, offsetY: 0 });
    const pivot = selectionFrameCenterWorld(start, mirrored);
    expectPoint(pivot, { x: -15, y: 0 });

    const result = rotateAboutWorldPivot({ transform: start, pivot, rotation: 90 });
    const landed = selectionFrameCenterWorld({ ...start, x: result.x, y: result.y, rotation: 90 }, mirrored);
    expectPoint(landed, pivot);
  });
});
