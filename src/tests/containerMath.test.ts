import { describe, expect, it } from 'vitest';
import type { Transform } from '../types/animator';
import { worldToContainerLocal } from '../utils/containerMath';

const transform = (overrides: Partial<Transform>): Transform => ({
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  ...overrides,
});

describe('container transform conversion', () => {
  it('inverts parent translation, rotation, and scale', () => {
    const parent = transform({ x: 100, y: 40, rotation: 90, scaleX: 2, scaleY: 4 });
    const world = transform({ x: 100, y: 240, rotation: 105, scaleX: 6, scaleY: 8 });

    expect(worldToContainerLocal(world, parent)).toMatchObject({
      x: 100,
      y: expect.closeTo(0, 8),
      rotation: 15,
      scaleX: 3,
      scaleY: 2,
    });
  });
});
