import { useState, useCallback } from 'react';
import type { CharacterPart, Track, TrackChannel, EasingType, Keyframe, Transform } from '../types/animator';
import { generateId } from '../utils/idGenerator';
import { generateTransitionChannelKeyframes } from '../utils/motionTransitions';
import { hasChannelDataForTemplate } from '../utils/timelineMetrics';
import { 
  updateKeyframeBezierPointsMutator, 
  addPropertyKeyframeMutator, 
  deletePropertyKeyframeMutator, 
  deleteSelectedKeyframeGroupMutator,
  updatePropertyKeyframeFrameMutator,
  updatePropertyKeyframeEasingMutator,
  applyTransitionChannelsMutator,
  applyTransitionToTrackCanonicalMutator
} from '../utils/trackMutations';

interface UseTimelineOptions {
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  selectedPartId: string | null;
  setSelectedPartId: (id: string | null) => void;
  selectedPartIds: string[];
  setSelectedPartIds: React.Dispatch<React.SetStateAction<string[]>>;
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
  tracks,
  setTracks,
  selectedPartId,
  setSelectedPartId,
  selectedPartIds,
  setSelectedPartIds,
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

  // Delete part directly without confirm
  const deletePart = useCallback((partId: string) => {
    setCharacterParts((prev) => prev.filter((p) => p.id !== partId));
    if (selectedPartIds.includes(partId)) {
      setSelectedPartIds(selectedPartIds.filter((id) => id !== partId));
    }
    setTracks((prev) => prev.filter((t) => t.partId !== partId));
    if (selectedPartId === partId) {
      setSelectedPartId(null);
    }
  }, [selectedPartId, selectedPartIds]);

  // Keyframe & Track Actions
  const addKeyframeToTrack = (trackId: string, frame: number) => {
    setTracks((prevTracks) =>
      prevTracks.map((tr) => {
        if (tr.id !== trackId) return tr;
        const currentTransform = getComputedTransform(tr.partId, frame);
        const activeTmpl = activeTemplateId || 'Sequence';
        const existingIdx = (tr.keyframes || []).findIndex((k) => k.frame === frame && (k.templateId || 'Sequence') === activeTmpl);

        const newKf: Keyframe = {
          id: generateId('kf'),
          frame,
          transform: { ...currentTransform },
          easing: 'easeInOut',
          templateId: activeTemplateId || 'Sequence',
        };

        let newKfs = [...(tr.keyframes || [])];
        if (existingIdx >= 0) {
          newKfs[existingIdx] = newKf;
        } else {
          newKfs.push(newKf);
          newKfs.sort((a, b) => a.frame - b.frame);
        }
        return { ...tr, keyframes: newKfs };
      })
    );
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
    channel: TrackChannel,
    frame: number,
    value: number,
    easing: EasingType = 'easeInOut'
  ) => {
    setTracks((prev) => addPropertyKeyframeMutator(prev, trackId, channel, frame, value, easing, activeTemplateId || 'Sequence'));
  };

  const deletePropertyKeyframe = (trackId: string, channel: TrackChannel, keyframeId: string) => {
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

  const updatePropertyKeyframeFrame = (trackId: string, channel: TrackChannel, keyframeId: string, newFrame: number) => {
    setTracks((prev) => updatePropertyKeyframeFrameMutator(prev, trackId, channel, keyframeId, newFrame));
  };

  // M1: change easing of a single channel keyframe
  const updatePropertyKeyframeEasing = (trackId: string, channel: TrackChannel, keyframeId: string, easing: EasingType) => {
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
  }, [showToast]);

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
  }, []);



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
    deletePropertyKeyframe,
    deleteSelectedKeyframe,
    updatePropertyKeyframeFrame,
    updatePropertyKeyframeEasing,
    applyMotionTransition,
    renamePartAndTrack,
    reorderParts,
  };
};
