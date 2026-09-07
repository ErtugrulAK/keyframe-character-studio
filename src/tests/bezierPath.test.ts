import { describe, expect, it } from 'vitest';
import {
  areBezierPathsTopologyCompatible,
  buildBezierPathD,
  buildNormalizedPathD,
  interpolateBezierPath,
  legacyFreeformPointsToPath,
  legacyMaskPointsToPath,
  normalizeBezierPath,
} from '../utils/bezierPath';

describe('bezierPath', () => {
  it('builds straight and cubic SVG segments from one path contract', () => {
    const path = legacyFreeformPointsToPath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(buildBezierPathD(path)).toBe('M 0 0 L 10 0 L 10 10 Z');

    const curved = {
      ...path!,
      points: path!.points.map((point, index) => index === 0
        ? { ...point, handleOut: { x: 4, y: 0 } }
        : index === 1
          ? { ...point, handleIn: { x: 10, y: 4 } }
          : point),
    };
    expect(buildBezierPathD(curved)).toContain('C 4 0, 10 4, 10 0');
  });

  it('maps normalized mask coordinates into local SVG coordinates', () => {
    const path = legacyMaskPointsToPath([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);
    expect(buildNormalizedPathD(path, 200, 100)).toBe('M -100 -50 L 100 -50 L 100 50 Z');
  });

  it('normalizes malformed handles without hiding valid vertices', () => {
    const path = normalizeBezierPath({
      coordinateSpace: 'local',
      closed: false,
      points: [
        { id: 'a', x: 0, y: 0, handleOut: { x: 2, y: 2 } },
        { id: '', x: 1, y: 1, handleIn: { x: 'bad', y: 1 } },
        { x: Number.NaN, y: 2 },
      ],
    }, 'local');
    expect(path).toEqual({
      version: 1,
      coordinateSpace: 'local',
      closed: false,
      points: [
        { id: 'a', x: 0, y: 0, handleOut: { x: 2, y: 2 } },
        { id: 'vertex-1', x: 1, y: 1 },
      ],
    });
  });

  it('interpolates matching topology and holds mismatched topology', () => {
    const first = legacyFreeformPointsToPath([{ x: 0, y: 0 }, { x: 10, y: 0 }], false)!;
    const second = legacyFreeformPointsToPath([{ x: 10, y: 10 }, { x: 20, y: 10 }], false)!;
    const midpoint = interpolateBezierPath(first, second, 0.5);
    expect(midpoint?.points.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 5, y: 5 },
      { x: 15, y: 5 },
    ]);
    expect(areBezierPathsTopologyCompatible(first, second)).toBe(true);

    const mismatched = legacyFreeformPointsToPath([{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 30, y: 10 }], false)!;
    expect(areBezierPathsTopologyCompatible(first, mismatched)).toBe(false);
    expect(interpolateBezierPath(first, mismatched, 0.5)).toBe(first);
  });
  it('rejects coordinate-space mismatches and preserves one-sided handle endpoints', () => {
    const local = {
      ...legacyFreeformPointsToPath([{ x: 0, y: 0 }, { x: 10, y: 0 }], false)!,
      points: [
        { id: 'vertex-0', x: 0, y: 0 },
        { id: 'vertex-1', x: 10, y: 0, handleIn: { x: 8, y: 0 } },
      ],
    };
    const normalized = { ...local, coordinateSpace: 'normalized' as const };
    expect(areBezierPathsTopologyCompatible(local, normalized)).toBe(false);
    const straight = {
      ...local,
      points: local.points.map((point) => ({ ...point, handleIn: undefined })),
    };
    const curved = {
      ...local,
      points: local.points.map((point) => ({ ...point, handleOut: { x: 4, y: 0 } })),
    };
    expect(interpolateBezierPath(straight, curved, 0)?.points[0].handleOut).toBeUndefined();
    expect(interpolateBezierPath(straight, curved, 1)?.points[0].handleOut).toEqual({ x: 4, y: 0 });
  });
});
