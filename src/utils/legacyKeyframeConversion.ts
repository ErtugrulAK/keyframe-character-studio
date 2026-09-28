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

const ANIMATED_CHANNELS = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'] as const;
const MASK_CHANNELS = ['maskOffsetX', 'maskOffsetY', 'maskScale', 'maskRotation'] as const;
/** Every canonical channel key, in the order the converter fills them. */
const CHANNEL_KEYS: TrackChannel[] = [
  ...ANIMATED_CHANNELS,
  ...MASK_CHANNELS,
  'trimPathStart',
  'trimPathEnd',
  'trimPathOffset',
];

/** A channels record with every canonical key present and empty. */
const createEmptyChannels = (): Record<TrackChannel, PropertyKeyframe[]> => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

/**
 * The template scope a keyframe belongs to. This is the evaluator's own rule
 * (`evaluateTransform` filters by `keyframe.templateId || 'Sequence'`), so the
 * fallback below is decided with exactly the scope the evaluator will use.
 */
const scopeOf = (keyframe: { templateId?: string }): string => keyframe.templateId || 'Sequence';

/**
 * Convert a legacy composite keyframe list into canonical channels.
 * Returns a full Record (all TrackChannel keys present).
 */
export function convertLegacyKeyframesToChannels(
  legacyKeyframes: Keyframe[],
): Record<TrackChannel, PropertyKeyframe[]> {
  const channels: Record<TrackChannel, PropertyKeyframe[]> = createEmptyChannels();

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
  for (const ch of CHANNEL_KEYS) {
    channels[ch].sort((a, b) => a.frame - b.frame);
  }

  return channels;
}

/**
 * Fills the channels the evaluator would otherwise resolve through the legacy
 * composite fallback.
 *
 * `evaluateTransform` reads a channel when it carries keyframes *for the active
 * template* and falls back to the composite legacy keyframes otherwise. An
 * export that writes the canonical channels **instead of** the legacy
 * keyframes therefore has to carry that fallback itself: without it, a track
 * whose `x` channel is populated but whose `y` animation still lives in
 * `keyframes[]` loses `y` the moment the file is loaded again.
 *
 * A channel scope that already carries canonical keyframes is kept verbatim —
 * the canonical value wins for that template, exactly as it does in the editor.
 * Legacy keyframes only fill the scopes no canonical keyframe covers, so no
 * (channel, frame, template) is written twice.
 */
export function fillChannelsFromLegacyKeyframes(
  canonical: Record<TrackChannel, PropertyKeyframe[]> | undefined,
  legacyKeyframes: Keyframe[],
): Record<TrackChannel, PropertyKeyframe[]> {
  const fallbackChannels = convertLegacyKeyframesToChannels(legacyKeyframes);
  const filled: Record<TrackChannel, PropertyKeyframe[]> = createEmptyChannels();

  for (const channel of CHANNEL_KEYS) {
    const canonicalKeyframes = canonical?.[channel] ?? [];
    const coveredScopes = new Set(canonicalKeyframes.map(scopeOf));
    const fallback = fallbackChannels[channel].filter((keyframe) => !coveredScopes.has(scopeOf(keyframe)));
    filled[channel] = fallback.length === 0
      ? canonicalKeyframes
      : [...canonicalKeyframes, ...fallback].sort((a, b) => a.frame - b.frame);
  }

  return filled;
}
