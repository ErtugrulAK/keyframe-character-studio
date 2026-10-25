import { useState, useCallback } from 'react';
import type { CharacterPart, Track, TrackChannel } from '../types/animator';
import { generateId } from '../utils/idGenerator';
import { makeEmptyChannels } from '../utils/defaults';
import { mirrorChannelValue, mirrorTransform, type MirrorAxis } from '../utils/mirror';
import { cloneAnimationOntoTarget } from '../utils/animationTransfer';
import { getGroupDescendants } from '../utils/layerGrouping';

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
  }, [selectedPartId, characterParts, tracks]);

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
      // A copy is not bonded to the original's partners.
      boundPartIds: undefined,
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
  }, [clipboardData, characterParts, setTracks, setCharacterParts, setSelectedPartId, showToast]);

  const duplicateSelectedPart = useCallback(() => {
    if (!selectedPartId) return;
    const part = characterParts.find((p) => p.id === selectedPartId);
    if (!part) return;

    // A layer group is a container: duplicating it copies the whole group with
    // fresh ids so the copy is not an empty shell, and every clone re-parents to
    // the cloned container. Duplicating one layer of a group instead leaves the
    // copy in that same group, which is what re-parenting by id already does.
    const sources = part.isGroup ? [part, ...getGroupDescendants(characterParts, part.id)] : [part];
    const newPartId = generateId('part');
    const idMap = new Map<string, string>();
    sources.forEach((source) => idMap.set(source.id, source.id === part.id ? newPartId : generateId('part')));

    const cloneTrackFor = (sourceId: string, cloneId: string, name: string): Track => {
      const source = tracks.find((t) => t.partId === sourceId);
      if (!source) {
        return {
          id: generateId('track'),
          partId: cloneId,
          name,
          color: '#3b82f6',
          keyframes: [],
          channels: makeEmptyChannels(),
          visible: true,
          locked: false,
          expanded: false,
        };
      }
      const clonedTrack: Track = structuredClone(source);
      const newChannels = makeEmptyChannels();
      if (clonedTrack.channels) {
        (Object.keys(clonedTrack.channels) as TrackChannel[]).forEach((ch) => {
          if (clonedTrack.channels[ch]) {
            newChannels[ch] = clonedTrack.channels[ch].map((pk) => ({ ...pk, id: generateId(`pkf_${ch}`) }));
          }
        });
      }
      return {
        ...clonedTrack,
        id: generateId('track'),
        partId: cloneId,
        name,
        keyframes: (clonedTrack.keyframes || []).map((k) => ({ ...k, id: generateId('kf') })),
        channels: newChannels,
      };
    };

    const newParts: CharacterPart[] = [];
    const newTracks: Track[] = [];
    sources.forEach((source, index) => {
      const cloneId = idMap.get(source.id)!;
      const name = `${source.name} Copy`;
      const clone: CharacterPart = {
        ...structuredClone(source),
        id: cloneId,
        name,
        zIndex: characterParts.length + 1 + index,
        boundPartIds: undefined,
        baseTransform: index === 0
          ? { ...source.baseTransform, x: source.baseTransform.x + 20, y: source.baseTransform.y + 20 }
          : { ...source.baseTransform },
      };
      const cloneParentId = source.parentId ? idMap.get(source.parentId) : undefined;
      if (cloneParentId) clone.parentId = cloneParentId;
      newParts.push(clone);
      newTracks.push(cloneTrackFor(source.id, cloneId, name));
    });

    setTracks((prevTracks) => [...newTracks, ...prevTracks]);
    setCharacterParts((prevParts) => [...newParts, ...prevParts]);
    setSelectedPartId(newPartId);
  }, [selectedPartId, characterParts, tracks, setTracks, setCharacterParts, setSelectedPartId]);

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
        boundPartIds: undefined,
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
    },
    [selectedPartId, characterParts, tracks, setTracks, setCharacterParts, setSelectedPartId]
  );

  /**
   * M26 — paste the copied ANIMATION onto an EXISTING selected part.
   * The target part is NOT replaced: only animation data is transferred
   * (Track.channels + legacy keyframes + IN/OUT presets + durations). The
   * target keeps its id/name/transform/matte/parent/geometry/media and its
   * track keeps its id + visible/locked metadata. Fresh keyframe ids are
   * generated; custom preset IDs are referenced, never duplicated.
   *
   * C8 — the transfer is RELATIVE to the target's own base transform: the
   * target keeps its place and proportions and performs the source's motion
   * (see `cloneAnimationOntoTarget`). Exact values stay the job of the
   * timeline's keyframe copy/paste.
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
        { targetBase: targetPart.baseTransform },
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
    },
    [clipboardData, characterParts, tracks, setTracks, setCharacterParts, showToast]
  );

  return { clipboardData, copySelectedPart, pasteCopiedPart, duplicateSelectedPart, duplicateMirrored, pasteAnimationOntoSelected };
};
