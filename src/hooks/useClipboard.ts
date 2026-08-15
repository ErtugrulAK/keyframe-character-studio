import { useState, useCallback } from 'react';
import type { CharacterPart, Track, TrackChannel } from '../types/animator';
import { generateId } from '../utils/idGenerator';
import { makeEmptyChannels } from '../utils/defaults';
import { mirrorChannelValue, mirrorTransform, type MirrorAxis } from '../utils/mirror';
import { cloneAnimationOntoTarget } from '../utils/animationTransfer';

interface UseClipboardOptions {
  characterParts: CharacterPart[];
  tracks: Track[];
  selectedPartId: string | null;
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  setSelectedPartId: (id: string | null) => void;
}

export const useClipboard = ({
  characterParts,
  tracks,
  selectedPartId,
  showToast,
  setTracks,
  setCharacterParts,
  setSelectedPartId,
}: UseClipboardOptions) => {
  const [clipboardData, setClipboardData] = useState<{ part: CharacterPart; track?: Track } | null>(null);

  const copySelectedPart = useCallback(() => {
    if (!selectedPartId) return;
    const part = characterParts.find((p) => p.id === selectedPartId);
    if (!part) return;
    const track = tracks.find((t) => t.partId === selectedPartId);
    setClipboardData({
      part: structuredClone(part),
      track: track ? structuredClone(track) : undefined,
    });
    showToast(`Copied "${part.name}" to clipboard`, 'info');
  }, [selectedPartId, characterParts, tracks, showToast]);

  const pasteCopiedPart = useCallback(() => {
    if (!clipboardData) {
      showToast('Clipboard is empty', 'error');
      return;
    }
    const newPartId = generateId('part');
    const newPart: CharacterPart = {
      ...structuredClone(clipboardData.part),
      id: newPartId,
      name: `${clipboardData.part.name} Copy`,
      zIndex: characterParts.length + 1,
      baseTransform: {
        ...clipboardData.part.baseTransform,
        x: clipboardData.part.baseTransform.x + 20,
        y: clipboardData.part.baseTransform.y + 20,
      },
    };

    let newTrack: Track = {
      id: generateId('track'),
      partId: newPartId,
      name: newPart.name,
      color: '#3b82f6',
      keyframes: [],
      channels: makeEmptyChannels(),
      visible: true,
      locked: false,
      expanded: false,
    };

    if (clipboardData.track) {
      const clonedTrack: Track = structuredClone(clipboardData.track);
      const newChannels = makeEmptyChannels();
      if (clonedTrack.channels) {
        (Object.keys(clonedTrack.channels) as TrackChannel[]).forEach((ch) => {
          if (clonedTrack.channels[ch]) {
            newChannels[ch] = clonedTrack.channels[ch].map((pk) => ({ ...pk, id: generateId(`pkf_${ch}`) }));
          }
        });
      }
      newTrack = {
        ...clonedTrack,
        id: generateId('track'),
        partId: newPartId,
        name: newPart.name,
        keyframes: (clonedTrack.keyframes || []).map((k) => ({
          ...k,
          id: generateId('kf'),
        })),
        channels: newChannels,
      };
    }

    setTracks((prevTracks) => [newTrack, ...prevTracks]);
    setCharacterParts((prevParts) => [newPart, ...prevParts]);
    setSelectedPartId(newPartId);
    showToast(`Pasted "${newPart.name}"`, 'success');
  }, [clipboardData, characterParts, setTracks, setCharacterParts, setSelectedPartId, showToast]);

  const duplicateSelectedPart = useCallback(() => {
    if (!selectedPartId) return;
    const part = characterParts.find((p) => p.id === selectedPartId);
    if (!part) return;
    const track = tracks.find((t) => t.partId === selectedPartId);

    const newPartId = generateId('part');
    const newPart: CharacterPart = {
      ...structuredClone(part),
      id: newPartId,
      name: `${part.name} Copy`,
      zIndex: characterParts.length + 1,
      baseTransform: {
        ...part.baseTransform,
        x: part.baseTransform.x + 20,
        y: part.baseTransform.y + 20,
      },
    };

    let newTrack: Track = {
      id: generateId('track'),
      partId: newPartId,
      name: newPart.name,
      color: track?.color || '#3b82f6',
      keyframes: [],
      channels: makeEmptyChannels(),
      visible: true,
      locked: false,
      expanded: false,
    };

    if (track) {
      const clonedTrack: Track = structuredClone(track);
      const newChannels = makeEmptyChannels();
      if (clonedTrack.channels) {
        (Object.keys(clonedTrack.channels) as TrackChannel[]).forEach((ch) => {
          if (clonedTrack.channels[ch]) {
            newChannels[ch] = clonedTrack.channels[ch].map((pk) => ({ ...pk, id: generateId(`pkf_${ch}`) }));
          }
        });
      }
      newTrack = {
        ...clonedTrack,
        id: generateId('track'),
        partId: newPartId,
        name: newPart.name,
        keyframes: (clonedTrack.keyframes || []).map((k) => ({
          ...k,
          id: generateId('kf'),
        })),
        channels: newChannels,
      };
    }

    setTracks((prevTracks) => [newTrack, ...prevTracks]);
    setCharacterParts((prevParts) => [newPart, ...prevParts]);
    setSelectedPartId(newPartId);
    showToast(`Duplicated "${newPart.name}"`, 'success');
  }, [selectedPartId, characterParts, tracks, setTracks, setCharacterParts, setSelectedPartId, showToast]);

  /**
   * Duplicate the selected part as a MIRROR copy: across the Y axis
   * (horizontal flip), the X axis (vertical flip), or the origin (180°
   * point reflection). Position, rotation, scale and all keyframe/channel
   * values are mirrored so animated copies stay correct.
   */
  const duplicateMirrored = useCallback(
    (axis: MirrorAxis) => {
      if (!selectedPartId) return;
      const part = characterParts.find((p) => p.id === selectedPartId);
      if (!part) return;
      const track = tracks.find((t) => t.partId === selectedPartId);

      const mirrorName = axis === 'y' ? 'Mirror Y' : axis === 'x' ? 'Mirror X' : 'Mirror Origin';
      const newPartId = generateId('part');
      const newPart: CharacterPart = {
        ...structuredClone(part),
        id: newPartId,
        name: `${part.name} ${mirrorName}`,
        zIndex: characterParts.length + 1,
        baseTransform: mirrorTransform(part.baseTransform, axis),
      };

      let newTrack: Track = {
        id: generateId('track'),
        partId: newPartId,
        name: newPart.name,
        color: track?.color || '#3b82f6',
        keyframes: [],
        channels: makeEmptyChannels(),
        visible: true,
        locked: false,
        expanded: false,
      };

      if (track) {
        const clonedTrack: Track = structuredClone(track);
        const newChannels = makeEmptyChannels();
        if (clonedTrack.channels) {
          (Object.keys(clonedTrack.channels) as TrackChannel[]).forEach((ch) => {
            if (clonedTrack.channels[ch]) {
              newChannels[ch] = clonedTrack.channels[ch].map((pk) => {
                const value = mirrorChannelValue(ch, pk.value, axis);
                let bezierControlPoints = pk.bezierControlPoints ? ([...pk.bezierControlPoints] as [number, number, number, number]) : undefined;
                // Mirror the curve handles (y1/y2) too so the easing shape is preserved
                if (bezierControlPoints && value !== pk.value) {
                  bezierControlPoints[1] = -bezierControlPoints[1];
                  bezierControlPoints[3] = -bezierControlPoints[3];
                }
                return {
                  ...pk,
                  id: generateId(`pkf_${ch}`),
                  value,
                  ...(bezierControlPoints ? { bezierControlPoints } : {}),
                };
              });
            }
          });
        }
        newTrack = {
          ...clonedTrack,
          id: generateId('track'),
          partId: newPartId,
          name: newPart.name,
          keyframes: (clonedTrack.keyframes || []).map((k) => ({
            ...k,
            id: generateId('kf'),
            transform: mirrorTransform(k.transform, axis),
          })),
          channels: newChannels,
        };
      }

      setTracks((prevTracks) => [newTrack, ...prevTracks]);
      setCharacterParts((prevParts) => [newPart, ...prevParts]);
      setSelectedPartId(newPartId);
      showToast(`Created "${newPart.name}"`, 'success');
    },
    [selectedPartId, characterParts, tracks, setTracks, setCharacterParts, setSelectedPartId, showToast]
  );

  /**
   * M26 — paste the copied ANIMATION onto an EXISTING selected part.
   * The target part is NOT replaced: only animation data is transferred
   * (Track.channels + legacy keyframes + IN/OUT presets + durations). The
   * target keeps its id/name/transform/matte/parent/geometry/media and its
   * track keeps its id + visible/locked metadata. Fresh keyframe ids are
   * generated; custom preset IDs are referenced, never duplicated.
   *
   * setTracks + setCharacterParts are the two halves of ONE logical
   * transaction — the UI layer (26B) wraps both in a single history entry.
   */
  const pasteAnimationOntoSelected = useCallback(
    (targetPartId: string) => {
      if (!clipboardData) {
        showToast('Clipboard is empty', 'error');
        return;
      }
      const targetPart = characterParts.find((p) => p.id === targetPartId);
      if (!targetPart) {
        showToast('Target part not found', 'error');
        return;
      }
      const targetTrack = tracks.find((t) => t.partId === targetPartId);
      const result = cloneAnimationOntoTarget(
        clipboardData.track,
        clipboardData.part,
        targetPartId,
        targetTrack,
      );

      setTracks((prevTracks) => {
        const exists = prevTracks.some((t) => t.id === result.track.id);
        return exists
          ? prevTracks.map((t) => (t.id === result.track.id ? result.track : t))
          : [result.track, ...prevTracks];
      });
      setCharacterParts((prevParts) =>
        prevParts.map((p) => (p.id === targetPartId ? { ...p, ...result.animationFields } : p)),
      );
      showToast(`Pasted animation onto "${targetPart.name}"`, 'success');
    },
    [clipboardData, characterParts, tracks, setTracks, setCharacterParts, showToast]
  );

  return { clipboardData, copySelectedPart, pasteCopiedPart, duplicateSelectedPart, duplicateMirrored, pasteAnimationOntoSelected };
};
