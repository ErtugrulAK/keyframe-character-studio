import { useState, useCallback } from 'react';
import type { CharacterPart, Track, TrackChannel, AnimationChannel, EasingType, Transform, BezierPath, LayerMaskPathChannel } from '../types/animator';
import { layerMaskPathChannel } from '../types/animator';
import { generateTransitionChannelKeyframes } from '../utils/motionTransitions';
import { hasChannelDataForTemplate } from '../utils/timelineMetrics';
import { buildTransformSnapshot, resolveAuthoredLocalTransform } from '../utils/channelKeyframeGroups';
import { 
  updateKeyframeBezierPointsMutator,
  addPropertyKeyframeMutator,
  addTransformKeyframeGroupMutator,
  migrateTrackLegacyKeyframes,
  resolveKeyframeMoveTargets,
  moveKeyframesMutator,
  deleteFrameGroupsMutator,
  updatePropertyKeyframeValueMutator,
  updatePropertyKeyframeTemporalHandlesMutator,
  updatePropertyKeyframeFrameMutator,
  updatePropertyKeyframeEasingMutator,
  deletePropertyKeyframeMutator,
  deleteSelectedKeyframeGroupMutator,
  addMaskPathKeyframeMutator,
  updateMaskPathKeyframeValueMutator,
  updateMaskPathKeyframeFrameMutator,
  deleteMaskPathKeyframeMutator,
  applyTransitionChannelsMutator,
  applyTransitionToTrackCanonicalMutator
} from '../utils/trackMutations';
import { deleteParts } from '../utils/partDeletion';

