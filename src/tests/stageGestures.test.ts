/**
 * The stage's geometric gestures, solved without React: what a pointer
 * position makes of a crop region or a transform.
 */
import { describe, expect, it } from 'vitest';
import { isCropGesture, resolveCropGesture, resolveTransformGesture, svgPointToWorld, type GestureStart } from '../components/Canvas/stageGestures';
import { EDITOR_CAMERA_CENTER } from '../utils/geometry/projectCoordinates';

const identity = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
const svg = (x: number, y: number) => ({ x: x + EDITOR_CAMERA_CENTER.x, y: y + EDITOR_CAMERA_CENTER.y });
const input = (start: GestureStart, pointer: { x: number; y: number }, overrides = {}) => ({
  start, pointer, initialAngle: 0, initialLocalX: 1, initialLocalY: 1, scaleLocked: false, shiftKey: false, ...overrides,
});

describe('stage gestures', () => {
  it('converts stage SVG points to world points', () => {
    expect(svgPointToWorld(svg(12, -7))).toEqual({ x: 12, y: -7 });
  });

  it('rotates about the layer origin and keeps its position', () => {
    const start: GestureStart = { ...svg(100, 0), initialTransform: { ...identity, x: 0, y: 0 } };
    const solved = resolveTransformGesture('rotate', input(start, svg(0, 100)));
    expect(solved).toEqual({ patch: { x: 0, y: 0, rotation: 90 } });
  });

  it('keeps the opposite corner fixed in a corner resize, uniformly while Shift toggles the lock', () => {
    const start: GestureStart = { ...svg(50, 50), initialTransform: identity, localBounds: { minX: -50, minY: -50, maxX: 50, maxY: 50 } };
    const free = resolveTransformGesture('scale_corner_br', input(start, svg(150, 50)))!.patch;
    expect(free.scaleX).toBeCloseTo(2, 6);
    expect(free.scaleY).toBeCloseTo(1, 6);
    expect(free.x).toBeCloseTo(50, 6);
    const uniform = resolveTransformGesture('scale_corner_br', input(start, svg(150, 50), { shiftKey: true }))!.patch;
    expect(uniform.scaleY).toBeCloseTo(uniform.scaleX!, 6);
  });

  it('does not solve a resize without the bounds it began with', () => {
    const start: GestureStart = { ...svg(50, 50), initialTransform: identity };
    expect(resolveTransformGesture('scale_corner_tl', input(start, svg(0, 0)))).toBeNull();
    expect(resolveTransformGesture('scale_left', input(start, svg(0, 0)))).toBeNull();
  });

  it('scales one axis by the pointer distance ratio', () => {
    const start: GestureStart = { ...svg(10, 0), initialTransform: identity };
    expect(resolveTransformGesture('scale_x', input(start, svg(30, 5), { initialLocalX: 10 }))).toEqual({ patch: { scaleX: 3 } });
    expect(resolveTransformGesture('scale_y', input(start, svg(5, -20), { initialLocalY: 10 }))).toEqual({ patch: { scaleY: 2 } });
  });

  it('scales and turns a child frame around its centre, for the layer the gesture grabbed', () => {
    const start: GestureStart = { x: 10, y: 0, initialTransform: identity, mediaCenter: { x: 0, y: 0 }, partId: 'child', initialChildScaleX: 1, initialChildRot: 10 };
    expect(resolveTransformGesture('child_frame_scale', input(start, { x: 25, y: 0 }))).toEqual({ patch: { scaleX: 2.5, scaleY: 2.5 }, targetId: 'child' });
    expect(resolveTransformGesture('child_frame_rotate', input(start, { x: 0, y: 10 }))).toEqual({ patch: { rotation: 100 }, targetId: 'child' });
  });

  it('leaves the gestures the stage owns to the stage', () => {
    const start: GestureStart = { x: 0, y: 0, initialTransform: identity };
    for (const mode of ['translate', 'pan', 'marquee', 'shape_create'] as const) {
      expect(resolveTransformGesture(mode, input(start, { x: 5, y: 5 }))).toBeNull();
    }
  });

  it('draws, moves and resizes a crop region inside the canvas', () => {
    const resolution = { width: 1920, height: 1080 };
    expect(isCropGesture('crop_move')).toBe(true);
    expect(isCropGesture('translate')).toBe(false);
    const drawn = resolveCropGesture('crop_new', { x: 0, y: 0, initialTransform: identity, cropAnchor: { x: 100, y: 100 } }, { x: 300, y: 250 }, resolution);
    expect(drawn).toMatchObject({ x: 100, y: 100, width: 200, height: 150 });
    const initial = { x: 100, y: 100, width: 200, height: 150 };
    expect(resolveCropGesture('crop_move', { x: 0, y: 0, initialTransform: identity, cropInitial: initial, cropAnchor: { x: 150, y: 150 } }, { x: 170, y: 140 }, resolution))
      .toMatchObject({ x: 120, y: 90, width: 200, height: 150 });
    expect(resolveCropGesture('crop_resize', { x: 0, y: 0, initialTransform: identity }, { x: 1, y: 1 }, resolution)).toBeNull();
  });
});
