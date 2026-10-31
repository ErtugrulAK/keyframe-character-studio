/**
 * Timeline metric helpers (pure, testable).
 *
 * Extracted from SequencerTimeline so the timeline-length (maxFrame) and
 * bezier-target resolution can be regression-tested without rendering the
 * component.
 */

import type { AnimationChannel, LayerMaskChannel, PropertyKeyframe, Track, TrackChannel, Transform } from '../types/animator';
import { TRACK_CHANNELS } from '../types/animator';
import { resolveTrackChannels } from './channelKeyframeGroups';

/**
 * Longest frame across BOTH legacy keyframes and canonical channel keyframes,
 * across ALL templates (timeline length is the max of every template's
 * animation — same behavior as the previous inline logic).
 */
export function computeMaxFrame(tracks: Track[]): number {
  let maxFrame = 0;
  tracks.forEach((track) => {
    (track.keyframes || []).forEach((kf) => { if (kf.frame > maxFrame) maxFrame = kf.frame; });
    TRACK_CHANNELS.forEach((ch) => {
      (track.channels?.[ch] ?? []).forEach((pkf) => { if (pkf.frame > maxFrame) maxFrame = pkf.frame; });
    });
    Object.values(track.maskChannels ?? {}).forEach((keyframes) => {
      keyframes.forEach((keyframe) => { if (keyframe.frame > maxFrame) maxFrame = keyframe.frame; });
    });
    Object.values(track.maskPathChannels ?? {}).forEach((keyframes) => {
      keyframes.forEach((keyframe) => { if (keyframe.frame > maxFrame) maxFrame = keyframe.frame; });
    });
  });
  return maxFrame;
}

/** Does the track carry any canonical channel keyframes for the template? */
export function hasChannelDataForTemplate(track: Track, activeTemplateId: string): boolean {
  if (!track.channels) return false;
  return Object.values(track.channels).some((arr) =>
    arr.some((k) => (k.templateId || 'Sequence') === activeTemplateId),
  );
}

/**
 * The fields a curve segment needs. Legacy composite keyframes and channel
 * keyframes both carry them, so one resolver serves either model.
 */
export interface CurveSegmentKeyframe {
  id: string;
  frame: number;
  templateId?: string;
  bezierControlPoints?: [number, number, number, number];
}

/** The curve segment the Motion Curves modal shapes. */
interface CurveSegment {
  /** Keyframe the segment starts at; it stores the segment's curve. */
  from: CurveSegmentKeyframe;
  /** Keyframe the segment arrives at (the one under the playhead). */
  to: CurveSegmentKeyframe;
  /** Every keyframe of the animated property, in frame order. */
  list: CurveSegmentKeyframe[];
}

/**
 * Resolve the segment a keyframe owns as its *incoming* curve:
 * `[previous keyframe → this keyframe]`.
 *
 * The evaluator reads a segment's curve from the keyframe the segment STARTS
 * at (`prev.easing` / `prev.bezierControlPoints` / `prev.bezierOut`), so the
 * edit target is the previous keyframe and the curve that leads into it is
 * untouched. A keyframe without a predecessor — the first one, or the only
 * one — owns no segment, so the caller must offer no curve at all instead of
 * silently editing a different keyframe.
 *
 * The keyframe is picked by the playhead first (clicking a diamond moves it
 * there) and by the timeline's keyframe selection second. Returns null when
 * nothing matches, rather than guessing.
 */
export function resolveCurveSegment(
  keyframes: CurveSegmentKeyframe[],
  activeTemplateId: string,
  selectedKeyframeId: string | null,
  currentFrame: number,
): CurveSegment | null {
  const list = keyframes
    .filter((keyframe) => (keyframe.templateId || 'Sequence') === activeTemplateId)
    .sort((a, b) => a.frame - b.frame);
  if (list.length < 2) return null;

  let index = list.findIndex((keyframe) => keyframe.frame === currentFrame);
  if (index < 0 && selectedKeyframeId) {
    index = list.findIndex((keyframe) => keyframe.id === selectedKeyframeId);
  }
  if (index < 1) return null;
  // A segment must have a strictly positive duration: two keyframes on the same
  // frame own no time to shape, and the evaluator never reads a curve from
  // them. Refuse instead of silently choosing a different segment.
  if (list[index].frame <= list[index - 1].frame) return null;

  return { from: list[index - 1], to: list[index], list };
}

/**
 * The distinct frames a keyframe list animates in ONE template, ascending.
 * One frame is ONE navigation target: several keyframes on the same frame (and
 * the legacy composite list the projection also carries) resolve to a single
 * playhead position.
 */
