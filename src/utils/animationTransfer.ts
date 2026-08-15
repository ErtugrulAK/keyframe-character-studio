import type { CharacterPart, Keyframe, PropertyKeyframe, Track, TrackChannel } from '../types/animator';
import { generateId } from './idGenerator';
import { makeEmptyChannels } from './defaults';

/**
 * M26 26A — COPY ANIMATION ONTO EXISTING PART (pure data layer).
 *
 * Transfers ONLY animation intent from a clipboard source (part + track) to
 * an EXISTING target part:
 *   - Track.channels (PropertyKeyframe[] with fresh ids)
 *   - legacy Track.keyframes (fresh ids)
 *   - CharacterPart.inAnimPreset / outAnimPreset / inAnimDuration / outAnimDuration
 *
 * The target keeps its own identity (id/name/transform/matte/parent/geometry/
 * media/visibility/lock/zIndex) and its track keeps its own id + metadata.
 * Fresh ids are generated for every transferred keyframe (source ids are
 * NEVER reused — M25 custom preset IDs are referenced as-is, never cloned).
 *
 * M8 SAFE: copies EXISTING Track.channels/keyframes — no new channel type,
 * no evaluateFrame/playback/serialization change.
 */

export interface AnimationTransferResult {
  /** Target track carrying the copied animation (existing id+metadata, or a
   *  freshly created track when the target had none). */
  track: Track;
  /** Animation fields to apply onto the target part (undefined = cleared to
   *  match the source exactly). Typed from CharacterPart's actual fields. */
  animationFields: Pick<
    CharacterPart,
    'inAnimPreset' | 'outAnimPreset' | 'inAnimDuration' | 'outAnimDuration'
  >;
}

export function cloneAnimationOntoTarget(
  sourceTrack: Track | undefined,
  sourcePart: CharacterPart,
  targetPartId: string,
  targetTrack: Track | undefined,
): AnimationTransferResult {
  // Base track: preserve target track identity + metadata when it exists;
  // otherwise create one with the repository's default track conventions.
  const baseTrack: Track = targetTrack
    ? {
        ...targetTrack,
        partId: targetPartId,
        keyframes: [],
        channels: makeEmptyChannels(),
      }
    : {
        id: generateId('track'),
        partId: targetPartId,
        name: sourcePart.name,
        color: '#3b82f6',
        keyframes: [],
        channels: makeEmptyChannels(),
        visible: true,
        locked: false,
        expanded: false,
      };

  if (sourceTrack) {
    // Channels: clone every PropertyKeyframe with a FRESH id; frame/value/
    // easing/bezierControlPoints/templateId are preserved exactly (nested
    // bezier array deep-cloned so target never shares references with source).
    (Object.keys(sourceTrack.channels ?? {}) as TrackChannel[]).forEach((ch) => {
      const arr = sourceTrack.channels?.[ch];
      if (arr && arr.length > 0) {
        baseTrack.channels[ch] = arr.map((pk: PropertyKeyframe) => ({
          ...pk,
          id: generateId(`pkf_${ch}`),
          ...(pk.bezierControlPoints ? { bezierControlPoints: [...pk.bezierControlPoints] as [number, number, number, number] } : {}),
        }));
      }
    });
    // Legacy composite keyframes: clone with fresh ids; transform + bezier
    // deep-cloned (transform is a nested object — shallow spread would share
    // the reference with the source clipboard).
    if (sourceTrack.keyframes && sourceTrack.keyframes.length > 0) {
      baseTrack.keyframes = sourceTrack.keyframes.map((k: Keyframe) => ({
        ...k,
        id: generateId('kf'),
        transform: { ...k.transform },
        ...(k.bezierControlPoints ? { bezierControlPoints: [...k.bezierControlPoints] as [number, number, number, number] } : {}),
      }));
    }
  }

  return {
    track: baseTrack,
    animationFields: {
      inAnimPreset: sourcePart.inAnimPreset,
      outAnimPreset: sourcePart.outAnimPreset,
      inAnimDuration: sourcePart.inAnimDuration,
      outAnimDuration: sourcePart.outAnimDuration,
    },
  };
}
