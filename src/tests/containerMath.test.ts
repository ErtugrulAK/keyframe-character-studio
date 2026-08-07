import { describe, it, expect } from 'vitest';
import { worldToContainerLocal, containerLocalToWorld, worldDeltaToContainerLocal } from '../utils/containerMath';
import type { Transform } from '../types/animator';

const makeT = (over: Partial<Transform>): Transform => ({
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  ...over,
});

describe('containerMath', () => {
  it('worldToContainerLocal with an unrotated unscaled container is a plain offset', () => {
    const container = makeT({ x: 120, y: -40 });
    const world = makeT({ x: 160, y: 10, rotation: 15, scaleX: 1.5, scaleY: 1.5 });
    const local = worldToContainerLocal(world, container);
    expect(local.x).toBeCloseTo(40, 6);
    expect(local.y).toBeCloseTo(50, 6);
    expect(local.rotation).toBeCloseTo(15, 6);
  });

  it('round-trips local -> world -> local (rotated + scaled container)', () => {
    const container = makeT({ x: -50, y: 80, rotation: 30, scaleX: 2, scaleY: 0.5, opacity: 0.8 });
    const local = makeT({ x: 12, y: -7, rotation: 10, scaleX: 1.2, scaleY: 0.9, opacity: 0.6 });
    const world = containerLocalToWorld(local, container);
    const back = worldToContainerLocal(world, container);
    expect(back.x).toBeCloseTo(local.x, 5);
    expect(back.y).toBeCloseTo(local.y, 5);
    expect(back.rotation).toBeCloseTo(local.rotation, 5);
    expect(back.scaleX).toBeCloseTo(local.scaleX, 5);
    expect(back.scaleY).toBeCloseTo(local.scaleY, 5);
    expect(back.opacity).toBeCloseTo(local.opacity, 5);
  });

  it('world -> local keeps the child visually in place (assign does not jump)', () => {
    const container = makeT({ x: 200, y: 100, rotation: 45, scaleX: 2, scaleY: 2 });
    const world = makeT({ x: 300, y: 200, rotation: 0, scaleX: 1, scaleY: 1 });
    const local = worldToContainerLocal(world, container);
    // Putting the local back through the container must reproduce the world
    const restored = containerLocalToWorld(local, container);
    expect(restored.x).toBeCloseTo(world.x, 5);
    expect(restored.y).toBeCloseTo(world.y, 5);
    expect(restored.rotation).toBeCloseTo(world.rotation, 5);
  });

  it('worldDeltaToContainerLocal converts a drag delta into container space', () => {
    const container = makeT({ x: 0, y: 0, rotation: 90, scaleX: 2, scaleY: 2 });
    const delta = worldDeltaToContainerLocal(10, 0, container);
    // Rotating the delta by -90° then dividing by 2: (10,0) -> (0,-10) -> (0,-5)
    expect(delta.x).toBeCloseTo(0, 5);
    expect(delta.y).toBeCloseTo(-5, 5);
  });
});
