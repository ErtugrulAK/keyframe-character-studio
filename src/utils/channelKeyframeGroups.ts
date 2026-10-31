/**
 * Frame-based grouping of canonical channel keyframes.
 *
 * The editor UI treats "a keyframe" as one frame holding several property
 * keyframes (legacy composite keyframe semantics). This helper groups the
 * canonical per-channel keyframes into that frame-based view, and resolves the
 * authored pose a keyframe must capture (see `resolveAuthoredLocalTransform`).
 */

import type { AnimationChannel, CharacterPart, PropertyKeyframe, Track, TrackChannel, Transform } from '../types/animator';
import { worldToContainerLocal } from './containerMath';
import { authoredBasePose } from './evaluateTransform';
import { fillChannelsFromLegacyKeyframes } from './legacyKeyframeConversion';
import { relationshipParentId } from './partBinding';

const MASK_SCALAR_PROPERTIES = ['opacity', 'feather', 'expansion'] as const;
/** A per-mask scalar channel (`maskId:opacity|feather|expansion`). Path
 * channels carry geometry, not a number, and stay outside this pair. */
const asMaskScalarChannel = (channel: string): string | null => {
  if (!channel.includes(':')) return null;
  const [, property] = channel.split(':');
  return (MASK_SCALAR_PROPERTIES as readonly string[]).includes(property) ? channel : null;
};

interface ChannelKeyframeGroup {
  /** Shared frame number */
  frame: number;
  /** Channels that have a keyframe at this frame */
  channels: TrackChannel[];
  /** channel → keyframe at this frame (already template-filtered) */
  keyframes: Record<string, PropertyKeyframe>;
  /** Representative easing (first channel's keyframe easing) */
  easing: string;
  /** Representative bezier control points, if any */
  bezierControlPoints?: [number, number, number, number];
}

/** All channels the editor can animate, in display order (6 main properties) */
export const DISPLAY_CHANNELS = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'] as const;
export const TRIM_PATH_CHANNELS = ['trimPathStart', 'trimPathEnd', 'trimPathOffset'] as const;
export const ANIMATABLE_CHANNELS: TrackChannel[] = [...DISPLAY_CHANNELS, ...TRIM_PATH_CHANNELS];

/**
 * The authored base pose of one layer inside a document, or `undefined` when the
 * document does not carry that layer.
 *
 * A projection may only prune a legacy property the composite holds when it can
 * PROVE the held value is the layer's own pose (`animatedScopes`). A missing
 * layer proves nothing, so the projection stays faithful — the conservative
 * reading, never an invented pose.
 */
export const resolveAuthoredBasePose = (
  parts: readonly CharacterPart[] | undefined,
  partId: string,
): Transform | undefined => {
  const part = parts?.find((candidate) => candidate.id === partId);
  return part ? authoredBasePose(part) : undefined;
};

/**
 * The keyframes a track's channels resolve to: its canonical channel keys plus
 * every legacy composite keyframe the evaluator still falls back to.
 *
 * This is the ONE read truth behind the aggregate (layer) row, the channel
 * lanes and the Inspector keyframe list — the row is a *projection* of the
 * animation that plays, never a second store. The resolution is exactly the
 * evaluator's (`fillChannelsFromLegacyKeyframes`), so a surface can neither show
 * a key that has no effect nor hide a frame the animation uses.
 *
 * `basePose` is the layer's own authored pose (`authoredBasePose`). A legacy
 * composite list is a sequence of full-pose samples, so without the pose the
 * projection cannot tell an animated property from one that merely re-states
 * the layer's pose; passing it keeps a property row from showing keys for a
 * property the composite never moves (and never hides a held override that
 * differs from the pose).
 */
export function resolveTrackChannels(
  track: Track,
  basePose?: Partial<Transform>,
): Record<TrackChannel, PropertyKeyframe[]> {
  return fillChannelsFromLegacyKeyframes(track.channels, track.keyframes || [], basePose);
}

/**
 * Group per-channel keyframes by frame, filtered to the active template.
 * Deterministic: groups sorted by frame; channels in DISPLAY_CHANNELS order.
 */
export function groupChannelKeyframesByFrame(
  channels: Record<TrackChannel, PropertyKeyframe[]> | undefined,
  activeTemplateId: string,
): ChannelKeyframeGroup[] {
  if (!channels) return [];

  const byFrame = new Map<number, ChannelKeyframeGroup>();

  for (const ch of ANIMATABLE_CHANNELS) {
    const kfs = channels[ch] || [];
    for (const kf of kfs) {
      if ((kf.templateId || 'Sequence') !== activeTemplateId) continue;
      let group = byFrame.get(kf.frame);
      if (!group) {
        group = { frame: kf.frame, channels: [], keyframes: {}, easing: kf.easing || 'linear' };
        byFrame.set(kf.frame, group);
      }
      group.channels.push(ch);
      group.keyframes[ch] = kf;
      // First channel's easing is the representative
      if (group.channels.length === 1) {
        group.easing = kf.easing || 'linear';
        group.bezierControlPoints = kf.bezierControlPoints;
      }
    }
  }

  return [...byFrame.values()].sort((a, b) => a.frame - b.frame);
}

