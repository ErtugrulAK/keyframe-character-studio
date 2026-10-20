/**
 * F5a — Endpoint-slope ↔ temporal-handle conversion (pure math, spec §3/§5).
 *
 * Companion to `docs/KCS_F5_SPEED_GRAPH_INVERSE_SPEC.md` (PR #55): arbitrary
 * speed-graph editing is NOT losslessly representable in the authored model,
 * but a 2-DOF-per-segment endpoint-slope subset is, in closed form. This
 * module is the math only — no UI, no SceneData writes, no second evaluator.
 * Everything that cannot be represented returns an explicit safe outcome;
 * nothing is ever silently approximated.
 *
 * Forward model (the authority, `applyEasing`/`solveCubicBezier`): for one
 * segment with P0=(0,0), P3=(1,1), P1=(outX,outY), P2=(inX,inY):
 *
 *   x(s) = 3(1-s)²s·outX + 3(1-s)s²·inX + s³,   y(s) likewise on the y pair
 *   E(u) = y(x⁻¹(u)),   endpoint slopes E'(0) = outY/outX, E'(1) = (1-inY)/(1-inX)
 *
 * (derivatives x'(0)=3·outX, x'(1)=3(1-inX) and the y analogues; the factors
 * of 3 cancel). Physical velocity is V = k·E'(u) with k = (v1-v0)/Δt —
 * `segmentVelocityScale` below is the ONLY bridge between the dimensionless
 * eased-progress slope and value-units/frame; the two must never be conflated.
 *
 * Degenerate endpoint classes (spec §2.4, §3):
 *  - regular:   x1 > τ (entry) / x2 < 1-τ (exit) — slope is the ratio above.
 *  - limit:     x and y handles both collapse onto the endpoint (x1=y1=0 or
 *               x2=y2=1): the 0/0 resolves by a second L'Hôpital pass to
 *               (inY-2·outY)/(inX-2·outX) at entry, (1+outY-2·inY)/(1+outX-2·inX) at exit.
 *  - cusp:      x-handle at the endpoint but y-handle not (x1=0, y1≠0):
 *               vertical tangent, |E'| = ∞ — never writable from a slope gesture.
 *
 * Inverse (the F5a contract): with x fixed by the value graph, the unique
 * preimage of target slopes (g0, g1) is
 *
 *   outY = g0·outX,    inY = 1 - g1·(1-inX)
 *
 * valid only while both x-handles keep positive distance τ from the singular
 * endpoints; y results are clamped to the storage envelope [-α, 1+α], α=0.5,
 * and any clamp is REPORTED (never silent). Presets may live outside the
 * envelope (spec erratum) — they write through the value graph, not here.
 */

import type { TemporalHandle } from '../types/animator';

/** Minimum x-handle distance from 0/1 that can carry a finite slope. */
export const X_SINGULARITY_TAU = 1e-6;

/** Storage envelope for y handles produced by a speed gesture (spec α=0.5). */
export const SLOPE_ENVELOPE_MIN = -0.5;
export const SLOPE_ENVELOPE_MAX = 1.5;

export type SlopeKind = 'regular' | 'limit' | 'cusp';

/** One endpoint reading; `cusp` carries a signed Infinity. */
export interface SlopeReading {
  kind: SlopeKind;
  value: number;
}

export interface EndpointSlopes {
  entry: SlopeReading;
  exit: SlopeReading;
}

const finite = (value: number): boolean => Number.isFinite(value);

/**
 * Forward: the two endpoint slopes of one segment's stored handles.
 * Never throws; unreadable inputs report `cusp` with NaN, singular geometries
 * classify per the module header.
 */
export function endpointSlopesFromHandles(
  out: TemporalHandle,
  inHandle: TemporalHandle,
): EndpointSlopes {
  if (![out.x, out.y, inHandle.x, inHandle.y].every(finite)) {
    return {
      entry: { kind: 'cusp', value: Number.NaN },
      exit: { kind: 'cusp', value: Number.NaN },
    };
  }
  let entry: SlopeReading;
  if (out.x > X_SINGULARITY_TAU) {
    entry = { kind: 'regular', value: out.y / out.x };
  } else if (Math.abs(out.y) <= X_SINGULARITY_TAU) {
    const denominator = inHandle.x - 2 * out.x;
    entry = Math.abs(denominator) <= X_SINGULARITY_TAU
      ? { kind: 'cusp', value: Number.POSITIVE_INFINITY }
      : { kind: 'limit', value: (inHandle.y - 2 * out.y) / denominator };
  } else {
    entry = { kind: 'cusp', value: Math.sign(out.y) * Number.POSITIVE_INFINITY };
  }
  let exit: SlopeReading;
  if (inHandle.x < 1 - X_SINGULARITY_TAU) {
    exit = { kind: 'regular', value: (1 - inHandle.y) / (1 - inHandle.x) };
  } else if (Math.abs(inHandle.y - 1) <= X_SINGULARITY_TAU) {
    const denominator = 1 + out.x - 2 * inHandle.x;
    exit = Math.abs(denominator) <= X_SINGULARITY_TAU
      ? { kind: 'cusp', value: Number.POSITIVE_INFINITY }
      : { kind: 'limit', value: (1 + out.y - 2 * inHandle.y) / denominator };
  } else {
    exit = { kind: 'cusp', value: -Math.sign(inHandle.y - 1) * Number.POSITIVE_INFINITY };
  }
  return { entry, exit };
}

