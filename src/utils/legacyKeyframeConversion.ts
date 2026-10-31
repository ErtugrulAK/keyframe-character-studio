/**
 * Legacy composite Keyframe[] → canonical channels conversion.
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
 *   - A property that never moves inside a template scope is NOT animated:
 *     see `animatedScopes` — only the properties the composite list actually
 *     animates become channel keyframes.
 *   - Mask point/feather data is NOT mapped — channels are scalar-only.
 *     The legacy keyframe's mask transform fields are simply not representable.
 */

import type { Keyframe, PropertyKeyframe, TrackChannel, EasingType, Transform } from '../types/animator';

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

/** The channel keys a legacy keyframe's own fields can carry. */
type ConvertedChannel = (typeof ANIMATED_CHANNELS)[number] | (typeof MASK_CHANNELS)[number];

/** `${channel}|${template scope}` — the identity a sampled property is judged in. */
const scopeKey = (channel: ConvertedChannel, templateId: string | undefined) =>
  `${channel}|${templateId || 'Sequence'}`;

/**
 * The value one legacy keyframe carries for a converted channel, or `undefined`
 * when the keyframe does not carry it at all (mask fields are optional).
 */
const legacyValueOf = (kf: Keyframe, channel: ConvertedChannel): number | undefined => {
  // BUG #4 rule: opacity 0 preserved; only undefined/missing falls back to 1.
  if (channel === 'opacity') return kf.transform.opacity ?? 1;
  const value = kf.transform[channel];
  return typeof value === 'number' ? value : undefined;
};

/**
 * The (channel, scope) pairs a legacy composite list actually ANIMATES.
 *
 * A legacy composite keyframe is a full-pose SAMPLE: it carries a value for
 * every property, because the composite list stores poses, not per-property
 * channels. Materializing all of them invents channel keys with no motion
 * behind them — a position-only composite animation (three samples, x/y moving,
 * rotation 0 / scale 1 / opacity 1) showed three keys on Rotation, Scale and
 * Opacity, and every authoring entry and export made them permanent.
 *
 * A property IS animated in a scope when either:
 *   - its deduped samples are not all equal (the property moves), or
 *   - its samples hold a constant value the layer does not own, i.e. the value
 *     differs from the base pose `evaluateTransform` composes onto (a real held
 *     override — rotation 30 over a base rotation 0 is consumer-visible and is
 *     kept verbatim), or
 *   - the base pose is not available, so the value cannot be proven neutral.
 *
 * A constant equal to the layer's own pose is not animation: the evaluator
 * resolves that property from the base pose itself (`evalComposite([], base)`
 * returns exactly `base`), so dropping the channel is provably pose-neutral.
 * `basePose` is the evaluator's own `authoredBasePose`, never a re-derivation.
 *
 * A scope that animates NOTHING is a static hold: it pins the whole pose,
 * exactly as the legacy evaluator resolves it, and every keyframe it carries is
 * kept — a hold a user created may not vanish because it repeats the layer's
 * pose. Only a scope with real motion (or a held override) sheds the properties
 * that motion does not touch.
 *
 * The sampling below is the converter's OWN dedupe (first sample at a frame
 * wins), so "the samples" here are exactly the channel keyframes that would be
 * materialized.
 */
const animatedScopes = (legacyKeyframes: Keyframe[], basePose?: Partial<Transform>): Set<string> => {
  const samplesByScope = new Map<string, Map<number, number>>();

  for (const kf of legacyKeyframes) {
    for (const channel of [...ANIMATED_CHANNELS, ...MASK_CHANNELS] as ConvertedChannel[]) {
      const value = legacyValueOf(kf, channel);
      if (value === undefined) continue;
      const key = scopeKey(channel, kf.templateId);
      const samples = samplesByScope.get(key) ?? new Map<number, number>();
      // First sample at a frame wins — the same rule the keyframe list keeps.
      if (!samples.has(kf.frame)) samples.set(kf.frame, value);
      samplesByScope.set(key, samples);
    }
  }

  // The (channel, scope) keys of every scope, in discovery order.
  const keysByScope = new Map<string, string[]>();
  samplesByScope.forEach((_samples, key) => {
    const scope = key.slice(key.indexOf('|') + 1);
    keysByScope.set(scope, [...(keysByScope.get(scope) ?? []), key]);
  });

  const animated = new Set<string>();
  keysByScope.forEach((scopeKeys) => {
    const moving = scopeKeys.filter((key) => {
      const values = [...samplesByScope.get(key)!.values()];
      if (values.length > 1 && values.some((value) => value !== values[0])) return true;
      const owned = basePose?.[key.slice(0, key.indexOf('|')) as ConvertedChannel];
      // No base pose → the held value cannot be proven to be the layer's own pose.
      return typeof owned !== 'number' || values[0] !== owned;
    });
    (moving.length > 0 ? moving : scopeKeys).forEach((key) => animated.add(key));
  });
  return animated;
};

/**
 * Convert a legacy composite keyframe list into canonical channels.
 * Returns a full Record (all TrackChannel keys present).
 *
 * `basePose` is the layer's own authored pose (`authoredBasePose`). It is the
 * proof behind `animatedScopes`: without it every property is materialized
 * (faithful conversion, provenance unknown); with it a held sample that equals
 * the pose the layer already owns is not animation and is left out.
 */
export function convertLegacyKeyframesToChannels(
  legacyKeyframes: Keyframe[],
  basePose?: Partial<Transform>,
): Record<TrackChannel, PropertyKeyframe[]> {
  const channels: Record<TrackChannel, PropertyKeyframe[]> = createEmptyChannels();

  if (!legacyKeyframes || legacyKeyframes.length === 0) return channels;

  // Dedupe key: `${channel}|${frame}|${templateId}`
  const seen = new Set<string>();
  const animated = animatedScopes(legacyKeyframes, basePose);

  for (const kf of legacyKeyframes) {
    const templateId = kf.templateId;
    const easing = (kf.easing || 'linear') as EasingType;
    const bezier = kf.bezierControlPoints;

    for (const ch of ANIMATED_CHANNELS) {
      if (!animated.has(scopeKey(ch, templateId))) continue;
      const dedupeKey = `${ch}|${kf.frame}|${templateId || 'Sequence'}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      channels[ch].push({
        id: `conv_${kf.id}_${ch}`,
        frame: kf.frame,
        value: legacyValueOf(kf, ch) as number,
        easing,
        ...(bezier ? { bezierControlPoints: bezier } : {}),
        ...(templateId ? { templateId } : {}),
      });
    }

    // M8b: optional mask transform fields → canonical mask channels.
    // Only mapped when defined on the legacy keyframe; a defined 0 survives.
    for (const ch of MASK_CHANNELS) {
      if (!animated.has(scopeKey(ch, templateId))) continue;
      const value = legacyValueOf(kf, ch);
      if (value === undefined) continue;
      const dedupeKey = `${ch}|${kf.frame}|${templateId || 'Sequence'}`;
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
 *
 * `basePose` is the layer's own authored pose and carries the same meaning as
 * in `convertLegacyKeyframesToChannels`: with it, a legacy property that only
 * re-states the layer's pose is not materialized as authored animation.
 */
export function fillChannelsFromLegacyKeyframes(
  canonical: Record<TrackChannel, PropertyKeyframe[]> | undefined,
  legacyKeyframes: Keyframe[],
  basePose?: Partial<Transform>,
): Record<TrackChannel, PropertyKeyframe[]> {
  const fallbackChannels = convertLegacyKeyframesToChannels(legacyKeyframes, basePose);
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