/**
 * Snapshot an evaluated transform into the 6 canonical channel values at
 * the current frame (used by the Outliner "Add Composite Keyframe" button —
 * same data the keyframe add command writes).
 */
export type SnapshotTransform = Pick<
  Record<TrackChannel, number>,
  'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'opacity'
>;

export function buildTransformSnapshot(t: {
  x: number; y: number; rotation: number;
  scaleX: number; scaleY: number; opacity: number;
}): SnapshotTransform {
  return {
    x: t.x, y: t.y, rotation: t.rotation,
    scaleX: t.scaleX, scaleY: t.scaleY, opacity: t.opacity,
  };
}

/** Evaluated world transforms for a document — the app's `getComputedTransform`. */
interface EvaluatedPoseSource {
  /** Every layer, used to resolve the captured layer's relationship parent. */
  parts: CharacterPart[];
  /** Evaluated WORLD transform of a layer at a frame (`getComputedTransform`). */
  worldOf: (partId: string, frame: number) => Transform;
}

/**
 * The transform a keyframe must capture for a layer: its own authored pose in
 * the container that owns it.
 *
 * `getComputedTransform` returns the WORLD transform with the whole parent chain
 * already composed in, while a channel keyframe is authored in the layer's own
 * space — `evaluateTransform` composes the parent afterwards. Storing the world
 * pose therefore re-composes the parent on the very next evaluation: adding a
 * keyframe moved a parented/grouped layer by its container's transform, and
 * every later add moved it again. Converting with the same exact inverse the
 * Inspector and grouping use keeps the evaluated pose identical at the captured
 * frame, including rotated and scaled containers.
 */
export const resolveAuthoredLocalTransform = (
  partId: string,
  frame: number,
  source: EvaluatedPoseSource,
): Transform => {
  const world = source.worldOf(partId, frame);
  const parentId = relationshipParentId(source.parts.find((part) => part.id === partId));
  if (!parentId) return world;
  return worldToContainerLocal(world, source.worldOf(parentId, frame));
};

/**
 * K1 (contract D2) — the static half of the stopwatch: when a property stops
 * being animated, the value the timeline evaluates AT THE PLAYHEAD becomes the
 * property's authored static value, written through the same fields
 * `authoredBasePose` reads. Every canonical channel has one, so disarm never
 * needs a parallel "static override" store. Mask scalars/paths write their own
 * part fields and are the K3/K5 slice's responsibility.
 */
export const applyChannelStaticValue = (
  part: CharacterPart,
  channel: AnimationChannel,
  value: number,
): CharacterPart => {
  const maskScalar = asMaskScalarChannel(channel);
  if (maskScalar) {
    const [maskId, property] = maskScalar.split(':') as [string, 'opacity' | 'feather' | 'expansion'];
    if (!part.masks?.some((mask) => mask.id === maskId)) return part;
    return { ...part, masks: part.masks.map((mask) => (mask.id === maskId ? { ...mask, [property]: value } : mask)) };
  }
  switch (channel) {
    case 'x':
    case 'y':
    case 'rotation':
    case 'scaleX':
    case 'scaleY':
    case 'opacity':
    case 'maskOffsetX':
    case 'maskOffsetY':
    case 'maskScale':
    case 'maskRotation':
      return { ...part, baseTransform: { ...part.baseTransform, [channel]: value } };
    case 'trimPathStart':
      return { ...part, trimPathStart: value };
    case 'trimPathEnd':
      return { ...part, trimPathEnd: value };
    case 'trimPathOffset':
      return { ...part, trimPathOffset: value };
    default:
      // Exhaustive over TrackChannel; an unknown channel must never guess-write.
      return part;
  }
};

/** The arm value: the property's value at a frame, read from the SAME
 * authored-local pose the aggregate `+` captures (finding F safe) and the
 * part fields the trim/mask-offset channels are authored in. */
export const channelArmValue = (
  channel: AnimationChannel,
  authored: Transform,
  part: CharacterPart,
): number => {
  // A per-mask scalar arms from its own mask's authored static value.
  const maskScalar = asMaskScalarChannel(channel);
  if (maskScalar) {
    const [maskId, property] = maskScalar.split(':') as [string, 'opacity' | 'feather' | 'expansion'];
    return part.masks?.find((mask) => mask.id === maskId)?.[property] ?? 0;
  }
  switch (channel) {
    case 'x':
    case 'y':
    case 'rotation':
    case 'scaleX':
    case 'scaleY':
    case 'opacity':
      return authored[channel];
    case 'maskOffsetX':
      return part.baseTransform.maskOffsetX ?? 0;
    case 'maskOffsetY':
      return part.baseTransform.maskOffsetY ?? 0;
    case 'maskScale':
      return part.baseTransform.maskScale ?? 1;
    case 'maskRotation':
      return part.baseTransform.maskRotation ?? 0;
    case 'trimPathStart':
      return part.trimPathStart ?? 0;
    case 'trimPathEnd':
      return part.trimPathEnd ?? 1;
    case 'trimPathOffset':
      return part.trimPathOffset ?? 0;
    default:
      // Unreachable for the exhaustive TrackChannel union.
      return authored.x;
  }
};
