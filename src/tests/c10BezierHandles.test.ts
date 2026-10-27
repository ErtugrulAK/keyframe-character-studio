import { describe, expect, it } from 'vitest';
import { altMoveVertexHandle, moveVertexHandle, pullVertexHandles, toggleVertexKind } from '../utils/bezierPath';
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
  it('toggles Corner → Smooth with the canvas rule (neighbours untouched) and back with the handles retracted (C12)', () => {
    const path = makePath();
    const toSmooth = toggleVertexKind(path, 1);
    expect(toSmooth.points[0]).toEqual(path.points[0]);
    expect(toSmooth.points[2]).toEqual(path.points[2]);
    const vertex = toSmooth.points[1];
    expect(vertex.kind).toBe('smooth');
    // Handles mirror through the vertex along the neighbours' chord (a→c).
    expect(vertex.handleIn!.x + vertex.handleOut!.x).toBeCloseTo(2 * vertex.x, 9);
    expect(vertex.handleIn!.y + vertex.handleOut!.y).toBeCloseTo(2 * vertex.y, 9);

    // C12 — the second toggle retracts the handles: a sharp corner again.
    const back = toggleVertexKind(toSmooth, 1);
    expect(back.points[1]).toEqual({ id: 'b', x: 0.9, y: 0.1, kind: 'corner' });
    expect(back.points[0]).toBe(toSmooth.points[0]);
    expect(toggleVertexKind(path, 7)).toBe(path);
  });

  it('a plain handle drag on a smooth point mirrors the other handle; Alt moves only the dragged one', () => {
    const linked = moveVertexHandle(smooth, 'out', { x: 0, y: 10 });
    expect(linked.handleIn!.x).toBeCloseTo(0, 9);
    expect(linked.handleIn!.y).toBeCloseTo(-10, 9);

    const broken = altMoveVertexHandle(smooth, 'out', { x: 0, y: 10 });
    expect(broken.kind).toBe('corner');
    expect(broken.handleOut).toEqual({ x: 0, y: 10 });
    expect(broken.handleIn).toEqual(smooth.handleIn);
  });

  it('C12 — Alt-drag of a handle on a broken point links the handles again; plain drags then mirror', () => {
    const broken = altMoveVertexHandle(smooth, 'out', { x: 0, y: 10 });
    const relinked = altMoveVertexHandle(broken, 'out', { x: 20, y: 0 });
    expect(relinked.kind).toBe('smooth');
    expect(relinked.handleOut).toEqual({ x: 20, y: 0 });
    // The other handle turns to mirror it and keeps its own length (10).
    expect(relinked.handleIn!.x).toBeCloseTo(-10, 9);
    expect(relinked.handleIn!.y).toBeCloseTo(0, 9);
    const linked = moveVertexHandle(relinked, 'in', { x: 0, y: -5 });
    expect(linked.handleOut!.x).toBeCloseTo(0, 9);
    expect(linked.handleOut!.y).toBeCloseTo(20, 9);
  });

  it('C12 — a corner whose handles were broken apart retracts them on a double-click (C), then gets fresh ones', () => {
    const path: BezierPath = { ...makePath(), points: [makePath().points[0], { ...smooth, id: 'b', x: 0.9, y: 0.1, kind: 'corner', handleIn: { x: 0.8, y: 0.1 }, handleOut: { x: 0.9, y: 0.3 } }, makePath().points[2]] };
    const retracted = toggleVertexKind(path, 1);
    expect(retracted.points[1]).toEqual({ id: 'b', x: 0.9, y: 0.1, kind: 'corner' });
    const again = toggleVertexKind(retracted, 1).points[1];
    expect(again.kind).toBe('smooth');
    expect(again.handleIn).toBeDefined();
    expect(again.handleOut).toBeDefined();
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
