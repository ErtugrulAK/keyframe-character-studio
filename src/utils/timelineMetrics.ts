/**
 * M5 — Timeline metric helpers (pure, testable).
 *
 * Extracted from SequencerTimeline so the timeline-length (maxFrame) and
 * bezier-target resolution can be regression-tested without rendering the
 * component.
 */

import type { Track, TrackChannel } from '../types/animator';
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

  return { from: list[index - 1], to: list[index], list };
}

/** Channel display order (same as DISPLAY_CHANNELS in the editor panel) */
export const TIMELINE_CHANNEL_ORDER: TrackChannel[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity', 'trimPathStart', 'trimPathEnd', 'trimPathOffset'];
