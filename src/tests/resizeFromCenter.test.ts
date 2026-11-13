import { describe, expect, it } from 'vitest';
import { resolveCornerResize, resolveEdgeResize } from '../utils/geometry/cornerResize';

// A 100 x 60 box centred on its origin at (200, 100), unrotated.
const transform = { x: 200, y: 100, rotation: 0, scaleX: 1, scaleY: 1 };
const bounds = { minX: -50, maxX: 50, minY: -30, maxY: 30 };
const worldBox = (r: { x: number; y: number; scaleX: number; scaleY: number }) => ({
  left: r.x + bounds.minX * r.scaleX,
  right: r.x + bounds.maxX * r.scaleX,
  top: r.y + bounds.minY * r.scaleY,
  bottom: r.y + bounds.maxY * r.scaleY,
});

describe('Alt: scale from the centre', () => {
  it('a corner drag keeps the centre fixed and grows both sides', () => {
    // Drag the bottom-right corner 20 right and 10 down.
    const result = resolveCornerResize({
      transform, bounds, corner: 'br', fromCenter: true,
      startPointer: { x: 250, y: 130 }, pointer: { x: 270, y: 140 },
    });
    expect(result.x).toBeCloseTo(200);
    expect(result.y).toBeCloseTo(100);
    const box = worldBox(result);
    expect(box.right).toBeCloseTo(270);
    expect(box.left).toBeCloseTo(130);
    expect(box.bottom).toBeCloseTo(140);
    expect(box.top).toBeCloseTo(60);
  });

  it('without Alt the opposite corner stays fixed (unchanged behaviour)', () => {
    const result = resolveCornerResize({
      transform, bounds, corner: 'br',
      startPointer: { x: 250, y: 130 }, pointer: { x: 270, y: 140 },
    });
    const box = worldBox(result);
    expect(box.left).toBeCloseTo(150);
    expect(box.top).toBeCloseTo(70);
    expect(box.right).toBeCloseTo(270);
  });

  it('an edge drag from the centre moves both opposite edges', () => {
    const result = resolveEdgeResize({
      transform, bounds, edge: 'right', fromCenter: true,
      startPointer: { x: 250, y: 100 }, pointer: { x: 260, y: 100 },
    });
    const box = worldBox(result);
    expect(box.right).toBeCloseTo(260);
    expect(box.left).toBeCloseTo(140);
    expect(box.top).toBeCloseTo(70);
    expect(result.x).toBeCloseTo(200);
  });

  it('Alt with Shift scales uniformly about the centre', () => {
    const result = resolveCornerResize({
      transform, bounds, corner: 'br', fromCenter: true, uniform: true,
      startPointer: { x: 250, y: 130 }, pointer: { x: 300, y: 160 },
    });
    expect(result.scaleX).toBeCloseTo(result.scaleY);
    expect(result.x).toBeCloseTo(200);
    expect(result.y).toBeCloseTo(100);
  });
});