export type HandleFromSlopesFailure =
  | 'non-finite-input'
  | 'out-x-not-representable'
  | 'in-x-not-representable';

export type HandleFromSlopesResult =
  | {
      ok: true;
      bezierOut: TemporalHandle;
      bezierIn: TemporalHandle;
      /** Endpoints whose y needed envelope clamping — the caller MUST surface this. */
      clamped: Array<'entry' | 'exit'>;
      /** True when a requested slope was mathematically unwritable and clamped. */
      lossy: boolean;
    }
  | { ok: false; reason: HandleFromSlopesFailure };

/**
 * Inverse: closed-form handles for target endpoint slopes (g0, g1), x fixed.
 * Refuses singular x-handles (a finite slope cannot live there) instead of
 * fudging x; clamps y into the storage envelope and reports every clamp.
 */
export function handlesFromEndpointSlopes(request: {
  outX: number;
  inX: number;
  entrySlope: number;
  exitSlope: number;
}): HandleFromSlopesResult {
  const { outX, inX, entrySlope, exitSlope } = request;
  if (![outX, inX, entrySlope, exitSlope].every(finite)) {
    return { ok: false, reason: 'non-finite-input' };
  }
  if (outX <= X_SINGULARITY_TAU || outX >= 1 - X_SINGULARITY_TAU) {
    return { ok: false, reason: 'out-x-not-representable' };
  }
  if (inX <= X_SINGULARITY_TAU || inX >= 1 - X_SINGULARITY_TAU) {
    return { ok: false, reason: 'in-x-not-representable' };
  }
  const clamped: Array<'entry' | 'exit'> = [];
  const rawOutY = entrySlope * outX;
  const outY = Math.min(SLOPE_ENVELOPE_MAX, Math.max(SLOPE_ENVELOPE_MIN, rawOutY));
  if (outY !== rawOutY) clamped.push('entry');
  const rawInY = 1 - exitSlope * (1 - inX);
  const inY = Math.min(SLOPE_ENVELOPE_MAX, Math.max(SLOPE_ENVELOPE_MIN, rawInY));
  if (inY !== rawInY) clamped.push('exit');
  return {
    ok: true,
    bezierOut: { x: outX, y: outY },
    bezierIn: { x: inX, y: inY },
    clamped,
    lossy: clamped.length > 0,
  };
}

export type VelocityScale =
  | { ok: true; k: number; deltaFrames: number; deltaValue: number }
  | { ok: false; reason: 'non-finite-input' | 'zero-duration' | 'zero-displacement' };

/**
 * The ONLY sanctioned bridge between dimensionless slope g and physical
 * velocity V (value-units/frame): V = k·g, k = (v1-v0)/Δt.
 * Zero duration and zero displacement are the spec's non-identifiability
 * limits (L2/L3): speed information does not exist there, so conversion
 * REFUSES rather than inventing one.
 */
export function segmentVelocityScale(
  v0: number,
  v1: number,
  frame0: number,
  frame1: number,
): VelocityScale {
  if (![v0, v1, frame0, frame1].every(finite)) return { ok: false, reason: 'non-finite-input' };
  const deltaFrames = frame1 - frame0;
  if (deltaFrames <= 0) return { ok: false, reason: 'zero-duration' };
  const deltaValue = v1 - v0;
  if (deltaValue === 0) return { ok: false, reason: 'zero-displacement' };
  return { ok: true, k: deltaValue / deltaFrames, deltaFrames, deltaValue };
}

/** Physical (value-units/frame) → dimensionless. Refuses on the invalid scale. */
export function physicalVelocityToNormalized(velocity: number, scale: VelocityScale): number | null {
  if (!scale.ok || !Number.isFinite(velocity)) return null;
  return velocity / scale.k;
}

/** Dimensionless → physical (value-units/frame). Refuses on the invalid scale. */
export function normalizedSlopeToPhysicalVelocity(slope: number, scale: VelocityScale): number | null {
  if (!scale.ok || !Number.isFinite(slope)) return null;
  return slope * scale.k;
}
