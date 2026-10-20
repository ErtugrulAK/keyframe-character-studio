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
 *   u = x(s),   E(u) = y(s) = y(x⁻¹(u))
 *   E'(0) = outY/outX,   E'(1) = (1-inY)/(1-inX)      (first-order, when live)
 *
 * (derivatives x'(0)=3·outX, x'(1)=3(1-inX) and the y analogues; the factors
 * of 3 cancel). Physical velocity is V = k·E'(u) with k = (v1-v0)/Δt —
 * `segmentVelocityScale` below is the ONLY bridge between the dimensionless
 * eased-progress slope and value-units/frame; the two must never be conflated.
 *
 * Degenerate endpoint classes (spec §2.4, §3; V6-corrected):
 *  - regular:   first-order x derivative > 0 — slope is the live ratio, exact
 *               at near-zero magnitudes (conditioning is documented, not feared).
 *  - limit:     derivative descent by L'Hôpital when lower orders vanish
 *               exactly (second order, then third; fully-collapsed corners
 *               resolve to slope 1, matching the identity curve).
 *  - cusp:      the x-derivative vanishes at the leading live order while a
 *               y-derivative does not — vertical tangent, signed infinity.
 */

import type { TemporalHandle } from '../types/animator';

/** Minimum x-handle distance from 0/1 that a GESTURE may author (write policy). */
export const X_SINGULARITY_TAU = 1e-6;

/** Storage envelope for y handles produced by a speed gesture (spec α=0.5). */
export const SLOPE_ENVELOPE_MIN = -0.5;
export const SLOPE_ENVELOPE_MAX = 1.5;

export type SlopeKind = 'regular' | 'limit' | 'cusp';

/** One endpoint reading; `cusp` carries a signed Infinity (or NaN when undefined). */
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
 *
 * V6 classification proceeds strictly by DERIVATIVE ORDER, never by an
 * epsilon-blended threshold (review findings 4A/4B):
 *
 *  - live first-order x (d1x ≠ 0): REGULAR — the derivative ratio y1/x1 is
 *    the live slope (exact at x1 = 1e-7 as at 0.42).
 *  - x vanishing at order k ≥ 1 with the y-derivative vanishing EARLIER:
 *    CUSP — vertical tangent, signed infinity. The sign follows the live
 *    derivative just INSIDE the endpoint: in the reflected parameter
 *    t = 1 − s the series alternates (X(t) = d1·t − d2·t² + d3·t³), so the
 *    exit multiplies its k-th-order coefficient by (−1)^k; the entry does
 *    not. Finite equal-order ratios are untouched — the factors cancel
 *    between the axes — only the divergent reading needs the order parity.
 *  - both first derivatives exactly zero: descend to the second-order
 *    L'Hôpital pair; live denominator → LIMIT; zero denominator with live
 *    numerator → CUSP; both zero → third order. A cubic's third derivative
 *    cannot vanish together with the lower two unless the curve is the
 *    identity, which yields slope 1 at both fully-collapsed corners
 *    (0,0 / 0,0) and (1,1 / 1,1).
 *
 * Epsilon thresholds are a WRITE-POLICY concern (handlesFromEndpointSlopes
 * refuses to author near-singular x — see its docs), never a READ shortcut:
 * a (1e-7, 1e-7) entry reads its real slope 1, not a surrogate limit.
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
  // Per-axis leading vanishing order and its stored coefficient.
  const lead = (d1: number, d2: number, d3: number) =>
    d1 !== 0
      ? { order: 0 as const, value: d1 }
      : d2 !== 0
        ? { order: 1 as const, value: d2 }
        : d3 !== 0
          ? { order: 2 as const, value: d3 }
          : null;
  // dir[k] = sign the k-th-order coefficient contributes to the live
  // derivative approaching the endpoint from the interior (entry: +1,+1,+1;
  // exit, reflected parameter t = 1−s: +1,−1,+1).
  const descent = (
    d1x: number,
    d1y: number,
    d2x: number,
    d2y: number,
    d3x: number,
    d3y: number,
    dir: readonly [number, number, number],
  ): SlopeReading => {
    const xl = lead(d1x, d2x, d3x);
    const yl = lead(d1y, d2y, d3y);
    // A cubic joining (0,0) to (1,1) cannot vanish at every derivative order
    // on one axis; null is only reachable through non-finite input, refused
    // above — keep an honest undefined reading as the defensive fallback.
    if (xl === null || yl === null) return { kind: 'cusp', value: Number.NaN };
    if (xl.order === 0) {
      const value = d1y / d1x;
      return finite(value) ? { kind: 'regular', value } : { kind: 'cusp', value: Math.sign(value) * Number.POSITIVE_INFINITY };
    }
    // Equal orders: a finite L'Hôpital limit, the direction factors cancel.
    if (yl.order === xl.order) return { kind: 'limit', value: yl.value / xl.value };
    // Numerator vanishes later: the endpoint is flat, the limit is 0.
    if (yl.order > xl.order) return { kind: 'limit', value: 0 };
    // Divergent: sign = (numerator coefficient × its direction) ÷ (denominator
    // coefficient × its direction); division by ±1 is multiplication.
    const sign = dir[yl.order] * dir[xl.order] * Math.sign(yl.value) * Math.sign(xl.value);
    return { kind: 'cusp', value: sign * Number.POSITIVE_INFINITY };
  };
  // Entry derivatives: d1=(x1,y1); d2/6=(x2−2x1, y2−2y1); d3/6=(1−3x2+3x1, 1−3y2+3y1).
  const entry = descent(
    out.x,
    out.y,
    inHandle.x - 2 * out.x,
    inHandle.y - 2 * out.y,
    1 - 3 * inHandle.x + 3 * out.x,
    1 - 3 * inHandle.y + 3 * out.y,
    [1, 1, 1],
  );
  // Exit mirrors through the complement (t → 1−t): d1=(1−x2, 1−y2);
  // d2/6=(1+x1−2x2, 1+y1−2y2); d3/6=(1−3x2+3x1, 1−3y2+3y1).
  const exit = descent(
    1 - inHandle.x,
    1 - inHandle.y,
    1 + out.x - 2 * inHandle.x,
    1 + out.y - 2 * inHandle.y,
    1 - 3 * inHandle.x + 3 * out.x,
    1 - 3 * inHandle.y + 3 * out.y,
    [1, -1, 1],
  );
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
      /** True when a requested slope was unwritable inside the envelope and clamped. */
      lossy: boolean;
    }
  | { ok: false; reason: HandleFromSlopesFailure };

