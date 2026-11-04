import { useState, useCallback } from 'react';
import type { CharacterPart, Track, TrackChannel } from '../types/animator';
import { generateId } from '../utils/layers/idGenerator';
import { makeEmptyChannels } from '../utils/animation/defaults';
import { mirrorChannelValue, mirrorTransform, type MirrorAxis } from '../utils/animation/mirror';
import { cloneAnimationOntoTarget } from '../utils/animation/animationTransfer';
import { getGroupDescendants } from '../utils/layers/layerGrouping';

interface UseClipboardOptions {
  characterParts: CharacterPart[];
  tracks: Track[];
  selectedPartId: string | null;
  /** The whole selection; the primary `selectedPartId` is one of them. */
  selectedPartIds?: string[];
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  setSelectedPartId: (id: string | null) => void;
  setSelectedPartIds?: (ids: string[]) => void;
}

interface ClipboardEntry {
  part: CharacterPart;
  track?: Track;
}

/**
 * `part`/`track` are the PRIMARY layer (the one animation paste reads);
 * `entries` are every copied layer, in scene order, the primary among them.
 */
type ClipboardData = ClipboardEntry & { entries: ClipboardEntry[] };

/** A track for `cloneId`: the source's animation under fresh ids, or an empty track. */
const cloneTrackOnto = (source: Track | undefined, cloneId: string, name: string): Track => {
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

export const useClipboard = ({
  characterParts,
  tracks,
  selectedPartId,
  selectedPartIds = [],
  showToast,
  setTracks,
  setCharacterParts,
  setSelectedPartId,
  setSelectedPartIds,
}: UseClipboardOptions) => {
  const [clipboardData, setClipboardData] = useState<ClipboardData | null>(null);

  /**
   * Copies the selection: every selected layer, a selected group with its
   * contents. A single layer copies exactly as before.
   */
  const copySelectedPart = useCallback(() => {
    if (!selectedPartId) return;
    const primary = characterParts.find((p) => p.id === selectedPartId);
    if (!primary) return;
    const chosen = new Set(selectedPartIds.includes(selectedPartId) ? selectedPartIds : [selectedPartId]);
    for (const id of [...chosen]) {
      const part = characterParts.find((p) => p.id === id);
      if (part?.isGroup) getGroupDescendants(characterParts, id).forEach((child) => chosen.add(child.id));
    }
    const entryFor = (part: CharacterPart): ClipboardEntry => {
      const track = tracks.find((t) => t.partId === part.id);
      return { part: structuredClone(part), track: track ? structuredClone(track) : undefined };
    };
    setClipboardData({
      ...entryFor(primary),
      entries: characterParts.filter((part) => chosen.has(part.id)).map(entryFor),
    });
  }, [selectedPartId, selectedPartIds, characterParts, tracks]);

  /**
   * Pastes every copied layer under fresh ids, as ONE scene edit. Links between
   * the copied layers (group parent, matte source, boolean group) point at the
   * copies; a link to a layer that was not copied stays on the original, as a
   * single-layer paste always did. The copies keep their stacking order above
   * the scene, and the outermost ones move by the usual paste offset.
   */
  const pasteCopiedPart = useCallback(() => {
    if (!clipboardData) {
      showToast('Clipboard is empty', 'error');
      return;
    }
    const entries = clipboardData.entries.length > 0 ? clipboardData.entries : [clipboardData];
    const idMap = new Map(entries.map((entry) => [entry.part.id, generateId('part')]));
    const remap = (id: string) => idMap.get(id) ?? id;
    const stacking = [...entries].sort((a, b) => (a.part.zIndex ?? 0) - (b.part.zIndex ?? 0));
    const zIndexOf = new Map(stacking.map((entry, rank) => [entry.part.id, characterParts.length + 1 + rank]));

    const newParts: CharacterPart[] = [];
    const newTracks: Track[] = [];
    const outermostIds: string[] = [];
    entries.forEach(({ part, track }) => {
      const cloneId = idMap.get(part.id)!;
      const outermost = !part.parentId || !idMap.has(part.parentId);
      const clone: CharacterPart = {
        ...structuredClone(part),
        id: cloneId,
        name: `${part.name} Copy`,
        zIndex: zIndexOf.get(part.id)!,
        // A copy is not bonded to the original's partners.
        boundPartIds: undefined,
        baseTransform: outermost
          ? { ...part.baseTransform, x: part.baseTransform.x + 20, y: part.baseTransform.y + 20 }
          : { ...part.baseTransform },
      };
      if (part.parentId) clone.parentId = remap(part.parentId);
      if (clone.matte?.sourcePartId) clone.matte = { ...clone.matte, sourcePartId: remap(clone.matte.sourcePartId) };
      if (clone.trackMatte?.sourceLayerId) clone.trackMatte = { ...clone.trackMatte, sourceLayerId: remap(clone.trackMatte.sourceLayerId) };
      if (part.booleanGroupId) clone.booleanGroupId = remap(part.booleanGroupId);
      if (part.booleanOperandIds) clone.booleanOperandIds = part.booleanOperandIds.map(remap);
      if (clone.fitToText) {
        clone.fitToText = {
          ...clone.fitToText,
          textLayerId: remap(clone.fitToText.textLayerId),
          ...(clone.fitToText.extraTextLayerIds ? { extraTextLayerIds: clone.fitToText.extraTextLayerIds.map(remap) } : {}),
        };
      }
      if (clone.follow) clone.follow = { ...clone.follow, targetLayerId: remap(clone.follow.targetLayerId) };
      if (outermost) outermostIds.push(cloneId);
      newParts.push(clone);
      newTracks.push(cloneTrackOnto(track, cloneId, clone.name));
    });

    const primaryCloneId = idMap.get(clipboardData.part.id) ?? newParts[0].id;
    setTracks((prevTracks) => [...newTracks, ...prevTracks]);
    setCharacterParts((prevParts) => [...newParts, ...prevParts]);
    if (outermostIds.length > 1) setSelectedPartIds?.(outermostIds);
    setSelectedPartId(outermostIds.includes(primaryCloneId) ? primaryCloneId : outermostIds[outermostIds.length - 1] ?? primaryCloneId);
  }, [clipboardData, characterParts, setTracks, setCharacterParts, setSelectedPartId, setSelectedPartIds, showToast]);

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

    const cloneTrackFor = (sourceId: string, cloneId: string, name: string): Track => cloneTrackOnto(tracks.find((t) => t.partId === sourceId), cloneId, name);

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
   * Paste the copied ANIMATION onto an EXISTING selected part.
   * The target part is NOT replaced: only animation data is transferred
   * (Track.channels + legacy keyframes + IN/OUT presets + durations). The
   * target keeps its id/name/transform/matte/parent/geometry/media and its
   * track keeps its id + visible/locked metadata. Fresh keyframe ids are
   * generated; custom preset IDs are referenced, never duplicated.
   *
   * The transfer is RELATIVE to the target's own base transform: the
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
