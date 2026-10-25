import { useState, useCallback } from 'react';
import type { CharacterPart, PropertyKeyframe, Track, TrackChannel, AnimationChannel, EasingType, Transform, BezierPath, LayerMaskPathChannel } from '../types/animator';
import { layerMaskPathChannel } from '../types/animator';
import { generateTransitionChannelKeyframes } from '../utils/motionTransitions';
import { hasChannelDataForTemplate, resolveChannelAnimationState } from '../utils/timelineMetrics';
import { buildTransformSnapshot, resolveAuthoredLocalTransform, resolveAuthoredBasePose, applyChannelStaticValue, channelArmValue } from '../utils/channelKeyframeGroups';
import { interpolateChannel } from '../utils/defaults';
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
  applyTemporalHandlesToSegmentMutator,
  updatePropertyKeyframeFrameMutator,
  updatePropertyKeyframeEasingMutator,
  deletePropertyKeyframeMutator,
  deleteSelectedKeyframeGroupsMutator,
  addMaskPathKeyframeMutator,
  updateMaskPathKeyframeValueMutator,
  updateMaskPathKeyframeFrameMutator,
  deleteMaskPathKeyframeMutator,
  clearMaskPathAnimationMutator,
  applyTransitionChannelsMutator,
  applyTransitionToTrackCanonicalMutator,
  clearChannelAnimationMutator
} from '../utils/trackMutations';
import { planPartDeletion } from '../utils/partDeletion';
import { evaluateLayerMasks } from '../utils/evaluateLayerMasks';
import { lockedLayersRefusal } from '../utils/layerLocks';

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
  /** Every selected keyframe; the delete acts on the whole set. */
  selectedKeyframeIds: string[];
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
  selectedKeyframeIds,
  setSelectedKeyframeId,
  currentFrame,
  totalFrames,
  activeTemplateId,
  getComputedTransform,
  showToast,
}: UseTimelineOptions) => {
  const [timelineZoom, setTimelineZoom] = useState<number>(18); // px per frame
  const [showGrid, setShowGrid] = useState<boolean>(true);
  // Canvas presentation state only: never serialized with the scene.
  const [showCoordinateOverlay, setShowCoordinateOverlay] = useState<boolean>(true);

  // Delete the requested part or the complete canonical selection in one state transaction.
  const deletePart = useCallback((partId: string) => {
    const requestedIds = selectedPartIds.includes(partId) ? selectedPartIds : [partId];
    const deletion = planPartDeletion(characterParts, tracks, requestedIds);
    if (!deletion.ok) {
      showToast(deletion.reason, 'error');
      return;
    }
    if (deletion.deletedIds.length === 0) return;
    // C4 — a locked layer is neither deleted nor rewritten (a released child
    // gets a new pose): the whole delete is refused, nothing half-applied.
    const lockRefusal = lockedLayersRefusal(characterParts, tracks, [...deletion.deletedIds, ...deletion.releasedChildIds]);
    if (lockRefusal) {
      showToast(lockRefusal, 'error');
      return;
    }
    if (deletion.releasedChildIds.length > 0) {
      const count = deletion.releasedChildIds.length;
      showToast(
        `${count} child layer${count === 1 ? '' : 's'} kept ${count === 1 ? 'its' : 'their'} place${deletion.bakeNotes ? '; the parent’s motion was baked into their keyframes' : ''}.`,
        'info',
      );
    }
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
    showToast,
    tracks,
  ]);

  // Keyframe & Track Actions
  /**
   * The authored base pose of one track's layer: the proof the legacy →
   * canonical conversion needs to tell a composite property that animates (or
   * holds a pose the layer does not own) from one that only re-states the
   * layer's own pose. Never re-derived — it is the evaluator's own
   * `authoredBasePose`, and absent when the document does not carry the layer.
   */
  const basePoseOfTrack = (partId: string) => resolveAuthoredBasePose(characterParts, partId);

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
      basePoseOfTrack(track.partId),
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

  /**
   * C4 — the one lock writer for several layers at once (the lock shortcut, the
   * Inspector's Unlock, Unlock All). The lock is a switch: one undo step, and it
   * never touches the layer's content.
   */
  const setLayersLocked = useCallback((partIds: readonly string[], locked: boolean) => {
    const wanted = new Set(partIds);
    setTracks((prev) => {
      let changed = false;
      const next = prev.map((t) => {
        if (!wanted.has(t.partId) || Boolean(t.locked) === locked) return t;
        changed = true;
        return { ...t, locked };
      });
      return changed ? next : prev;
    });
  }, [setTracks]);

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
    const basePose = basePoseOfTrack(tracks.find((track) => track.id === trackId)?.partId ?? '');
    setTracks((prev) => addPropertyKeyframeMutator(
      migrateTrackLegacyKeyframes(prev, trackId, basePose),
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
  /** #57 (V6): segment preset application — one write, one undo entry, or a strict no-op. */
  const applyTemporalHandlesToSegment = (
    trackId: string,
    channel: AnimationChannel,
    fromKeyframeId: string,
    outgoing: { x: number; y: number },
    incoming: { x: number; y: number },
  ) => {
    setTracks((prev) => applyTemporalHandlesToSegmentMutator(prev, trackId, channel, fromKeyframeId, outgoing, incoming) ?? prev);
  };
  const deletePropertyKeyframe = (trackId: string, channel: AnimationChannel, keyframeId: string) => {
    setTracks((prev) => deletePropertyKeyframeMutator(prev, trackId, channel, keyframeId));
  };

  /**
   * Delete the timeline's whole keyframe selection — every frame group the
   * selected keys belong to — in ONE document write, so a multi-key deletion is
   * a single undo step and Undo restores the exact set. The whole set is resolved
   * against the previous document in one reducer pass, which is what makes the
   * deletion atomic however many tracks and channels the selection spans.
   *
   * The selection itself decides whether the key is consumed: while keyframes are
   * selected, Delete never falls through to deleting the selected LAYER, even
   * when the selected keys are staler than the document (a set that matches
   * nothing writes the same array back, so React records no history entry).
   */
  const deleteSelectedKeyframes = useCallback((): boolean => {
    if (selectedKeyframeIds.length === 0) return false;
    const templateId = activeTemplateId || 'Sequence';
    setTracks((prev) => deleteSelectedKeyframeGroupsMutator(prev, selectedKeyframeIds, templateId).tracks);
    setSelectedKeyframeId(null);
    return true;
  }, [activeTemplateId, selectedKeyframeIds, setSelectedKeyframeId, setTracks]);

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

  /**
   * Author geometry using the same between-key convention as scalar Inspector
   * channels (WP-01): the path is animated only when it holds keys in the
   * ACTIVE sequence — another sequence's keys never turn a base edit into a key.
   * An exact-frame key changes its value only (easing and temporal handles
   * survive); between keys one key is inserted with the sequence's easing. A
   * missing owner or a deleted mask is a no-op.
   */
  const authorMaskPath = (partId: string, maskId: string, path: BezierPath) => {
    const owner = characterParts.find((candidate) => candidate.id === partId);
    if (!owner?.masks?.some((mask) => mask.id === maskId)) return;
    const scope = activeTemplateId || 'Sequence';
    const track = tracks.find((candidate) => candidate.partId === partId);
    const channel = layerMaskPathChannel(maskId);
    const keyframes = (track?.maskPathChannels?.[channel] ?? []).filter((keyframe) => (keyframe.templateId || 'Sequence') === scope);
    if (keyframes.length > 0 && track) {
      const exact = keyframes.find((keyframe) => keyframe.frame === currentFrame);
      if (exact) {
        updateMaskPathKeyframeValue(track.id, channel, exact.id, path);
      } else {
        addMaskPathKeyframe(track.id, maskId, currentFrame, path, keyframes[0].easing ?? 'easeInOut');
      }
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
    setTracks((prev) => applyTransitionToTrackCanonicalMutator(prev, track.id, transition, activeTmpl, basePoseOfTrack(track.partId)));
    return;
  };

  const renamePartAndTrack = useCallback((partId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const lockRefusal = lockedLayersRefusal(characterParts, tracks, [partId]);
    if (lockRefusal) {
      showToast(lockRefusal, 'error');
      return;
    }
    setCharacterParts((prev) =>
      prev.map((p) => (p.id === partId ? { ...p, name: trimmed } : p))
    );
    setTracks((prev) =>
      prev.map((t) => (t.partId === partId ? { ...t, name: trimmed } : t))
    );
  }, [characterParts, setCharacterParts, setTracks, showToast, tracks]);

  const reorderParts = useCallback((dragIndex: number, hoverIndex: number) => {
    if (dragIndex === hoverIndex) return;
    // C4 — a locked layer keeps its place in the stack (other layers may still
    // move past it; that only renumbers it).
    const moved = characterParts[dragIndex];
    const lockRefusal = moved ? lockedLayersRefusal(characterParts, tracks, [moved.id]) : null;
    if (lockRefusal) {
      showToast(lockRefusal, 'error');
      return;
    }

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
  }, [characterParts, setCharacterParts, setTracks, showToast, tracks]);


  /**
   * K1 (contract D2) — the stopwatch. Arm writes the FIRST key of one channel
   * at the playhead with the property's evaluated current value (the same
   * authored-local capture the aggregate `+` uses — finding F safe); an
   * already-animated channel is never re-initialised and never duplicated.
   */
  const armChannel = (trackId: string, channel: AnimationChannel) => {
    const track = tracks.find((candidate) => candidate.id === trackId);
    const part = track ? characterParts.find((candidate) => candidate.id === track.partId) : undefined;
    if (!track || !part) return;
    const scope = activeTemplateId || 'Sequence';
    if (resolveChannelAnimationState(track, channel, currentFrame, scope) !== 'off') return;
    // WP-03 — a mask PATH arms like a scalar: its first key is the path the
    // timeline shows at the playhead in this sequence (the existing writer).
    if (channel.endsWith(':path')) {
      const maskId = channel.slice(0, -':path'.length);
      const displayed = evaluateLayerMasks(part, track, currentFrame, scope)?.find((mask) => mask.id === maskId);
      if (!displayed) return;
      setTracks((prev) => addMaskPathKeyframeMutator(prev, trackId, channel as LayerMaskPathChannel, currentFrame, displayed.path, 'easeInOut', scope));
      return;
    }
    const authored = resolveAuthoredLocalTransform(track.partId, currentFrame, { parts: characterParts, worldOf: getComputedTransform });
    const value = channelArmValue(channel, authored, part);
    setTracks((prev) => addPropertyKeyframeMutator(
      migrateTrackLegacyKeyframes(prev, trackId, basePoseOfTrack(track.partId)),
      trackId,
      channel,
      currentFrame,
      value,
      'easeInOut',
      scope,
    ));
  };

  /**
   * K1 (contract D2) — disarm, the confirmed half: every key the channel holds
   * IN THE ACTIVE SEQUENCE is removed and the value the timeline evaluates at
   * the playhead survives as the authored static value, in one state batch
   * (one history entry). Other sequences' keys survive untouched. The caller
   * owns the confirmation; this function is only reached through it.
   */
  const disableChannelAnimation = (trackId: string, channel: AnimationChannel) => {
    const track = tracks.find((candidate) => candidate.id === trackId);
    if (!track) return;
    const scope = activeTemplateId || 'Sequence';
    // WP-03 — the path disarm mirrors the scalar one: the active sequence's
    // path keys go, and the path shown at the playhead stays as the base path.
    if (channel.endsWith(':path')) {
      const maskId = channel.slice(0, -':path'.length);
      const part = characterParts.find((candidate) => candidate.id === track.partId);
      const inScope = (track.maskPathChannels?.[channel as LayerMaskPathChannel] ?? []).filter((k) => (k.templateId || 'Sequence') === scope);
      const displayed = part ? evaluateLayerMasks(part, track, currentFrame, scope)?.find((mask) => mask.id === maskId) : undefined;
      if (!part || !displayed || inScope.length === 0) return;
      setTracks((prev) => clearMaskPathAnimationMutator(prev, trackId, channel as LayerMaskPathChannel, scope));
      setCharacterParts((prev) => prev.map((candidate) => (candidate.id === part.id
        ? { ...candidate, masks: candidate.masks?.map((mask) => (mask.id === maskId ? { ...mask, path: displayed.path } : mask)) }
        : candidate)));
      return;
    }
    const store = (channel.includes(':') ? track.maskChannels : track.channels) as Record<string, PropertyKeyframe[]> | undefined;
    const inScopeKeys = (store?.[channel] ?? []).filter((k) => (k.templateId || 'Sequence') === scope);
    if (inScopeKeys.length === 0) return;
    const part = characterParts.find((candidate) => candidate.id === track.partId);
    if (!part) return;
    const authored = resolveAuthoredLocalTransform(track.partId, currentFrame, { parts: characterParts, worldOf: getComputedTransform });
    const staticValue = interpolateChannel(inScopeKeys, currentFrame, channelArmValue(channel, authored, part));
    setTracks((prev) => clearChannelAnimationMutator(prev, trackId, channel, scope));
    setCharacterParts((prev) => prev.map((candidate) => (candidate.id === part.id ? applyChannelStaticValue(candidate, channel, staticValue) : candidate)));
  };

  return {
    armChannel,
    disableChannelAnimation,
    timelineZoom,
    setTimelineZoom,
    showGrid,
    setShowGrid,
    showCoordinateOverlay,
    setShowCoordinateOverlay,
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
    applyTemporalHandlesToSegment,
    deletePropertyKeyframe,
    addMaskPathKeyframe,
    updateMaskPathKeyframeValue,
    updateMaskPathKeyframeFrame,
    deleteMaskPathKeyframe,
    authorMaskPath,
    setLayersLocked,
    deleteSelectedKeyframes,
    updatePropertyKeyframeFrame,
    updatePropertyKeyframeEasing,
    applyMotionTransition,
    renamePartAndTrack,
    reorderParts,
  };
};
