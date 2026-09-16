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
});
