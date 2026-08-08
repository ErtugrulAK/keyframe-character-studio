/**
 * M5 — Timeline metric helpers (pure, testable).
 *
 * Extracted from SequencerTimeline so the timeline-length (maxFrame) and
 * bezier-target resolution can be regression-tested without rendering the
 * component.
 */

import type { Track, TrackChannel, PropertyKeyframe } from '../types/animator';
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
  });
  return maxFrame;
}

/**
 * Find the first channel keyframe at a given frame for the active template.
 * Used by the Motion Curves modal as the canonical fallback when no legacy
 * composite keyframe exists at the frame.
 */
export function findChannelKeyframeAtFrame(
  track: Track,
  activeTemplateId: string,
  frame: number,
): PropertyKeyframe | null {
  if (!track.channels) return null;
  for (const ch of TRACK_CHANNELS) {
    const match = (track.channels[ch] || []).find(
      (k) => (k.templateId || 'Sequence') === activeTemplateId && k.frame === frame,
    );
    if (match) return match;
  }
  return null;
}

/** Does the track carry any canonical channel keyframes for the template? */
export function hasChannelDataForTemplate(track: Track, activeTemplateId: string): boolean {
  if (!track.channels) return false;
  return Object.values(track.channels).some((arr) =>
    arr.some((k) => (k.templateId || 'Sequence') === activeTemplateId),
  );
}

/** Channel display order (same as DISPLAY_CHANNELS in the editor panel) */
export const TIMELINE_CHANNEL_ORDER: TrackChannel[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'];
