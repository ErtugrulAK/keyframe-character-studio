import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { ToastPortal } from '../components/Toast/ToastPortal';
import type {
  CharacterPart,
  BodyPartType,
  Track,
  Keyframe,
  Transform,
  ToolType,
  EasingType,
  AnimationProject,
  TrackChannel,
  PropertyKeyframe,
  AppMode,
  BroadcastObjectState,
} from '../types/animator';
import {
  DEFAULT_CHARACTER_PARTS,
  DEFAULT_TRACKS,
  PRESET_POSES,
  interpolateTransform,
  makeEmptyChannels,
  interpolateChannel,
} from '../utils/defaults';

const AUTOSAVE_STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

/** Ensure legacy tracks (without channels) get empty channels injected */
function migrateTrack(t: Track): Track {
  return {
    ...t,
    channels: t.channels ?? makeEmptyChannels(),
    expanded: t.expanded ?? false,
  };
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

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
  projectResolution: { width: number; height: number };
  setProjectResolution: React.Dispatch<React.SetStateAction<{ width: number; height: number }>>;

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
  toggleTrackExpanded: (trackId: string) => void;
  exportProject: () => string;
  importProject: (jsonStr: string) => boolean;
  resetProject: () => void;
  addCustomPart: (type: BodyPartType, name: string, extraProps?: Partial<CharacterPart>) => void;
  deletePart: (partId: string) => void;
  applyMotionTransition: (partId: string, transitionType: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  addPropertyKeyframe: (trackId: string, channel: TrackChannel, frame: number, value: number, easing?: EasingType) => void;
  deletePropertyKeyframe: (trackId: string, channel: TrackChannel, keyframeId: string) => void;
  updatePropertyKeyframeFrame: (trackId: string, channel: TrackChannel, keyframeId: string, newFrame: number) => void;

  // Broadcast Mode
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  broadcastState: Record<string, BroadcastObjectState>;
  triggerBroadcastIn: (partId: string) => void;
  triggerBroadcastOut: (partId: string) => void;
  resetBroadcastState: () => void;
}

const AnimatorContext = createContext<AnimatorContextType | null>(null);

export const AnimatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(30);
  const [totalFrames, setTotalFramesState] = useState<number>(60);

  const setTotalFrames = useCallback((newTotal: number | ((prev: number) => number)) => {
    setTotalFramesState((prev) => {
      const val = typeof newTotal === 'function' ? newTotal(prev) : newTotal;
      const clamped = Math.max(10, Math.min(1200, Math.round(val)));
      setCurrentFrame((cf) => Math.min(cf, clamped));
      return clamped;
    });
  }, []);

  const [isLooping, setIsLooping] = useState<boolean>(true);

  // Broadcast Mode State
  const [appMode, setAppMode] = useState<AppMode>('edit');
  const [broadcastState, setBroadcastState] = useState<Record<string, BroadcastObjectState>>({});

  const resetBroadcastState = useCallback(() => {
    setBroadcastState({});
  }, []);

  const triggerBroadcastIn = useCallback((partId: string) => {
    setBroadcastState(prev => ({
      ...prev,
      [partId]: { state: 'animating_in', progress: 0 }
    }));
  }, []);

  const triggerBroadcastOut = useCallback((partId: string) => {
    setBroadcastState(prev => {
      const current = prev[partId];
      if (current && current.state === 'hidden') return prev; // Cannot play out if hidden
      return {
        ...prev,
        [partId]: { state: 'animating_out', progress: 0 }
      };
    });
  }, []);

  // Broadcast Loop
  const broadcastLastTimeRef = useRef<number>(performance.now());
  const broadcastReqRef = useRef<number | null>(null);

  useEffect(() => {
    if (appMode !== 'broadcast') {
      if (broadcastReqRef.current) cancelAnimationFrame(broadcastReqRef.current);
      return;
    }

    broadcastLastTimeRef.current = performance.now();

    const loop = (time: number) => {
      const dtMs = time - broadcastLastTimeRef.current;
      broadcastLastTimeRef.current = time;

      // Update progress for animating objects
      setBroadcastState(prev => {
        let changed = false;
        const nextState = { ...prev };

        // We need access to characterParts to know their animation durations
        // However, accessing characterParts directly in a state updater is tricky without it being in dependency array.
        // We will assume 30 frames duration at 60fps = 500ms by default, 
        // but we should ideally calculate progress based on exact duration.
        // For simplicity, we convert dtMs to progress increment.
        
        Object.entries(nextState).forEach(([id, st]) => {
          if (st.state === 'animating_in' || st.state === 'animating_out') {
            changed = true;
            // Assumed default duration is 30 frames (0.5s at 60fps)
            // Progress per ms = 1 / 500ms
            const progressDelta = dtMs / 500;
            const newProgress = Math.min(1, st.progress + progressDelta);
            
            if (newProgress >= 1) {
              nextState[id] = {
                state: st.state === 'animating_in' ? 'visible' : 'hidden',
                progress: 1
              };
            } else {
              nextState[id] = { ...st, progress: newProgress };
            }
          }
        });

        return changed ? nextState : prev;
      });

      broadcastReqRef.current = requestAnimationFrame(loop);
    };

    broadcastReqRef.current = requestAnimationFrame(loop);

    return () => {
      if (broadcastReqRef.current) cancelAnimationFrame(broadcastReqRef.current);
    };
  }, [appMode]);

  const [projectResolution, setProjectResolution] = useState<{ width: number; height: number }>({ width: 1920, height: 1080 });

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
          if (parsed.projectResolution) setProjectResolution(parsed.projectResolution);
          setTracks(parsed.tracks.map(migrateTrack));
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
        projectResolution,
        tracks,
        characterParts,
        lastSavedTime: new Date().toISOString(),
      };
      localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(projectData));
      setLastSavedAt(new Date());
    } catch (e) {
      console.error('[AutoSave] Failed to save project to LocalStorage', e);
    }
  }, [fps, totalFrames, projectResolution, tracks, characterParts]);

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
  // Channels take priority over legacy composite keyframes when populated
  const getComputedTransform = useCallback(
    (partId: string, frame: number): Transform => {
      const part = characterParts.find((p) => p.id === partId);
      const baseTransform = part ? part.baseTransform : { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

      const track = tracks.find((t) => t.partId === partId);
      if (!track) return baseTransform;

      const rawTransform = (() => {
        const ch = track.channels;
        const hasChannelData = ch && Object.values(ch).some((arr: any) => arr.length > 0);

        if (hasChannelData) {
          const legacyTransform: Transform = (() => {
            if (!track.keyframes || track.keyframes.length === 0) return baseTransform;
            const sorted = [...track.keyframes].sort((a, b) => a.frame - b.frame);
            const exact = sorted.find((k) => k.frame === frame);
            if (exact) return exact.transform;
            if (frame <= sorted[0].frame) return sorted[0].transform;
            if (frame >= sorted[sorted.length - 1].frame) return sorted[sorted.length - 1].transform;
            let prev = sorted[0]; let next = sorted[sorted.length - 1];
            for (let i = 0; i < sorted.length - 1; i++) {
              if (frame >= sorted[i].frame && frame <= sorted[i + 1].frame) { prev = sorted[i]; next = sorted[i + 1]; break; }
            }
            const dur = next.frame - prev.frame;
            const prog = (frame - prev.frame) / dur;
            return interpolateTransform(prev.transform, next.transform, prog, prev.easing, prev.bezierControlPoints);
          })();

          return {
            x:        ch.x.length > 0        ? interpolateChannel(ch.x,        frame, legacyTransform.x)        : legacyTransform.x,
            y:        ch.y.length > 0        ? interpolateChannel(ch.y,        frame, legacyTransform.y)        : legacyTransform.y,
            rotation: ch.rotation.length > 0 ? interpolateChannel(ch.rotation, frame, legacyTransform.rotation) : legacyTransform.rotation,
            scaleX:   ch.scaleX.length > 0   ? interpolateChannel(ch.scaleX,   frame, legacyTransform.scaleX)   : legacyTransform.scaleX,
            scaleY:   ch.scaleY.length > 0   ? interpolateChannel(ch.scaleY,   frame, legacyTransform.scaleY)   : legacyTransform.scaleY,
            opacity:  ch.opacity.length > 0  ? interpolateChannel(ch.opacity,  frame, legacyTransform.opacity)  : legacyTransform.opacity,
          };
        }

        if (!track.keyframes || track.keyframes.length === 0) return baseTransform;

        const sortedKfs = [...track.keyframes].sort((a, b) => a.frame - b.frame);
        const exact = sortedKfs.find((k) => k.frame === frame);
        if (exact) return exact.transform;
        if (frame <= sortedKfs[0].frame) return sortedKfs[0].transform;
        if (frame >= sortedKfs[sortedKfs.length - 1].frame) return sortedKfs[sortedKfs.length - 1].transform;

        let prevKf = sortedKfs[0];
        let nextKf = sortedKfs[sortedKfs.length - 1];
        for (let i = 0; i < sortedKfs.length - 1; i++) {
          if (frame >= sortedKfs[i].frame && frame <= sortedKfs[i + 1].frame) {
            prevKf = sortedKfs[i]; nextKf = sortedKfs[i + 1]; break;
          }
        }
        const duration = nextKf.frame - prevKf.frame;
        const progress = (frame - prevKf.frame) / duration;
        return interpolateTransform(prevKf.transform, nextKf.transform, progress, prevKf.easing, prevKf.bezierControlPoints);
      })();

      // Feature 2: Responsive Anchor Point Resolution
      if (part && part.anchor && part.anchor !== 'none') {
        const ox = part.anchorOffsetX ?? 0;
        const oy = part.anchorOffsetY ?? 0;
        let ax = 300;
        let ay = 240;
        switch (part.anchor) {
          case 'top-left':      ax = 50;  ay = 50;  break;
          case 'top-center':    ax = 300; ay = 50;  break;
          case 'top-right':     ax = 550; ay = 50;  break;
          case 'center-left':   ax = 50;  ay = 240; break;
          case 'center':        ax = 300; ay = 240; break;
          case 'center-right':  ax = 550; ay = 240; break;
          case 'bottom-left':   ax = 50;  ay = 430; break;
          case 'bottom-center': ax = 300; ay = 430; break;
          case 'bottom-right':  ax = 550; ay = 430; break;
        }
        return {
          ...rawTransform,
          x: ax + ox,
          y: ay + oy,
        };
      }

      return rawTransform;
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
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        const ch = t.channels ?? makeEmptyChannels();
        const existing = ch[channel].find((k) => k.frame === frame);
        const newKf: PropertyKeyframe = {
          id: `pkf_${channel}_${frame}_${Date.now()}`,
          frame,
          value,
          easing,
        };
        const updated = existing
          ? ch[channel].map((k) => (k.frame === frame ? { ...k, value, easing } : k))
          : [...ch[channel], newKf].sort((a, b) => a.frame - b.frame);
        return { ...t, channels: { ...ch, [channel]: updated } };
      })
    );
  };

  const deletePropertyKeyframe = (trackId: string, channel: TrackChannel, keyframeId: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        const ch = t.channels ?? makeEmptyChannels();
        return { ...t, channels: { ...ch, [channel]: ch[channel].filter((k) => k.id !== keyframeId) } };
      })
    );
  };

  const updatePropertyKeyframeFrame = (trackId: string, channel: TrackChannel, keyframeId: string, newFrame: number) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        const ch = t.channels ?? makeEmptyChannels();
        const updated = ch[channel].map((k) => (k.id === keyframeId ? { ...k, frame: newFrame } : k)).sort((a, b) => a.frame - b.frame);
        return { ...t, channels: { ...ch, [channel]: updated } };
      })
    );
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
      projectResolution,
      tracks,
      characterParts,
    };
    return JSON.stringify(project, null, 2);
  };

  const importProject = (jsonStr: string): boolean => {
    try {
      const parsed: AnimationProject = JSON.parse(jsonStr);
      if (parsed.tracks && parsed.characterParts) {
        if (parsed.projectResolution) setProjectResolution(parsed.projectResolution);
        setTracks(parsed.tracks.map(migrateTrack));
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
      strokeProgress: 1,
      anchor: 'none',
      anchorOffsetX: 0,
      anchorOffsetY: 0,
      clonerConfig: type === 'mograph_cloner' ? {
        mode: 'grid',
        countX: 4,
        countY: 3,
        spacingX: 45,
        spacingY: 45,
        countCircle: 8,
        radius: 70,
        countLinear: 6,
        spacingLinear: 40,
        childShape: 'circle',
        childSize: 12,
        childColor: randomColor,
        childStroke: '#ffffff',
        childStrokeWidth: 1.5,
        effector: 'wave',
        waveSpeed: 1.5,
        waveAmplitude: 15,
        waveAxis: 'y',
        randomSeed: 42,
        randomAmplitude: 10,
        stepPhase: 0,
      } : undefined,
      particleConfig: type === 'particle_system' ? {
        count: 40,
        shape: 'dot',
        minSize: 3,
        maxSize: 8,
        color: randomColor,
        minOpacity: 0.2,
        maxOpacity: 0.85,
        speed: 35,
        direction: 'up',
        spread: 300,
        loop: true,
        fadeIn: true,
        fadeOut: true,
        randomSeed: 123,
      } : undefined,
      ...extraProps,
    };

    const newTrack: Track = {
      id: `track_${partId}`,
      partId,
      name: `${name} Track`,
      color: randomColor,
      visible: true,
      locked: false,
      expanded: false,
      keyframes: [],
      channels: makeEmptyChannels(),
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
        projectResolution,
        setProjectResolution,
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
        toggleTrackExpanded,
        exportProject,
        importProject,
        resetProject,
        addCustomPart,
        deletePart,
        applyMotionTransition,
        showToast,
        addPropertyKeyframe,
        deletePropertyKeyframe,
        updatePropertyKeyframeFrame,
        appMode,
        setAppMode,
        broadcastState,
        triggerBroadcastIn,
        triggerBroadcastOut,
        resetBroadcastState,
      }}
    >
      {children}

      {/* Floating Glassmorphism Toast Notification Portal */}
      <ToastPortal toasts={toasts} removeToast={removeToast} />
    </AnimatorContext.Provider>
  );
};

export const useAnimator = () => {
  const ctx = useContext(AnimatorContext);
  if (!ctx) throw new Error('useAnimator must be used within an AnimatorProvider');
  return ctx;
};
