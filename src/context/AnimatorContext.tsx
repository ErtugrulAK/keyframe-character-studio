import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type {
  CharacterPart,
  Track,
  Keyframe,
  Transform,
  ToolType,
  EasingType,
  AnimationProject,
} from '../types/animator';
import {
  DEFAULT_CHARACTER_PARTS,
  DEFAULT_TRACKS,
  PRESET_POSES,
  interpolateTransform,
} from '../utils/defaults';

const AUTOSAVE_STORAGE_KEY = 'SEQUENCER_2D_STUDIO_AUTOSAVE_V1';

interface AnimatorContextType {
  currentFrame: number;
  setCurrentFrame: (frame: number | ((prev: number) => number)) => void;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  fps: number;
  setFps: (fps: number) => void;
  totalFrames: number;
  setTotalFrames: (frames: number) => void;
  isLooping: boolean;
  setIsLooping: (loop: boolean) => void;

  selectedPartId: string | null;
  setSelectedPartId: (id: string | null) => void;
  selectedTrackId: string | null;
  setSelectedTrackId: (id: string | null) => void;
  selectedKeyframeId: string | null;
  setSelectedKeyframeId: (id: string | null) => void;
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;

  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  characterParts: CharacterPart[];
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;

  // Timeline UI state
  timelineZoom: number;
  setTimelineZoom: (zoom: number | ((prev: number) => number)) => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;

  // Auto-Save System state
  lastSavedAt: Date | null;
  triggerManualSave: () => void;

  // Helper getters
  getComputedTransform: (partId: string, frame: number) => Transform;

  // Actions
  addKeyframeForSelected: () => void;
  addKeyframeToTrack: (trackId: string, frame: number) => void;
  deleteKeyframe: (trackId: string, keyframeId: string) => void;
  updateKeyframeFrame: (trackId: string, keyframeId: string, newFrame: number) => void;
  updateKeyframeEasing: (trackId: string, keyframeId: string, easing: EasingType) => void;
  updateCurrentTransform: (newTransform: Partial<Transform>) => void;
  applyPresetPose: (poseId: string) => void;
  toggleTrackVisibility: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;
  exportProject: () => string;
  importProject: (jsonStr: string) => boolean;
  resetProject: () => void;
}

const AnimatorContext = createContext<AnimatorContextType | null>(null);

