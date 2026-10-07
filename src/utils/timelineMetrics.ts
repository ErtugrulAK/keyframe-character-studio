/**
 * M5 — Timeline metric helpers (pure, testable).
 *
 * Extracted from SequencerTimeline so the timeline-length (maxFrame) and
 * bezier-target resolution can be regression-tested without rendering the
 * component.
 */

import type { AnimationChannel, LayerMaskChannel, PropertyKeyframe, Track, TrackChannel } from '../types/animator';
import { TRACK_CHANNELS } from '../types/animator';

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
export interface CurveSegment {
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

/** Channel display order (same as DISPLAY_CHANNELS in the editor panel) */
export const TIMELINE_CHANNEL_ORDER: TrackChannel[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity', 'trimPathStart', 'trimPathEnd', 'trimPathOffset'];

/**
 * The exact identity a curve edit belongs to, resolved *inside one track*.
 *
 * The Motion Curves modal must never write a curve into a layer the user did
 * not select. This helper answers "which channel — or legacy keyframe list —
 * of THIS track owns the segment?" so the caller cannot fall back to another
 * layer. `channel` is `null` for the legacy composite-keyframe route.
 */
export interface CurveTarget {
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
