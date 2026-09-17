import { describe, expect, it } from 'vitest';
import type { CharacterPart } from '../types/animator';
import { resolveFreeformPath } from '../utils/freeform';
import { buildBezierPathD, initializeSmoothHandles, legacyFreeformPointsToPath, normalizeBezierPath } from '../utils/bezierPath';

const makePart = (overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id: 'free',
  name: 'Free',
  type: 'custom_freeform',
  zIndex: 1,
  ...overrides,
} as CharacterPart);

describe('resolveFreeformPath', () => {
  it('drops a repeated closing vertex from legacy points instead of materializing a degenerate vertex', () => {
    const part = makePart({
      points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 0 }],
    });

    const path = resolveFreeformPath(part);
    expect(path?.points.map((vertex) => ({ x: vertex.x, y: vertex.y }))).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
    ]);
    expect(path?.coordinateSpace).toBe('local');
    expect(path?.closed).toBe(true);
  });

  it('keeps legacy points untouched and does not mutate the part it resolves', () => {
    const points = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 0 }];
    const part = makePart({ points });
    const before = JSON.stringify(part);

    resolveFreeformPath(part);

    expect(part.points).toBe(points);
    expect(JSON.stringify(part)).toBe(before);
  });

  it('returns undefined when normalization leaves fewer than two legacy points', () => {
    expect(resolveFreeformPath(makePart({ points: [{ x: 5, y: 5 }, { x: 5, y: 5 }] }))).toBeUndefined();
  });

  it('passes a canonical path through untouched, so render authorities keep their exact geometry', () => {
    const path = {
      version: 1 as const,
      coordinateSpace: 'local' as const,
      closed: true,
      points: [
        { id: 'a', x: 0, y: 0, handleOut: { x: 6, y: 0 }, kind: 'smooth' as const },
        { id: 'b', x: 20, y: 0 },
        { id: 'c', x: 20, y: 20 },
      ],
    };
    const part = makePart({
      path,
      // Legacy points deliberately disagree: the canonical path must win.
      points: [{ x: -50, y: -50 }, { x: -40, y: -50 }, { x: -40, y: -40 }],
    });

    const resolved = resolveFreeformPath(part);
    expect(resolved).toBe(path);
    expect(buildBezierPathD(resolved!)).toBe(buildBezierPathD(path));
  });

  it('materializes a local path whose anchors match the normalized legacy polygon', () => {
    const part = makePart({ points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 0 }] });
    const resolved = resolveFreeformPath(part)!;
    const legacy = legacyFreeformPointsToPath([
      { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 },
    ], true)!;

    expect(buildBezierPathD(resolved)).toBe(buildBezierPathD(legacy));
  });

  it('preserves smooth handles of a materialized path across the import sanitizer', () => {
    const legacy = resolveFreeformPath(makePart({
      points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }],
    }))!;
    const materialized = initializeSmoothHandles(legacy, 0);

    const roundTripped = normalizeBezierPath(JSON.parse(JSON.stringify(materialized)), 'local');
    expect(roundTripped).toEqual(materialized);
    expect(buildBezierPathD(roundTripped!)).toBe(buildBezierPathD(materialized));
  });
});