interface UseTimelineOptions {
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  characterParts: CharacterPart[];
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  /** Live mirror of `tracks`; a drag gesture reads and writes it between renders. */
  tracksRef: React.MutableRefObject<Track[]>;
  selectedPartId: string | null;
  setSelectedPartId: (id: string | null) => void;
  selectedPartIds: string[];
  setSelectedPartIds: (ids: string[]) => void;
  booleanOperandEditingGroupId?: string | null;
  setBooleanOperandEditingGroupId?: (id: string | null) => void;
  selectedKeyframeId: string | null;
  setSelectedKeyframeId: (id: string | null) => void;
  currentFrame: number;
  totalFrames: number;
  activeTemplateId: string;
  getComputedTransform: (partId: string, frame: number) => Transform;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const useTimeline = ({
  setCharacterParts,
  characterParts,
  tracks,
  setTracks,
  tracksRef,
  selectedPartId,
  setSelectedPartId,
  selectedPartIds,
  setSelectedPartIds,
  booleanOperandEditingGroupId,
  setBooleanOperandEditingGroupId = () => {},
  selectedKeyframeId,
  setSelectedKeyframeId,
  currentFrame,
  totalFrames,
  activeTemplateId,
  getComputedTransform,
  showToast,
}: UseTimelineOptions) => {
  const [timelineZoom, setTimelineZoom] = useState<number>(18); // px per frame
  const [showGrid, setShowGrid] = useState<boolean>(true);

  // Delete the requested part or the complete canonical selection in one state transaction.
  const deletePart = useCallback((partId: string) => {
    const requestedIds = selectedPartIds.includes(partId) ? selectedPartIds : [partId];
    const deletion = deleteParts(characterParts, tracks, requestedIds);
    if (deletion.deletedIds.length === 0) return;
    const deletedIdSet = new Set(deletion.deletedIds);
    setCharacterParts(deletion.parts);
    setTracks(deletion.tracks);
    setSelectedPartIds(selectedPartIds.filter((id) => !deletedIdSet.has(id)));
    if (selectedPartId && deletedIdSet.has(selectedPartId)) {
      setSelectedPartId(null);
    }
    if (selectedKeyframeId && tracks.some((track) => deletedIdSet.has(track.partId))) {
      setSelectedKeyframeId(null);
    }
    const activeOperandDeleted = characterParts.some(
      (part) => part.booleanGroupId === booleanOperandEditingGroupId && deletedIdSet.has(part.id),
    );
    if (
      (booleanOperandEditingGroupId && deletedIdSet.has(booleanOperandEditingGroupId))
      || activeOperandDeleted
    ) {
      setBooleanOperandEditingGroupId(null);
    }
  }, [
    booleanOperandEditingGroupId,
    characterParts,
    selectedPartId,
    selectedKeyframeId,
    selectedPartIds,
    setBooleanOperandEditingGroupId,
    setCharacterParts,
    setSelectedPartId,
    setSelectedPartIds,
    setSelectedKeyframeId,
    setTracks,
    tracks,
  ]);

  // Keyframe & Track Actions
  /**
   * R3-10: the layer-level ("aggregate") keyframe action authors ONE canonical
   * transform keyframe group — the x/y/rotation/scaleX/scaleY/opacity and Trim
   * Path channels at this frame, from the layer's evaluated authored pose. The
   * layer row and the expanded channel rows are then two views of the same
   * keys, and any legacy composite animation is migrated instead of hidden.
   */
  const addKeyframeToTrack = (trackId: string, frame: number) => {
    const track = tracks.find((candidate) => candidate.id === trackId);
    if (!track) return;
    const authored = resolveAuthoredLocalTransform(track.partId, frame, { parts: characterParts, worldOf: getComputedTransform });
    const part = characterParts.find((candidate) => candidate.id === track.partId);
    const values: Partial<Record<TrackChannel, number>> = {
      ...buildTransformSnapshot(authored),
      trimPathStart: part?.trimPathStart ?? 0,
      trimPathEnd: part?.trimPathEnd ?? 1,
      trimPathOffset: part?.trimPathOffset ?? 0,
    };
    setTracks((prev) => addTransformKeyframeGroupMutator(
      prev,
      trackId,
      frame,
      activeTemplateId || 'Sequence',
      values,
      'easeInOut',
    ));
  };

  const deleteKeyframe = (trackId: string, keyframeId: string) => {
    setTracks((prev) =>
      prev.map((tr) => {
        if (tr.id !== trackId) return tr;
        return {
          ...tr,
          keyframes: (tr.keyframes || []).filter((k) => k.id !== keyframeId),
        };
      })
    );
  };

  const updateKeyframeFrame = (trackId: string, keyframeId: string, newFrame: number) => {
    setTracks((prev) =>
      prev.map((tr) => {
        if (tr.id !== trackId) return tr;
        const targetKf = (tr.keyframes || []).find((k) => k.id === keyframeId);
        if (!targetKf) return tr;

        const updatedKfs = (tr.keyframes || []).map((k) => (k.id === keyframeId ? { ...k, frame: newFrame } : k));
        updatedKfs.sort((a, b) => a.frame - b.frame);
        return { ...tr, keyframes: updatedKfs };
      })
    );
  };

  const updateKeyframeBezierPoints = (
    trackId: string,
    keyframeId: string,
    points: [number, number, number, number]
  ) => {
    setTracks((prev) => updateKeyframeBezierPointsMutator(prev, trackId, keyframeId, points));
  };

  const toggleTrackVisibility = (trackId: string) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, visible: !t.visible } : t)));
  };

  const toggleTrackEditVisibility = (trackId: string) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, editVisible: t.editVisible === false ? true : false } : t)));
  };

  const toggleTrackLock = (trackId: string) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, locked: !t.locked } : t)));
  };

  const toggleTrackExpanded = (trackId: string) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, expanded: !t.expanded } : t)));
  };

  // Per-property channel keyframe actions (Unreal-style)
  const addPropertyKeyframe = (
    trackId: string,
    channel: AnimationChannel,
    frame: number,
    value: number,
    easing: EasingType = 'easeInOut'
  ) => {
    setTracks((prev) => addPropertyKeyframeMutator(
      migrateTrackLegacyKeyframes(prev, trackId),
      trackId,
      channel,
      frame,
      value,
      easing,
      activeTemplateId || 'Sequence',
    ));
  };

  /**
   * R3-04: move the whole timeline keyframe selection by `delta` frames — one
   * gesture, one history entry (the caller batches), clamped to the project range
   * and stopped at the first frame that would overwrite unrelated animation.
   * Returns the delta actually applied, so a drag keeps its pointer mapping.
   *
   * The gesture reads and writes the live tracks ref: consecutive `mousemove`
   * events of one drag can arrive before React re-renders, and a drag must never
   * move the set twice from the same base.
   */
  const moveSelectedKeyframes = (selectedIds: string[], delta: number, expandFrameGroups: boolean): number => {
    const templateId = activeTemplateId || 'Sequence';
    const current = tracksRef.current;
    const targets = resolveKeyframeMoveTargets(current, selectedIds, templateId, expandFrameGroups);
    const outcome = moveKeyframesMutator(current, targets, delta, totalFrames);
    if (outcome.appliedDelta === 0) return 0;
    tracksRef.current = outcome.tracks;
    setTracks(outcome.tracks);
    return outcome.appliedDelta;
  };

  /** Delete every frame group at one frame of one track (all stores). */
  const deleteKeyframeFrameGroup = (trackId: string, frame: number) => {
    setTracks((prev) => deleteFrameGroupsMutator(prev, trackId, [frame], activeTemplateId || 'Sequence'));
  };

  const updatePropertyKeyframeValue = (trackId: string, channel: AnimationChannel, keyframeId: string, value: number) => {
    setTracks((prev) => updatePropertyKeyframeValueMutator(prev, trackId, channel, keyframeId, value));
  };
  const updatePropertyKeyframeTemporalHandles = (
    trackId: string,
    channel: AnimationChannel,
    keyframeId: string,
    patch: { bezierIn?: { x: number; y: number }; bezierOut?: { x: number; y: number } },
  ) => {
    setTracks((prev) => updatePropertyKeyframeTemporalHandlesMutator(prev, trackId, channel, keyframeId, patch));
  };
  const deletePropertyKeyframe = (trackId: string, channel: AnimationChannel, keyframeId: string) => {
    setTracks((prev) => deletePropertyKeyframeMutator(prev, trackId, channel, keyframeId));
  };

  const deleteSelectedKeyframe = useCallback((): boolean => {
    if (!selectedKeyframeId) return false;
    const templateId = activeTemplateId || 'Sequence';
    const current = deleteSelectedKeyframeGroupMutator(tracks, selectedKeyframeId, templateId);
    if (!current.deleted) return false;

    setTracks((prev) => deleteSelectedKeyframeGroupMutator(prev, selectedKeyframeId, templateId).tracks);
    setSelectedKeyframeId(null);
    return true;
  }, [activeTemplateId, selectedKeyframeId, setSelectedKeyframeId, setTracks, tracks]);

  const addMaskPathKeyframe = (
    trackId: string,
    maskId: string,
    frame: number,
    path: BezierPath,
    easing: EasingType = 'easeInOut',
  ) => {
    setTracks((prev) => addMaskPathKeyframeMutator(
      prev,
      trackId,
      layerMaskPathChannel(maskId),
      frame,
      path,
      easing,
      activeTemplateId || 'Sequence',
    ));
  };

  const updateMaskPathKeyframeValue = (
    trackId: string,
    channel: LayerMaskPathChannel,
    keyframeId: string,
    path: BezierPath,
  ) => {
    setTracks((prev) => updateMaskPathKeyframeValueMutator(prev, trackId, channel, keyframeId, path));
  };

  const updateMaskPathKeyframeFrame = (
    trackId: string,
    channel: LayerMaskPathChannel,
    keyframeId: string,
    frame: number,
  ) => {
    setTracks((prev) => updateMaskPathKeyframeFrameMutator(prev, trackId, channel, keyframeId, frame));
  };

  const deleteMaskPathKeyframe = (
    trackId: string,
    channel: LayerMaskPathChannel,
    keyframeId: string,
  ) => {
    setTracks((prev) => deleteMaskPathKeyframeMutator(prev, trackId, channel, keyframeId));
  };

  /** Author geometry using the same between-key convention as scalar Inspector channels. */
  const authorMaskPath = (partId: string, maskId: string, path: BezierPath) => {
    const track = tracks.find((candidate) => candidate.partId === partId);
    const channel = layerMaskPathChannel(maskId);
    const keyframes = track?.maskPathChannels?.[channel] ?? [];
    if (keyframes.length > 0 && track) {
      addMaskPathKeyframe(track.id, maskId, currentFrame, path);
      return;
    }
    setCharacterParts((prev) => prev.map((part) => part.id === partId
      ? { ...part, masks: part.masks?.map((mask) => mask.id === maskId ? { ...mask, path } : mask) }
      : part));
  };

  const updatePropertyKeyframeFrame = (trackId: string, channel: AnimationChannel, keyframeId: string, newFrame: number) => {
    setTracks((prev) => updatePropertyKeyframeFrameMutator(prev, trackId, channel, keyframeId, newFrame));
  };

  // M1: change easing of a single channel keyframe
  const updatePropertyKeyframeEasing = (trackId: string, channel: AnimationChannel, keyframeId: string, easing: EasingType) => {
    setTracks((prev) => updatePropertyKeyframeEasingMutator(prev, trackId, channel, keyframeId, easing));
  };

  const applyMotionTransition = (partId: string, transitionType: string) => {
    const track = tracks.find((t) => t.partId === partId);
    if (!track) return;

    const startFrame = currentFrame;
    const duration = 15;
    const endFrame = Math.min(totalFrames, startFrame + duration);
    const baseTransform = getComputedTransform(partId, startFrame);
    const activeTmpl = activeTemplateId || 'Sequence';

    // M8a: canonical transition for channel-data tracks — writes the 6
    // channels, never touches legacy keyframes[].
    if (hasChannelDataForTemplate(track, activeTmpl)) {
      const transition = generateTransitionChannelKeyframes(baseTransform, transitionType, startFrame, endFrame);
      setTracks((prev) => applyTransitionChannelsMutator(prev, track.id, transition, activeTmpl));
      return;
    }

    // M8e-prep A: legacy-only tracks (empty channels but populated legacy
    // keyframes[]) get a canonical transition too — existing legacy keyframes
    // are converted into channels first, then the transition applies. The
    // legacy keyframes[] array stays untouched for import compatibility.
    const transition = generateTransitionChannelKeyframes(baseTransform, transitionType, startFrame, endFrame);
    setTracks((prev) => applyTransitionToTrackCanonicalMutator(prev, track.id, transition, activeTmpl));
    return;
  };

  const renamePartAndTrack = useCallback((partId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCharacterParts((prev) =>
      prev.map((p) => (p.id === partId ? { ...p, name: trimmed } : p))
    );
    setTracks((prev) =>
      prev.map((t) => (t.partId === partId ? { ...t, name: trimmed } : t))
    );
    showToast(`Renamed layer to "${trimmed}"`, 'success');
  }, [setCharacterParts, setTracks, showToast]);

  const reorderParts = useCallback((dragIndex: number, hoverIndex: number) => {
    if (dragIndex === hoverIndex) return;

    setCharacterParts((prevParts) => {
      if (dragIndex < 0 || hoverIndex < 0 || dragIndex >= prevParts.length || hoverIndex >= prevParts.length) {
        return prevParts;
      }
      const updatedParts = [...prevParts];
      const [movedPart] = updatedParts.splice(dragIndex, 1);
      updatedParts.splice(hoverIndex, 0, movedPart);

      const total = updatedParts.length;
      const reindexedParts = updatedParts.map((p, idx) => ({
        ...p,
        zIndex: total - idx,
      }));

      setTracks((prevTracks) => {
        const sortedTracks = reindexedParts
          .map((p) => prevTracks.find((t) => t.partId === p.id))
          .filter(Boolean) as Track[];
        prevTracks.forEach((t) => {
          if (!sortedTracks.some((st) => st.id === t.id)) {
            sortedTracks.push(t);
          }
        });
        return sortedTracks;
      });

      return reindexedParts;
    });
  }, [setCharacterParts, setTracks]);



  return {
    timelineZoom,
    setTimelineZoom,
    showGrid,
    setShowGrid,
    deletePart,
    addKeyframeToTrack,
    deleteKeyframe,
    updateKeyframeFrame,
    updateKeyframeBezierPoints,
    toggleTrackVisibility,
    toggleTrackEditVisibility,
    toggleTrackLock,
    toggleTrackExpanded,
    addPropertyKeyframe,
    moveSelectedKeyframes,
    deleteKeyframeFrameGroup,
    updatePropertyKeyframeValue,
    updatePropertyKeyframeTemporalHandles,
    deletePropertyKeyframe,
    addMaskPathKeyframe,
    updateMaskPathKeyframeValue,
    updateMaskPathKeyframeFrame,
    deleteMaskPathKeyframe,
    authorMaskPath,
    deleteSelectedKeyframe,
    updatePropertyKeyframeFrame,
    updatePropertyKeyframeEasing,
    applyMotionTransition,
    renamePartAndTrack,
    reorderParts,
  };
};
