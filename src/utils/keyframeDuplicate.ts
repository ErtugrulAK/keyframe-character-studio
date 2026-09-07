import type { Track, Keyframe, PropertyKeyframe, PathKeyframe } from '../types/animator';
import { TRACK_CHANNELS } from '../types/animator';
import { generateId } from './idGenerator';

export interface DuplicateKeyframeGroupResult { track: Track; duplicated: boolean; }

export function duplicateKeyframeGroup(track: Track, sourceFrame: number, offset = 1, totalFrames?: number): DuplicateKeyframeGroupResult {
  const targetFrame = sourceFrame + offset;
  if (!Number.isFinite(sourceFrame) || sourceFrame < 0 || (totalFrames !== undefined && (sourceFrame > totalFrames || targetFrame > totalFrames))) return { track, duplicated: false };
  const channels = track.channels ?? {};
  const sourceChannelKfs = TRACK_CHANNELS.filter((channel) => (channels[channel] ?? []).some((keyframe) => keyframe.frame === sourceFrame));
  const maskChannels = (track.maskChannels ?? {}) as Record<string, PropertyKeyframe[]>;
  const maskPathChannels = (track.maskPathChannels ?? {}) as Record<string, PathKeyframe[]>;
  const maskKeys = Object.keys(maskChannels).filter((channel) => (maskChannels[channel] ?? []).some((keyframe) => keyframe.frame === sourceFrame));
  const pathKeys = Object.keys(maskPathChannels).filter((channel) => (maskPathChannels[channel] ?? []).some((keyframe) => keyframe.frame === sourceFrame));
  const sourceLegacy = (track.keyframes ?? []).filter((keyframe) => keyframe.frame === sourceFrame);
  if (!sourceChannelKfs.length && !maskKeys.length && !pathKeys.length && !sourceLegacy.length) return { track, duplicated: false };
  const occupied = (map: Record<string, Array<{ frame: number }> > | undefined) => Object.values(map ?? {}).some((keyframes) => keyframes.some((keyframe) => keyframe.frame === targetFrame));
  if (TRACK_CHANNELS.some((channel) => (channels[channel] ?? []).some((keyframe) => keyframe.frame === targetFrame)) || occupied(track.maskChannels) || occupied(track.maskPathChannels) || (track.keyframes ?? []).some((keyframe) => keyframe.frame === targetFrame)) return { track, duplicated: false };
  const nextChannels = { ...channels };
  for (const channel of sourceChannelKfs) nextChannels[channel] = [...(channels[channel] ?? []), ...(channels[channel] ?? []).filter((keyframe) => keyframe.frame === sourceFrame).map((keyframe: PropertyKeyframe) => ({ ...keyframe, id: generateId(`pkf_${channel}`), frame: targetFrame, ...(keyframe.bezierControlPoints ? { bezierControlPoints: [...keyframe.bezierControlPoints] as [number, number, number, number] } : {}) }))];
  const duplicateMap = (map: Record<string, Array<any>> | undefined, keys: string[], prefix: string) => Object.fromEntries(Object.entries(map ?? {}).map(([channel, keyframes]) => [channel, [...keyframes, ...(keys.includes(channel) ? keyframes.filter((keyframe) => keyframe.frame === sourceFrame).map((keyframe) => ({ ...keyframe, id: generateId(prefix), frame: targetFrame, value: keyframe.value && typeof keyframe.value === 'object' ? JSON.parse(JSON.stringify(keyframe.value)) : keyframe.value })) : [])]]));
  const nextMaskChannels = duplicateMap(track.maskChannels, maskKeys, 'pkf_mask');
  const nextPathChannels = duplicateMap(track.maskPathChannels, pathKeys, 'pkf_mask_path');
  const nextLegacy: Keyframe[] = [...(track.keyframes ?? []), ...sourceLegacy.map((keyframe) => ({ ...keyframe, id: generateId('kf'), frame: targetFrame, transform: { ...keyframe.transform } }))];
  return { track: { ...track, channels: nextChannels, maskChannels: nextMaskChannels, maskPathChannels: nextPathChannels, keyframes: nextLegacy }, duplicated: true };
}
