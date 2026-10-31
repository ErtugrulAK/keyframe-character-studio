/**
 * F5a unit coverage — closed-form endpoint-slope ↔ handle math.
 * Analytic fixtures first, then seeded property sweeps; T1 parity is measured
 * through the SHIPPED helper (channelVelocityAt), never a second evaluator.
 */

import { describe, expect, it } from 'vitest';
import {
  SLOPE_ENVELOPE_MAX,
  SLOPE_ENVELOPE_MIN,
  endpointSlopesFromHandles,
  handlesFromEndpointSlopes,
  normalizedSlopeToPhysicalVelocity,
  physicalVelocityToNormalized,
  segmentVelocityScale,
} from '../utils/animation/speedInverse';
import { channelVelocityAt } from '../utils/animation/velocityMath';
import type { PropertyKeyframe } from '../types/animator';

const h = (x: number, y: number) => ({ x, y });

describe('endpointSlopesFromHandles — analytic table', () => {
  it('linear (1/3, 1/3, 2/3, 2/3): slope 1 at both ends', () => {
    const slopes = endpointSlopesFromHandles(h(1 / 3, 1 / 3), h(2 / 3, 2 / 3));
    expect(slopes.entry).toEqual({ kind: 'regular', value: 1 });
    expect(slopes.exit).toEqual({ kind: 'regular', value: 1 });
  });

  it('easeInOut (0.42, 0, 0.58, 1): 0 at both ends', () => {
    const slopes = endpointSlopesFromHandles(h(0.42, 0), h(0.58, 1));
    expect(slopes.entry.value).toBeCloseTo(0, 12);
    expect(slopes.exit.value).toBeCloseTo(0, 12);
  });

  it('easeIn preset (0.42, 0, 1, 1): regular 0 entry, L\'Hôpital limit exit 1/(1-0.42)', () => {
    const slopes = endpointSlopesFromHandles(h(0.42, 0), h(1, 1));
    expect(slopes.entry.kind).toBe('regular');
    expect(slopes.exit.kind).toBe('limit');
    expect(slopes.exit.value).toBeCloseTo((1 - 0) / (1 - 0.42), 12);
  });

  it('anticipate preset: negative entry slope is a regular reading', () => {
    const slopes = endpointSlopesFromHandles(h(0.6, -0.28), h(0.735, 0.045));
    expect(slopes.entry).toEqual({ kind: 'regular', value: -0.28 / 0.6 });
  });

  it('entry cusp (x1=0, y1>0): +Infinity, classified not thrown', () => {
    const slopes = endpointSlopesFromHandles(h(0, 0.3), h(0.5, 0.5));
    expect(slopes.entry.kind).toBe('cusp');
    expect(slopes.entry.value).toBe(Number.POSITIVE_INFINITY);
  });

  it('V6 correction — fully collapsed (0,0 / 0,0) is the identity: slope 1, not a cusp', () => {
    const slopes = endpointSlopesFromHandles(h(0, 0), h(0, 0));
    expect(slopes.entry.kind).toBe('limit');
    expect(slopes.entry.value).toBe(1);
  });

  it('V6 correction — symmetric exit collapse (1,1 / 1,1) also reads 1', () => {
    const slopes = endpointSlopesFromHandles(h(1, 1), h(1, 1));
    expect(slopes.exit.kind).toBe('limit');
    expect(slopes.exit.value).toBe(1);
  });

  it('V6 correction — near-singular but live (1e-7, 1e-7 / .5, .2) keeps its REAL first-order slope 1', () => {
    const slopes = endpointSlopesFromHandles(h(1e-7, 1e-7), h(0.5, 0.2));
    expect(slopes.entry.kind).toBe('regular');
    expect(slopes.entry.value).toBeCloseTo(1, 12);
  });

  it('parabolic cusp (0,0 / 0, .3): second-order numerator live, denominator dead', () => {
    const slopes = endpointSlopesFromHandles(h(0, 0), h(0, 0.3));
    expect(slopes.entry.kind).toBe('cusp');
    expect(slopes.entry.value).toBe(Number.POSITIVE_INFINITY);
  });

  it('entry limit (0,0 / 0.5,0.2): second-order ratio y2/x2', () => {
    const slopes = endpointSlopesFromHandles(h(0, 0), h(0.5, 0.2));
    expect(slopes.entry.kind).toBe('limit');
    expect(slopes.entry.value).toBeCloseTo(0.4, 12);
  });

  it('exit cusp (x2=1, y2<1): signed +Infinity (y′(1) = 3(1−y2) > 0 over a double-zero-free positive x′)', () => {
    // Analytic: x′(s) = 3(1−s)²·… + … → live near s=1 with x′(1)=0 and
    // x″(1) = 6(1+0.3−2·1) < 0 ⇒ x′(s) ≈ −x″(1)(1−s) > 0; y′(1) = 1.8 > 0
    // ⇒ ratio diverges positive.
    const slopes = endpointSlopesFromHandles(h(0.3, 0.3), h(1, 0.4));
    expect(slopes.exit.kind).toBe('cusp');
    expect(slopes.exit.value).toBe(Number.POSITIVE_INFINITY);
  });

  it('non-finite inputs: both endpoints cusp-NaN', () => {
    const slopes = endpointSlopesFromHandles(h(Number.NaN, 0), h(0.5, Number.POSITIVE_INFINITY));
    expect(slopes.entry.kind).toBe('cusp');
    expect(Number.isNaN(slopes.entry.value)).toBe(true);
  });
});

