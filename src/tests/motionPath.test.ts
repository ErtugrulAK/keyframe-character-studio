import { describe, expect, it } from 'vitest';
import { createMotionPath, measureMotionPath, motionPathPoseAt } from '../utils/geometry/motionPath';

const line = { closed: false, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 300 }] };

describe('motion path', () => {
  it('places progress by LENGTH, not by vertex: halfway is 200 of 400 units', () => {
    const table = measureMotionPath(line)!;
    expect(table.total).toBeCloseTo(400, 6);
    const half = motionPathPoseAt(table, 0.5);
    expect(half.x).toBeCloseTo(100, 6);
    expect(half.y).toBeCloseTo(100, 6);
    // Travelling down the second segment: +90° in SVG's y-down sense.
    expect(half.angle).toBeCloseTo(90, 6);
    const quarter = motionPathPoseAt(table, 0.125);
    expect(quarter.x).toBeCloseTo(50, 6);
    expect(quarter.angle).toBeCloseTo(0, 6);
  });

  it('an open path holds its ends; a closed path loops', () => {
    const table = measureMotionPath(line)!;
    expect(motionPathPoseAt(table, -1)).toMatchObject({ x: 0, y: 0 });
    const end = motionPathPoseAt(table, 2);
    expect(end.x).toBeCloseTo(100, 6);
    expect(end.y).toBeCloseTo(300, 6);
    expect(end.angle).toBeCloseTo(90, 6);

    const square = measureMotionPath({ closed: true, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] })!;
    expect(square.total).toBeCloseTo(40, 6);
    const lap = motionPathPoseAt(square, 1.25);
    expect(lap.x).toBeCloseTo(10, 6);
    expect(lap.y).toBeCloseTo(0, 6);
    // The closing edge runs back up to the start.
    const closing = motionPathPoseAt(square, 0.875);
    expect(closing.x).toBeCloseTo(0, 6);
    expect(closing.y).toBeCloseTo(5, 6);
    expect(closing.angle).toBeCloseTo(-90, 6);
  });

  it('follows a curved segment as drawn: a quarter circle bulges off the chord', () => {
    const k = 0.5522847498307936 * 100;
    const arc = measureMotionPath({
      closed: false,
      points: [
        { x: 100, y: 0, handleOut: { x: 100, y: k } },
        { x: 0, y: 100, handleIn: { x: k, y: 100 } },
      ],
    })!;
    expect(arc.total).toBeCloseTo((Math.PI / 2) * 100, 0);
    const middle = motionPathPoseAt(arc, 0.5);
    expect(Math.hypot(middle.x, middle.y)).toBeCloseTo(100, 0);
    expect(middle.x).toBeCloseTo(middle.y, 3);
    expect(middle.angle).toBeCloseTo(135, 0);
  });

  it('refuses a path with nothing to follow and keeps a zero-length one in place', () => {
    expect(measureMotionPath(undefined)).toBeNull();
    expect(measureMotionPath({ closed: false, points: [{ x: 1, y: 2 }] })).toBeNull();
    expect(measureMotionPath({ closed: false, points: [{ x: 1, y: 2 }, { x: Number.NaN, y: 0 }] })).toBeNull();
    const dot = measureMotionPath({ closed: false, points: [{ x: 5, y: 5 }, { x: 5, y: 5 }] })!;
    expect(motionPathPoseAt(dot, 0.7)).toEqual({ x: 5, y: 5, angle: 0 });
    expect(motionPathPoseAt(measureMotionPath(line)!, Number.NaN)).toMatchObject({ x: 0, y: 0 });
  });

  it('is self-contained, so the runtime can run its source', () => {
    const rebuilt = new Function(`return (${createMotionPath.toString()})();`)() as ReturnType<typeof createMotionPath>;
    const table = rebuilt.measure(line)!;
    expect(rebuilt.poseAt(table, 0.5)).toEqual(motionPathPoseAt(measureMotionPath(line)!, 0.5));
  });
});
