import type { Track, TrackChannel, AnimationChannel, LayerMaskChannel, LayerMaskPathChannel, EasingType, PropertyKeyframe, PathKeyframe, BezierPath } from '../types/animator';
import { TRACK_CHANNELS } from '../types/animator';
import { generateId } from './idGenerator';
import { ANIMATABLE_CHANNELS, DISPLAY_CHANNELS } from './channelKeyframeGroups';
import type { TransitionChannelResult } from './motionTransitions';
import { convertLegacyKeyframesToChannels } from './legacyKeyframeConversion';
import { makeEmptyChannels } from './defaults';

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

    return {
      ...tr,
      keyframes: updatedKfs,
      channels: updatedChannels,
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
    const existing = keyframes.find((k) => k.frame === frame && (!isMask || (k.templateId || 'Sequence') === templateId));
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

/**
 * Delete the logical keyframe selection used by the timeline. Canonical
 * selections represent every display-channel keyframe at the selected frame;
 * legacy selections represent one composite keyframe.
 */
export const deleteSelectedKeyframeGroupMutator = (
  tracks: Track[],
  selectedKeyframeId: string,
  activeTemplateId: string,
): DeleteSelectedKeyframeResult => {
  for (const track of tracks) {
    const legacyMatch = (track.keyframes || []).find(
      (keyframe) => keyframe.id === selectedKeyframeId
        && (keyframe.templateId || 'Sequence') === activeTemplateId,
    );
    if (legacyMatch) {
      return {
        deleted: true,
        tracks: tracks.map((candidate) => candidate.id === track.id
          ? { ...candidate, keyframes: (candidate.keyframes || []).filter((keyframe) => keyframe.id !== selectedKeyframeId) }
          : candidate),
      };
    }

    const selectedPropertyEntry = [
      ...ANIMATABLE_CHANNELS.flatMap((channel) => (track.channels?.[channel] || []).map((keyframe) => ({ keyframe, channel }))),
      ...Object.entries(track.maskChannels ?? {}).flatMap(([channel, keyframes]) => keyframes.map((keyframe) => ({ keyframe, channel }))),
    ].find(({ keyframe }) => keyframe.id === selectedKeyframeId
      && (keyframe.templateId || 'Sequence') === activeTemplateId);
    const selectedPathEntry = Object.entries(track.maskPathChannels ?? {})
      .flatMap(([channel, keyframes]) => keyframes.map((keyframe) => ({ channel, keyframe })))
      .find(({ keyframe }) => keyframe.id === selectedKeyframeId
        && (keyframe.templateId || 'Sequence') === activeTemplateId);
    const selectedFrame = selectedPropertyEntry?.keyframe.frame ?? selectedPathEntry?.keyframe.frame;
    if (selectedFrame === undefined) continue;

    const channels = Object.fromEntries(Object.entries(track.channels ?? {}).map(([channel, keyframes]) => [
      channel,
      keyframes.filter((keyframe) => keyframe.frame !== selectedFrame
        || (keyframe.templateId || 'Sequence') !== activeTemplateId),
    ]));
    const maskChannels = Object.fromEntries(Object.entries(track.maskChannels ?? {}).map(([channel, keyframes]) => [
      channel,
      keyframes.filter((keyframe) => keyframe.frame !== selectedFrame
        || (keyframe.templateId || 'Sequence') !== activeTemplateId),
    ]));
    const maskPathChannels = Object.fromEntries(Object.entries(track.maskPathChannels ?? {}).map(([channel, keyframes]) => [
      channel,
      keyframes.filter((keyframe) => keyframe.frame !== selectedFrame
        || (keyframe.templateId || 'Sequence') !== activeTemplateId),
    ]));

    return {
      deleted: true,
      tracks: tracks.map((candidate) => candidate.id === track.id
        ? { ...candidate, channels, maskChannels, maskPathChannels }
        : candidate),
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
