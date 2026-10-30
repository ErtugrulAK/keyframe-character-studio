/**
 * Derived per-channel velocity (speed) math.
 *
 * V6+ roadmap item: the Speed Graph is a DERIVED view "backed by the shared
 * evaluator" (docs/roadmap/ANIMATION_ROADMAP_V6.md). This module therefore adds
 * NO parallel interpolation: every sample is taken from `interpolateChannel`,
 * the single scalar-channel authority (segment scan, hold semantics, bezier
 * control points, temporal handles, auto-Bezier derivation all stay there).
 * Velocity is the derivative of that one function, measured, not re-derived
 * from a second easing model.
 *
 * Scope guard: this file is read-only math for display/analysis. It is NOT
 * the editable speed-graph contract — the roadmap requires a mathematically
 * explicit conversion back to the temporal-handle model BEFORE controls are
 * added, and this module deliberately provides no such inverse.
 *
 * Units: value-units per frame along the primary (frame) axis.
 */

import type { PropertyKeyframe } from '../types/animator';
import { interpolateChannel } from './defaults';

/** One measured frame position on a channel's speed curve. */
interface ChannelVelocitySample {
  /** Frame the sample was taken at. */
  frame: number;
  /** Channel value at that frame, straight from the shared evaluator. */
  value: number;
  /** d(value)/d(frame); 0 wherever the channel holds or clamps flat. */
  velocity: number;
}

/** Which one-sided limit to probe, or a centred difference in a segment. */
type Probe = 'forward' | 'backward' | 'center';

/** Upper bound on the sampling window, in frames. */
const MAX_EPSILON = 0.25;
/** Lower bound that keeps the finite difference out of float noise. */
const MIN_EPSILON = 1e-4;

/**
 * Pick the probe direction and a sampling window at `frame` that never
 * straddles a keyframe: interior windows stay inside the bordering keys,
 * on-key windows reach only into the segment being measured.
 */
function selectProbe(sorted: PropertyKeyframe[], frame: number): { epsilon: number; probe: Probe } {
  const last = sorted[sorted.length - 1].frame;
  let onKey = false;
  let forwardGap = Number.POSITIVE_INFINITY;
  let backwardGap = Number.POSITIVE_INFINITY;
  for (const key of sorted) {
    const gap = key.frame - frame;
    if (gap === 0) onKey = true;
    if (gap > 0 && gap < forwardGap) forwardGap = gap;
    if (gap < 0 && -gap < backwardGap) backwardGap = -gap;
  }
  if (onKey) {
    const gap = frame === last ? backwardGap : forwardGap;
    const epsilon = Math.min(MAX_EPSILON, Number.isFinite(gap) ? gap : MAX_EPSILON);
    return { epsilon: Math.max(MIN_EPSILON, epsilon), probe: frame === last ? 'backward' : 'forward' };
  }
  // Interior of a segment: keep the centred window inside both bordering keys.
  const nearestGap = Math.min(forwardGap, backwardGap);
  const epsilon = Math.min(MAX_EPSILON, nearestGap * 0.5);
  return { epsilon: Math.max(MIN_EPSILON, epsilon), probe: 'center' };
}

/**
 * Channel value and velocity at one frame.
 *
 * - Empty channel or a single key: flat, velocity 0.
 * - Strictly outside the animated span: the evaluator clamps flat, velocity 0.
 * - `hold` spans: the evaluator returns the previous value for the whole
 *   span, so the measured difference is exactly 0.
 * - Exactly on a keyframe corner: the one-sided limit into the adjacent
 *   segment (backward at the last key); a speed graph shows a corner there,
 *   not a value.
 *
 * @param keyframes channel keyframes (any order; the evaluator sorts)
 * @param frame probe frame
 * @param fallback value used when the channel is empty (velocity is 0 there)
 */
export function channelVelocityAt(
  keyframes: PropertyKeyframe[],
  frame: number,
  fallback = 0,
): ChannelVelocitySample {
  const value = interpolateChannel(keyframes, frame, fallback);
  if (!keyframes || keyframes.length < 2) {
    return { frame, value, velocity: 0 };
  }
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
  if (frame < sorted[0].frame || frame > sorted[sorted.length - 1].frame) {
    return { frame, value, velocity: 0 };
  }
  const { epsilon, probe } = selectProbe(sorted, frame);
  if (probe === 'forward') {
    const after = interpolateChannel(sorted, frame + epsilon, fallback);
    return { frame, value, velocity: (after - value) / epsilon };
  }
  if (probe === 'backward') {
    const before = interpolateChannel(sorted, frame - epsilon, fallback);
    return { frame, value, velocity: (value - before) / epsilon };
  }
  const before = interpolateChannel(sorted, frame - epsilon, fallback);
  const after = interpolateChannel(sorted, frame + epsilon, fallback);
  return { frame, value, velocity: (after - before) / (2 * epsilon) };
}

/**
 * Sample a channel's speed curve over an inclusive frame span at a fixed
 * step. Used by derived views (speed graph, retiming analysis); stays pure
 * and allocation-light so callers can memoise the array as a whole.
 */
export function sampleChannelVelocity(
  keyframes: PropertyKeyframe[],
  fromFrame: number,
  toFrame: number,
  step = 1,
  fallback = 0,
): ChannelVelocitySample[] {
  if (toFrame < fromFrame || step <= 0) return [];
  const samples: ChannelVelocitySample[] = [];
  const lastWhole = fromFrame + Math.floor((toFrame - fromFrame) / step) * step;
  for (let frame = fromFrame; frame <= lastWhole; frame += step) {
    samples.push(channelVelocityAt(keyframes, frame, fallback));
  }
  if (lastWhole !== toFrame) samples.push(channelVelocityAt(keyframes, toFrame, fallback));
  return samples;
}