const templateKeyframeFrames = (
  keyframes: Array<{ frame: number; templateId?: string }>,
  activeTemplateId: string,
): number[] => {
  const frames = new Set<number>();
  keyframes.forEach((keyframe) => {
    if ((keyframe.templateId || 'Sequence') === activeTemplateId) frames.add(keyframe.frame);
  });
  return [...frames].sort((a, b) => a - b);
};

/**
 * The frames of ONE channel, ascending and deduplicated: the same rule as
 * `resolveLayerKeyframeFrames`, applied to the same projection, so the
 * property-level navigation can never reach a frame the property does not
 * animate. A channel the projection does not carry has no frames at all.
 *
 * `basePose` is the layer's own authored pose; it decides which legacy
 * composite properties the projection may materialize (see
 * `resolveTrackChannels`), so the property arrows and the property lane agree.
 */
export function resolveChannelKeyframeFrames(
  track: Track,
  channel: AnimationChannel,
  activeTemplateId: string,
  basePose?: Partial<Transform>,
): number[] {
  // Per-mask channels read their own stores; the projection behind the
  // transform channels stays exactly as it was.
  const keyframes = channel.includes(':')
    ? ((channel.endsWith(':path')
      ? (track.maskPathChannels as Record<string, PropertyKeyframe[] | undefined> | undefined)?.[channel]
      : (track.maskChannels as Record<string, PropertyKeyframe[] | undefined> | undefined)?.[channel]) ?? [])
    : (resolveTrackChannels(track, basePose)[channel as TrackChannel] ?? []);
  return templateKeyframeFrames(keyframes, activeTemplateId);
}

/**
 * The frames a layer's animation occupies in one template, ascending
 * and deduplicated.
 *
 * The read is exactly what the aggregate layer row DRAWS, so a frame the user
 * can see on the layer is always a frame the navigation can reach, and a frame
 * no surface shows is never a target:
 *   - a track with canonical channel data draws its channel frame groups
 *     (`resolveTrackChannels`, the projection behind both rows) — a legacy
 *     composite the channel scope already covers is resolved by it;
 *   - a track without canonical channel data draws its legacy composite
 *     diamonds themselves, so those frames are the layer's frames even when the
 *     composite list holds no motion for any single property (`TrackLane`
 *     renders the legacy list directly for those tracks).
 */
export function resolveLayerKeyframeFrames(
  track: Track,
  activeTemplateId: string,
  basePose?: Partial<Transform>,
): number[] {
  const frames = new Set<number>();
  if (hasChannelDataForTemplate(track, activeTemplateId)) {
    Object.values(resolveTrackChannels(track, basePose)).forEach((keyframes) => {
      templateKeyframeFrames(keyframes, activeTemplateId).forEach((frame) => frames.add(frame));
    });
    return [...frames].sort((a, b) => a - b);
  }
  // No canonical channel data → the layer row draws the legacy composite
  // diamonds and the V6 mask keyframes themselves.
  const drawnKeyframes = [
    ...(track.keyframes ?? []),
    ...Object.values(track.maskChannels ?? {}).flat(),
    ...Object.values(track.maskPathChannels ?? {}).flat(),
  ];
  templateKeyframeFrames(drawnKeyframes, activeTemplateId).forEach((frame) => frames.add(frame));
  return [...frames].sort((a, b) => a - b);
}

/**
 * The visible interpolation connector of one lane, as SEGMENTS.
 *
 * Each segment spans the gap between two neighbouring keyframes and stops
 * `glyphGapPx` short of the keyframe at either end, so the line can never be
 * seen through the interior of a hollow glyph. Masking by geometry is what keeps
 * the glyph exactly its compact size (its outline is never enlarged) and the hit
 * target untouched. Two keys closer together than two gaps own no visible
 * connector, so the segment is simply not emitted.
 */
export function resolveConnectorSegments(
  frames: number[],
  frameWidth: number,
  glyphGapPx: number,
): Array<{ left: number; width: number }> {
  const segments: Array<{ left: number; width: number }> = [];
  for (let index = 1; index < frames.length; index += 1) {
    const span = (frames[index] - frames[index - 1]) * frameWidth;
    const width = span - glyphGapPx * 2;
    if (width > 0) segments.push({ left: frames[index - 1] * frameWidth + glyphGapPx, width });
  }
  return segments;
}

/**
 * The nearest keyframe frame strictly BEFORE (previous) or AFTER
 * (next) `frame`. Null when the layer has no keyframe on that side, so the
 * control disables itself instead of jumping to a frame the layer never
 * animates. Pure navigation: this only ever resolves a frame number.
 *
 * The ONE policy every keyframe navigation control obeys (the per-layer
 * pair and the per-property pairs), so no control can promise a jump it cannot
 * make:
 *   - 0 keys:      both directions are null (both controls disabled).
 *   - exactly 1:   standing ON the key disables both (there is nowhere to go);
 *                  otherwise only the direction that REACHES it is enabled.
 *   - 2 or more:   `previous` only when an earlier key exists, `next` only when a
 *                  later one does.
 * Navigation NEVER wraps: the first key has no previous, the last has no next.
 * "Previous" also means the key strictly before a key the playhead already
 * stands on, which is what makes the control a step, not a no-op.
 */
