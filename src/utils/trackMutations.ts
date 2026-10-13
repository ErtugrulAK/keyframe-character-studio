import type { Track, TrackChannel, AnimationChannel, LayerMaskChannel, LayerMaskPathChannel, EasingType, PropertyKeyframe, PathKeyframe, BezierPath } from '../types/animator';
import { TRACK_CHANNELS } from '../types/animator';
import { generateId } from './idGenerator';
import { ANIMATABLE_CHANNELS, DISPLAY_CHANNELS, TRIM_PATH_CHANNELS } from './channelKeyframeGroups';
import type { TransitionChannelResult } from './motionTransitions';
import { convertLegacyKeyframesToChannels, fillChannelsFromLegacyKeyframes } from './legacyKeyframeConversion';
import { makeEmptyChannels } from './defaults';

/**
 * R3-10 / R3-11 — ONE canonical authored animation truth.
 *
 * A document may still carry the legacy composite list (`track.keyframes[]`).
 * The evaluator resolves a channel from that list only while the channel has no
 * canonical keyframes for the active sequence, so the two stores can disagree:
 * a canonical write left the legacy animation live at runtime but invisible in
 * the timeline, and a partially covered track hid frames the evaluator used.
 *
 * Every canonical authoring entry point migrates first. The migration IS the
 * evaluator's own resolution (`fillChannelsFromLegacyKeyframes`): each legacy
 * keyframe becomes canonical per-channel keyframes with the same frame, value,
 * easing, bezier points and sequence scope, and the now-redundant composite list
 * is dropped. The authored animation is then a single store — `channels` — and
 * no read path can hide a frame the evaluator uses.
 */
export const migrateLegacyKeyframesToCanonical = (track: Track): Track => {
  if (!track.keyframes || track.keyframes.length === 0) return track;
  return {
    ...track,
    channels: fillChannelsFromLegacyKeyframes(track.channels, track.keyframes),
    keyframes: [],
  };
};

/** Migrate one track of a document; identical array when there is nothing to move. */
export const migrateTrackLegacyKeyframes = (tracks: Track[], trackId: string): Track[] => {
  const index = tracks.findIndex((track) => track.id === trackId);
  if (index < 0) return tracks;
  const migrated = migrateLegacyKeyframesToCanonical(tracks[index]);
  if (migrated === tracks[index]) return tracks;
  const next = [...tracks];
  next[index] = migrated;
  return next;
};

const isLayerMaskChannel = (channel: AnimationChannel): channel is LayerMaskChannel =>
  channel.includes(':') && !channel.endsWith(':path');
export const updateKeyframeBezierPointsMutator = (
  tracks: Track[],
  trackId: string,
  keyframeId: string,
  points: [number, number, number, number]
): Track[] => {
  return tracks.map((tr) => {
    if (tr.id !== trackId) return tr;

    const updatedKfs = (tr.keyframes || []).map((k) =>
      k.id === keyframeId ? { ...k, easing: 'cubic_bezier' as EasingType, bezierControlPoints: points } : k
    );

    let updatedChannels = { ...tr.channels };
    if (tr.channels) {
      Object.keys(tr.channels).forEach((chKey) => {
        const ch = chKey as TrackChannel;
        if (updatedChannels[ch]) {
          updatedChannels[ch] = updatedChannels[ch]!.map((pk) =>
            pk.id === keyframeId ? { ...pk, easing: 'cubic_bezier' as EasingType, bezierControlPoints: points } : pk
          );
        }
      });
    }

    let updatedMaskChannels = tr.maskChannels;
    if (tr.maskChannels) {
      updatedMaskChannels = { ...tr.maskChannels };
      Object.keys(tr.maskChannels).forEach((chKey) => {
        const ch = chKey as LayerMaskChannel;
        const list = updatedMaskChannels![ch];
        if (list) {
          updatedMaskChannels![ch] = list.map((pk) =>
            pk.id === keyframeId ? { ...pk, easing: 'cubic_bezier' as EasingType, bezierControlPoints: points } : pk
          );
        }
      });
    }

    return {
      ...tr,
      keyframes: updatedKfs,
      channels: updatedChannels,
      maskChannels: updatedMaskChannels,
    };
  });
};

