/**
 * B1 — derived channel velocity math.
 *
 * The module forbids a parallel interpolation engine, so the tests pin the
 * contract to the shared scalar authority (`interpolateChannel`) instead of
 * to any re-implemented easing math: exact closed forms where the span is
 * linear, structural invariants everywhere else.
 */

import { describe, expect, it } from 'vitest';
import type { PropertyKeyframe } from '../types/animator';
import { channelVelocityAt, sampleChannelVelocity } from '../utils/velocityMath';
import { interpolateChannel } from '../utils/defaults';

const kf = (
  id: string,
  frame: number,
  value: number,
  easing: PropertyKeyframe['easing'] = 'linear',
  extra: Partial<PropertyKeyframe> = {},
): PropertyKeyframe => ({ id, frame, value, easing, ...extra });

describe('channelVelocityAt — flat regions', () => {
  it('is exactly zero on an empty channel and reports the fallback value', () => {
    const sample = channelVelocityAt([], 10, 42);
    expect(sample).toEqual({ frame: 10, value: 42, velocity: 0 });
  });

  it('is exactly zero for a single key and outside the animated span', () => {
    const one = [kf('a', 5, 100)];
    expect(channelVelocityAt(one, 5, 0).velocity).toBe(0);
    const span = [kf('a', 5, 0), kf('b', 25, 200)];
    expect(channelVelocityAt(span, 1).velocity).toBe(0);
    expect(channelVelocityAt(span, 40).velocity).toBe(0);
    // Clamped values themselves still come from the authority.
    expect(channelVelocityAt(span, 40).value).toBe(200);
  });

  it('is exactly zero across a hold span even when the values differ', () => {
    const keys = [kf('a', 0, 0, 'hold'), kf('b', 10, 500)];
    for (const frame of [1, 3.5, 5, 9, 9.9]) {
      expect(channelVelocityAt(keys, frame).velocity).toBe(0);
      // Consistency with the value the runtime itself would show.
      expect(channelVelocityAt(keys, frame).value).toBe(interpolateChannel(keys, frame, 0));
    }
  });
});

describe('channelVelocityAt — linear spans are exact', () => {
  const keys = [kf('a', 2, 10), kf('b', 6, 30)]; // slope = 20/4 = 5

  it('reports the closed-form slope at interior, end-inclusive probes', () => {
    for (const frame of [2.01, 3, 4, 4.5, 5.99]) {
      expect(channelVelocityAt(keys, frame).velocity).toBeCloseTo(5, 9);
    }
  });

  it('reads the one-sided slope exactly on a keyframe corner', () => {
    expect(channelVelocityAt(keys, 2).velocity).toBeCloseTo(5, 9);
  });

  it('flips sign with direction and stays deterministic', () => {
    const down = [kf('a', 2, 30), kf('b', 6, 10)];
    expect(channelVelocityAt(down, 4).velocity).toBeCloseTo(-5, 9);
    expect(channelVelocityAt(keys, 4)).toEqual(channelVelocityAt(keys, 4));
  });
});

describe('channelVelocityAt — eased spans obey the authority', () => {
  const spanKeys = (easing: PropertyKeyframe['easing']) => [
    kf('a', 0, 0, easing),
    kf('b', 10, 100),
  ];

  it('is never negative and never exceeds the cubic bound on an increasing easeInOut span', () => {
    const keys = spanKeys('easeInOut');
    for (let frame = 0.5; frame <= 9.5; frame += 0.5) {
      const v = channelVelocityAt(keys, frame).velocity;
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(-1e-9);
      // Cubic-bezier (0.42,0,0.58,1): parametric slope peaks at t=0.5 with
      // dy/dt = 1.5, dx/dt = 0.87 → eased slope ≤ 1.724, span slope 10.
      expect(v).toBeLessThanOrEqual(17.25);
    }
  });

  it('is symmetric about the midpoint of a symmetric easing', () => {
    const keys = spanKeys('easeInOut');
    const left = channelVelocityAt(keys, 3).velocity;
    const right = channelVelocityAt(keys, 7).velocity;
    expect(left).toBeCloseTo(right, 6);
  });

  it('starts and ends near zero for an in-easing', () => {
    const keys = spanKeys('easeIn');
    expect(Math.abs(channelVelocityAt(keys, 0.05).velocity)).toBeLessThan(1);
    expect(channelVelocityAt(keys, 9.75).velocity).toBeGreaterThan(1);
  });

  it('stays finite and bounded for wilder curves (bounce, elastic, anticipate)', () => {
    for (const easing of ['bounce', 'elastic', 'anticipate', 'overshoot'] as const) {
      const keys = spanKeys(easing);
      for (const frame of [0.25, 1, 2.5, 5, 7.5, 9, 9.75]) {
        const v = channelVelocityAt(keys, frame).velocity;
        expect(Number.isFinite(v)).toBe(true);
        expect(Math.abs(v)).toBeLessThan(10_000);
      }
    }
  });

  it('honours explicit bezier control points via the same authority path', () => {
    const keys: PropertyKeyframe[] = [
      kf('a', 0, 0, 'cubic_bezier', { bezierControlPoints: [0.1, 0.9, 0.2, 1] }),
      kf('b', 10, 100),
    ];
    // A steep-then-flat curve: front-loaded motion must show as early speed.
    expect(channelVelocityAt(keys, 0.5).velocity).toBeGreaterThan(
      channelVelocityAt(keys, 5).velocity,
    );
  });

  it('measures temporal-handle segments through the authority', () => {
    const keys: PropertyKeyframe[] = [
      kf('a', 0, 0, 'bezier', { bezierOut: { x: 0.33, y: 0 }, bezierIn: { x: 0.67, y: 1 } }),
      kf('b', 10, 50, 'linear', { bezierIn: { x: 0.33, y: 0 } }),
    ];
    const mid = channelVelocityAt(keys, 5);
    expect(Number.isFinite(mid.velocity)).toBe(true);
    expect(mid.velocity).toBeGreaterThan(0);
  });
});

describe('sampleChannelVelocity', () => {
  const keys = [kf('a', 0, 0), kf('b', 10, 20)]; // slope 2

  it('covers an inclusive span with whole steps and exact endpoint samples', () => {
    const samples = sampleChannelVelocity(keys, 0, 10, 2);
    expect(samples).toHaveLength(6);
    expect(samples[0].frame).toBe(0);
    expect(samples[samples.length - 1].frame).toBe(10);
    for (const sample of samples.slice(1, -1)) {
      expect(sample.velocity).toBeCloseTo(2, 9);
    }
  });

  it('appends a fractional end frame when the span is not step-divisible', () => {
    const samples = sampleChannelVelocity(keys, 1, 5.5, 2);
    expect(samples[samples.length - 1].frame).toBe(5.5);
  });

  it('returns nothing for inverted spans or non-positive steps', () => {
    expect(sampleChannelVelocity(keys, 5, 1)).toEqual([]);
    expect(sampleChannelVelocity(keys, 1, 5, 0)).toEqual([]);
  });
});