export const AnimatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(30);
  const [totalFrames, setTotalFrames] = useState<number>(60);
  const [isLooping, setIsLooping] = useState<boolean>(true);

  const [selectedPartId, setSelectedPartId] = useState<string | null>('head');
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>('track_head');
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>('select');

  const [tracks, setTracks] = useState<Track[]>(DEFAULT_TRACKS);
  const [characterParts, setCharacterParts] = useState<CharacterPart[]>(DEFAULT_CHARACTER_PARTS);

  const [timelineZoom, setTimelineZoom] = useState<number>(18); // px per frame
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  // 1. Initial Load: Restore from LocalStorage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
      if (saved) {
        const parsed: AnimationProject & { lastSavedTime?: string } = JSON.parse(saved);
        if (parsed.tracks && parsed.characterParts) {
          setTracks(parsed.tracks);
          setCharacterParts(parsed.characterParts);
          if (parsed.fps) setFps(parsed.fps);
          if (parsed.totalFrames) setTotalFrames(parsed.totalFrames);
          setLastSavedAt(parsed.lastSavedTime ? new Date(parsed.lastSavedTime) : new Date());
          console.log('[AutoSave] Previous session restored from LocalStorage');
        }
      }
    } catch (e) {
      console.warn('[AutoSave] Failed to restore saved state', e);
    }
  }, []);

  // 2. Auto-Save System: Every 10 Seconds
  const performSave = useCallback(() => {
    try {
      const projectData = {
        name: 'Unreal 2D Character Sequence',
        fps,
        totalFrames,
        tracks,
        characterParts,
        lastSavedTime: new Date().toISOString(),
      };
      localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(projectData));
      setLastSavedAt(new Date());
    } catch (e) {
      console.error('[AutoSave] Failed to save project to LocalStorage', e);
    }
  }, [fps, totalFrames, tracks, characterParts]);

  useEffect(() => {
    const timer = setInterval(() => {
      performSave();
    }, 10000); // 10 seconds auto-save interval

    return () => clearInterval(timer);
  }, [performSave]);

  const triggerManualSave = () => {
    performSave();
  };

  // Calculate position/rotation at given frame using interpolation
  const getComputedTransform = useCallback(
    (partId: string, frame: number): Transform => {
      const part = characterParts.find((p) => p.id === partId);
      const baseTransform = part ? part.baseTransform : { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

      const track = tracks.find((t) => t.partId === partId);
      if (!track || track.keyframes.length === 0) {
        return baseTransform;
      }

      const sortedKfs = [...track.keyframes].sort((a, b) => a.frame - b.frame);

      const exact = sortedKfs.find((k) => k.frame === frame);
      if (exact) return exact.transform;

      if (frame <= sortedKfs[0].frame) {
        return sortedKfs[0].transform;
      }

      if (frame >= sortedKfs[sortedKfs.length - 1].frame) {
        return sortedKfs[sortedKfs.length - 1].transform;
      }

      let prevKf = sortedKfs[0];
      let nextKf = sortedKfs[sortedKfs.length - 1];

      for (let i = 0; i < sortedKfs.length - 1; i++) {
        if (frame >= sortedKfs[i].frame && frame <= sortedKfs[i + 1].frame) {
          prevKf = sortedKfs[i];
          nextKf = sortedKfs[i + 1];
          break;
        }
      }

      const duration = nextKf.frame - prevKf.frame;
      const progress = (frame - prevKf.frame) / duration;
      return interpolateTransform(prevKf.transform, nextKf.transform, progress, prevKf.easing);
    },
    [characterParts, tracks]
  );

  // Playback Loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    const frameInterval = 1000 / fps;

    const tick = (now: number) => {
      const delta = now - lastTimeRef.current;
      if (delta >= frameInterval) {
        lastTimeRef.current = now - (delta % frameInterval);
        setCurrentFrame((prev) => {
          if (prev >= totalFrames) {
            if (isLooping) return 0;
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    lastTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, fps, totalFrames, isLooping]);

  // Keyframe & Track Actions
  const addKeyframeToTrack = (trackId: string, frame: number) => {
    setTracks((prevTracks) =>
      prevTracks.map((tr) => {
        if (tr.id !== trackId) return tr;
        const currentTransform = getComputedTransform(tr.partId, frame);
        const existingIdx = tr.keyframes.findIndex((k) => k.frame === frame);

        const newKf: Keyframe = {
          id: `kf_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          frame,
          transform: { ...currentTransform },
          easing: 'easeInOut',
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
    let track = tracks.find((t) => t.partId === selectedPartId);
    if (!track) {
      const part = characterParts.find((p) => p.id === selectedPartId);
      const newTrack: Track = {
        id: `track_${selectedPartId}`,
        partId: selectedPartId,
        name: `${part?.name || selectedPartId} Track`,
        color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        visible: true,
        locked: false,
        keyframes: [],
      };
      setTracks((prev) => [...prev, newTrack]);
      track = newTrack;
    }
    addKeyframeToTrack(track.id, currentFrame);
  };

  const deleteKeyframe = (trackId: string, keyframeId: string) => {
    setTracks((prev) =>
      prev.map((tr) => (tr.id === trackId ? { ...tr, keyframes: tr.keyframes.filter((k) => k.id !== keyframeId) } : tr))
    );
    if (selectedKeyframeId === keyframeId) setSelectedKeyframeId(null);
  };

  const updateKeyframeFrame = (trackId: string, keyframeId: string, newFrame: number) => {
    const clampedFrame = Math.max(0, Math.min(totalFrames, newFrame));
    setTracks((prev) =>
      prev.map((tr) => {
        if (tr.id !== trackId) return tr;
        const newKfs = tr.keyframes.map((k) => (k.id === keyframeId ? { ...k, frame: clampedFrame } : k));
        newKfs.sort((a, b) => a.frame - b.frame);
        return { ...tr, keyframes: newKfs };
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

  const updateCurrentTransform = (newTransform: Partial<Transform>) => {
    if (!selectedPartId) return;

    let track = tracks.find((t) => t.partId === selectedPartId);

    if (!track) {
      const part = characterParts.find((p) => p.id === selectedPartId);
      const newTrack: Track = {
        id: `track_${selectedPartId}`,
        partId: selectedPartId,
        name: `${part?.name || selectedPartId} Track`,
        color: '#00d2ff',
        visible: true,
        locked: false,
        keyframes: [],
      };
      track = newTrack;
      setTracks((prev) => [...prev, newTrack]);
    }

    const currentComp = getComputedTransform(selectedPartId, currentFrame);
    const updatedTransform: Transform = { ...currentComp, ...newTransform };

    setTracks((prevTracks) =>
      prevTracks.map((tr) => {
        if (tr.partId !== selectedPartId) return tr;
        const kfIdx = tr.keyframes.findIndex((k) => k.frame === currentFrame);
        let updatedKfs = [...tr.keyframes];

        if (kfIdx >= 0) {
          updatedKfs[kfIdx] = {
            ...updatedKfs[kfIdx],
            transform: updatedTransform,
          };
        } else {
          updatedKfs.push({
            id: `kf_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            frame: currentFrame,
            transform: updatedTransform,
            easing: 'easeInOut',
          });
          updatedKfs.sort((a, b) => a.frame - b.frame);
        }
        return { ...tr, keyframes: updatedKfs };
      })
    );
  };

  const applyPresetPose = (poseId: string) => {
    const pose = PRESET_POSES.find((p) => p.id === poseId);
    if (!pose) return;

    Object.entries(pose.transforms).forEach(([partId, transform]) => {
      const current = getComputedTransform(partId, currentFrame);
      const updated = { ...current, ...transform };

      setTracks((prev) =>
        prev.map((tr) => {
          if (tr.partId !== partId) return tr;
          const idx = tr.keyframes.findIndex((k) => k.frame === currentFrame);
          let newKfs = [...tr.keyframes];
          if (idx >= 0) {
            newKfs[idx] = { ...newKfs[idx], transform: updated };
          } else {
            newKfs.push({
              id: `kf_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              frame: currentFrame,
              transform: updated,
              easing: 'easeInOut',
            });
            newKfs.sort((a, b) => a.frame - b.frame);
          }
          return { ...tr, keyframes: newKfs };
        })
      );
    });
  };

  const toggleTrackVisibility = (trackId: string) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, visible: !t.visible } : t)));
  };

  const toggleTrackLock = (trackId: string) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, locked: !t.locked } : t)));
  };

  const exportProject = (): string => {
    const project: AnimationProject = {
      name: 'Unreal 2D Character Sequence',
      fps,
      totalFrames,
      tracks,
      characterParts,
    };
    return JSON.stringify(project, null, 2);
  };

  const importProject = (jsonStr: string): boolean => {
    try {
      const parsed: AnimationProject = JSON.parse(jsonStr);
      if (parsed.tracks && parsed.characterParts) {
        setFps(parsed.fps || 30);
        setTotalFrames(parsed.totalFrames || 60);
        setTracks(parsed.tracks);
        setCharacterParts(parsed.characterParts);
        setCurrentFrame(0);
        performSave();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to parse project JSON', e);
      return false;
    }
  };

  const resetProject = () => {
    setTracks(DEFAULT_TRACKS);
    setCharacterParts(DEFAULT_CHARACTER_PARTS);
    setCurrentFrame(0);
    setIsPlaying(false);
    localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
    setLastSavedAt(null);
  };

  return (
    <AnimatorContext.Provider
      value={{
        currentFrame,
        setCurrentFrame,
        isPlaying,
        setIsPlaying,
        fps,
        setFps,
        totalFrames,
        setTotalFrames,
        isLooping,
        setIsLooping,
        selectedPartId,
        setSelectedPartId,
        selectedTrackId,
        setSelectedTrackId,
        selectedKeyframeId,
        setSelectedKeyframeId,
        activeTool,
        setActiveTool,
        tracks,
        setTracks,
        characterParts,
        setCharacterParts,
        timelineZoom,
        setTimelineZoom,
        showGrid,
        setShowGrid,
        lastSavedAt,
        triggerManualSave,
        getComputedTransform,
        addKeyframeForSelected,
        addKeyframeToTrack,
        deleteKeyframe,
        updateKeyframeFrame,
        updateKeyframeEasing,
        updateCurrentTransform,
        applyPresetPose,
        toggleTrackVisibility,
        toggleTrackLock,
        exportProject,
        importProject,
        resetProject,
      }}
    >
      {children}
    </AnimatorContext.Provider>
  );
};

export const useAnimator = () => {
  const ctx = useContext(AnimatorContext);
  if (!ctx) throw new Error('useAnimator must be used within an AnimatorProvider');
  return ctx;
};
