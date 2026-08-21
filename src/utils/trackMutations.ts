import type { Track, TrackChannel, EasingType, PropertyKeyframe } from '../types/animator';
import { TRACK_CHANNELS } from '../types/animator';
import { generateId } from './idGenerator';
import { makeEmptyChannels } from './defaults';
import { ANIMATABLE_CHANNELS, DISPLAY_CHANNELS } from './channelKeyframeGroups';
import type { TransitionChannelResult } from './motionTransitions';
import { convertLegacyKeyframesToChannels } from './legacyKeyframeConversion';

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
  channel: TrackChannel,
  frame: number,
  value: number,
  easing: EasingType,
  templateId: string
): Track[] => {
  return tracks.map((t) => {
    if (t.id !== trackId) return t;
    const ch = t.channels ?? makeEmptyChannels();
    const existing = ch[channel].find((k) => k.frame === frame);
    const newKf: PropertyKeyframe = {
      id: generateId(`pkf_${channel}`),
      frame,
      value,
      easing,
      templateId,
    };
    const updated = existing
      ? ch[channel].map((k) => (k.frame === frame ? { ...k, value, easing } : k))
      : [...ch[channel], newKf].sort((a, b) => a.frame - b.frame);
    return { ...t, channels: { ...ch, [channel]: updated } };
  });
};

export const deletePropertyKeyframeMutator = (
  tracks: Track[],
  trackId: string,
  channel: TrackChannel,
  keyframeId: string
): Track[] => {
  return tracks.map((t) => {
    if (t.id !== trackId) return t;
    const ch = t.channels ?? makeEmptyChannels();
    return { ...t, channels: { ...ch, [channel]: ch[channel].filter((k) => k.id !== keyframeId) } };
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

    const selectedPropertyKeyframe = ANIMATABLE_CHANNELS
      .flatMap((channel) => track.channels?.[channel] || [])
      .find((keyframe) => keyframe.id === selectedKeyframeId
        && (keyframe.templateId || 'Sequence') === activeTemplateId);
    if (!selectedPropertyKeyframe) continue;

    const channels = { ...track.channels };
    for (const channel of ANIMATABLE_CHANNELS) {
      channels[channel] = (channels[channel] || []).filter(
        (keyframe) => keyframe.frame !== selectedPropertyKeyframe.frame
          || (keyframe.templateId || 'Sequence') !== activeTemplateId,
      );
    }

    return {
      deleted: true,
      tracks: tracks.map((candidate) => candidate.id === track.id ? { ...candidate, channels } : candidate),
    };
  }

  return { tracks, deleted: false };
};

export const updatePropertyKeyframeFrameMutator = (
  tracks: Track[],
  trackId: string,
  channel: TrackChannel,
  keyframeId: string,
  newFrame: number
): Track[] => {
  return tracks.map((t) => {
    if (t.id !== trackId) return t;
    const ch = t.channels ?? makeEmptyChannels();
    const updated = ch[channel].map((k) => (k.id === keyframeId ? { ...k, frame: newFrame } : k)).sort((a, b) => a.frame - b.frame);
    return { ...t, channels: { ...ch, [channel]: updated } };
  });
};

// M1: change the easing of a single channel keyframe. Only the target
// channel's matching keyframe is touched — other channels/keyframes stay.
export const updatePropertyKeyframeEasingMutator = (
  tracks: Track[],
  trackId: string,
  channel: TrackChannel,
  keyframeId: string,
  easing: EasingType
): Track[] => {
  return tracks.map((t) => {
    if (t.id !== trackId) return t;
    const ch = t.channels ?? makeEmptyChannels();
    const updated = ch[channel].map((k) => (k.id === keyframeId ? { ...k, easing } : k));
    return { ...t, channels: { ...ch, [channel]: updated } };
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
