import type { AnimationTrackData, BezierPath, CharacterPart, LayerMask, PathKeyframe, PropertyKeyframe, TrackChannel } from '../src/types/animator';
import { layerMaskChannel, layerMaskPathChannel } from '../src/types/animator';
import type { RuntimeData, RuntimeTrackState } from '../src/types/composition';
import { makeEmptyChannels } from '../src/utils/defaults';

/**
 * Deterministic scene builder for the evaluator profile.
 *
 * The profile is only useful if the same parameters always produce the same
 * scene, so nothing here uses randomness, clocks or generated ids: ids are
 * derived from the layer index and keyframe values follow a fixed pattern.
 * It reuses the production channel factory (`makeEmptyChannels`) and the
 * production mask channel keys (`layerMaskChannel`/`layerMaskPathChannel`) so
 * the shape of a track cannot drift from what the evaluator actually reads.
 *
 * Every layer is built as a `CharacterPart` without a cast: the previous
 * `as CharacterPart` hid two fields the evaluator never reads (`transform`
 * instead of `baseTransform`, and `layers` instead of `masks`), so the profile
 * measured default transforms and no masks at all.
 */
export interface ProfileSceneParameters {
  /** Number of animated layers. */
  layers: number;
  /** Number of animated transform channels per layer (max 5: x, y, rotation, scaleX, scaleY). */
  channelsPerLayer: number;
  /** Keyframes per animated channel. */
  keyframesPerChannel: number;
  /** Layers that also carry animated mask scalars and a mask path. */
  maskedLayers: number;
  /** Layers parented to the previous layer, exercising the hierarchy stage. */
  parentedLayers: number;
}

export interface ProfileScene {
  parameters: ProfileSceneParameters;
  layers: CharacterPart[];
  tracks: (AnimationTrackData & RuntimeTrackState)[];
  totalFrames: number;
  runtime: RuntimeData;
}

