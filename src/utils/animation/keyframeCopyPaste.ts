import type { Track, TrackChannel, Keyframe, PropertyKeyframe, PathKeyframe } from '../../types/animator';
import { TRACK_CHANNELS } from '../../types/animator';
import { generateId } from '../layers/idGenerator';

/**
 * Timeline-local keyframe copy / paste (AGENTS.md §14).
 *
 * Copy takes every keyframe at one frame of one track — transform channels,
 * mask channels, mask-path channels and legacy composite keyframes — without
 * ids. Paste writes that group at an explicit target frame of any track with
 * fresh ids. A target frame that already holds any keyframe on the track is a
 * safe no-op, so a paste never merges into or overwrites existing keys.
 */

type CopiedKeyframe<T> = Omit<T, 'id'>;

export interface KeyframeCopyPayload {
  channels: Partial<Record<TrackChannel, Array<CopiedKeyframe<PropertyKeyframe>>>>;
  maskChannels?: Record<string, Array<CopiedKeyframe<PropertyKeyframe>>>;
  maskPathChannels?: Record<string, Array<CopiedKeyframe<PathKeyframe>>>;
  legacy: Array<CopiedKeyframe<Keyframe>>;
}

interface PasteKeyframeResult { track: Track; pasted: boolean; }

type FramedKeyframe = { frame: number; bezierControlPoints?: [number, number, number, number]; value?: unknown };
type KeyframeMap<T> = Record<string, T[]>;

/** A copy that shares no mutable array or object value with its source. */
function cloneKeyframe<T extends FramedKeyframe>(keyframe: T): T {
  return {
    ...keyframe,
    ...(keyframe.bezierControlPoints ? { bezierControlPoints: [...keyframe.bezierControlPoints] as [number, number, number, number] } : {}),
    ...(keyframe.value && typeof keyframe.value === 'object' ? { value: JSON.parse(JSON.stringify(keyframe.value)) } : {}),
  };
}

const withoutId = <T extends FramedKeyframe & { id: string }>({ id: _id, ...keyframe }: T): CopiedKeyframe<T> =>
  cloneKeyframe(keyframe as unknown as T) as unknown as CopiedKeyframe<T>;

/** The keyframes of each channel at `frame`; channels with none are left out. */
function copyMap<T extends FramedKeyframe & { id: string }>(map: KeyframeMap<T> | undefined, frame: number): KeyframeMap<CopiedKeyframe<T>> {
  return Object.fromEntries(Object.entries(map ?? {}).flatMap(([channel, keyframes]) => {
    const values = keyframes.filter((keyframe) => keyframe.frame === frame);
    return values.length ? [[channel, values.map(withoutId)]] : [];
  }));
}

export function copyKeyframeGroupData(track: Track, frame: number): KeyframeCopyPayload {
  const channels: KeyframeCopyPayload['channels'] = {};
  for (const channel of TRACK_CHANNELS) {
    const values = (track.channels?.[channel] ?? []).filter((keyframe) => keyframe.frame === frame);
    if (values.length) channels[channel] = values.map(withoutId);
  }
  const legacy = (track.keyframes ?? [])
    .filter((keyframe) => keyframe.frame === frame)
    .map(({ id: _id, ...keyframe }) => ({ ...cloneKeyframe(keyframe), transform: { ...keyframe.transform } }));
  return {
    channels,
    maskChannels: copyMap(track.maskChannels, frame),
    maskPathChannels: copyMap(track.maskPathChannels, frame),
    legacy,
  };
}

/** Whether any channel of the map already has a keyframe at `frame`. */
const mapOccupies = (map: KeyframeMap<{ frame: number }> | undefined, frame: number): boolean =>
  Object.values(map ?? {}).some((keyframes) => keyframes.some((keyframe) => keyframe.frame === frame));

/** Whether the track holds any keyframe at all at `frame`. */
const trackOccupies = (track: Track, frame: number): boolean =>
  TRACK_CHANNELS.some((channel) => (track.channels?.[channel] ?? []).some((keyframe) => keyframe.frame === frame))
  || mapOccupies(track.maskChannels, frame)
  || mapOccupies(track.maskPathChannels, frame)
  || (track.keyframes ?? []).some((keyframe) => keyframe.frame === frame);

/** Every existing channel kept, each copied channel appended at `frame` with fresh ids. */
function pasteMap<T extends FramedKeyframe>(
  source: KeyframeMap<T>,
  existing: KeyframeMap<T & { id: string }> | undefined,
  frame: number,
  prefix: string,
): KeyframeMap<T & { id: string }> {
  return Object.fromEntries([...Object.entries(existing ?? {}), ...Object.entries(source)].map(([channel]) => [channel, [
    ...(existing?.[channel] ?? []),
    ...(source[channel] ?? []).map((keyframe) => ({ ...cloneKeyframe(keyframe), id: generateId(prefix), frame })),
  ]]));
}

export function pasteKeyframeGroupData(track: Track, targetFrame: number, payload: KeyframeCopyPayload, totalFrames?: number): PasteKeyframeResult {
  if (!Number.isFinite(targetFrame) || targetFrame < 0 || (totalFrames !== undefined && targetFrame > totalFrames)) return { track, pasted: false };

  const channelKeys = TRACK_CHANNELS.filter((channel) => (payload.channels[channel] ?? []).length);
  const hasMasks = Object.keys(payload.maskChannels ?? {}).length > 0;
  const hasPaths = Object.keys(payload.maskPathChannels ?? {}).length > 0;
  if (!channelKeys.length && !hasMasks && !hasPaths && !payload.legacy.length) return { track, pasted: false };
  if (trackOccupies(track, targetFrame)) return { track, pasted: false };

  const channels = { ...(track.channels ?? {}) };
  for (const channel of channelKeys) {
    channels[channel] = [
      ...(channels[channel] ?? []),
      ...(payload.channels[channel] ?? []).map((keyframe) => ({ ...cloneKeyframe(keyframe), id: generateId(`pkf_${channel}`), frame: targetFrame })),
    ];
  }
  const maskChannels = pasteMap(payload.maskChannels ?? {}, track.maskChannels, targetFrame, 'pkf_mask');
  const maskPathChannels = pasteMap(payload.maskPathChannels ?? {}, track.maskPathChannels, targetFrame, 'pkf_mask_path');
  const legacy = [
    ...(track.keyframes ?? []),
    ...payload.legacy.map((keyframe) => ({ ...keyframe, id: generateId('kf'), frame: targetFrame, transform: { ...keyframe.transform } })),
  ];
  return {
    track: { ...track, channels, maskChannels: maskChannels as Track['maskChannels'], maskPathChannels: maskPathChannels as Track['maskPathChannels'], keyframes: legacy },
    pasted: true,
  };
}