export const addPropertyKeyframeMutator = (
  tracks: Track[],
  trackId: string,
  channel: AnimationChannel,
  frame: number,
  value: number,
  easing: EasingType,
  templateId: string
): Track[] => {
  return tracks.map((t) => {
    if (t.id !== trackId) return t;
    const isMask = isLayerMaskChannel(channel);
    const channelMap = (isMask ? (t.maskChannels ?? {}) : (t.channels ?? makeEmptyChannels())) as Record<string, PropertyKeyframe[]>;
    const keyframes = channelMap[channel] ?? [];
    const existing = keyframes.find((k) => k.frame === frame && (k.templateId || 'Sequence') === templateId);
    const newKf: PropertyKeyframe = {
      id: existing?.id ?? generateId(`pkf_${channel}`),
      frame,
      value,
      easing,
      templateId,
    };
    const updated = existing
      ? keyframes.map((k) => (
        k.id === existing.id
          ? (isMask ? { ...k, value, easing, templateId } : { ...k, value, easing })
          : k
      ))
      : [...keyframes, newKf].sort((a, b) => a.frame - b.frame);
    return isMask
      ? { ...t, maskChannels: { ...t.maskChannels, [channel]: updated } }
      : { ...t, channels: { ...channelMap, [channel]: updated } as Track['channels'] };
  });
};

/**
 * Author ONE transform keyframe group: the canonical x/y/rotation/scaleX/
 * scaleY/opacity and Trim Path channels at (frame, template).
 *
 * This is the ONE layer-level ("aggregate"/"composite") keyframe action —
 * the timeline `+`, the Outliner `+` and the Inspector's keyframe panel all
 * write through here. It migrates any legacy composite animation first (so the
 * aggregate row can never hide it), then materializes each channel from the
 * authored values, so the layer row and the expanded channel rows always show
 * the same keys.
 */
export const addTransformKeyframeGroupMutator = (
  tracks: Track[],
  trackId: string,
  frame: number,
  templateId: string,
  values: Partial<Record<TrackChannel, number>>,
  easing: EasingType,
): Track[] => {
  return tracks.map((t) => {
    if (t.id !== trackId) return t;
    const migrated = migrateLegacyKeyframesToCanonical(t);
    const channels = { ...(migrated.channels ?? makeEmptyChannels()) };
    for (const channel of [...DISPLAY_CHANNELS, ...TRIM_PATH_CHANNELS]) {
      const value = values[channel];
      if (typeof value !== 'number') continue;
      channels[channel] = upsertPropertyKeyframe(channels[channel] ?? [], channel, frame, value, easing, templateId, false);
    }
    return { ...migrated, channels: channels as Track['channels'] };
  });
};

/**
 * Insert or replace the keyframe of one channel at (frame, template). Every
 * canonical authoring path shares this rule: an existing keyframe keeps its id
 * (and, for transform channels, its scope tag) and takes the new value/easing;
 * a new keyframe is appended and the channel stays frame-sorted.
 */
const upsertPropertyKeyframe = (
  keyframes: PropertyKeyframe[],
  channel: AnimationChannel,
  frame: number,
  value: number,
  easing: EasingType,
  templateId: string,
  isMask: boolean,
): PropertyKeyframe[] => {
  const existing = keyframes.find((k) => k.frame === frame && (k.templateId || 'Sequence') === templateId);
  if (!existing) {
    return [...keyframes, {
      id: generateId(`pkf_${channel}`),
      frame,
      value,
      easing,
      templateId,
    }].sort((a, b) => a.frame - b.frame);
  }
  return keyframes.map((k) => (k.id === existing.id
    ? (isMask ? { ...k, value, easing, templateId } : { ...k, value, easing })
    : k));
};

export const addMaskPathKeyframeMutator = (
  tracks: Track[],
  trackId: string,
  channel: LayerMaskPathChannel,
  frame: number,
  value: BezierPath,
  easing: EasingType,
  templateId: string,
): Track[] => tracks.map((track) => {
  if (track.id !== trackId) return track;
  const keyframes = track.maskPathChannels?.[channel] ?? [];
  const existing = keyframes.find((keyframe) => keyframe.frame === frame && (keyframe.templateId || 'Sequence') === templateId);
  const nextKeyframe: PathKeyframe = {
    id: existing?.id ?? generateId(`pkf_${channel}`),
    frame,
    value,
    easing,
    templateId,
  };
  const updated = existing
    ? keyframes.map((keyframe) => keyframe.id === existing.id ? nextKeyframe : keyframe)
    : [...keyframes, nextKeyframe].sort((a, b) => a.frame - b.frame);
  return {
    ...track,
    maskPathChannels: { ...track.maskPathChannels, [channel]: updated },
  };
});

