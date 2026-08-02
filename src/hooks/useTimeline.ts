import { useState, useCallback } from 'react';
import type { CharacterPart, Track, TrackChannel, EasingType, Keyframe, Transform } from '../types/animator';
import { generateId } from '../utils/idGenerator';
import { generateTransitionKeyframes } from '../utils/motionTransitions';
import { 
  updateKeyframeBezierPointsMutator, 
  addPropertyKeyframeMutator, 
  deletePropertyKeyframeMutator, 
  updatePropertyKeyframeFrameMutator 
} from '../utils/trackMutations';

interface UseTimelineOptions {
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  selectedPartId: string | null;
  setSelectedPartId: (id: string | null) => void;
  selectedPartIds: string[];
  setSelectedPartIds: React.Dispatch<React.SetStateAction<string[]>>;
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
        const existingIdx = tr.keyframes.findIndex((k) => k.frame === frame && (k.templateId || 'Sequence') === activeTmpl);

        const newKf: Keyframe = {
          id: generateId('kf'),
          frame,
          transform: { ...currentTransform },
          easing: 'easeInOut',
          templateId: activeTemplateId || 'Sequence',
        };

        let newKfs = [...tr.keyframes];
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

  const addKeyframeForSelected = () => {
    if (!selectedPartId) return;
    const track = tracks.find((t) => t.partId === selectedPartId);
    if (track) {
      addKeyframeToTrack(track.id, currentFrame);
    }
  };

  const deleteKeyframe = (trackId: string, keyframeId: string) => {
    setTracks((prev) =>
      prev.map((tr) => {
        if (tr.id !== trackId) return tr;
        return {
          ...tr,
          keyframes: tr.keyframes.filter((k) => k.id !== keyframeId),
        };
      })
    );
  };

  const updateKeyframeFrame = (trackId: string, keyframeId: string, newFrame: number) => {
    setTracks((prev) =>
      prev.map((tr) => {
        if (tr.id !== trackId) return tr;
        const targetKf = tr.keyframes.find((k) => k.id === keyframeId);
        if (!targetKf) return tr;

        const updatedKfs = tr.keyframes.map((k) => (k.id === keyframeId ? { ...k, frame: newFrame } : k));
        updatedKfs.sort((a, b) => a.frame - b.frame);
        return { ...tr, keyframes: updatedKfs };
      })
    );
  };

  const updateKeyframeEasing = (trackId: string, keyframeId: string, easing: EasingType) => {
    setTracks((prev) =>
      prev.map((tr) => {
        if (tr.id !== trackId) return tr;
        return {
          ...tr,
          keyframes: tr.keyframes.map((k) => (k.id === keyframeId ? { ...k, easing } : k)),
        };
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

  const updatePropertyKeyframeFrame = (trackId: string, channel: TrackChannel, keyframeId: string, newFrame: number) => {
    setTracks((prev) => updatePropertyKeyframeFrameMutator(prev, trackId, channel, keyframeId, newFrame));
  };

  const applyMotionTransition = (partId: string, transitionType: string) => {
    const track = tracks.find((t) => t.partId === partId);
    if (!track) return;

    const startFrame = currentFrame;
    const duration = 15;
    const endFrame = Math.min(totalFrames, startFrame + duration);
    const baseTransform = getComputedTransform(partId, startFrame);

    const result = generateTransitionKeyframes(baseTransform, transitionType, startFrame, endFrame);
    
    if (!result) {
      setTracks((prev) =>
        prev.map((t) => (t.id === track.id ? { ...t, keyframes: [] } : t))
      );
      return;
    }

    const { kfStart, kfEnd } = result;

    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== track.id) return t;
        const filtered = t.keyframes.filter(
          (k) => k.frame < startFrame || k.frame > endFrame
        );
        const newKfs = [...filtered, kfStart, kfEnd].sort((a, b) => a.frame - b.frame);
        return { ...t, keyframes: newKfs };
      })
    );
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
    addKeyframeForSelected,
    deleteKeyframe,
    updateKeyframeFrame,
    updateKeyframeEasing,
    updateKeyframeBezierPoints,
    toggleTrackVisibility,
    toggleTrackEditVisibility,
    toggleTrackLock,
    toggleTrackExpanded,
    addPropertyKeyframe,
    deletePropertyKeyframe,
    updatePropertyKeyframeFrame,
    applyMotionTransition,
    renamePartAndTrack,
    reorderParts,
  };
};