describe('handlesFromEndpointSlopes — inverse, envelope, refusals', () => {
  it('exact preimage: (0.42, 0.58) + (0.2, 1.7) → (0.42,0.084)/(0.58,0.286)', () => {
    const result = handlesFromEndpointSlopes({ outX: 0.42, inX: 0.58, entrySlope: 0.2, exitSlope: 1.7 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bezierOut.x).toBe(0.42);
    expect(result.bezierOut.y).toBeCloseTo(0.084, 12);
    expect(result.bezierIn.x).toBe(0.58);
    expect(result.bezierIn.y).toBeCloseTo(1 - 1.7 * (1 - 0.58), 12);
    expect(result.clamped).toEqual([]);
    expect(result.lossy).toBe(false);
  });


  it('round-trip through the forward reading is exact to 1e-12', () => {
    const result = handlesFromEndpointSlopes({ outX: 0.33, inX: 0.67, entrySlope: 1, exitSlope: 1 });
    if (!result.ok) throw new Error('expected ok');
    const slopes = endpointSlopesFromHandles(result.bezierOut, result.bezierIn);
    expect(slopes.entry.value).toBeCloseTo(1, 12);
    expect(slopes.exit.value).toBeCloseTo(1, 12);
  });

  it('envelope clamp is reported, never silent: g0=10 at x1=0.42', () => {
    const result = handlesFromEndpointSlopes({ outX: 0.42, inX: 0.58, entrySlope: 10, exitSlope: 0 });
    if (!result.ok) throw new Error('expected ok');
    expect(result.bezierOut.y).toBe(SLOPE_ENVELOPE_MAX);
    expect(result.clamped).toEqual(['entry']);
    expect(result.lossy).toBe(true);
  });

  it('negative slope clamps at the lower envelope for large anticipation', () => {
    const result = handlesFromEndpointSlopes({ outX: 0.1, inX: 0.9, entrySlope: -20, exitSlope: 0 });
    if (!result.ok) throw new Error('expected ok');
    expect(result.bezierOut.y).toBe(SLOPE_ENVELOPE_MIN);
    expect(result.clamped).toContain('entry');
  });

  it('singular x handles refuse instead of fudging x', () => {
    expect(handlesFromEndpointSlopes({ outX: 0, inX: 0.5, entrySlope: 1, exitSlope: 1 }))
      .toEqual({ ok: false, reason: 'out-x-not-representable' });
    expect(handlesFromEndpointSlopes({ outX: 0.5, inX: 1, entrySlope: 1, exitSlope: 1 }))
      .toEqual({ ok: false, reason: 'in-x-not-representable' });
  });

  it('non-finite inputs refuse', () => {
    expect(handlesFromEndpointSlopes({ outX: 0.5, inX: Number.NaN, entrySlope: 1, exitSlope: 1 }))
      .toEqual({ ok: false, reason: 'non-finite-input' });
  });
});

describe('segmentVelocityScale + unit bridge', () => {
  it('k scales with frame duration: same g, double Δt halves V', () => {
    const a = segmentVelocityScale(0, 100, 0, 10);
    const b = segmentVelocityScale(0, 100, 0, 20);
    if (!a.ok || !b.ok) throw new Error('expected ok scales');
    expect(normalizedSlopeToPhysicalVelocity(2, a)).toBeCloseTo(20, 12);
    expect(normalizedSlopeToPhysicalVelocity(2, b)).toBeCloseTo(10, 12);
  });

  it('zero displacement and zero duration refuse (non-identifiability)', () => {
    expect(segmentVelocityScale(5, 5, 0, 10)).toEqual({ ok: false, reason: 'zero-displacement' });
    expect(segmentVelocityScale(0, 10, 4, 4)).toEqual({ ok: false, reason: 'zero-duration' });
  });

  it('signed channels convert through the signed scale', () => {
    const scale = segmentVelocityScale(100, 0, 0, 10); // k = -10
    if (!scale.ok) throw new Error('expected ok');
    expect(normalizedSlopeToPhysicalVelocity(1, scale)).toBeCloseTo(-10, 12);
    expect(physicalVelocityToNormalized(-5, scale)).toBeCloseTo(0.5, 12);
  });

  it('bridge refuses on invalid scale or non-finite velocity', () => {
    const dead = segmentVelocityScale(5, 5, 0, 10);
    expect(physicalVelocityToNormalized(3, dead)).toBeNull();
    const live = segmentVelocityScale(0, 10, 0, 10);
    expect(physicalVelocityToNormalized(Number.NaN, live)).toBeNull();
  });
});

describe('T1 parity — forward helper agrees with endpoint slopes', () => {
  // The shipped helper is a central/one-sided difference with window
  // ε ≤ 0.25 frames; discretisation error is O(k·E″·ε/Δt), so the parity
  // tolerance below is ε/Δt-scaled, not arbitrary.
  const key = (id: string, frame: number, value: number, out: { x: number; y: number }, inHandle: { x: number; y: number }): PropertyKeyframe =>
    ({ id, frame, value, easing: 'cubic_bezier', bezierOut: out, bezierIn: inHandle });

  const cases: Array<[string, { x: number; y: number }, { x: number; y: number }]> = [
    ['linear', h(1 / 3, 1 / 3), h(2 / 3, 2 / 3)],
    ['easeInOut', h(0.42, 0), h(0.58, 1)],
    ['overshoot', h(0.175, 0.885), h(0.32, 1.275)],
    ['anticipate', h(0.6, -0.28), h(0.735, 0.045)],
  ];

  it.each(cases)('%s: helper velocity just inside the entry matches k·E′(0) within the FD bound', (_name, out, inHandle) => {
    const frames = 100;
    const channel = [key('a', 0, 0, out, inHandle), key('b', frames, 100, out, inHandle)];
    const slopes = endpointSlopesFromHandles(out, inHandle);
    expect(slopes.entry.kind).toBe('regular');
    const expected = (100 / frames) * slopes.entry.value; // k = 1
    const probe = 0.3; // interior with the whole FD window on-segment (ε = 0.25)
    const measured = channelVelocityAt(channel, probe).velocity;
    const bound = 0.5 * (0.25 / frames) * 8; // |E″| ≤ ~8 for envelope-legit handles
    expect(Math.abs(measured - expected)).toBeLessThanOrEqual(Math.max(0.06, Math.abs(expected) * 0.06 + bound));
  });

  it('easeInOut entry (slope 0): helper reads a small positive FD residue, not noise-level garbage', () => {
    const channel = [key('a', 0, 0, h(0.42, 0), h(0.58, 1)), key('b', 100, 100, h(0.42, 0), h(0.58, 1))];
    const measured = channelVelocityAt(channel, 0).velocity; // on-key forward probe
    expect(measured).toBeGreaterThanOrEqual(0);
    expect(measured).toBeLessThan(0.2); // k=1; E'(0)=0, FD residue one order of ε/Δt down
  });
});

describe('F5a seeded property sweep', () => {
  // Deterministic LCG — no Math.random, no seeds leaking across runs.
  const lcg = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  it('200 random admissible (x, g) pairs: inverse writes stay in the envelope and read back at the clamped slope', () => {
    const rand = lcg(20261020);
    for (let attempt = 0; attempt < 200; attempt++) {
      const outX = 0.05 + rand() * 0.9;
      const inX = 0.05 + rand() * 0.9;
      const entrySlope = -6 + rand() * 14;
      const exitSlope = -6 + rand() * 14;
      const result = handlesFromEndpointSlopes({ outX, inX, entrySlope, exitSlope });
      if (!result.ok) throw new Error(`unexpected refusal: ${JSON.stringify(result)}`);
      expect(result.bezierOut.y).toBeGreaterThanOrEqual(SLOPE_ENVELOPE_MIN);
      expect(result.bezierOut.y).toBeLessThanOrEqual(SLOPE_ENVELOPE_MAX);
      expect(result.bezierIn.y).toBeGreaterThanOrEqual(SLOPE_ENVELOPE_MIN);
      expect(result.bezierIn.y).toBeLessThanOrEqual(SLOPE_ENVELOPE_MAX);
      const slopes = endpointSlopesFromHandles(result.bezierOut, result.bezierIn);
      const clampedEntry = Math.min(SLOPE_ENVELOPE_MAX, Math.max(SLOPE_ENVELOPE_MIN, entrySlope * outX));
      const clampedExit = Math.min(SLOPE_ENVELOPE_MAX, Math.max(SLOPE_ENVELOPE_MIN, 1 - exitSlope * (1 - inX)));
      expect(slopes.entry.value).toBeCloseTo(clampedEntry / outX, 9);
      expect(slopes.exit.value).toBeCloseTo((1 - clampedExit) / (1 - inX), 9);
      // A clamp must be reported exactly when the target was outside the envelope.
      const expectEntryClamp = entrySlope * outX < SLOPE_ENVELOPE_MIN || entrySlope * outX > SLOPE_ENVELOPE_MAX;
      expect(result.clamped.includes('entry')).toBe(expectEntryClamp);
    }
  });

  it('near-singular x handles (1e-7) refuse rather than report astronomic slopes', () => {
    const result = handlesFromEndpointSlopes({ outX: 1e-7, inX: 0.5, entrySlope: 3, exitSlope: 3 });
    expect(result).toEqual({ ok: false, reason: 'out-x-not-representable' });
  });

  it('editor/runtime parity: an inverse-written segment keeps its endpoint slopes under the authority forward reading (T2 subset)', () => {
    // Exact-subset round trip: slope → handle → forward slope. The forward
    // reading IS the authority expression (the helper above is proven against
    // the FD helper in T1), so a hit inside 1e-12 is the closed-form claim.
    const rand = lcg(31337);
    for (let attempt = 0; attempt < 25; attempt++) {
      const outX = 0.1 + rand() * 0.8;
      const inX = 0.1 + rand() * 0.8;
      const entrySlope = rand() * 3;
      const exitSlope = rand() * 3;
      const yEntry = entrySlope * outX;
      const yExit = 1 - exitSlope * (1 - inX);
      if (yEntry < SLOPE_ENVELOPE_MIN || yEntry > SLOPE_ENVELOPE_MAX) continue;
      if (yExit < SLOPE_ENVELOPE_MIN || yExit > SLOPE_ENVELOPE_MAX) continue;
      const result = handlesFromEndpointSlopes({ outX, inX, entrySlope, exitSlope });
      if (!result.ok || result.lossy) throw new Error('in-envelope targets must not be lossy');
      const slopes = endpointSlopesFromHandles(result.bezierOut, result.bezierIn);
      expect(Math.abs(slopes.entry.value - entrySlope)).toBeLessThan(1e-12);
      expect(Math.abs(slopes.exit.value - exitSlope)).toBeLessThan(1e-12);
    }
  });
});

describe('V6 — overflow guards, exit clamp, independent FD oracle', () => {
  it('finite inputs, infinite k: overflow is an explicit refusal', () => {
    expect(segmentVelocityScale(1e308, -1e308, 0, 2)).toEqual({ ok: false, reason: 'overflow-result' });
  });

  it('bridge refuses non-finite results from tiny/huge operands', () => {
    const tiny = segmentVelocityScale(0, 1e-300, 0, 1);
    expect(physicalVelocityToNormalized(1e300, tiny)).toBeNull(); // 1e600 → refused
    const huge = segmentVelocityScale(0, 1e300, 0, 1);
    expect(normalizedSlopeToPhysicalVelocity(1e10, huge)).toBeNull(); // 1e310 → refused
  });

  it('exit clamp is reported with truthful metadata', () => {
    const result = handlesFromEndpointSlopes({ outX: 0.4, inX: 0.9, entrySlope: 0, exitSlope: -20 });
    if (!result.ok) throw new Error('expected ok');
    expect(result.bezierIn.y).toBe(SLOPE_ENVELOPE_MAX);
    expect(result.clamped).toEqual(['exit']);
    expect(result.lossy).toBe(true);
  });

  it('regular slopes match an independent parametric FD oracle (no shared closed form)', () => {
    const cubic = (s: number, a: number, b: number) => 3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s;
    let seed = 90210;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };
    for (let attempt = 0; attempt < 30; attempt++) {
      const out = { x: 0.15 + rand() * 0.7, y: rand() * 1.6 - 0.3 };
      const inHandle = { x: 0.15 + rand() * 0.7, y: rand() * 1.6 - 0.3 };
      const slopes = endpointSlopesFromHandles(out, inHandle);
      expect(slopes.entry.kind).toBe('regular');
      const hSmall = 1e-4;
      const approx = (cubic(2 * hSmall, out.y, inHandle.y) - cubic(hSmall, out.y, inHandle.y))
        / (cubic(2 * hSmall, out.x, inHandle.x) - cubic(hSmall, out.x, inHandle.x));
      expect(Math.abs(slopes.entry.value - approx) / Math.max(1, Math.abs(slopes.entry.value))).toBeLessThan(0.02);
    }
  });
});

