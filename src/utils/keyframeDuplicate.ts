import type { Track, Keyframe, PropertyKeyframe } from '../types/animator';
import { TRACK_CHANNELS } from '../types/animator';
import { generateId } from './idGenerator';

/**
 * M27 27A — TIMELINE KEYFRAME FRAME-GROUP DUPLICATE (pure data layer).
 *
 * Duplicates the full keyframe frame-group at `sourceFrame` of `track` onto
 * `sourceFrame + offset` (M27 MVP uses offset = 1, i.e. immediately after the
 * source frame). A frame-group = ALL channel PropertyKeyframes at the frame
 * PLUS any legacy composite Keyframe at the frame (BUG 1 frame-group
 * semantics — never duplicates only the selected channel).
 *
 * - fresh ids for every cloned keyframe (source ids never reused)
 * - values/easing/templateId/bezierControlPoints/transform preserved
 * - nested data (bezier array, legacy transform object) deep-cloned — the
 *   duplicate never shares mutable references with the source track
 * - SAFE NO-OP when: no keyframes at source frame, target frame out of
 *   [0, totalFrames], or the target frame already holds ANY keyframe
 *   (repository channel semantics allow only one PropertyKeyframe per
 *   channel+frame via replace-on-insert — we never overwrite, we no-op)
 *
 * M8 SAFE: copies EXISTING Track.channels/keyframes — no new TrackChannel,
 * no evaluateFrame/playback/timing change.
 */

export interface DuplicateKeyframeGroupResult {
  /** The resulting track (identical to input when the operation was a no-op). */
  track: Track;
  /** true when a duplicate was actually created, false for safe no-op. */
  duplicated: boolean;
}

export function duplicateKeyframeGroup(
  track: Track,
  sourceFrame: number,
  offset = 1,
  totalFrames?: number,
): DuplicateKeyframeGroupResult {
  const targetFrame = sourceFrame + offset;

  // Existing frame validation conventions: frames live in [0, totalFrames].
  if (sourceFrame < 0 || !Number.isFinite(sourceFrame)) {
    return { track, duplicated: false };
  }
  if (totalFrames !== undefined) {
    if (sourceFrame > totalFrames || targetFrame > totalFrames) {
      return { track, duplicated: false };
    }
  }

  const channels = track.channels ?? {};
  const sourceChannelKfs = TRACK_CHANNELS.filter(
    (ch) => (channels[ch] ?? []).some((k) => k.frame === sourceFrame),
  );
  const sourceLegacy = (track.keyframes ?? []).filter((k) => k.frame === sourceFrame);

  if (sourceChannelKfs.length === 0 && sourceLegacy.length === 0) {
    return { track, duplicated: false };
  }

  // Collision: if the target frame already holds ANY keyframe (any channel or
  // legacy), do NOT overwrite — safe no-op (deterministic, non-destructive).
  const targetCollides =
    TRACK_CHANNELS.some((ch) => (channels[ch] ?? []).some((k) => k.frame === targetFrame)) ||
    (track.keyframes ?? []).some((k) => k.frame === targetFrame);
  if (targetCollides) {
    return { track, duplicated: false };
  }

  const newChannels = { ...channels };
  for (const ch of sourceChannelKfs) {
    const sourceKfs = channels[ch] ?? [];
    const clones = sourceKfs
      .filter((pk: PropertyKeyframe) => pk.frame === sourceFrame)
      .map((pk: PropertyKeyframe) => ({
        ...pk,
        id: generateId(`pkf_${ch}`),
        frame: targetFrame,
        ...(pk.bezierControlPoints
          ? { bezierControlPoints: [...pk.bezierControlPoints] as [number, number, number, number] }
          : {}),
      }));
    // Keep the source keyframes untouched and APPEND the clones (never replace).
    newChannels[ch] = [...sourceKfs, ...clones];
  }

  const newLegacy: Keyframe[] = (track.keyframes ?? []).concat(
    sourceLegacy.map((k) => ({
      ...k,
      id: generateId('kf'),
      frame: targetFrame,
      transform: { ...k.transform },
      ...(k.bezierControlPoints
        ? { bezierControlPoints: [...k.bezierControlPoints] as [number, number, number, number] }
        : {}),
    })),
  );

  return {
    track: { ...track, channels: newChannels, keyframes: newLegacy },
    duplicated: true,
  };
}
