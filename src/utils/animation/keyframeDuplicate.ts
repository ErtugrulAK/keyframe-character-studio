import type { Track, Keyframe, PropertyKeyframe, PathKeyframe } from '../../types/animator';
import { TRACK_CHANNELS } from '../../types/animator';
import { generateId } from '../layers/idGenerator';

/**
 * Duplicate Keyframes (AGENTS.md §14): the whole frame group of one track —
 * transform channels, mask channels, mask-path channels and legacy composite
 * keyframes at `sourceFrame` — is copied to `sourceFrame + offset` on the same
 * track with fresh ids. Values, easing, template and bezier metadata are kept.
 * Any keyframe already at the destination makes the whole call a safe no-op.
 */

interface DuplicateKeyframeGroupResult { track: Track; duplicated: boolean; }

type KeyframeMap<T> = Record<string, T[]>;

const hasKeyframeAt = (keyframes: ReadonlyArray<{ frame: number }> | undefined, frame: number): boolean =>
  (keyframes ?? []).some((keyframe) => keyframe.frame === frame);

/** The channels of the map that hold a keyframe at `frame`. */
const channelsWithKeyframeAt = (map: KeyframeMap<{ frame: number }>, frame: number): string[] =>
  Object.keys(map).filter((channel) => hasKeyframeAt(map[channel], frame));

const mapOccupies = (map: KeyframeMap<{ frame: number }> | undefined, frame: number): boolean =>
  Object.values(map ?? {}).some((keyframes) => hasKeyframeAt(keyframes, frame));

/** Every channel kept; the listed channels get their `sourceFrame` keys again at `targetFrame`. */
function duplicateInMap<T extends { id: string; frame: number; value?: unknown }>(
  map: KeyframeMap<T> | undefined,
  keys: readonly string[],
  sourceFrame: number,
  targetFrame: number,
  prefix: string,
): KeyframeMap<T> {
  return Object.fromEntries(Object.entries(map ?? {}).map(([channel, keyframes]) => [channel, [
    ...keyframes,
    ...(keys.includes(channel)
      ? keyframes.filter((keyframe) => keyframe.frame === sourceFrame).map((keyframe) => ({
        ...keyframe,
        id: generateId(prefix),
        frame: targetFrame,
        value: keyframe.value && typeof keyframe.value === 'object' ? JSON.parse(JSON.stringify(keyframe.value)) : keyframe.value,
      }))
      : []),
  ]]));
}

export function duplicateKeyframeGroup(track: Track, sourceFrame: number, offset = 1, totalFrames?: number): DuplicateKeyframeGroupResult {
  const targetFrame = sourceFrame + offset;
  if (!Number.isFinite(sourceFrame) || sourceFrame < 0) return { track, duplicated: false };
  if (totalFrames !== undefined && (sourceFrame > totalFrames || targetFrame > totalFrames)) return { track, duplicated: false };

  const channels = track.channels ?? {};
  const maskChannels = (track.maskChannels ?? {}) as KeyframeMap<PropertyKeyframe>;
  const maskPathChannels = (track.maskPathChannels ?? {}) as KeyframeMap<PathKeyframe>;

  const channelKeys = TRACK_CHANNELS.filter((channel) => hasKeyframeAt(channels[channel], sourceFrame));
  const maskKeys = channelsWithKeyframeAt(maskChannels, sourceFrame);
  const pathKeys = channelsWithKeyframeAt(maskPathChannels, sourceFrame);
  const sourceLegacy = (track.keyframes ?? []).filter((keyframe) => keyframe.frame === sourceFrame);
  if (!channelKeys.length && !maskKeys.length && !pathKeys.length && !sourceLegacy.length) return { track, duplicated: false };

  const destinationTaken = TRACK_CHANNELS.some((channel) => hasKeyframeAt(channels[channel], targetFrame))
    || mapOccupies(track.maskChannels, targetFrame)
    || mapOccupies(track.maskPathChannels, targetFrame)
    || hasKeyframeAt(track.keyframes, targetFrame);
  if (destinationTaken) return { track, duplicated: false };

  const nextChannels = { ...channels };
  for (const channel of channelKeys) {
    const existing = channels[channel] ?? [];
    nextChannels[channel] = [
      ...existing,
      ...existing.filter((keyframe) => keyframe.frame === sourceFrame).map((keyframe: PropertyKeyframe) => ({
        ...keyframe,
        id: generateId(`pkf_${channel}`),
        frame: targetFrame,
        ...(keyframe.bezierControlPoints ? { bezierControlPoints: [...keyframe.bezierControlPoints] as [number, number, number, number] } : {}),
      })),
    ];
  }
  const nextMaskChannels = duplicateInMap(track.maskChannels, maskKeys, sourceFrame, targetFrame, 'pkf_mask');
  const nextPathChannels = duplicateInMap(track.maskPathChannels, pathKeys, sourceFrame, targetFrame, 'pkf_mask_path');
  const nextLegacy: Keyframe[] = [
    ...(track.keyframes ?? []),
    ...sourceLegacy.map((keyframe) => ({ ...keyframe, id: generateId('kf'), frame: targetFrame, transform: { ...keyframe.transform } })),
  ];
  return {
    track: {
      ...track,
      channels: nextChannels,
      maskChannels: nextMaskChannels as Track['maskChannels'],
      maskPathChannels: nextPathChannels as Track['maskPathChannels'],
      keyframes: nextLegacy,
    },
    duplicated: true,
  };
}