export function resolveAdjacentKeyframeFrame(
  keyframeFrames: number[],
  frame: number,
  direction: 'previous' | 'next',
): number | null {
  let nearest: number | null = null;
  keyframeFrames.forEach((candidate) => {
    if (direction === 'previous' ? candidate >= frame : candidate <= frame) return;
    if (nearest === null) {
      nearest = candidate;
      return;
    }
    const closer = direction === 'previous' ? candidate > nearest : candidate < nearest;
    if (closer) nearest = candidate;
  });
  return nearest;
}

/**
 * The exact identity a curve edit belongs to, resolved *inside one track*.
 *
 * The Motion Curves modal must never write a curve into a layer the user did
 * not select. This helper answers "which channel — or legacy keyframe list —
 * of THIS track owns the segment?" so the caller cannot fall back to another
 * layer. `channel` is `null` for the legacy composite-keyframe route.
 */
interface CurveTarget {
  /** Canonical channel that owns the segment, or `null` for legacy keyframes. */
  channel: AnimationChannel | null;
  /** Active-sequence keyframes of that exact identity, in document order. */
  keyframes: CurveSegmentKeyframe[];
  /**
   * Canonical channel keyframes for the value/handle editor (they carry
   * `value`/`easing`); empty on the legacy composite-keyframe route, which has
   * no per-property value surface.
   */
  channelKeyframes: PropertyKeyframe[];
}

/**
 * Resolve the curve target of a single selected track:
 *   1. the channel that owns the selected keyframe (when the selection is known),
 *   2. else the first canonical channel carrying active-sequence keyframes,
 *   3. else the track's legacy composite keyframes.
 *
 * Returns `null` when the track carries no keyframes for the active sequence,
 * so the caller offers no edit instead of guessing another layer's curve.
 */
export function resolveCurveTarget(
  track: Track | null,
  activeTemplateId: string,
  selectedKeyframeId: string | null,
): CurveTarget | null {
  if (!track) return null;
  const isActive = (keyframe: { templateId?: string }) => (keyframe.templateId || 'Sequence') === activeTemplateId;
  const readChannel = (channel: AnimationChannel): CurveSegmentKeyframe[] =>
    (TRACK_CHANNELS as string[]).includes(channel)
      ? (track.channels?.[channel as TrackChannel] ?? [])
      : (track.maskChannels?.[channel as LayerMaskChannel] ?? []);
  const channelKeys: AnimationChannel[] = [
    ...TRACK_CHANNELS.filter((channel) => (track.channels?.[channel] ?? []).length > 0),
    ...Object.keys(track.maskChannels ?? {}) as AnimationChannel[],
  ];

  if (selectedKeyframeId) {
    for (const channel of channelKeys) {
      const keyframes = readChannel(channel) as PropertyKeyframe[];
      if (keyframes.some((keyframe) => keyframe.id === selectedKeyframeId && isActive(keyframe))) {
        const active = keyframes.filter(isActive);
        return { channel, keyframes: active, channelKeyframes: active };
      }
    }
  }
  for (const channel of channelKeys) {
    const active = (readChannel(channel) as PropertyKeyframe[]).filter(isActive);
    if (active.length > 0) return { channel, keyframes: active, channelKeyframes: active };
  }

  const legacy = (track.keyframes ?? []).filter(isActive);
  return legacy.length > 0 ? { channel: null, keyframes: legacy, channelKeyframes: [] } : null;
}

/** K1 (contract D2) — the three stopwatch states, read from the channel a row
 * actually shows: keys OUTSIDE the active template scope are another
 * sequence's animation and must not light this sequence's stopwatch. */
type ChannelAnimationState = 'off' | 'animated' | 'keyed';

export const resolveChannelAnimationState = (
  track: Track,
  channel: AnimationChannel,
  frame: number,
  templateId: string,
): ChannelAnimationState => {
  // A mask PATH channel keeps its keys in its own store (WP-03); reading the
  // scalar mask store for it would report an animated path as 'off'.
  const store = (channel.includes(':')
    ? (channel.endsWith(':path') ? track.maskPathChannels : track.maskChannels)
    : track.channels) as Record<string, { frame: number; templateId?: string }[]> | undefined;
  const keyframes = (store?.[channel] ?? []).filter((k) => (k.templateId || 'Sequence') === templateId);
  if (keyframes.length === 0) return 'off';
  return keyframes.some((k) => k.frame === frame) ? 'keyed' : 'animated';
};