describe('V7 — signed cusp tiers (reflected-parameter reasoning) and scale-range refusals', () => {
  // Independent oracle: raw Bernstein secant slopes from the endpoint into
  // the interior. The sign of the secant just inside a diverging endpoint IS
  // the sign of the cusp — no production coefficient arithmetic involved.
  const bern = (s: number, a: number, b: number) =>
    3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s;
  const entrySecant = (out: { x: number; y: number }, inH: { x: number; y: number }, t: number) =>
    (bern(t, out.y, inH.y) - bern(0, out.y, inH.y)) / (bern(t, out.x, inH.x) - bern(0, out.x, inH.x));
  const exitSecant = (out: { x: number; y: number }, inH: { x: number; y: number }, t: number) =>
    (bern(1, out.y, inH.y) - bern(1 - t, out.y, inH.y)) / (bern(1, out.x, inH.x) - bern(1 - t, out.x, inH.x));

  it('exit second-order cusp, rising side (x1=x2=1, y2=1, y1=0.5): +Infinity', () => {
    // X(t) = t³ alone: x′ approaches zero from +side as 3t²; Y(t) ≈ 1.5t² −
    // 0.5t³: the ratio (1−y)/(1−x) ≈ 1.5/t diverges POSITIVE. The sign is the
    // numerator's own vanishing order (t¹ ⇒ factor −1 at the exit) against
    // the denominator's order 2 (factor +1) — a −1·(+1)·sign(d2y)·sign(d3x)
    // rule, NOT sign(d2y) alone.
    const slopes = endpointSlopesFromHandles(h(1, 0.5), h(1, 1));
    expect(slopes.exit.kind).toBe('cusp');
    expect(slopes.exit.value).toBe(Number.POSITIVE_INFINITY);
    expect(Math.sign(exitSecant(h(1, 0.5), h(1, 1), 1e-3))).toBe(1);
  });

  it('exit second-order cusp, falling side (y1=1.5): −Infinity — both signs read from the same rule', () => {
    const slopes = endpointSlopesFromHandles(h(1, 1.5), h(1, 1));
    expect(slopes.exit.kind).toBe('cusp');
    expect(slopes.exit.value).toBe(Number.NEGATIVE_INFINITY);
    expect(Math.sign(exitSecant(h(1, 1.5), h(1, 1), 1e-3))).toBe(-1);
  });

  it('symmetric entry second-order cusp: mirror pair (1−E(1−u)) flips the SAME way', () => {
    // Mirroring the rising exit fixture through out′=(1−x2,1−y2),
    // in′=(1−x1,1−y1) and E′(u)=1−E(1−u) preserves endpoint slope SIGNS
    // (two reflections cancel): exit +∞ ↔ entry +∞, exit −∞ ↔ entry −∞.
    expect(endpointSlopesFromHandles(h(0, 0), h(0, 0.5)).entry)
      .toEqual({ kind: 'cusp', value: Number.POSITIVE_INFINITY });
    expect(Math.sign(entrySecant(h(0, 0), h(0, 0.5), 1e-3))).toBe(1);
    expect(endpointSlopesFromHandles(h(0, 0), h(0, -0.5)).entry)
      .toEqual({ kind: 'cusp', value: Number.NEGATIVE_INFINITY });
    expect(Math.sign(entrySecant(h(0, 0), h(0, -0.5), 1e-3))).toBe(-1);
  });

  it('exit first-order numerator over SECOND-order x (x1=x2=1, y2<1): +Infinity (dir[0]·dir[2] = +1)', () => {
    const slopes = endpointSlopesFromHandles(h(1, 0.5), h(1, 0.8));
    expect(slopes.exit.kind).toBe('cusp');
    expect(slopes.exit.value).toBe(Number.POSITIVE_INFINITY);
    expect(Math.sign(exitSecant(h(1, 0.5), h(1, 0.8), 1e-4))).toBe(1);
  });

  it('out-of-domain flip (x1=1.5, x2=1, y2<1): −Infinity — the order-1 exit coefficient enters negated', () => {
    // The READ path is defined for every finite storage pair (write policy
    // lives in handlesFromEndpointSlopes only): x′(s) < 0 just inside the
    // exit here, so the live ratio diverges negative.
    const slopes = endpointSlopesFromHandles(h(1.5, 1), h(1, 0.5));
    expect(slopes.exit.kind).toBe('cusp');
    expect(slopes.exit.value).toBe(Number.NEGATIVE_INFINITY);
    expect(Math.sign(exitSecant(h(1.5, 1), h(1, 0.5), 1e-4))).toBe(-1);
  });

  it('out-of-domain flip at entry (x1=0, in.x<0): −Infinity — entry dir is +1,+1,+1 but d2x carries the sign', () => {
    const slopes = endpointSlopesFromHandles(h(0, 0.3), h(-0.5, 0.3));
    expect(slopes.entry.kind).toBe('cusp');
    expect(slopes.entry.value).toBe(Number.NEGATIVE_INFINITY);
    expect(Math.sign(entrySecant(h(0, 0.3), h(-0.5, 0.3), 1e-4))).toBe(-1);
  });

  it('collapsed identity and regular expectations survive the sign rule', () => {
    expect(endpointSlopesFromHandles(h(0, 0), h(0, 0)).entry).toEqual({ kind: 'limit', value: 1 });
    expect(endpointSlopesFromHandles(h(1, 1), h(1, 1)).exit).toEqual({ kind: 'limit', value: 1 });
    expect(endpointSlopesFromHandles(h(1e-7, 1e-7), h(0.5, 0.2)).entry)
      .toEqual({ kind: 'regular', value: 1 });
    const easeIn = endpointSlopesFromHandles(h(0.42, 0), h(1, 1));
    expect(easeIn.exit.kind).toBe('limit'); // equal orders: the −1 factors cancel
    expect(easeIn.exit.value).toBeCloseTo(1 / (1 - 0.42), 12);
  });

  it('overflowed frame difference (finite inputs): explicit overflow-result, never an ok scale', () => {
    expect(segmentVelocityScale(0, 1, -1e308, 1e308)).toEqual({ ok: false, reason: 'overflow-result' });
  });

  it('underflowed displacement (finite inputs, k collapses to zero): overflow-result', () => {
    const refused = segmentVelocityScale(0, Number.MIN_VALUE, 0, 2); // k = 5e-324/2 → 0
    expect(refused).toEqual({ ok: false, reason: 'overflow-result' });
    expect(physicalVelocityToNormalized(2, refused)).toBeNull();
  });

  it('overflowed endpoint-value difference: overflow-result', () => {
    expect(segmentVelocityScale(-1e308, 1e308, 0, 2)).toEqual({ ok: false, reason: 'overflow-result' });
  });

  it('tiny-but-real scales stay ok and bridge exactly', () => {
    const scale = segmentVelocityScale(0, Number.MIN_VALUE, 0, 1); // k = MIN_VALUE exactly
    if (!scale.ok) throw new Error(`expected ok, got ${JSON.stringify(scale)}`);
    expect(scale.k).toBe(Number.MIN_VALUE);
    expect(physicalVelocityToNormalized(1e-323, scale)).toBe(2);
  });

  it('representable scale round-trips exactly through the signed bridge', () => {
    const scale = segmentVelocityScale(64, 0, 0, 8); // k = −8 (descending channel)
    if (!scale.ok) throw new Error('expected ok scale');
    expect(normalizedSlopeToPhysicalVelocity(0.5, scale)).toBe(-4);
    expect(physicalVelocityToNormalized(-4, scale)).toBe(0.5);
  });
});