export const updateMaskPathKeyframeValueMutator = (
  tracks: Track[],
  trackId: string,
  channel: LayerMaskPathChannel,
  keyframeId: string,
  value: BezierPath,
): Track[] => tracks.map((track) => track.id === trackId
  ? {
    ...track,
    maskPathChannels: {
      ...track.maskPathChannels,
      [channel]: (track.maskPathChannels?.[channel] ?? []).map((keyframe) =>
        keyframe.id === keyframeId ? { ...keyframe, value } : keyframe),
    },
  }
  : track);

export const updateMaskPathKeyframeFrameMutator = (
  tracks: Track[],
  trackId: string,
  channel: LayerMaskPathChannel,
  keyframeId: string,
  newFrame: number,
): Track[] => tracks.map((track) => track.id === trackId
  ? {
    ...track,
    maskPathChannels: {
      ...track.maskPathChannels,
      [channel]: (track.maskPathChannels?.[channel] ?? [])
        .map((keyframe) => keyframe.id === keyframeId ? { ...keyframe, frame: newFrame } : keyframe)
        .sort((a, b) => a.frame - b.frame),
    },
  }
  : track);

export const deleteMaskPathKeyframeMutator = (
  tracks: Track[],
  trackId: string,
  channel: LayerMaskPathChannel,
  keyframeId: string,
): Track[] => tracks.map((track) => track.id === trackId
  ? {
    ...track,
    maskPathChannels: {
      ...track.maskPathChannels,
      [channel]: (track.maskPathChannels?.[channel] ?? []).filter((keyframe) => keyframe.id !== keyframeId),
    },
  }
  : track);
export const updatePropertyKeyframeValueMutator = (
  tracks: Track[],
  trackId: string,
  channel: AnimationChannel,
  keyframeId: string,
  value: number,
): Track[] => {
  return tracks.map((t) => {
    if (t.id !== trackId) return t;
    const isMask = isLayerMaskChannel(channel);
    const channelMap = (isMask ? (t.maskChannels ?? {}) : (t.channels ?? makeEmptyChannels())) as Record<string, PropertyKeyframe[]>;
    const updated = (channelMap[channel] ?? []).map((k) => (k.id === keyframeId ? { ...k, value } : k));
    return isMask
      ? { ...t, maskChannels: { ...t.maskChannels, [channel]: updated } }
      : { ...t, channels: { ...channelMap, [channel]: updated } as Track['channels'] };
  });
};
export const updatePropertyKeyframeTemporalHandlesMutator = (
  tracks: Track[],
  trackId: string,
  channel: AnimationChannel,
  keyframeId: string,
  patch: { bezierIn?: { x: number; y: number }; bezierOut?: { x: number; y: number } },
): Track[] => {
  return tracks.map((t) => {
    if (t.id !== trackId) return t;
    const isMask = isLayerMaskChannel(channel);
    const channelMap = (isMask ? (t.maskChannels ?? {}) : (t.channels ?? makeEmptyChannels())) as Record<string, PropertyKeyframe[]>;
    const updated = (channelMap[channel] ?? []).map((k) => k.id === keyframeId ? { ...k, ...patch } : k);
    return isMask
      ? { ...t, maskChannels: { ...t.maskChannels, [channel]: updated } }
      : { ...t, channels: { ...channelMap, [channel]: updated } as Track['channels'] };
  });
};

export const deletePropertyKeyframeMutator = (
  tracks: Track[],
  trackId: string,
  channel: AnimationChannel,
  keyframeId: string
): Track[] => {
  return tracks.map((t) => {
    if (t.id !== trackId) return t;
    const isMask = isLayerMaskChannel(channel);
    const channelMap = (isMask ? (t.maskChannels ?? {}) : (t.channels ?? makeEmptyChannels())) as Record<string, PropertyKeyframe[]>;
    const updated = (channelMap[channel] ?? []).filter((k) => k.id !== keyframeId);
    return isMask
      ? { ...t, maskChannels: { ...t.maskChannels, [channel]: updated } }
      : { ...t, channels: { ...channelMap, [channel]: updated } as Track['channels'] };
  });
};

