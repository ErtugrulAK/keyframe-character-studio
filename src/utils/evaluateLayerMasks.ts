import type { AnimationTrackData, CharacterPart, LayerMask } from '../types/animator';
import { layerMaskChannel, layerMaskPathChannel } from '../types/animator';
import { interpolateChannel, interpolatePathChannel } from './defaults';

const normalizeSequenceId = (sequenceId?: string): string => sequenceId || 'Sequence';

const resolveScalar = (
  track: AnimationTrackData | undefined,
  maskId: string,
  property: 'opacity' | 'feather' | 'expansion',
  frame: number,
  fallback: number,
  sequenceId: string,
): number => {
  const keyframes = track?.maskChannels?.[layerMaskChannel(maskId, property)]
    ?.filter((keyframe) => normalizeSequenceId(keyframe.templateId) === sequenceId);
  return keyframes?.length ? interpolateChannel(keyframes, frame, fallback) : fallback;
};

const resolvePath = (
  track: AnimationTrackData | undefined,
  mask: LayerMask,
  frame: number,
  sequenceId: string,
): LayerMask['path'] => {
  const keyframes = track?.maskPathChannels?.[layerMaskPathChannel(mask.id)]
    ?.filter((keyframe) => normalizeSequenceId(keyframe.templateId) === sequenceId);
  return keyframes?.length
    ? interpolatePathChannel(keyframes, frame, mask.path)
    : mask.path;
};

/** Evaluate V6 scalar and path mask properties through the existing track authority. */
export const evaluateLayerMasks = (
  part: CharacterPart,
  track: AnimationTrackData | undefined,
  frame: number,
  sequenceId = 'Sequence',
): LayerMask[] | undefined => {
  if (!part.masks?.length) return undefined;
  const normalizedSequenceId = normalizeSequenceId(sequenceId);
  return part.masks.map((mask) => ({
    ...mask,
    path: resolvePath(track, mask, frame, normalizedSequenceId),
    opacity: Math.max(0, Math.min(1, resolveScalar(track, mask.id, 'opacity', frame, mask.opacity ?? 1, normalizedSequenceId))),
    feather: Math.max(0, resolveScalar(track, mask.id, 'feather', frame, mask.feather ?? 0, normalizedSequenceId)),
    expansion: resolveScalar(track, mask.id, 'expansion', frame, mask.expansion ?? 0, normalizedSequenceId),
  }));
};

