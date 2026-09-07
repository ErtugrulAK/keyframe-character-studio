import type { AnimationTrackData, CharacterPart, LayerMask } from '../types/animator';
import { layerMaskChannel } from '../types/animator';
import { interpolateChannel } from './defaults';

const resolveScalar = (
  track: AnimationTrackData | undefined,
  maskId: string,
  property: 'opacity' | 'feather' | 'expansion',
  frame: number,
  fallback: number,
): number => {
  const keyframes = track?.maskChannels?.[layerMaskChannel(maskId, property)];
  return keyframes?.length ? interpolateChannel(keyframes, frame, fallback) : fallback;
};

/** Evaluate V6 scalar mask properties through the existing track authority. */
export const evaluateLayerMasks = (
  part: CharacterPart,
  track: AnimationTrackData | undefined,
  frame: number,
): LayerMask[] | undefined => {
  if (!part.masks?.length) return undefined;
  return part.masks.map((mask) => ({
    ...mask,
    opacity: Math.max(0, Math.min(1, resolveScalar(track, mask.id, 'opacity', frame, mask.opacity ?? 1))),
    feather: Math.max(0, resolveScalar(track, mask.id, 'feather', frame, mask.feather ?? 0)),
    expansion: resolveScalar(track, mask.id, 'expansion', frame, mask.expansion ?? 0),
  }));
};