export interface DeleteSelectedKeyframeResult {
  tracks: Track[];
  deleted: boolean;
}

// ─── Keyframe location, frame groups and the timeline set move (R3-04) ──────

/** The store inside a track a keyframe lives in. */
export type KeyframeStore = 'channels' | 'maskChannels' | 'maskPathChannels' | 'keyframes';

/** A keyframe's identity inside its track. */
export interface LocatedKeyframe {
  store: KeyframeStore;
  /** Canonical channel name; '' for the legacy composite list. */
  channel: AnimationChannel | '';
  keyframeId: string;
  frame: number;
}

/** Anything carrying the identity a timeline keyframe is selected and moved by. */
const frameOf = (keyframe: { id: string; frame: number; templateId?: string }) => keyframe.frame;

const inScope = (keyframe: { templateId?: string }, templateId: string) =>
  (keyframe.templateId || 'Sequence') === templateId;

/**
 * Where a keyframe id lives inside one track, or null. The legacy composite
 * list is searched first: it is the older id namespace, and it is the list
 * whose ids the timeline rendered before the canonical model existed.
 */
export const locateKeyframe = (track: Track, keyframeId: string, templateId: string): LocatedKeyframe | null => {
  const parse = (store: KeyframeStore, channel: AnimationChannel | '') =>
    (keyframe: { id: string; frame: number; templateId?: string }): LocatedKeyframe => ({
      store, channel, keyframeId: keyframe.id, frame: frameOf(keyframe),
    });
  const found = (keyframes: Array<{ id: string; frame: number; templateId?: string }> | undefined) =>
    (keyframes ?? []).find((keyframe) => keyframe.id === keyframeId && inScope(keyframe, templateId));

  const legacy = found(track.keyframes);
  if (legacy) return parse('keyframes', '')(legacy);
  for (const channel of ANIMATABLE_CHANNELS) {
    const match = found(track.channels?.[channel]);
    if (match) return parse('channels', channel)(match);
  }
  for (const [channel, keyframes] of Object.entries(track.maskChannels ?? {})) {
    const match = found(keyframes);
    if (match) return parse('maskChannels', channel as AnimationChannel)(match);
  }
  for (const [channel, keyframes] of Object.entries(track.maskPathChannels ?? {})) {
    const match = found(keyframes);
    if (match) return parse('maskPathChannels', channel as AnimationChannel)(match);
  }
  return null;
};

/** The store a located keyframe must be written back into (never undefined for a hit). */
const keyframesOf = (track: Track, store: KeyframeStore, channel: AnimationChannel | '') =>
  (store === 'keyframes'
    ? track.keyframes
    : store === 'channels'
      ? track.channels?.[channel as TrackChannel]
      : store === 'maskChannels'
        ? track.maskChannels?.[channel as LayerMaskChannel]
        : track.maskPathChannels?.[channel as LayerMaskPathChannel]) ?? [];

/**
 * Every keyframe at one (frame, sequence) of a track — the "frame group" the
 * layer row draws as a single diamond, across the canonical channels, the V6
 * mask channels and the legacy composite list.
 */
export const frameGroupKeyframes = (track: Track, frame: number, templateId: string): LocatedKeyframe[] => {
  const at = (store: KeyframeStore, channel: AnimationChannel | '') =>
    (keyframe: { id: string; frame: number; templateId?: string }): LocatedKeyframe => ({
      store, channel, keyframeId: keyframe.id, frame,
    });
  const matching = (keyframes: Array<{ id: string; frame: number; templateId?: string }> | undefined, store: KeyframeStore, channel: AnimationChannel | '') =>
    (keyframes ?? []).filter((keyframe) => keyframe.frame === frame && inScope(keyframe, templateId)).map(at(store, channel));

  return [
    ...matching(track.keyframes, 'keyframes', ''),
    ...ANIMATABLE_CHANNELS.flatMap((channel) => matching(track.channels?.[channel], 'channels', channel)),
    ...Object.entries(track.maskChannels ?? {}).flatMap(([channel, keyframes]) => matching(keyframes, 'maskChannels', channel as AnimationChannel)),
    ...Object.entries(track.maskPathChannels ?? {}).flatMap(([channel, keyframes]) => matching(keyframes, 'maskPathChannels', channel as AnimationChannel)),
  ];
};

