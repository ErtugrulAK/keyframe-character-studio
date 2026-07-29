import type { Track, TrackChannel, EasingType, PropertyKeyframe } from '../types/animator';
import type { generateId } from './idGenerator';
import type { makeEmptyChannels } from './defaults';

export const updateKeyframeBezierPointsMutator = (
  tracks: Track[],
  trackId: string,
  keyframeId: string,
  points: [number, number, number, number]
): Track[] => {
  return tracks.map((tr) => {
    if (tr.id !== trackId) return tr;

    const updatedKfs = tr.keyframes.map((k) =>
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