describe('V7.1 — R5 range-unavailable forward readings and truthful inverse lossy', () => {
  // A real finite coefficient ratio that overflows IEEE double is neither a
  // vertical tangent (no signed ∞) nor a finite limit — it reads back as the
  // existing unavailable sentinel { kind: 'cusp', value: NaN }. True cusps
  // (denominator vanishing EARLIER than the numerator) keep signed Infinity.

  it('entry equal-order(1) overflow, supervisor repro (0,0)|(MIN,MAX): cusp-NaN, not limit-∞', () => {
    // Analytic: both axes live at order 1; L'Hôpital ratio = MAX/MIN ≈ 3.6e631 —
    // a finite real outside the IEEE range, NOT a geometric cusp. Exit: order-0
    // live, (1−MAX)/(1−MIN) = −MAX exactly (finite).
    const slopes = endpointSlopesFromHandles(h(0, 0), h(Number.MIN_VALUE, Number.MAX_VALUE));
    expect(slopes.entry).toEqual({ kind: 'cusp', value: Number.NaN });
    expect(slopes.exit).toEqual({ kind: 'regular', value: -Number.MAX_VALUE });
  });

  it('sign of an overflowing equal-order ratio is dropped, not faked as signed ∞', () => {
    const slopes = endpointSlopesFromHandles(h(0, 0), h(Number.MIN_VALUE, -Number.MAX_VALUE));
    expect(slopes.entry.kind).toBe('cusp');
    expect(Number.isNaN(slopes.entry.value)).toBe(true);
    expect(slopes.exit).toEqual({ kind: 'regular', value: Number.MAX_VALUE });
  });

  it('live first-order ratio overflow is range-unavailable, not a cusp ∞ (both signs)', () => {
    // x′(0) = 3·MIN ≠ 0: the tangent is NOT vertical; the slope 1/MIN ≈ 2.0e323
    // is finite but unrepresentable, so no sign can be honestly attached.
    const up = endpointSlopesFromHandles(h(Number.MIN_VALUE, 1), h(0.5, 0.5));
    expect(up.entry.kind).toBe('cusp');
    expect(Number.isNaN(up.entry.value)).toBe(true);
    const down = endpointSlopesFromHandles(h(Number.MIN_VALUE, -1), h(0.5, 0.5));
    expect(down.entry.kind).toBe('cusp');
    expect(Number.isNaN(down.entry.value)).toBe(true);
  });

  it('exit equal-order(1) overflow (0.5,−MAX)|(1,1): both endpoints range-unavailable', () => {
    // Entry order-0 live: −MAX/0.5 = −2^1024 overflows. Exit equal order 1:
    // (outY−1)/(outX−1) = −MAX/−0.5 = +2^1024 overflows. Neither is a true cusp.
    const slopes = endpointSlopesFromHandles(h(0.5, -Number.MAX_VALUE), h(1, 1));
    expect(slopes.entry.kind).toBe('cusp');
    expect(Number.isNaN(slopes.entry.value)).toBe(true);
    expect(slopes.exit.kind).toBe('cusp');
    expect(Number.isNaN(slopes.exit.value)).toBe(true);
  });

  it('boundary octave: 2^1000/2^-23 stays a finite limit; 2^1000/2^-24 is range-unavailable', () => {
    // Pure power-of-two arithmetic is exact: the finite side must keep its
    // truthful {limit, 2^1023} reading; one octave further overflows.
    expect(endpointSlopesFromHandles(h(0, 0), h(2 ** -23, 2 ** 1000)).entry)
      .toEqual({ kind: 'limit', value: 2 ** 1023 });
    expect(endpointSlopesFromHandles(h(0, 0), h(2 ** -24, 2 ** 1000)).entry.kind).toBe('cusp');
    expect(Number.isNaN(endpointSlopesFromHandles(h(0, 0), h(2 ** -24, 2 ** 1000)).entry.value)).toBe(true);
  });

  it('true divergent cusp keeps signed ∞ even with an astronomic numerator', () => {
    // x leads at order 2 (d2x = 0), y at order 1 (2^1000): the ratio genuinely
    // diverges like 1/t — a vertical tangent, so the ∞ must survive the fix.
    expect(endpointSlopesFromHandles(h(0, 0), h(0, 2 ** 1000)).entry)
      .toEqual({ kind: 'cusp', value: Number.POSITIVE_INFINITY });
  });

  it('entry underflow: ±MIN_VALUE stores as ±0 for a real request — lossy true, clamped untouched', () => {
    const pos = handlesFromEndpointSlopes({ outX: 0.42, inX: 0.58, entrySlope: Number.MIN_VALUE, exitSlope: Number.MIN_VALUE });
    if (!pos.ok) throw new Error('expected ok');
    expect(pos.bezierOut.y).toBe(0);
    expect(pos.bezierIn.y).toBe(1);
    expect(pos.clamped).toEqual([]); // not an envelope event
    expect(pos.lossy).toBe(true);    // nonzero request reads back exactly zero: total loss
    const neg = handlesFromEndpointSlopes({ outX: 0.42, inX: 0.58, entrySlope: -Number.MIN_VALUE, exitSlope: -Number.MIN_VALUE });
    if (!neg.ok) throw new Error('expected ok');
    expect(Object.is(neg.bezierOut.y, -0)).toBe(true);
    expect(neg.lossy).toBe(true);
  });

  it('exit cancellation boundary at the exact half-ULP of 1, both signs', () => {
    // (1−inX) = 0.42. 1e-16·0.42 = 4.2e-17 < 2^-54 (half-ULP below 1) ⇒ 1−p
    // rounds to exactly 1 and the stored curve reads slope 0: material loss.
    // 2e-16·0.42 = 8.4e-17 > half-ULP ⇒ rounds to pred(1); the surviving
    // read-back is ≈2.6e-16, cancellation amplifying rounding to ~30% of the
    // request — ordinary floating-point noise on a representable reading.
    // The flag is structural (collapse / subnormal mismatch), never a
    // universal error-bound guarantee, so this row must stay lossy=false.
    const below = handlesFromEndpointSlopes({ outX: 0.42, inX: 0.58, entrySlope: 0, exitSlope: 1e-16 });
    if (!below.ok) throw new Error('expected ok');
    expect(below.bezierIn.y).toBe(1);
    expect(below.clamped).toEqual([]);
    expect(below.lossy).toBe(true);
    const negBelow = handlesFromEndpointSlopes({ outX: 0.42, inX: 0.58, entrySlope: 0, exitSlope: -1e-16 });
    if (!negBelow.ok) throw new Error('expected ok');
    expect(negBelow.bezierIn.y).toBe(1); // 1+4.2e-17 also rounds to exactly 1
    expect(negBelow.lossy).toBe(true);
    const above = handlesFromEndpointSlopes({ outX: 0.42, inX: 0.58, entrySlope: 0, exitSlope: 2e-16 });
    if (!above.ok) throw new Error('expected ok');
    expect(above.bezierIn.y).toBe(1 - 2 ** -53);
    expect(above.lossy).toBe(false);
    const negAbove = handlesFromEndpointSlopes({ outX: 0.42, inX: 0.58, entrySlope: 0, exitSlope: -2e-16 });
    if (!negAbove.ok) throw new Error('expected ok');
    // Half-ULP asymmetry at 1, negative side: the grid ABOVE 1 is 2^-52 wide
    // (half-step 2^-53), so +8.4e-17 of cancellation still rounds to exactly
    // 1 where the positive twin above survives as pred(1). Signed behavior
    // of the shipped collapse flag, pinned (V7.1 rework item 4).
    expect(negAbove.bezierIn.y).toBe(1);
    expect(negAbove.lossy).toBe(true);
  });

  it('tiny 1e-20 (supervisor repro): collapsed exit is lossy though the entry round-trips exact', () => {
    const both = handlesFromEndpointSlopes({ outX: 0.42, inX: 0.58, entrySlope: 1e-20, exitSlope: 1e-20 });
    if (!both.ok) throw new Error('expected ok');
    expect(both.clamped).toEqual([]);
    expect(both.bezierIn.y).toBe(1);
    expect(both.lossy).toBe(true);
    const entryOnly = handlesFromEndpointSlopes({ outX: 0.42, inX: 0.58, entrySlope: 1e-20, exitSlope: 0 });
    if (!entryOnly.ok) throw new Error('expected ok');
    expect(entryOnly.lossy).toBe(false);
    expect(endpointSlopesFromHandles(entryOnly.bezierOut, entryOnly.bezierIn).entry.value).toBe(1e-20);
  });

  it('forward total-underflow of a finite nonzero ratio is range-unavailable, not a fabricated zero (both branches)', () => {
    // Supervisor repro (0,0)|(MAX,MIN): both axes live at order 1, the true
    // L'Hôpital ratio MIN/MAX ≈ 2.8e-632 is a NONZERO real below the IEEE
    // subnormal floor, so fl() is +0. `{limit, 0}` would assert a flat
    // endpoint — a lie about the geometry; report unavailable, same as for
    // overflow. Exit is untouched: order-0 live with (1−MIN)/(1−MAX) =
    // −5.56e-309, a nonzero subnormal — an honest regular reading.
    const slopes = endpointSlopesFromHandles(h(0, 0), h(Number.MAX_VALUE, Number.MIN_VALUE));
    expect(slopes.entry).toEqual({ kind: 'cusp', value: Number.NaN });
    expect(slopes.exit.kind).toBe('regular');
    expect(slopes.exit.value).not.toBe(0);
    // First-order twin: x′(0)=MAX live, y′(0)=MIN live; the slope MIN/MAX
    // underflows to +0 over a live tangent. A regular 0 would fabricate a
    // flat entry — range-unavailable, never a true cusp-∞ either.
    const first = endpointSlopesFromHandles(h(Number.MAX_VALUE, Number.MIN_VALUE), h(0.5, 0.5));
    expect(first.entry).toEqual({ kind: 'cusp', value: Number.NaN });
    expect(first.exit).toEqual({ kind: 'regular', value: 1 });
  });

  it('only TOTAL loss to zero refuses: a subnormal-nonzero ratio and an exact-zero numerator stay truthful', () => {
    // (0,0)|(0.5, MIN): equal-order ratio MIN/0.5 = 2·MIN is representable on
    // the subnormal ladder — an honest tiny finite limit, NOT a refusal.
    expect(endpointSlopesFromHandles(h(0, 0), h(0.5, Number.MIN_VALUE)).entry)
      .toEqual({ kind: 'limit', value: 2 * Number.MIN_VALUE });
    // d1y exactly 0 over live d1x: the flat endpoint's regular 0 is TRUE zero.
    expect(endpointSlopesFromHandles(h(0.42, 0), h(0.58, 1)).entry)
      .toEqual({ kind: 'regular', value: 0 });
  });

  it('supervisor counterexample 3·MIN at outX 0.5: subnormal quantization read back as 4·MIN is lossy, both signs', () => {
    // fl(3·MIN × 0.5) ties-to-even → stores 2·MIN; the forward API then reads
    // 2·MIN/0.5 = 4·MIN — a 33.3% error against a representable request.
    // Real information loss on the subnormal ladder: the EXISTING lossy flag
    // must say true (V7.1 rework: not only ±0 total collapse is material).
    const pos = handlesFromEndpointSlopes({ outX: 0.5, inX: 0.58, entrySlope: 3 * Number.MIN_VALUE, exitSlope: 0 });
    if (!pos.ok) throw new Error('expected ok');
    expect(pos.bezierOut.y).toBe(2 * Number.MIN_VALUE);
    expect(endpointSlopesFromHandles(pos.bezierOut, pos.bezierIn).entry.value).toBe(4 * Number.MIN_VALUE);
    expect(pos.lossy).toBe(true);
    expect(pos.clamped).toEqual([]); // structural loss, not an envelope event
    const neg = handlesFromEndpointSlopes({ outX: 0.5, inX: 0.58, entrySlope: -3 * Number.MIN_VALUE, exitSlope: 0 });
    if (!neg.ok) throw new Error('expected ok');
    expect(Object.is(neg.bezierOut.y, -2 * Number.MIN_VALUE)).toBe(true);
    expect(endpointSlopesFromHandles(neg.bezierOut, neg.bezierIn).entry.value).toBe(-4 * Number.MIN_VALUE);
    expect(neg.lossy).toBe(true);
  });
  it('subnormal entry rows: the forward read-back decides, no tolerance anywhere', () => {
    // Decimal path: 3e-320 (≈6072·MIN) stores exactly 2550·MIN and reads back
    // as 2.9995e-320 ≠ request → flagged. This corrects the earlier wrong
    // "255·MIN" note and its sample 2e-3 bound; every figure below is the
    // exact IEEE value, derived, not sampled.
    const r = handlesFromEndpointSlopes({ outX: 0.42, inX: 0.58, entrySlope: 3e-320, exitSlope: 0 });
    if (!r.ok) throw new Error('expected ok');
    expect(r.bezierOut.y).toBe(2550 * Number.MIN_VALUE);
    expect(endpointSlopesFromHandles(r.bezierOut, r.bezierIn).entry.value).toBe(2.9995e-320);
    expect(r.lossy).toBe(true);
    expect(r.clamped).toEqual([]);
    // Power-of-two ladder: 10200·MIN × 0.25 = 2550·MIN EXACT on the subnormal
    // grid and the read-back divides back exactly → no flag despite a
    // subnormal product. Quantization per se is not the trigger; a read-back
    // mismatch is.
    const lad = handlesFromEndpointSlopes({ outX: 0.25, inX: 0.58, entrySlope: 10200 * Number.MIN_VALUE, exitSlope: 0 });
    if (!lad.ok) throw new Error('expected ok');
    expect(lad.bezierOut.y).toBe(2550 * Number.MIN_VALUE);
    expect(endpointSlopesFromHandles(lad.bezierOut, lad.bezierIn).entry.value).toBe(10200 * Number.MIN_VALUE);
    expect(lad.lossy).toBe(false);
    // Quantized yet self-consistent: 2·MIN × 0.42 stores MIN but reads back
    // the request exactly — nothing observable was lost, lossy stays false.
    const keep = handlesFromEndpointSlopes({ outX: 0.42, inX: 0.58, entrySlope: 2 * Number.MIN_VALUE, exitSlope: 0 });
    if (!keep.ok) throw new Error('expected ok');
    expect(keep.bezierOut.y).toBe(Number.MIN_VALUE);
    expect(keep.lossy).toBe(false);
    // Normal-range 1-ULP round-trip drift is ordinary IEEE rounding, NOT a
    // flagged event: 0.1 × 0.77 stores 0.07700000000000001 and reads back
    // 0.10000000000000002 — the gate is subnormality AND mismatch, never
    // mismatch alone, and never a percent tolerance.
    const norm = handlesFromEndpointSlopes({ outX: 0.77, inX: 0.58, entrySlope: 0.1, exitSlope: 0 });
    if (!norm.ok) throw new Error('expected ok');
    expect(norm.bezierOut.y).toBe(0.07700000000000001);
    expect(endpointSlopesFromHandles(norm.bezierOut, norm.bezierIn).entry.value).toBe(0.10000000000000002);
    expect(norm.lossy).toBe(false);
  });
});
