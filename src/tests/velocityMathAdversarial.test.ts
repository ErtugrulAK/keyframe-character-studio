/**
 * M2 — Adversarial probes for the derived-velocity helper.
 *
 * Companion to velocityMath.test.ts (the happy-path contract). These cases
 * hunt for mathematical counterexamples: duplicate frames, discontinuities,
 * sub-frame probes, corner semantics, precision at float extremes, and the
 * documented limits (clamped-flat outside, exact-zero hold spans, jump at the
 * hold end corner). Every assertion pins DOCUMENTED behaviour — if one of
 * these ever changes, either the docs or the helper must move first,
 * deliberately.
 */

import { describe, expect, it } from 'vitest';
import { channelVelocityAt, sampleChannelVelocity } from '../utils/velocityMath';
import type { PropertyKeyframe } from '../types/animator';

const kf = (
  id: string,
  frame: number,
  value: number,
  easing: PropertyKeyframe['easing'] = 'linear',
  extra: Partial<PropertyKeyframe> = {},
): PropertyKeyframe => ({ id, frame, value, easing, ...extra });

describe('M2 — duplicate and degenerate key geometry', () => {
  const duplicates = [
    kf('a', 0, 0),
    kf('a2', 0, 50), // same frame, different value: an authored discontinuity
    kf('b', 10, 100),
  ];

  it('never throws or returns non-finite at a duplicate-frame key', () => {
    const sample = channelVelocityAt(duplicates, 0);
    expect(Number.isFinite(sample.velocity)).toBe(true);
  });

  it('interior probes near duplicates stay finite', () => {
    for (const frame of [0.1, 0.25, 0.5, 1, 5, 9, 9.5, 9.9]) {
      expect(Number.isFinite(channelVelocityAt(duplicates, frame).velocity)).toBe(true);
    }
  });

  it('zero-duration middle (duplicate in the middle of the channel)', () => {
    const keys = [kf('a', 0, 0), kf('b', 5, 10), kf('b2', 5, 90), kf('c', 10, 100)];
    expect(Number.isFinite(channelVelocityAt(keys, 5).velocity)).toBe(true);
    expect(Number.isFinite(channelVelocityAt(keys, 5.001).velocity)).toBe(true);
  });

  it('identical values on two adjacent keys report exactly zero velocity (zero displacement)', () => {
    const keys = [kf('a', 0, 42), kf('b', 10, 42)];
    expect(channelVelocityAt(keys, 0).velocity).toBe(0);
    expect(channelVelocityAt(keys, 5).velocity).toBe(0);
    expect(channelVelocityAt(keys, 10).velocity).toBe(0);
  });

  it('single-key channels are flat; fallback applies only to the EMPTY channel', () => {
    const single = [kf('a', 3, 7)];
    expect(channelVelocityAt(single, 3)).toEqual({ frame: 3, value: 7, velocity: 0 });
    // Outside the span the evaluator clamps to the key (defaults.ts exact /
    // boundary lines); the fallback parameter is reserved for the empty
    // channel, as the helper's own docstring documents.
    expect(channelVelocityAt(single, 99, -1).value).toBe(7);
    expect(channelVelocityAt([], 99, -1)).toEqual({ frame: 99, value: -1, velocity: 0 });
  });

  it('unsorted input is irrelevant (the helper sorts internally)', () => {
    const up = [kf('a', 0, 0), kf('b', 10, 100)];
    const down = [kf('b', 10, 100), kf('a', 0, 0)];
    expect(channelVelocityAt(down, 5).velocity).toBe(channelVelocityAt(up, 5).velocity);
  });
});

describe('M2 — HOLD boundaries', () => {
  const holdKeys = [kf('a', 0, 0), kf('b', 10, 50, 'hold'), kf('c', 20, 100)];

  it('hold span is exactly zero at every probe inside it', () => {
    for (const frame of [10, 10.2, 10.5, 15, 19, 19.9]) {
      expect(channelVelocityAt(holdKeys, frame).velocity).toBe(0);
    }
  });

  it('hold RESUMES only after the end key; the end corner shows the jump', () => {
    expect(channelVelocityAt(holdKeys, 15).velocity).toBe(0);
    // At the end key the authority takes the key's own value (exact-match
    // rule), so the backward probe legitimately measures the documented hold
    // discontinuity (50 -> 100 over the probe window): finite, non-zero.
    const corner = channelVelocityAt(holdKeys, 20);
    expect(corner.velocity).toBeGreaterThan(100);
    expect(Number.isFinite(corner.velocity)).toBe(true);
  });

  it('probes adjacent to the discontinuity stay finite', () => {
    expect(Number.isFinite(channelVelocityAt(holdKeys, 19.999).velocity)).toBe(true);
  });
});

