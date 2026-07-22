import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type {
  CharacterPart,
  BodyPartType,
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

const AUTOSAVE_STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

interface HistoryState {
  tracks: Track[];
  characterParts: CharacterPart[];
}

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

  // Undo / Redo History
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Helper getters
  getComputedTransform: (partId: string, frame: number) => Transform;

  // Actions
  addKeyframeForSelected: () => void;
  addKeyframeToTrack: (trackId: string, frame: number) => void;
  deleteKeyframe: (trackId: string, keyframeId: string) => void;
  updateKeyframeFrame: (trackId: string, keyframeId: string, newFrame: number) => void;
  updateKeyframeEasing: (trackId: string, keyframeId: string, easing: EasingType) => void;
  updateKeyframeBezierPoints: (trackId: string, keyframeId: string, points: [number, number, number, number]) => void;
  updateCurrentTransform: (newTransform: Partial<Transform>) => void;
  applyPresetPose: (poseId: string) => void;
  toggleTrackVisibility: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;
  exportProject: () => string;
  importProject: (jsonStr: string) => boolean;
  resetProject: () => void;
  addCustomPart: (type: BodyPartType, name: string, extraProps?: Partial<CharacterPart>) => void;
  deletePart: (partId: string) => void;
  applyMotionTransition: (partId: string, transitionType: string) => void;
}

const AnimatorContext = createContext<AnimatorContextType | null>(null);