/** Delete every frame group of one track at the given frames. */
export const deleteFrameGroupsMutator = (
  tracks: Track[],
  trackId: string,
  frames: number[],
  templateId: string,
): Track[] => tracks.map((track) => {
  if (track.id !== trackId) return track;
  const removed = new Set(frames.flatMap((frame) => frameGroupKeyframes(track, frame, templateId)
    .map((keyframe) => `${keyframe.store}|${keyframe.channel}|${keyframe.keyframeId}`)));
  if (removed.size === 0) return track;
  const keep = <T extends { id: string }>(store: KeyframeStore, channel: AnimationChannel | '', keyframes: T[] | undefined) =>
    keyframes === undefined ? undefined : keyframes.filter((keyframe) => !removed.has(`${store}|${channel}|${keyframe.id}`));
  const keepAll = <T extends { id: string }>(store: KeyframeStore, entries: Record<string, T[]> | undefined) =>
    entries === undefined
      ? undefined
      : Object.fromEntries(Object.entries(entries).map(([channel, keyframes]) => [channel, keep(store, channel as AnimationChannel, keyframes)])) as Record<string, T[]>;
  return {
    ...track,
    ...(track.keyframes ? { keyframes: keep('keyframes', '', track.keyframes) } : {}),
    ...(track.channels ? { channels: keepAll('channels', track.channels) as Track['channels'] } : {}),
    ...(track.maskChannels ? { maskChannels: keepAll('maskChannels', track.maskChannels) as Track['maskChannels'] } : {}),
    ...(track.maskPathChannels ? { maskPathChannels: keepAll('maskPathChannels', track.maskPathChannels) as Track['maskPathChannels'] } : {}),
  };
});

/** One keyframe the timeline moves as part of a selection drag. */
export interface KeyframeMoveTarget extends LocatedKeyframe {
  trackId: string;
}

/**
 * Resolve the timeline selection into the keyframes a drag moves.
 *
 * `expandFrameGroups` carries the unit the user grabbed: a press on the layer
 * row's diamond (the frame group's first channel keyframe) moves the whole frame
 * group, because that is the one unit the layer row draws; a press on a channel
 * diamond moves exactly the diamonds the selection holds. Every selected id
 * contributes, so a selection can span channels, stores and layers.
 */
export const resolveKeyframeMoveTargets = (
  tracks: Track[],
  selectedKeyframeIds: string[],
  templateId: string,
  expandFrameGroups: boolean,
): KeyframeMoveTarget[] => {
  const targets: KeyframeMoveTarget[] = [];
  const seen = new Set<string>();
  for (const id of selectedKeyframeIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    for (const track of tracks) {
      const located = locateKeyframe(track, id, templateId);
      if (!located) continue;
      const representative = expandFrameGroups
        ? ANIMATABLE_CHANNELS
          .map((channel) => (track.channels?.[channel] ?? []).find(
            (keyframe) => keyframe.frame === located.frame && inScope(keyframe, templateId),
          ))
          .find((keyframe) => keyframe !== undefined)
        : undefined;
      const unit = representative?.id === id ? frameGroupKeyframes(track, located.frame, templateId) : [located];
      unit.forEach((keyframe) => targets.push({ ...keyframe, trackId: track.id }));
      break;
    }
  }
  return targets;
};

export interface KeyframeMoveOutcome {
  tracks: Track[];
  /** The delta actually applied: clamped to the project range and to the first collision. */
  appliedDelta: number;
}

/**
 * Move every target keyframe by `delta` frames — the whole timeline selection,
 * as ONE set.
 *
 * Policy, deterministic and non-destructive:
 *   - the delta is clamped so that no moved keyframe leaves [0, totalFrames];
 *   - the delta is then reduced towards zero while any moved keyframe would land
 *     on a frame that already holds a keyframe of the SAME channel and sequence
 *     which is not part of the move, so a move can never silently overwrite
 *     unrelated animation — the drag stops at the last free offset;
 *   - only `frame` changes: ids, easing and bezier handles travel with the key.
 */
