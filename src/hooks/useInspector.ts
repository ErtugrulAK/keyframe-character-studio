import type { CharacterPart, Track, Transform, TrackChannel, PropertyKeyframe } from '../types/animator';
import { generateId } from '../utils/idGenerator';

interface UseInspectorOptions {
  selectedPartId: string | null;
  selectedPartIds: string[];
  activeTemplateId: string;
  currentFrame: number;
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  getComputedTransform: (partId: string, frame: number) => Transform;
  addKeyframeToTrack: (trackId: string, frame: number) => void;
}

// Transform fields → canonical channel names (6 animated properties)
const TRANSFORM_TO_CHANNEL: [keyof Transform, TrackChannel][] = [
  ['x', 'x'],
  ['y', 'y'],
  ['rotation', 'rotation'],
  ['scaleX', 'scaleX'],
  ['scaleY', 'scaleY'],
  ['opacity', 'opacity'],
];

export const useInspector = ({
  selectedPartId,
  selectedPartIds,
  activeTemplateId,
  currentFrame,
  tracks,
  setTracks,
  setCharacterParts,
  getComputedTransform,
  addKeyframeToTrack,
}: UseInspectorOptions) => {
  const applyTransformToPart = (id: string, newTransform: Partial<Transform>, activeTmpl: string) => {
    const track = tracks.find((t) => t.partId === id);
    if (!track) return;

    // M4: channel-aware path — if this track carries canonical channel data
    // for the active template, Inspector edits write to channels.
    const hasChannelData = !!(track.channels && (Object.values(track.channels) as PropertyKeyframe[][])
      .some((arr) => arr.some((k) => (k.templateId || 'Sequence') === activeTmpl)));

    if (hasChannelData) {
      applyTransformToChannels(id, track, newTransform, activeTmpl);
      return;
    }

    const activeKfs = (track.keyframes || []).filter((k) => (k.templateId || 'Sequence') === activeTmpl);
    const hasActiveKfOnFrame = activeKfs.some((k) => k.frame === currentFrame);

    if (hasActiveKfOnFrame) {
      setTracks((prev) =>
        prev.map((tr) => {
          if (tr.id !== track.id) return tr;
          return {
            ...tr,
            keyframes: (tr.keyframes || []).map((k) =>
              k.frame === currentFrame && (k.templateId || 'Sequence') === activeTmpl
                ? { ...k, transform: { ...k.transform, ...newTransform } }
                : k
            ),
          };
        })
      );
    } else if (activeKfs.length > 0) {
      setCharacterParts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, baseTransform: { ...p.baseTransform, ...newTransform } } : p
        )
      );
      addKeyframeToTrack(track.id, currentFrame);
    } else {
      setCharacterParts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, baseTransform: { ...p.baseTransform, ...newTransform } } : p
        )
      );
    }
  };

  /**
   * M4: write Inspector transform edits into canonical channels.
   * - Channel has keyframes for this template → update value at current frame
   *   (or add a new keyframe there if the frame is empty), keeping easing/bezier.
   * - Channel is completely empty for this template → fall back to baseTransform
   *   (same defensive behavior as legacy no-keyframe path).
   */
  const applyTransformToChannels = (
    id: string,
    track: Track,
    newTransform: Partial<Transform>,
    activeTmpl: string,
  ) => {
    const channelUpdates: { channel: TrackChannel; value: number }[] = [];
    const baseUpdates: Record<string, number> = {};

    for (const [prop, channel] of TRANSFORM_TO_CHANNEL) {
      const newVal = newTransform[prop];
      if (typeof newVal !== 'number') continue; // skip undefined + non-numeric (e.g. mask)
      const tmplKfs = (track.channels?.[channel] || []).filter((k) => (k.templateId || 'Sequence') === activeTmpl);
      if (tmplKfs.length === 0) {
        baseUpdates[prop] = newVal;
      } else {
        channelUpdates.push({ channel, value: newVal });
      }
    }

    if (channelUpdates.length > 0) {
      setTracks((prev) =>
        prev.map((tr) => {
          if (tr.id !== track.id) return tr;
          const channels = { ...tr.channels };
          for (const u of channelUpdates) {
            const list = [...(channels[u.channel] || [])];
            const frameKf = list.find((k) => k.frame === currentFrame && (k.templateId || 'Sequence') === activeTmpl);
            if (frameKf) {
              // update value only — easing/bezier/templateId preserved
              channels[u.channel] = list.map((k) => (k.id === frameKf.id ? { ...k, value: u.value } : k));
            } else {
              // add a new keyframe at current frame, reusing the template's easing
              const templateEasing = list.find((k) => (k.templateId || 'Sequence') === activeTmpl)?.easing || 'easeInOut';
              channels[u.channel] = [
                ...list,
                {
                  id: generateId(`pkf_${u.channel}`),
                  frame: currentFrame,
                  value: u.value,
                  easing: templateEasing,
                  templateId: activeTmpl,
                },
              ].sort((a, b) => a.frame - b.frame);
            }
          }
          return { ...tr, channels };
        })
      );
    }

    if (Object.keys(baseUpdates).length > 0) {
      setCharacterParts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, baseTransform: { ...p.baseTransform, ...baseUpdates } } : p
        )
      );
    }
  };

  const updateCurrentTransform = (newTransform: Partial<Transform>, partIdOverride?: string) => {
    const targetPartId = partIdOverride || selectedPartId;
    if (!targetPartId) return;

    const partsToUpdate = (!partIdOverride && selectedPartIds.length > 1)
      ? selectedPartIds
      : [targetPartId];

    const activeTmpl = activeTemplateId || 'Sequence';

    // If updating multiple parts via inspector delta
    if (!partIdOverride && selectedPartIds.length > 1) {
      const primaryPartT = getComputedTransform(targetPartId, currentFrame);
      
      const deltaX = newTransform.x !== undefined ? newTransform.x - primaryPartT.x : 0;
      const deltaY = newTransform.y !== undefined ? newTransform.y - primaryPartT.y : 0;
      const deltaRot = newTransform.rotation !== undefined ? newTransform.rotation - primaryPartT.rotation : 0;
      const deltaScaleX = newTransform.scaleX !== undefined ? newTransform.scaleX - primaryPartT.scaleX : 0;
      const deltaScaleY = newTransform.scaleY !== undefined ? newTransform.scaleY - primaryPartT.scaleY : 0;
      const deltaOpacity = newTransform.opacity !== undefined ? newTransform.opacity - primaryPartT.opacity : 0;

      partsToUpdate.forEach(id => {
        const t = getComputedTransform(id, currentFrame);
        const relativeUpdate: Partial<Transform> = {};
        if (newTransform.x !== undefined) relativeUpdate.x = t.x + deltaX;
        if (newTransform.y !== undefined) relativeUpdate.y = t.y + deltaY;
        if (newTransform.rotation !== undefined) relativeUpdate.rotation = t.rotation + deltaRot;
        if (newTransform.scaleX !== undefined) relativeUpdate.scaleX = t.scaleX + deltaScaleX;
        if (newTransform.scaleY !== undefined) relativeUpdate.scaleY = t.scaleY + deltaScaleY;
        if (newTransform.opacity !== undefined) relativeUpdate.opacity = t.opacity + deltaOpacity;
        
        applyTransformToPart(id, relativeUpdate, activeTmpl);
      });
      return;
    }

    applyTransformToPart(targetPartId, newTransform, activeTmpl);
  };

  const updateCurrentPropertyChannel = (channel: TrackChannel, value: number, partIdOverride?: string) => {
    const targetPartId = partIdOverride || selectedPartId;
    if (!targetPartId) return;
    const track = tracks.find((candidate) => candidate.partId === targetPartId);
    if (!track) return;
    const activeTmpl = activeTemplateId || 'Sequence';
    const channelKeyframes = (track.channels?.[channel] || []).filter((kf) => (kf.templateId || 'Sequence') === activeTmpl);

    if (channelKeyframes.length > 0) {
      setTracks((prev) => prev.map((candidate) => {
        if (candidate.id !== track.id) return candidate;
        const channels = { ...candidate.channels };
        const list = [...(channels[channel] || [])];
        const atFrame = list.find((kf) => kf.frame === currentFrame && (kf.templateId || 'Sequence') === activeTmpl);
        if (atFrame) {
          channels[channel] = list.map((kf) => kf.id === atFrame.id ? { ...kf, value } : kf);
        } else {
          const templateEasing = channelKeyframes[0]?.easing || 'easeInOut';
          channels[channel] = [...list, {
            id: generateId(`pkf_${channel}`), frame: currentFrame, value,
            easing: templateEasing, templateId: activeTmpl,
          }].sort((a, b) => a.frame - b.frame);
        }
        return { ...candidate, channels };
      }));
      return;
    }

    const partField = channel === 'trimPathStart'
      ? 'trimPathStart'
      : channel === 'trimPathEnd'
        ? 'trimPathEnd'
        : channel === 'trimPathOffset'
          ? 'trimPathOffset'
          : null;
    if (partField) {
      setCharacterParts((prev) => prev.map((part) => part.id === targetPartId ? { ...part, [partField]: value } : part));
    }
  };

  const updatePartMedia = (partId: string, url: string, type: 'image' | 'video') => {
    setCharacterParts((prev) =>
      prev.map((p) => (p.id === partId ? { ...p, innerMediaUrl: url, innerMediaType: type } : p))
    );
  };

  return {
    updateCurrentTransform,
    updateCurrentPropertyChannel,
    updatePartMedia,
  };
};
