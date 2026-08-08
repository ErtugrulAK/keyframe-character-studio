/**
 * M2 — Legacy composite Keyframe[] → canonical channels conversion.
 *
 * Pure, deterministic helper used at SceneData import time so that old files
 * (which only wrote `keyframes[]`) migrate into the canonical per-property
 * channel model automatically.
 *
 * Rules:
 *   - Each legacy keyframe's 6 animated properties (x, y, rotation, scaleX,
 *     scaleY, opacity) become separate PropertyKeyframes in their channel.
 *   - M8b: optional mask transform fields (maskOffsetX, maskOffsetY,
 *     maskScale, maskRotation) are carried into their canonical channels when
 *     defined — a defined 0 is preserved, undefined is skipped (no invented
 *     keyframes).
 *   - opacity: 0 is preserved (never coerced).
 *   - easing + bezierControlPoints are carried over.
 *   - templateId is preserved.
 *   - No duplicate channel keyframes: same (frame + templateId + channel)
 *     only produces one entry.
 *   - Mask point/feather data is NOT mapped — channels are scalar-only.
 *     The legacy keyframe's mask transform fields are simply not representable.
 */

import type { Keyframe, PropertyKeyframe, TrackChannel, EasingType } from '../types/animator';

const ANIMATED_CHANNELS: TrackChannel[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'];
const MASK_CHANNELS: TrackChannel[] = ['maskOffsetX', 'maskOffsetY', 'maskScale', 'maskRotation'];

/**
 * Convert a legacy composite keyframe list into canonical channels.
 * Returns a full Record (all TrackChannel keys present).
 */
export function convertLegacyKeyframesToChannels(
  legacyKeyframes: Keyframe[],
): Record<TrackChannel, PropertyKeyframe[]> {
  const channels: Record<TrackChannel, PropertyKeyframe[]> = {
    x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
    maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  };

  if (!legacyKeyframes || legacyKeyframes.length === 0) return channels;

  // Dedupe key: `${channel}|${frame}|${templateId}`
  const seen = new Set<string>();

  for (const kf of legacyKeyframes) {
    const templateId = kf.templateId;
    const easing = (kf.easing || 'linear') as EasingType;
    const bezier = kf.bezierControlPoints;

    const props: Record<string, number> = {
      x: kf.transform.x,
      y: kf.transform.y,
      rotation: kf.transform.rotation,
      scaleX: kf.transform.scaleX,
      scaleY: kf.transform.scaleY,
      // BUG #4 rule: opacity 0 preserved; only undefined/missing falls back to 1
      opacity: kf.transform.opacity ?? 1,
    };

    for (const ch of ANIMATED_CHANNELS) {
      const dedupeKey = `${ch}|${kf.frame}|${templateId || ''}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      channels[ch].push({
        id: `conv_${kf.id}_${ch}`,
        frame: kf.frame,
        value: props[ch],
        easing,
        ...(bezier ? { bezierControlPoints: bezier } : {}),
        ...(templateId ? { templateId } : {}),
      });
    }

    // M8b: optional mask transform fields → canonical mask channels.
    // Only mapped when defined on the legacy keyframe; a defined 0 survives.
    for (const ch of MASK_CHANNELS) {
      const value = kf.transform[ch];
      if (typeof value !== 'number') continue;
      const dedupeKey = `${ch}|${kf.frame}|${templateId || ''}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      channels[ch].push({
        id: `conv_${kf.id}_${ch}`,
        frame: kf.frame,
        value,
        easing,
        ...(bezier ? { bezierControlPoints: bezier } : {}),
        ...(templateId ? { templateId } : {}),
      });
    }
  }

  // Deterministic ordering per channel
  for (const ch of [...ANIMATED_CHANNELS, ...MASK_CHANNELS]) {
    channels[ch].sort((a, b) => a.frame - b.frame);
  }

  return channels;
}
