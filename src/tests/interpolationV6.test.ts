import { describe, expect, it } from 'vitest';
import { applyEasing, deriveAutoBezierControlPoints, interpolateChannel } from '../utils/defaults';
import type { PropertyKeyframe } from '../types/animator';

const keyframe = (id: string, frame: number, value: number, easing: PropertyKeyframe['easing'], extra: Partial<PropertyKeyframe> = {}): PropertyKeyframe => ({
  id,
  frame,
  value,
  easing,
  ...extra,
});

describe('V6 interpolation authority', () => {
  it('holds the previous value for hold segments', () => {
    expect(interpolateChannel([
      keyframe('a', 0, 10, 'hold'),
      keyframe('b', 10, 30, 'linear'),
    ], 5, 0)).toBe(10);
  });

  it('uses temporal handles when both segment endpoints define them', () => {
    const value = interpolateChannel([
      keyframe('a', 0, 0, 'bezier', { bezierOut: { x: 0.1, y: 0 } }),
      keyframe('b', 10, 100, 'bezier', { bezierIn: { x: 0.9, y: 0.2 } }),
    ], 5, 0);
    expect(value).toBeCloseTo(20, 4);
  });

  it('derives deterministic auto-bezier controls from neighboring values', () => {
    const controls = deriveAutoBezierControlPoints(
      keyframe('b', 10, 10, 'autoBezier'),
      keyframe('c', 20, 30, 'linear'),
      keyframe('a', 0, 0, 'linear'),
      keyframe('d', 30, 35, 'linear'),
    );
    expect(controls[0]).toBeCloseTo(1 / 3);
    expect(controls[2]).toBeCloseTo(2 / 3);
    expect(controls[1]).toBeGreaterThanOrEqual(0);
    expect(controls[3]).toBeLessThanOrEqual(1);
    expect(applyEasing(0.5, 'hold')).toBe(0);
  });
});
