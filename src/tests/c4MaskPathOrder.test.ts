import { describe, expect, it } from 'vitest';
import type { BezierPath } from '../types/animator';
import { sampleBezierPath } from '../utils/geometry/bezierPath';
import { applyPathOrderEdit, applyPathOrderEditEverywhere, planPathOrderEdit, type PathOrderCommand } from '../utils/geometry/maskPathOrder';

const curved = (closed = true): BezierPath => ({
  version: 1,
  coordinateSpace: 'normalized',
  closed,
  points: [
    { id: 'a', x: 0.1, y: 0.1, kind: 'smooth', handleIn: { x: 0.05, y: 0.2 }, handleOut: { x: 0.2, y: 0.02 } },
    { id: 'b', x: 0.9, y: 0.1, kind: 'corner' },
    { id: 'c', x: 0.8, y: 0.85, kind: 'smooth', handleIn: { x: 0.95, y: 0.7 }, handleOut: { x: 0.6, y: 0.95 } },
    { id: 'd', x: 0.15, y: 0.8, kind: 'corner', handleOut: { x: 0.1, y: 0.6 } },
  ],
} as BezierPath);

const run = (path: BezierPath, command: PathOrderCommand, selected: number | null) => {
  const plan = planPathOrderEdit(path, command, selected);
  if (!plan.ok) throw new Error(plan.reason);
  const next = applyPathOrderEdit(path, plan.edit);
  if (!next) throw new Error('not applied');
  return { next, selectedIndex: plan.selectedIndex };
};

/** Same outline: every sampled point of one lies on (a sample of) the other. */
const sameOutline = (first: BezierPath, second: BezierPath) => {
  const a = sampleBezierPath(first, 64);
  const b = sampleBezierPath(second, 64);
  const near = (p: { x: number; y: number }, list: { x: number; y: number }[]) => list.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-9);
  return a.every((p) => near(p, b)) && b.every((p) => near(p, a));
};

describe('C4 mask path structure commands', () => {
  it('close/open change only the flag — points, handles and kinds are untouched', () => {
    const open = run(curved(), 'open', 1).next;
    expect(open.closed).toBe(false);
    expect(open.points).toEqual(curved().points);
    const closed = run(open, 'close', 1).next;
    expect(closed).toEqual(curved());
  });

  it('a path needs three points to close; an already closed/open path is refused', () => {
    const two: BezierPath = { ...curved(false), points: curved().points.slice(0, 2) };
    expect(planPathOrderEdit(two, 'close', null)).toMatchObject({ ok: false });
    expect(planPathOrderEdit(curved(), 'close', null)).toMatchObject({ ok: false, reason: 'The path is already closed.' });
  });

  it('reverse keeps the outline, swaps every point handle pair, and keeps a closed path first point', () => {
    for (const closed of [true, false]) {
      const { next, selectedIndex } = run(curved(closed), 'reverse', 2);
      expect(sameOutline(curved(closed), next)).toBe(true);
      expect(next.points.map((point) => point.id)).toEqual(closed ? ['a', 'd', 'c', 'b'] : ['d', 'c', 'b', 'a']);
      const c = next.points.find((point) => point.id === 'c')!;
      expect(c.handleIn).toEqual({ x: 0.6, y: 0.95 });
      expect(c.handleOut).toEqual({ x: 0.95, y: 0.7 });
      expect(c.kind).toBe('smooth');
      expect(next.points[selectedIndex!].id).toBe('c'); // the selection follows its point
      expect(run(next, 'reverse', null).next).toEqual(curved(closed)); // twice = identity
    }
  });

  it('first point keeps a closed outline and follows the selected point; refused on an open path', () => {
    const { next, selectedIndex } = run(curved(), 'first', 2);
    expect(next.points.map((point) => point.id)).toEqual(['c', 'd', 'a', 'b']);
    expect(selectedIndex).toBe(0);
    expect(sameOutline(curved(), next)).toBe(true);
    expect(planPathOrderEdit(curved(false), 'first', 2)).toMatchObject({ ok: false });
    expect(planPathOrderEdit(curved(), 'first', 0)).toMatchObject({ ok: false });
    expect(planPathOrderEdit(curved(), 'first', null)).toMatchObject({ ok: false, reason: 'Select a point first.' });
  });

  it('earlier/later swap the point with its neighbour in the path order (the outline changes) and stop at the ends', () => {
    const { next, selectedIndex } = run(curved(), 'earlier', 2);
    expect(next.points.map((point) => point.id)).toEqual(['a', 'c', 'b', 'd']);
    expect(selectedIndex).toBe(1);
    expect(sameOutline(curved(), next)).toBe(false);
    expect(run(curved(), 'later', 1).next.points.map((point) => point.id)).toEqual(['a', 'c', 'b', 'd']);
    expect(planPathOrderEdit(curved(), 'earlier', 0)).toMatchObject({ ok: false });
    expect(planPathOrderEdit(curved(), 'later', 3)).toMatchObject({ ok: false });
  });

  it('one edit applies to the static path and every keyframe, keeping them interpolation-compatible', () => {
    const base = curved();
    const keyed = { ...curved(), points: curved().points.map((point) => ({ ...point, x: point.x + 0.05 })) };
    const plan = planPathOrderEdit(base, 'reverse', null);
    if (!plan.ok) throw new Error(plan.reason);
    const outcome = applyPathOrderEditEverywhere(base, [base, keyed], plan.edit);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const ids = (path: BezierPath) => path.points.map((point) => point.id);
    expect(ids(outcome.keyframePaths[0])).toEqual(ids(outcome.base));
    expect(ids(outcome.keyframePaths[1])).toEqual(ids(outcome.base));
    expect(sameOutline(keyed, outcome.keyframePaths[1])).toBe(true);
  });

  it('refuses the whole edit when a keyframe does not share the points (nothing half-applied)', () => {
    const base = curved();
    const other = { ...curved(), points: curved().points.slice(0, 3) };
    const plan = planPathOrderEdit(base, 'open', null);
    if (!plan.ok) throw new Error(plan.reason);
    expect(applyPathOrderEditEverywhere(base, [base, other], plan.edit)).toMatchObject({ ok: false });
  });

  it('refuses a path whose points share an id', () => {
    const duplicated = { ...curved(), points: [...curved().points.slice(0, 3), { ...curved().points[3], id: 'a' }] };
    expect(planPathOrderEdit(duplicated, 'reverse', null)).toMatchObject({ ok: false });
  });
});