describe('M2 — corners, probes and one-sided semantics', () => {
  const V = [kf('a', 0, 0), kf('b', 10, 100), kf('c', 20, 0)];

  it('probe at the very last key uses the backward segment (negative slope visible)', () => {
    expect(channelVelocityAt(V, 20).velocity).toBeLessThan(0);
  });

  it('probe at the first key uses the forward segment', () => {
    expect(channelVelocityAt(V, 0).velocity).toBeGreaterThan(0);
  });

  it('out-of-range probes are documented flat zero on BOTH sides', () => {
    expect(channelVelocityAt(V, -0.001).velocity).toBe(0);
    expect(channelVelocityAt(V, 20.001).velocity).toBe(0);
    expect(channelVelocityAt(V, -1000).velocity).toBe(0);
    expect(channelVelocityAt(V, 1000).velocity).toBe(0);
  });

  it('two interior probes inside one linear segment agree exactly', () => {
    const near0 = channelVelocityAt(V, 2).velocity;
    const nearMid = channelVelocityAt(V, 5).velocity;
    expect(Math.abs(near0 - nearMid)).toBeLessThan(1e-9);
  });
});

describe('M2 — sub-frame and non-uniform timing', () => {
  it('sub-frame probes are deterministic and repeat bit-for-bit', () => {
    const keys = [kf('a', 0, 0), kf('b', 7, -33.5), kf('c', 13, 12.25)];
    const first = channelVelocityAt(keys, 6.666666);
    const second = channelVelocityAt(keys, 6.666666);
    expect(second.velocity).toBe(first.velocity);
  });

  it('non-uniform spacing: velocity tracks the local segment, not the global one', () => {
    const keys = [kf('a', 0, 0), kf('b', 1, 100), kf('c', 100, 100)];
    expect(channelVelocityAt(keys, 0.3).velocity).toBeGreaterThan(50); // steep early
    expect(channelVelocityAt(keys, 50).velocity).toBe(0); // flat by-value span
  });

  it('sampled sweep always includes both endpoints verbatim, fractional or not', () => {
    const keys = [kf('a', 0, 0), kf('b', 10, 100)];
    const sweep = sampleChannelVelocity(keys, 0, 10.5);
    expect(sweep[0].frame).toBe(0);
    expect(sweep[sweep.length - 1].frame).toBe(10.5);
  });
});

describe('M2 — temporal-handle overrides', () => {
  const eased = [
    kf('a', 0, 0, 'linear', { bezierOut: { x: 0.42, y: 0 }, bezierIn: { x: 0.58, y: 1 } }),
    kf('b', 100, 100, 'linear', { bezierIn: { x: 0.58, y: 1 }, bezierOut: { x: 0.42, y: 0 } }),
  ];

  it('a full handle pair overrides the easing NAME (start velocity near zero despite linear)', () => {
    const v = channelVelocityAt(eased, 0).velocity;
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(0.5); // k=1: FD residue only; pure linear would read 1.0
  });

  it('half-handle pairs (pairing incomplete) fall back to the named easing', () => {
    const oneSided = [
      kf('a', 0, 0, 'linear'),
      kf('b', 100, 100, 'linear', { bezierOut: { x: 0.42, y: 0 } }),
    ];
    // Pairing is prev.bezierOut && next.bezierIn: incomplete pair -> linear.
    expect(channelVelocityAt(oneSided, 50).velocity).toBeCloseTo(1, 9);
  });
});

describe('M2 — numeric conditioning', () => {
  it('astronomic values keep finite slopes', () => {
    const keys = [kf('a', 0, -1e9), kf('b', 10, 1e9)];
    const sample = channelVelocityAt(keys, 5);
    expect(Number.isFinite(sample.velocity)).toBe(true);
    expect(sample.velocity).toBeCloseTo(2e8, 0);
  });

  it('sub-milli values do not underflow to a wrong sign', () => {
    const keys = [kf('a', 0, 0), kf('b', 10, 0.0005)];
    expect(channelVelocityAt(keys, 5).velocity).toBeGreaterThan(0);
  });

  it('NaN-tainted keys poison the sample, never the process', () => {
    const keys = [kf('a', 0, Number.NaN), kf('b', 10, 10)];
    const sample = channelVelocityAt(keys, 5);
    expect(Number.isNaN(sample.velocity)).toBe(true);
  });

  it('one-frame segments stay finite (minimum integer Δt)', () => {
    const keys = [kf('a', 0, 0), kf('b', 1, 360)];
    expect(channelVelocityAt(keys, 0.5).velocity).toBeCloseTo(360, 6);
  });
});