/**
 * Inverse: closed-form handles for target endpoint slopes (g0, g1), x fixed.
 *
 * The [tau, 1−tau] x-window is a WRITE-CONDITIONING POLICY, not the storage
 * domain: the evaluator accepts any finite x and endpointSlopesFromHandles
 * READS near-singular handles exactly. Authoring through a gesture refuses
 * near-singular x instead of writing numerically fragile curves. The
 * [−0.5, 1.5] y-window is the GESTURE envelope (it covers every curve the
 * named easings can produce), NOT a storage limit — presets such as Elastic
 * (y = −0.55 / 1.55) deliberately live outside it and write through the
 * value graph, never through this function.
 *
 * CALLER PREFLIGHT (this pure utility cannot see the channel): the write is
 * only meaningful for a segment whose start key is not HOLD and whose
 * effective curve is (or is about to become) a complete temporal pair. Over
 * HOLD, bezierControlPoints-only, or named non-cubic easing the authored
 * handles stay inert until a pair completes — the caller owns that gating.
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
  | { ok: false; reason: 'non-finite-input' | 'zero-duration' | 'zero-displacement' | 'overflow-result' };

/**
 * The ONLY sanctioned bridge between dimensionless slope g and physical
 * velocity V (value-units/frame): V = k·g, k = (v1−v0)/Δt. k is SIGNED —
 * a descending channel has negative V for positive g (the speed display
 * shows signed velocity; the eased-progress slope g stays non-negative
 * only when the authored curve is monotone in the same direction).
 * Zero duration and zero displacement are the spec's non-identifiability
 * limits (L2/L3): speed information does not exist there, so conversion
 * REFUSES rather than inventing one. Numeric-range failures refuse under
 * the same explicit overflow-result reason as an infinite k: an infinite
 * Δt or Δv computed from finite inputs, and a k that underflows to zero
 * (a non-zero displacement divided by enough frames has no representable
 * nonzero scale — the bridge would silently flatten every velocity to 0
 * and its inverse to null).
 */
export function segmentVelocityScale(
  v0: number,
  v1: number,
  frame0: number,
  frame1: number,
): VelocityScale {
  if (![v0, v1, frame0, frame1].every(finite)) return { ok: false, reason: 'non-finite-input' };
  const deltaFrames = frame1 - frame0;
  const deltaValue = v1 - v0;
  if (!Number.isFinite(deltaFrames) || !Number.isFinite(deltaValue)) return { ok: false, reason: 'overflow-result' };
  if (deltaFrames <= 0) return { ok: false, reason: 'zero-duration' };
  if (deltaValue === 0) return { ok: false, reason: 'zero-displacement' };
  const k = deltaValue / deltaFrames;
  if (!Number.isFinite(k) || k === 0) return { ok: false, reason: 'overflow-result' };
  return { ok: true, k, deltaFrames, deltaValue };
}

/** Physical (value-units/frame) → dimensionless. Null on invalid scale, input, or non-finite result. */
export function physicalVelocityToNormalized(velocity: number, scale: VelocityScale): number | null {
  if (!scale.ok || !Number.isFinite(velocity)) return null;
  const g = velocity / scale.k;
  return Number.isFinite(g) ? g : null;
}

/** Dimensionless → physical (value-units/frame). Null on invalid scale, input, or non-finite result. */
export function normalizedSlopeToPhysicalVelocity(slope: number, scale: VelocityScale): number | null {
  if (!scale.ok || !Number.isFinite(slope)) return null;
  const v = slope * scale.k;
  return Number.isFinite(v) ? v : null;
}
