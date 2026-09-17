import { describe, expect, it } from 'vitest';
import { initializeSmoothHandles, legacyFreeformPointsToPath, createBezierPath } from '../utils/bezierPath';
import type { BezierPath } from '../types/animator';

const square = (): BezierPath => legacyFreeformPointsToPath([
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 20, y: 20 },
  { x: 0, y: 20 },
], true)!;

const handlesOf = (path: BezierPath, index: number) => path.points[index];

describe('initializeSmoothHandles', () => {
  it('derives mirrored handles from the neighbour chord at a quarter of the shortest span', () => {
    const next = initializeSmoothHandles(square(), 0);

    // Vertex 0 = (0,0); neighbours are (0,20) and (20,0) → chord direction (1,-1) normalized.
    const vertex = handlesOf(next, 0);
    expect(vertex.kind).toBe('smooth');
    // Shortest span is 20 → reach 5 → handles at ±5 along the unit chord.
    expect(vertex.handleOut!.x).toBeCloseTo(5 / Math.SQRT2, 6);
    expect(vertex.handleOut!.y).toBeCloseTo(-5 / Math.SQRT2, 6);
    expect(vertex.handleIn!.x).toBeCloseTo(-5 / Math.SQRT2, 6);
    expect(vertex.handleIn!.y).toBeCloseTo(5 / Math.SQRT2, 6);
  });

  it('leaves untouched vertices byte-identical', () => {
    const path = square();
    const next = initializeSmoothHandles(path, 2);
    expect(next.points[0]).toBe(path.points[0]);
    expect(next.points[1]).toBe(path.points[1]);
    expect(next.points[3]).toBe(path.points[3]);
  });

  it('uses the single existing neighbour at an open path endpoint', () => {
    const open = legacyFreeformPointsToPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }], false)!;
    const first = initializeSmoothHandles(open, 0).points[0];
    expect(first.handleOut!.x).toBeCloseTo(2.5, 6);
    expect(first.handleOut!.y).toBeCloseTo(0, 6);

    const last = initializeSmoothHandles(open, 2).points[2];
    expect(last.handleIn!.x).toBeCloseTo(17.5, 6);
  });

  it('falls back to a unit horizontal direction when the neighbour chord is degenerate', () => {
    const coincident = createBezierPath([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }], 'local', true);
    const vertex = initializeSmoothHandles(coincident, 0).points[0];
    expect(vertex.handleOut).toEqual({ x: 0, y: 0 });
    expect(vertex.handleIn).toEqual({ x: 0, y: 0 });
  });

  it('repairs a partial smooth vertex by mirroring the handle that exists', () => {
    const path = square();
    path.points[1] = { ...path.points[1], kind: 'smooth', handleOut: { x: 26, y: 4 } };
    const vertex = initializeSmoothHandles(path, 1).points[1];
    expect(vertex.handleOut).toEqual({ x: 26, y: 4 });
    expect(vertex.handleIn).toEqual({ x: 14, y: -4 });
  });

  it('never overwrites two existing handles', () => {
    const path = square();
    path.points[1] = { ...path.points[1], handleOut: { x: 26, y: 4 }, handleIn: { x: 14, y: -4 } };
    const vertex = initializeSmoothHandles(path, 1).points[1];
    expect(vertex.handleOut).toEqual({ x: 26, y: 4 });
    expect(vertex.handleIn).toEqual({ x: 14, y: -4 });
  });

  it('keeps existing coordinate space and closed flag', () => {
    const next = initializeSmoothHandles(square(), 3);
    expect(next.coordinateSpace).toBe('local');
    expect(next.closed).toBe(true);
    expect(next.version).toBe(1);
  });
  it('refuses to write a non-finite mirrored handle when the mirror overflows', () => {
    // Selected vertex IS the huge one: vertex (1e308,0) with handleOut (-1e308,0).
    // Its mirror is 2 * 1e308 - (-1e308) = Infinity, so it must not become handleIn.
    const path = legacyFreeformPointsToPath([
      { x: 0, y: 0 },
      { x: 1e308, y: 0 },
      { x: 20, y: 20 },
    ], true)!;
    path.points[1] = { ...path.points[1], handleOut: { x: -1e308, y: 0 } };

    const vertex = initializeSmoothHandles(path, 1).points[1];
    expect(vertex.kind).toBe('smooth');
    expect(Number.isFinite(vertex.handleIn!.x)).toBe(true);
    expect(Number.isFinite(vertex.handleIn!.y)).toBe(true);
    // The mirror is unusable, so handleIn comes from the direction-and-reach rule:
    // finite, inside the vertex→previous span, on the chord side of the vertex.
    expect(vertex.handleIn!.x).toBeLessThan(1e308);
    expect(vertex.handleIn!.x).toBeGreaterThan(0);
    expect(vertex.handleIn!.y).toBeLessThan(0);
    // The existing handle is preserved untouched.
    expect(vertex.handleOut).toEqual({ x: -1e308, y: 0 });
  });

  it('degenerates onto the vertex when even the reach cannot be represented', () => {
    // Over the double range: the chord is Infinity and vertex.x + reach overflows,
    // so the handle must stay at the vertex instead of becoming Infinity.
    const path = legacyFreeformPointsToPath([
      { x: -1e308, y: 0 },
      { x: 1.7e308, y: 0 },
      { x: 1e308, y: 0 },
    ], true)!;

    const first = initializeSmoothHandles(path, 1);
    const second = initializeSmoothHandles(path, 1);
    const vertex = first.points[1];
    expect(vertex.handleOut).toEqual({ x: 1.7e308, y: 0 });
    expect(Number.isFinite(vertex.handleIn!.x)).toBe(true);
    expect(Number.isFinite(vertex.handleOut!.x)).toBe(true);
    expect(second.points[1]).toEqual(vertex);
  });

  it('stays finite and deterministic when the neighbour chord overflows', () => {
    const path = legacyFreeformPointsToPath([
      { x: -1e308, y: 0 },
      { x: 0, y: 0 },
      { x: 1e308, y: 0 },
    ], true)!;

    const first = initializeSmoothHandles(path, 1);
    const second = initializeSmoothHandles(path, 1);
    const vertex = first.points[1];
    expect(Number.isFinite(vertex.handleIn!.x)).toBe(true);
    expect(Number.isFinite(vertex.handleIn!.y)).toBe(true);
    expect(Number.isFinite(vertex.handleOut!.x)).toBe(true);
    expect(Number.isFinite(vertex.handleOut!.y)).toBe(true);
    expect(second.points[1]).toEqual(vertex);
  });
  it('writes no computed handles for a vertex that is itself not finite', () => {
    const path = createBezierPath([{ x: Infinity, y: 0 }, { x: 0, y: 0 }], 'local', false);

    const vertex = initializeSmoothHandles(path, 0).points[0];
    expect(vertex.kind).toBe('smooth');
    expect(vertex.handleIn).toBeUndefined();
    expect(vertex.handleOut).toBeUndefined();
  });

  it('keeps the existing handles of a vertex that is itself not finite', () => {
    const path = createBezierPath([{ x: Infinity, y: 0 }, { x: 0, y: 0 }], 'local', false);
    path.points[0] = { ...path.points[0], handleOut: { x: 5, y: 0 } };

    const vertex = initializeSmoothHandles(path, 0).points[0];
    expect(vertex.handleOut).toEqual({ x: 5, y: 0 });
    expect(vertex.handleIn).toBeUndefined();
  });
});
