/**
 * M3 — Frame-based grouping of canonical channel keyframes.
 *
 * The editor UI treats "a keyframe" as one frame holding several property
 * keyframes (legacy composite keyframe semantics). This helper groups the
 * canonical per-channel keyframes into that frame-based view.
 */

import type { PropertyKeyframe, TrackChannel } from '../types/animator';

export interface ChannelKeyframeGroup {
  /** Shared frame number */
  frame: number;
  /** Channels that have a keyframe at this frame */
  channels: TrackChannel[];
  /** channel → keyframe at this frame (already template-filtered) */
  keyframes: Record<string, PropertyKeyframe>;
  /** Representative easing (first channel's keyframe easing) */
  easing: string;
  /** Representative bezier control points, if any */
  bezierControlPoints?: [number, number, number, number];
}

/** All channels the editor can animate, in display order (6 main properties) */
export const DISPLAY_CHANNELS = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'] as const;
export const TRIM_PATH_CHANNELS = ['trimPathStart', 'trimPathEnd', 'trimPathOffset'] as const;
export const ANIMATABLE_CHANNELS: TrackChannel[] = [...DISPLAY_CHANNELS, ...TRIM_PATH_CHANNELS];

/**
 * Group per-channel keyframes by frame, filtered to the active template.
 * Deterministic: groups sorted by frame; channels in DISPLAY_CHANNELS order.
 */
export function groupChannelKeyframesByFrame(
  channels: Record<TrackChannel, PropertyKeyframe[]> | undefined,
  activeTemplateId: string,
): ChannelKeyframeGroup[] {
  if (!channels) return [];

  const byFrame = new Map<number, ChannelKeyframeGroup>();

  for (const ch of ANIMATABLE_CHANNELS) {
    const kfs = channels[ch] || [];
    for (const kf of kfs) {
      if ((kf.templateId || 'Sequence') !== activeTemplateId) continue;
      let group = byFrame.get(kf.frame);
      if (!group) {
        group = { frame: kf.frame, channels: [], keyframes: {}, easing: kf.easing || 'linear' };
        byFrame.set(kf.frame, group);
      }
      group.channels.push(ch);
      group.keyframes[ch] = kf;
      // First channel's easing is the representative
      if (group.channels.length === 1) {
        group.easing = kf.easing || 'linear';
        group.bezierControlPoints = kf.bezierControlPoints;
      }
    }
  }

  return [...byFrame.values()].sort((a, b) => a.frame - b.frame);
}

/**
 * M7: snapshot an evaluated transform into the 6 canonical channel values at
 * the current frame (used by the Outliner "Add Composite Keyframe" button —
 * same data KeyframesTab handleAdd writes).
 */
export type SnapshotTransform = Pick<
  Record<TrackChannel, number>,
  'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'opacity'
>;

export function buildTransformSnapshot(t: {
  x: number; y: number; rotation: number;
  scaleX: number; scaleY: number; opacity: number;
}): SnapshotTransform {
  return {
    x: t.x, y: t.y, rotation: t.rotation,
    scaleX: t.scaleX, scaleY: t.scaleY, opacity: t.opacity,
  };
}