export const moveKeyframesMutator = (
  tracks: Track[],
  targets: KeyframeMoveTarget[],
  delta: number,
  totalFrames: number,
): KeyframeMoveOutcome => {
  const requested = Math.trunc(delta);
  if (!Number.isFinite(requested) || requested === 0 || targets.length === 0) return { tracks, appliedDelta: 0 };

  const frames = targets.map((target) => target.frame);
  const lowerBound = -Math.min(...frames);
  const upperBound = totalFrames - Math.max(...frames);
  let step = Math.max(lowerBound, Math.min(upperBound, requested));

  const byId = new Map(tracks.map((track) => [track.id, track]));
  const movingKeys = new Set(targets.map((target) => `${target.trackId}|${target.store}|${target.channel}|${target.keyframeId}`));
  const collides = (candidate: number) => step !== 0 && targets.some((target) => {
    const track = byId.get(target.trackId);
    if (!track) return false;
    return keyframesOf(track, target.store, target.channel).some((keyframe) => (
      keyframe.frame === target.frame + candidate
      && !movingKeys.has(`${target.trackId}|${target.store}|${target.channel}|${keyframe.id}`)
    ));
  });
  while (step !== 0 && collides(step)) step -= Math.sign(step);
  if (step === 0) return { tracks, appliedDelta: 0 };

  const next = tracks.map((track) => {
    const moved = targets.filter((target) => target.trackId === track.id);
    if (moved.length === 0) return track;
    const movedKeys = new Set(moved.map((target) => `${target.store}|${target.channel}|${target.keyframeId}`));
    const shift = <T extends { id: string; frame: number }>(store: KeyframeStore, channel: AnimationChannel | '', keyframes: T[] | undefined) => {
      if (keyframes === undefined) return undefined;
      if (!keyframes.some((keyframe) => movedKeys.has(`${store}|${channel}|${keyframe.id}`))) return keyframes;
      return keyframes
        .map((keyframe) => (movedKeys.has(`${store}|${channel}|${keyframe.id}`) ? { ...keyframe, frame: keyframe.frame + step } : keyframe))
        .sort((a, b) => a.frame - b.frame);
    };
    const shiftAll = <T extends { id: string; frame: number }>(store: KeyframeStore, entries: Record<string, T[]> | undefined) =>
      entries === undefined
        ? undefined
        : Object.fromEntries(Object.entries(entries).map(([channel, keyframes]) => [channel, shift(store, channel as AnimationChannel, keyframes)])) as Record<string, T[]>;
    return {
      ...track,
      ...(track.keyframes ? { keyframes: shift('keyframes', '', track.keyframes) } : {}),
      ...(track.channels ? { channels: shiftAll('channels', track.channels) as Track['channels'] } : {}),
      ...(track.maskChannels ? { maskChannels: shiftAll('maskChannels', track.maskChannels) as Track['maskChannels'] } : {}),
      ...(track.maskPathChannels ? { maskPathChannels: shiftAll('maskPathChannels', track.maskPathChannels) as Track['maskPathChannels'] } : {}),
    };
  });
  return { tracks: next, appliedDelta: step };
};

/**
 * Delete the logical keyframe selection used by the timeline: the whole frame
 * group of whichever track holds the selected keyframe (canonical channels,
 * mask channels and the legacy composite list alike).
 */
export const deleteSelectedKeyframeGroupMutator = (
  tracks: Track[],
  selectedKeyframeId: string,
  activeTemplateId: string,
): DeleteSelectedKeyframeResult => {
  for (const track of tracks) {
    const located = locateKeyframe(track, selectedKeyframeId, activeTemplateId);
    if (!located) continue;
    return {
      deleted: true,
      tracks: deleteFrameGroupsMutator(tracks, track.id, [located.frame], activeTemplateId),
    };
  }

  return { tracks, deleted: false };
};

export const updatePropertyKeyframeFrameMutator = (
  tracks: Track[],
  trackId: string,
  channel: AnimationChannel,
  keyframeId: string,
  newFrame: number
): Track[] => {
  return tracks.map((t) => {
    if (t.id !== trackId) return t;
    const isMask = isLayerMaskChannel(channel);
    const channelMap = (isMask ? (t.maskChannels ?? {}) : (t.channels ?? makeEmptyChannels())) as Record<string, PropertyKeyframe[]>;
    const updated = (channelMap[channel] ?? [])
      .map((k) => (k.id === keyframeId ? { ...k, frame: newFrame } : k))
      .sort((a, b) => a.frame - b.frame);
    return isMask
      ? { ...t, maskChannels: { ...t.maskChannels, [channel]: updated } }
      : { ...t, channels: { ...channelMap, [channel]: updated } as Track['channels'] };
  });
};