export const AnimatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(30);
  const [totalFrames, setTotalFrames] = useState<number>(60);
  const [isLooping, setIsLooping] = useState<boolean>(true);

  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>('select');

  const [tracks, setTracks] = useState<Track[]>(DEFAULT_TRACKS);
  const [characterParts, setCharacterParts] = useState<CharacterPart[]>(DEFAULT_CHARACTER_PARTS);

  // Undo / Redo Stack State
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const isUndoRedoRef = useRef<boolean>(false);

  const [timelineZoom, setTimelineZoom] = useState<number>(18); // px per frame
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  // Record History Snapshot whenever tracks or characterParts change
  useEffect(() => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    const snap: HistoryState = {
      tracks: JSON.parse(JSON.stringify(tracks)),
      characterParts: JSON.parse(JSON.stringify(characterParts)),
    };
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed.slice(-30), snap];
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 30));
  }, [tracks, characterParts]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const targetState = history[prevIndex];
      if (targetState) {
        isUndoRedoRef.current = true;
        setTracks(JSON.parse(JSON.stringify(targetState.tracks)));
        setCharacterParts(JSON.parse(JSON.stringify(targetState.characterParts)));
        setHistoryIndex(prevIndex);
      }
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const targetState = history[nextIndex];
      if (targetState) {
        isUndoRedoRef.current = true;
        setTracks(JSON.parse(JSON.stringify(targetState.tracks)));
        setCharacterParts(JSON.parse(JSON.stringify(targetState.characterParts)));
        setHistoryIndex(nextIndex);
      }
    }
  }, [history, historyIndex]);

  // 1. Initial Load: Restore from LocalStorage if available (filtering legacy stickman)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
      if (saved) {
        const parsed: AnimationProject & { lastSavedTime?: string } = JSON.parse(saved);
        const hasLegacyStickman = parsed.characterParts?.some((p) => p.type === 'head' || p.type === 'torso');
        if (parsed.tracks && parsed.characterParts && !hasLegacyStickman) {
          setTracks(parsed.tracks);
          setCharacterParts(parsed.characterParts);
          if (parsed.fps) setFps(parsed.fps);
          if (parsed.totalFrames) setTotalFrames(parsed.totalFrames);
          setLastSavedAt(parsed.lastSavedTime ? new Date(parsed.lastSavedTime) : new Date());
        } else {
          // Clear legacy stickman data
          localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
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

  // Delete part directly without confirm
  const deletePart = useCallback((partId: string) => {
    setCharacterParts((prev) => prev.filter((p) => p.id !== partId));
    setTracks((prev) => prev.filter((t) => t.partId !== partId));
    if (selectedPartId === partId) {
      setSelectedPartId(null);
    }
  }, [selectedPartId]);

  // Global Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Backspace/Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputActive =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable);

      if (isInputActive) return;

      // Undo: Ctrl + Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Redo: Ctrl + Y or Ctrl + Shift + Z
      else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        redo();
      }
      // Instant Delete without alert modal on Backspace or Delete
      else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedPartId) {
          e.preventDefault();
          deletePart(selectedPartId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPartId, deletePart, undo, redo]);

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
      return interpolateTransform(prevKf.transform, nextKf.transform, progress, prevKf.easing, prevKf.bezierControlPoints);
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
    setTracks((prev) =>
      prev.map((tr) => {
        if (tr.id !== trackId) return tr;
        return {
          ...tr,
          keyframes: tr.keyframes.map((k) =>
            k.id === keyframeId ? { ...k, easing: 'cubic_bezier', bezierControlPoints: points } : k
          ),
        };
      })
    );
  };

  const updateCurrentTransform = (newTransform: Partial<Transform>) => {
    if (!selectedPartId) return;
    const track = tracks.find((t) => t.partId === selectedPartId);
    if (!track) return;

    const existingKf = track.keyframes.find((k) => k.frame === currentFrame);

    if (existingKf) {
      setTracks((prev) =>
        prev.map((tr) => {
          if (tr.id !== track.id) return tr;
          return {
            ...tr,
            keyframes: tr.keyframes.map((k) =>
              k.frame === currentFrame ? { ...k, transform: { ...k.transform, ...newTransform } } : k
            ),
          };
        })
      );
    } else if (track.keyframes.length > 0) {
      setCharacterParts((prev) =>
        prev.map((p) =>
          p.id === selectedPartId ? { ...p, baseTransform: { ...p.baseTransform, ...newTransform } } : p
        )
      );
      addKeyframeToTrack(track.id, currentFrame);
    } else {
      setCharacterParts((prev) =>
        prev.map((p) =>
          p.id === selectedPartId ? { ...p, baseTransform: { ...p.baseTransform, ...newTransform } } : p
        )
      );
    }
  };

  const applyPresetPose = (poseId: string) => {
    const pose = PRESET_POSES.find((p) => p.id === poseId);
    if (!pose) return;

    Object.entries(pose.transforms).forEach(([partId, transform]) => {
      const track = tracks.find((t) => t.partId === partId);
      if (track) {
        setTracks((prevTracks) =>
          prevTracks.map((tr) => {
            if (tr.partId !== partId) return tr;
            const currentT = getComputedTransform(partId, currentFrame);
            const updatedT = { ...currentT, ...transform };
            const existingIdx = tr.keyframes.findIndex((k) => k.frame === currentFrame);

            let newKfs = [...tr.keyframes];
            if (existingIdx >= 0) {
              newKfs[existingIdx] = { ...newKfs[existingIdx], transform: updatedT };
            } else {
              newKfs.push({
                id: `kf_${Date.now()}_${partId}`,
                frame: currentFrame,
                transform: updatedT,
                easing: 'easeInOut',
              });
              newKfs.sort((a, b) => a.frame - b.frame);
            }
            return { ...tr, keyframes: newKfs };
          })
        );
      }
    });
  };

  const toggleTrackVisibility = (trackId: string) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, visible: !t.visible } : t)));
  };

  const toggleTrackLock = (trackId: string) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, locked: !t.locked } : t)));
  };

  const applyMotionTransition = (partId: string, transitionType: string) => {
    const track = tracks.find((t) => t.partId === partId);
    if (!track) return;

    const startFrame = currentFrame;
    const duration = 15;
    const endFrame = Math.min(totalFrames, startFrame + duration);
    const baseTransform = getComputedTransform(partId, startFrame);

    let startTransform: Transform = { ...baseTransform };
    let endTransform: Transform = { ...baseTransform };
    let easing: EasingType = 'easeOut';

    switch (transitionType) {
      case 'none':
        setTracks((prev) =>
          prev.map((t) => (t.id === track.id ? { ...t, keyframes: [] } : t))
        );
        return;
      case 'move_left':
        startTransform.x = baseTransform.x + 250;
        startTransform.opacity = 0;
        endTransform.opacity = 1;
        break;
      case 'move_right':
        startTransform.x = baseTransform.x - 250;
        startTransform.opacity = 0;
        endTransform.opacity = 1;
        break;
      case 'move_down':
        startTransform.y = baseTransform.y - 200;
        startTransform.opacity = 0;
        endTransform.opacity = 1;
        break;
      case 'move_up':
        startTransform.y = baseTransform.y + 200;
        startTransform.opacity = 0;
        endTransform.opacity = 1;
        break;
      case 'fade':
        startTransform.opacity = 0;
        endTransform.opacity = 1;
        break;
      case 'flash':
        startTransform.scaleX = 0.1;
        startTransform.scaleY = 0.1;
        startTransform.opacity = 0;
        endTransform.opacity = 1;
        easing = 'overshoot';
        break;
      case 'spin':
        startTransform.rotation = baseTransform.rotation - 360;
        startTransform.opacity = 0;
        endTransform.opacity = 1;
        break;
      case 'bounce':
        startTransform.y = baseTransform.y - 180;
        startTransform.opacity = 0;
        endTransform.opacity = 1;
        easing = 'bounce';
        break;
    }

    const kfStart: Keyframe = {
      id: `kf_${track.id}_${startFrame}_${Date.now()}`,
      frame: startFrame,
      transform: startTransform,
      easing,
    };

    const kfEnd: Keyframe = {
      id: `kf_${track.id}_${endFrame}_${Date.now() + 1}`,
      frame: endFrame,
      transform: endTransform,
      easing: 'linear',
    };

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
        setTracks(parsed.tracks);
        setCharacterParts(parsed.characterParts);
        if (parsed.fps) setFps(parsed.fps);
        if (parsed.totalFrames) setTotalFrames(parsed.totalFrames);
        return true;
      }
      return false;
    } catch {
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

  const addCustomPart = (type: BodyPartType, name: string, extraProps?: Partial<CharacterPart>) => {
    const partId = `part_${type}_${Date.now()}`;
    const colors = ['#00d2ff', '#ffb700', '#ff3366', '#a855f7', '#10b981', '#ff7b00', '#ec4899'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newPart: CharacterPart = {
      id: partId,
      name,
      type,
      zIndex: characterParts.length + 1,
      fillColor: randomColor,
      strokeColor: '#101218',
      pivot: { x: 0.5, y: 0.5 },
      parentId: selectedPartId || 'torso',
      baseTransform: { x: 300, y: 240, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      textValue: type === 'custom_text' ? 'NEW TEXT' : type === 'custom_banner' ? 'CARD LABEL' : undefined,
      fontSize: 20,
      cardCategory: type === 'custom_card' ? 'STUDIO CARD' : undefined,
      cardTitle: type === 'custom_card' ? 'MOTION GRAPHIC' : undefined,
      cardButtonText: type === 'custom_card' ? 'ACTIVE' : undefined,
      ...extraProps,
    };

    const newTrack: Track = {
      id: `track_${partId}`,
      partId,
      name: `${name} Track`,
      color: randomColor,
      visible: true,
      locked: false,
      keyframes: [], // UE5 Sequencer workflow: 0 auto keyframes on creation
    };

    setCharacterParts((prev) => [...prev, newPart]);
    setTracks((prev) => [...prev, newTrack]);
    setSelectedPartId(partId);
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
        undo,
        redo,
        canUndo,
        canRedo,
        getComputedTransform,
        addKeyframeForSelected,
        addKeyframeToTrack,
        deleteKeyframe,
        updateKeyframeFrame,
        updateKeyframeEasing,
        updateKeyframeBezierPoints,
        updateCurrentTransform,
        applyPresetPose,
        toggleTrackVisibility,
        toggleTrackLock,
        exportProject,
        importProject,
        resetProject,
        addCustomPart,
        deletePart,
        applyMotionTransition,
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
