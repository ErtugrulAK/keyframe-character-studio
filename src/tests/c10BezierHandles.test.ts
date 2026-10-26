import { describe, expect, it } from 'vitest';
import { moveBrokenVertexHandle, moveVertexHandle, pullVertexHandles, toggleVertexKind } from '../utils/bezierPath';
import type { BezierPath, BezierVertex } from '../types/animator';

const makePath = (): BezierPath => ({
  version: 1,
  coordinateSpace: 'normalized',
  closed: true,
  points: [
    { id: 'a', x: 0.1, y: 0.1, kind: 'corner' },
    { id: 'b', x: 0.9, y: 0.1, kind: 'corner' },
    { id: 'c', x: 0.9, y: 0.9, kind: 'corner' },
  ],
});

const smooth: BezierVertex = { id: 's', x: 0, y: 0, kind: 'smooth', handleIn: { x: -10, y: 0 }, handleOut: { x: 10, y: 0 } };

describe('C10 — canvas point type and handle gestures', () => {
  it('toggles Corner → Smooth with the canvas rule (neighbours untouched) and back keeping the handles', () => {
    const path = makePath();
    const toSmooth = toggleVertexKind(path, 1);
    expect(toSmooth.points[0]).toEqual(path.points[0]);
    expect(toSmooth.points[2]).toEqual(path.points[2]);
    const vertex = toSmooth.points[1];
    expect(vertex.kind).toBe('smooth');
    // Handles mirror through the vertex along the neighbours' chord (a→c).
    expect(vertex.handleIn!.x + vertex.handleOut!.x).toBeCloseTo(2 * vertex.x, 9);
    expect(vertex.handleIn!.y + vertex.handleOut!.y).toBeCloseTo(2 * vertex.y, 9);

    const back = toggleVertexKind(toSmooth, 1);
    expect(back.points[1]).toEqual({ ...vertex, kind: 'corner' });
    expect(toggleVertexKind(path, 7)).toBe(path);
  });

  it('a plain handle drag on a smooth point mirrors the other handle; Alt moves only the dragged one', () => {
    const linked = moveVertexHandle(smooth, 'out', { x: 0, y: 10 });
    expect(linked.handleIn!.x).toBeCloseTo(0, 9);
    expect(linked.handleIn!.y).toBeCloseTo(-10, 9);

    const broken = moveBrokenVertexHandle(smooth, 'out', { x: 0, y: 10 });
    expect(broken.kind).toBe('corner');
    expect(broken.handleOut).toEqual({ x: 0, y: 10 });
    expect(broken.handleIn).toEqual(smooth.handleIn);
  });

  it('Alt-drag from a point pulls out mirrored handles and makes it smooth; no travel changes nothing', () => {
    const corner: BezierVertex = { id: 'k', x: 5, y: 5, kind: 'corner' };
    expect(pullVertexHandles(corner, { x: 3, y: -4 })).toEqual({
      id: 'k', x: 5, y: 5, kind: 'smooth', handleOut: { x: 8, y: 1 }, handleIn: { x: 2, y: 9 },
    });
    expect(pullVertexHandles(corner, { x: 0, y: 0 })).toBe(corner);
    expect(pullVertexHandles(corner, { x: Number.NaN, y: 1 })).toBe(corner);
  });
});