// M1: change the easing of a single channel keyframe. Only the target
// channel's matching keyframe is touched — other channels/keyframes stay.
export const updatePropertyKeyframeEasingMutator = (
  tracks: Track[],
  trackId: string,
  channel: AnimationChannel,
  keyframeId: string,
  easing: EasingType
): Track[] => {
  return tracks.map((t) => {
    if (t.id !== trackId) return t;
    const isMask = isLayerMaskChannel(channel);
    const channelMap = (isMask ? (t.maskChannels ?? {}) : (t.channels ?? makeEmptyChannels())) as Record<string, PropertyKeyframe[]>;
    const updated = (channelMap[channel] ?? []).map((k) => (k.id === keyframeId ? { ...k, easing } : k));
    return isMask
      ? { ...t, maskChannels: { ...t.maskChannels, [channel]: updated } }
      : { ...t, channels: { ...channelMap, [channel]: updated } as Track['channels'] };
  });
};

// M8a: apply a motion transition to the canonical 6 channels.
// Semantics mirror the legacy applyMotionTransition exactly:
//   - transition == null  → 'none': clear ALL channel keyframes of the active
//     template (legacy clears every keyframes[] entry; here it is scoped to the
//     active template so other templates are untouched).
//   - otherwise → keyframes inside [startFrame, endFrame] of the active
//     template are removed; a start keyframe (transition easing) and an end
//     keyframe (linear) are written to each of the 6 channels.
export const applyTransitionChannelsMutator = (
  tracks: Track[],
  trackId: string,
  transition: TransitionChannelResult | null,
  activeTemplateId: string
): Track[] => {
  return tracks.map((t) => {
    if (t.id !== trackId) return t;

    const channels = { ...t.channels };

    if (!transition) {
      // 'none' — clear the active template's channel keyframes
      for (const ch of TRACK_CHANNELS) {
        channels[ch] = (channels[ch] || []).filter(
          (k) => (k.templateId || 'Sequence') !== activeTemplateId
        );
      }
      return { ...t, channels };
    }

    for (const ch of DISPLAY_CHANNELS) {
      // Remove active-template keyframes inside the transition window
      let list = (channels[ch] || []).filter(
        (k) =>
          (k.templateId || 'Sequence') !== activeTemplateId ||
          k.frame < transition.startFrame ||
          k.frame > transition.endFrame
      );
      // Start (transition easing) + end (linear) keyframes
      const startKf: PropertyKeyframe = {
        id: generateId(`pkf_${ch}`),
        frame: transition.startFrame,
        value: transition.start[ch],
        easing: transition.easing,
        templateId: activeTemplateId,
      };
      const endKf: PropertyKeyframe = {
        id: generateId(`pkf_${ch}`),
        frame: transition.endFrame,
        value: transition.end[ch],
        easing: 'linear',
        templateId: activeTemplateId,
      };
      list = [...list, startKf, endKf].sort((a, b) => a.frame - b.frame);
      channels[ch] = list;
    }

    return { ...t, channels };
  });
};

// M8e-prep A: canonical transition for legacy-only tracks (empty channels but
// populated keyframes[]). Existing legacy keyframes are converted into the
// canonical channels first (so the old animation survives), then the
// transition is applied on channels. The legacy keyframes[] array is left
// untouched for import compatibility.
export const applyTransitionToTrackCanonicalMutator = (
  tracks: Track[],
  trackId: string,
  transition: TransitionChannelResult | null,
  activeTemplateId: string
): Track[] => {
  return tracks.map((t) => {
    if (t.id !== trackId) return t;

    const converted = convertLegacyKeyframesToChannels(t.keyframes || []);
    const channels = { ...t.channels };
    for (const ch of TRACK_CHANNELS) {
      channels[ch] = [...(channels[ch] || []), ...converted[ch]].sort((a, b) => a.frame - b.frame);
    }

    return applyTransitionChannelsMutator([{ ...t, channels }], trackId, transition, activeTemplateId)[0];
  });
};
