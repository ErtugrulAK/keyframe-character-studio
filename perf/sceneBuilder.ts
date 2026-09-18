import type { AnimationTrackData, CharacterPart, PropertyKeyframe, TrackChannel } from '../src/types/animator';
import type { RuntimeData, RuntimeTrackState } from '../src/types/composition';
import { makeEmptyChannels } from '../src/utils/defaults';

/**
 * Deterministic scene builder for the evaluator profile.
 *
 * The profile is only useful if the same parameters always produce the same
 * scene, so nothing here uses randomness, clocks or generated ids: ids are
 * derived from the layer index and keyframe values follow a fixed pattern.
 * It reuses the production channel factory (`makeEmptyChannels`) so the shape
 * of a track cannot drift from what the evaluator actually reads.
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

export const buildProfileScene = (parameters: ProfileSceneParameters): ProfileScene => {
  const totalFrames = 120;
  const layers: CharacterPart[] = [];
  const tracks: (AnimationTrackData & RuntimeTrackState)[] = [];

  for (let layerIndex = 0; layerIndex < parameters.layers; layerIndex += 1) {
    const id = `profile-layer-${layerIndex}`;
    const isMasked = layerIndex < parameters.maskedLayers;
    const isParented = layerIndex >= parameters.layers - parameters.parentedLayers && layerIndex > 0;

    layers.push({
      id,
      name: `Profile Layer ${layerIndex}`,
      type: 'custom',
      zIndex: layerIndex,
      fillColor: '#404040',
      strokeColor: '#101218',
      pivot: { x: 0.5, y: 0.5 },
      parentId: isParented ? `profile-layer-${layerIndex - 1}` : undefined,
      transform: { x: layerIndex * 4, y: layerIndex * 2, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      ...(isMasked
        ? {
          layers: [
            {
              id: `${id}-mask`,
              mode: 'add' as const,
              inverted: false,
              opacity: 1,
              feather: 0,
              expansion: 0,
              path: {
                version: 1 as const,
                coordinateSpace: 'local' as const,
                closed: true,
                vertices: [
                  { id: `${id}-v0`, x: 0, y: 0 },
                  { id: `${id}-v1`, x: 40, y: 0 },
                  { id: `${id}-v2`, x: 40, y: 40 },
                  { id: `${id}-v3`, x: 0, y: 40 },
                ],
              },
            },
          ],
        }
        : {}),
    } as CharacterPart);

    const channels = makeEmptyChannels();
    const animatedCount = Math.min(parameters.channelsPerLayer, ANIMATED_CHANNELS.length);
    for (let channelIndex = 0; channelIndex < animatedCount; channelIndex += 1) {
      const channel = ANIMATED_CHANNELS[channelIndex];
      channels[channel] = buildKeyframes(layerIndex, channelIndex, parameters.keyframesPerChannel, totalFrames);
    }

    const maskChannels: AnimationTrackData['maskChannels'] = isMasked
      ? { [`${id}-mask:opacity`]: buildKeyframes(layerIndex, 9, parameters.keyframesPerChannel, totalFrames) }
      : undefined;

    const track: AnimationTrackData & RuntimeTrackState = {
      partId: id,
      channels,
      ...(maskChannels ? { maskChannels } : {}),
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