const ANIMATED_CHANNELS: TrackChannel[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY'];
const TOTAL_FRAMES = 120;

const buildKeyframes = (layerIndex: number, channelIndex: number, count: number, totalFrames: number): PropertyKeyframe[] => {
  const keyframes: PropertyKeyframe[] = [];
  const stride = Math.max(1, Math.floor(totalFrames / Math.max(1, count)));
  for (let index = 0; index < count; index += 1) {
    keyframes.push({
      id: `kf-l${layerIndex}-c${channelIndex}-${index}`,
      frame: Math.min(totalFrames - 1, index * stride),
      value: Number((index % 2 === 0 ? index * 0.25 : -(index * 0.25)).toFixed(3)),
      easing: index % 3 === 0 ? 'hold' : 'easeInOut',
      // Every third keyframe carries temporal handles so the Bezier path of the
      // interpolator is exercised, not just the linear fallback.
      ...(index % 3 === 2
        ? { bezierIn: { x: 0.42, y: 0 }, bezierOut: { x: 0.58, y: 1 } }
        : {}),
    });
  }
  return keyframes;
};

/**
 * A closed rectangle in the mask's own space. The size steps through six values
 * and repeats, so every keyframe carries valid geometry and consecutive
 * keyframes still differ (the path interpolator needs matching topology, not
 * identical points).
 */
const buildMaskPath = (layerIndex: number, keyframeIndex: number): BezierPath => {
  const inset = keyframeIndex % 6;
  const halfWidth = 20 - inset;
  const halfHeight = 12 - inset;
  return {
    version: 1,
    coordinateSpace: 'local',
    closed: true,
    points: [
      { id: `mask-v0-l${layerIndex}-k${keyframeIndex}`, x: -halfWidth, y: -halfHeight },
      { id: `mask-v1-l${layerIndex}-k${keyframeIndex}`, x: halfWidth, y: -halfHeight },
      { id: `mask-v2-l${layerIndex}-k${keyframeIndex}`, x: halfWidth, y: halfHeight },
      { id: `mask-v3-l${layerIndex}-k${keyframeIndex}`, x: -halfWidth, y: halfHeight },
    ],
  };
};

const buildMaskPathKeyframes = (layerIndex: number, count: number, totalFrames: number): PathKeyframe[] => {
  const keyframes: PathKeyframe[] = [];
  const stride = Math.max(1, Math.floor(totalFrames / Math.max(1, count)));
  for (let index = 0; index < count; index += 1) {
    keyframes.push({
      id: `mask-pkf-l${layerIndex}-${index}`,
      frame: Math.min(totalFrames - 1, index * stride),
      value: buildMaskPath(layerIndex, index),
      easing: 'easeInOut',
    });
  }
  return keyframes;
};

const buildMask = (maskId: string, layerIndex: number): LayerMask => ({
  id: maskId,
  name: `Profile Mask ${layerIndex}`,
  mode: 'add',
  inverted: false,
  enabled: true,
  opacity: 1,
  feather: 0,
  expansion: 0,
  path: buildMaskPath(layerIndex, 0),
});

/** A closed rectangle the freeform renderer can draw, so the layer is a real one. */
const buildLayerPath = (layerIndex: number): BezierPath => ({
  version: 1,
  coordinateSpace: 'local',
  closed: true,
  points: [
    { id: `v0-l${layerIndex}`, x: -12, y: -8 },
    { id: `v1-l${layerIndex}`, x: 12, y: -8 },
    { id: `v2-l${layerIndex}`, x: 12, y: 8 },
    { id: `v3-l${layerIndex}`, x: -12, y: 8 },
  ],
});

export const buildProfileScene = (parameters: ProfileSceneParameters): ProfileScene => {
  const totalFrames = TOTAL_FRAMES;
  const layers: CharacterPart[] = [];
  const tracks: (AnimationTrackData & RuntimeTrackState)[] = [];

  for (let layerIndex = 0; layerIndex < parameters.layers; layerIndex += 1) {
    const id = `profile-layer-${layerIndex}`;
    const maskId = `${id}-mask`;
    const isMasked = layerIndex < parameters.maskedLayers;
    const isParented = layerIndex >= parameters.layers - parameters.parentedLayers && layerIndex > 0;

    layers.push({
      id,
      name: `Profile Layer ${layerIndex}`,
      // A real member of the type union: the previous bare `'custom'` is not one,
      // and the cast hid that too.
      type: 'custom_freeform',
      zIndex: layerIndex,
      fillColor: '#404040',
      strokeColor: '#101218',
      pivot: { x: 0.5, y: 0.5 },
      ...(isParented ? { parentId: `profile-layer-${layerIndex - 1}` } : {}),
      baseTransform: { x: layerIndex * 4, y: layerIndex * 2, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      path: buildLayerPath(layerIndex),
      ...(isMasked ? { masks: [buildMask(maskId, layerIndex)] } : {}),
    });

    const channels = makeEmptyChannels();
    const animatedCount = Math.min(parameters.channelsPerLayer, ANIMATED_CHANNELS.length);
    for (let channelIndex = 0; channelIndex < animatedCount; channelIndex += 1) {
      const channel = ANIMATED_CHANNELS[channelIndex];
      channels[channel] = buildKeyframes(layerIndex, channelIndex, parameters.keyframesPerChannel, totalFrames);
    }

    const track: AnimationTrackData & RuntimeTrackState = {
      partId: id,
      channels,
      ...(isMasked
        ? {
          maskChannels: {
            [layerMaskChannel(maskId, 'opacity')]: buildKeyframes(layerIndex, ANIMATED_CHANNELS.length, parameters.keyframesPerChannel, totalFrames),
          },
          maskPathChannels: {
            [layerMaskPathChannel(maskId)]: buildMaskPathKeyframes(layerIndex, parameters.keyframesPerChannel, totalFrames),
          },
        }
        : {}),
      visible: true,
      opacity: 1,
      editVisible: true,
    };
    tracks.push(track);
  }

  return {
    parameters,
    layers,
    tracks,
    totalFrames,
    runtime: { appMode: 'edit', broadcast: {}, liveStunts: {} },
  };
};

/** Small, medium, large and masked-heavy scenes used by the default profile run. */
export const DEFAULT_PROFILE_SCENES: Record<string, ProfileSceneParameters> = {
  small: { layers: 5, channelsPerLayer: 5, keyframesPerChannel: 4, maskedLayers: 0, parentedLayers: 0 },
  medium: { layers: 25, channelsPerLayer: 5, keyframesPerChannel: 12, maskedLayers: 5, parentedLayers: 5 },
  large: { layers: 100, channelsPerLayer: 5, keyframesPerChannel: 24, maskedLayers: 20, parentedLayers: 20 },
  masks: { layers: 40, channelsPerLayer: 5, keyframesPerChannel: 12, maskedLayers: 40, parentedLayers: 0 },
};
