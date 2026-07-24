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
  CustomMotionPreset,
  CustomMotionPresetKeyframe,
  LiveStuntType,
} from '../types/animator';
import {
  DEFAULT_CHARACTER_PARTS,
  DEFAULT_TRACKS,
  PRESET_POSES,
  interpolateTransform,
  makeEmptyChannels,
  interpolateChannel,
} from '../utils/defaults';
import { DEFAULT_INITIAL_PRESETS, SAMPLE_SEQUENCER_PROJECT } from './initialStateData';

const AUTOSAVE_STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

/** Ensure legacy tracks (without channels) get empty channels injected */
function migrateTrack(t: Track): Track {
  return {
    ...t,
    channels: t.channels ?? makeEmptyChannels(),
    expanded: t.expanded ?? false,
    editVisible: t.editVisible ?? true,
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
  toggleTrackEditVisibility: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;
  toggleTrackExpanded: (trackId: string) => void;
  exportProject: () => string;
  importProject: (jsonStr: string) => boolean;
  resetProject: () => void;
  addCustomPart: (type: BodyPartType, name: string, extraProps?: Partial<CharacterPart>) => void;
  updatePartMedia: (partId: string, url: string, type: 'image' | 'video') => void;
  renamePartAndTrack: (partId: string, newName: string) => void;
  deletePart: (partId: string) => void;
  copySelectedPart: () => void;
  pasteCopiedPart: () => void;
  duplicateSelectedPart: () => void;
  applyMotionTransition: (partId: string, transitionType: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  addPropertyKeyframe: (trackId: string, channel: TrackChannel, frame: number, value: number, easing?: EasingType) => void;
  deletePropertyKeyframe: (trackId: string, channel: TrackChannel, keyframeId: string) => void;
  updatePropertyKeyframeFrame: (trackId: string, channel: TrackChannel, keyframeId: string, newFrame: number) => void;

  // Broadcast Mode & Custom Presets
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  broadcastState: Record<string, BroadcastObjectState>;
  triggerBroadcastIn: (partId: string) => void;
  triggerBroadcastOut: (partId: string) => void;
  triggerAllBroadcastIn: () => void;
  triggerAllBroadcastOut: () => void;
  resetBroadcastState: () => void;

  // Custom Motion Preset Engine & Sample Loader
  customPresets: CustomMotionPreset[];
  saveTrackAsPreset: (partId: string, name: string, type: 'in' | 'out' | 'stunt', startFrame?: number, endFrame?: number) => void;
  deleteCustomPreset: (presetId: string) => void;
  loadSampleSequencerProject: () => void;

  // Realtime Live Stunts Engine
  liveStuntsState: Record<string, { stunt: LiveStuntType; progress: number; loop?: boolean; customPresetId?: string }>;
  triggerLiveStunt: (partId: string, stunt: LiveStuntType, loop?: boolean, customPresetId?: string) => void;
  stopLiveStunt: (partId: string) => void;
  setStuntLoopState: (loop: boolean) => void;
  stopAllLiveStunts: () => void;
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
  const [tracks, setTracks] = useState<Track[]>(DEFAULT_TRACKS);
  const [characterParts, setCharacterParts] = useState<CharacterPart[]>(DEFAULT_CHARACTER_PARTS);

  const characterPartsRef = useRef(characterParts);
  useEffect(() => { characterPartsRef.current = characterParts; }, [characterParts]);

  const tracksRef = useRef(tracks);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);

  const [customPresets, setCustomPresets] = useState<CustomMotionPreset[]>(() => {
    try {
      const saved = localStorage.getItem('keyframe_custom_motion_presets');
      return saved ? JSON.parse(saved) : DEFAULT_INITIAL_PRESETS;
    } catch {
      return DEFAULT_INITIAL_PRESETS;
    }
  });

  const customPresetsRef = useRef(customPresets);
  useEffect(() => { customPresetsRef.current = customPresets; }, [customPresets]);

  useEffect(() => {
    try {
      localStorage.setItem('keyframe_custom_motion_presets', JSON.stringify(customPresets));
    } catch { }
  }, [customPresets]);

  // Broadcast Mode State
  const [appMode, setAppMode] = useState<AppMode>('edit');
  const [broadcastState, setBroadcastState] = useState<Record<string, BroadcastObjectState>>({});

  const resetBroadcastState = useCallback(() => {
    setBroadcastState({});
  }, []);

  const triggerBroadcastIn = useCallback((partId: string) => {
    const track = tracksRef.current.find(t => t.partId === partId);
    if (track && track.visible === false) {
      showToast('Layer is hidden via eye icon on timeline (muted from broadcast)', 'info');
      return;
    }
    setBroadcastState(prev => ({
      ...prev,
      [partId]: { state: 'animating_in', progress: 0 }
    }));
  }, [showToast]);

  const triggerBroadcastOut = useCallback((partId: string) => {
    setBroadcastState(prev => ({
      ...prev,
      [partId]: { state: 'animating_out', progress: 0 }
    }));
  }, []);

  const triggerAllBroadcastIn = useCallback(() => {
    const nextState: Record<string, BroadcastObjectState> = {};
    characterPartsRef.current.forEach(p => {
      const track = tracksRef.current.find(t => t.partId === p.id);
      if (!track || track.visible !== false) {
        nextState[p.id] = { state: 'animating_in', progress: 0 };
      }
    });
    setBroadcastState(nextState);
  }, []);

  const triggerAllBroadcastOut = useCallback(() => {
    setBroadcastState(prev => {
      const nextState = { ...prev };
      characterPartsRef.current.forEach(p => {
        if (nextState[p.id] && nextState[p.id].state !== 'hidden') {
          nextState[p.id] = { state: 'animating_out', progress: 0 };
        }
      });
      return nextState;
    });
  }, []);

  // Realtime Live Stunts Engine
  const [liveStuntsState, setLiveStuntsState] = useState<Record<string, { stunt: LiveStuntType; progress: number; loop?: boolean; customPresetId?: string }>>({});

  const triggerLiveStunt = useCallback((partId: string, stunt: LiveStuntType, loop?: boolean, customPresetId?: string) => {
    setLiveStuntsState(prev => ({
      ...prev,
      [partId]: { stunt, progress: 0, loop, customPresetId }
    }));
    showToast(`Triggered live stunt "${stunt.toUpperCase()}"${loop ? ' (LOOPING)' : ''}!`, 'success');
  }, [showToast]);

  const stopLiveStunt = useCallback((partId: string) => {
    setLiveStuntsState(prev => {
      const next = { ...prev };
      delete next[partId];
      return next;
    });
    showToast('Stopped live stunt', 'info');
  }, [showToast]);

  const setStuntLoopState = useCallback((loop: boolean) => {
    setLiveStuntsState(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        next[id] = { ...next[id], loop };
      });
      return next;
    });
    showToast(`Live stunt loop set to ${loop ? 'ON' : 'OFF'}`, 'info');
  }, [showToast]);

  const stopAllLiveStunts = useCallback(() => {
    setLiveStuntsState({});
    showToast('Stopped all live stunts', 'info');
  }, [showToast]);

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

      // Update progress for active live stunts
      setLiveStuntsState(prev => {
        let changed = false;
        const next = { ...prev };
        Object.entries(next).forEach(([id, item]) => {
          changed = true;
          let stuntDurMs = 800; // default built-in stunt duration 800ms
          if (item.customPresetId) {
            const cp = customPresetsRef.current.find(p => p.id === item.customPresetId);
            if (cp) {
              const durF = cp.durationFrames || 30;
              stuntDurMs = (durF / (fpsRef.current || 30)) * 1000;
            }
          }
          const deltaP = dtMs / Math.max(50, stuntDurMs);
          let newP = item.progress + deltaP;

          if (newP >= 1) {
            if (item.loop) {
              newP = newP % 1; // infinite loop reset
              next[id] = { ...item, progress: newP };
            } else {
              delete next[id]; // finished single-shot
            }
          } else {
            next[id] = { ...item, progress: newP };
          }
        });
        return changed ? next : prev;
      });

      // Update progress for animating objects
      setBroadcastState(prev => {
        let changed = false;
        const nextState = { ...prev };

        Object.entries(nextState).forEach(([id, st]) => {
          if (st.state === 'animating_in' || st.state === 'animating_out') {
            changed = true;
            const part = characterPartsRef.current.find(p => p.id === id);
            let durFrames = 30;
            if (part) {
              if (st.state === 'animating_in') {
                if (part.inAnimPreset === 'custom_timeline') {
                  durFrames = Math.max(1, (part.inAnimTimelineEnd || 30) - (part.inAnimTimelineStart || 0));
                } else {
                  durFrames = part.inAnimDuration || 30;
                }
              } else {
                if (part.outAnimPreset === 'custom_timeline') {
                  durFrames = Math.max(1, (part.outAnimTimelineEnd || 30) - (part.outAnimTimelineStart || 0));
                } else {
                  durFrames = part.outAnimDuration || 30;
                }
              }
            }
            const durMs = (durFrames / (fpsRef.current || 30)) * 1000;
            const progressDelta = dtMs / Math.max(50, durMs);
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

  const fpsRef = useRef(fps);
  useEffect(() => { fpsRef.current = fps; }, [fps]);

  // Undo / Redo Stack State
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const isUndoRedoRef = useRef<boolean>(false);

  const [timelineZoom, setTimelineZoom] = useState<number>(18); // px per frame
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  const historyIndexRef = useRef(historyIndex);
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);

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
      const trimmed = prev.slice(0, historyIndexRef.current + 1);
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
  }, [setTotalFrames]);

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

  const [clipboardData, setClipboardData] = useState<{ part: CharacterPart; track?: Track } | null>(null);

  const copySelectedPart = useCallback(() => {
    if (!selectedPartId) return;
    const part = characterParts.find((p) => p.id === selectedPartId);
    if (!part) return;
    const track = tracks.find((t) => t.partId === selectedPartId);
    setClipboardData({
      part: JSON.parse(JSON.stringify(part)),
      track: track ? JSON.parse(JSON.stringify(track)) : undefined,
    });
    showToast(`Copied "${part.name}" to clipboard`, 'info');
  }, [selectedPartId, characterParts, tracks, showToast]);

  const pasteCopiedPart = useCallback(() => {
    if (!clipboardData) return;
    const newPartId = `part_${clipboardData.part.type}_${Date.now()}`;
    const newPart: CharacterPart = {
      ...JSON.parse(JSON.stringify(clipboardData.part)),
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
      id: `track_${newPartId}`,
      partId: newPartId,
      name: newPart.name,
      color: '#3b82f6',
      keyframes: [],
      channels: { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [] },
      visible: true,
      locked: false,
      expanded: false,
    };

    if (clipboardData.track) {
      const clonedTrack: Track = JSON.parse(JSON.stringify(clipboardData.track));
      newTrack = {
        ...clonedTrack,
        id: `track_${newPartId}`,
        partId: newPartId,
        keyframes: clonedTrack.keyframes.map((k, idx) => ({
          ...k,
          id: `kf_${newPartId}_${k.frame}_${Date.now()}_${idx}`,
        })),
      };
      if (clonedTrack.channels) {
        newTrack.channels = {
          x: clonedTrack.channels.x.map((pk) => ({ ...pk, id: `pkf_x_${pk.frame}_${Date.now()}` })),
          y: clonedTrack.channels.y.map((pk) => ({ ...pk, id: `pkf_y_${pk.frame}_${Date.now()}` })),
          rotation: clonedTrack.channels.rotation.map((pk) => ({ ...pk, id: `pkf_rot_${pk.frame}_${Date.now()}` })),
          scaleX: clonedTrack.channels.scaleX.map((pk) => ({ ...pk, id: `pkf_sx_${pk.frame}_${Date.now()}` })),
          scaleY: clonedTrack.channels.scaleY.map((pk) => ({ ...pk, id: `pkf_sy_${pk.frame}_${Date.now()}` })),
          opacity: clonedTrack.channels.opacity.map((pk) => ({ ...pk, id: `pkf_op_${pk.frame}_${Date.now()}` })),
        };
      }
    }

    setCharacterParts((prev) => [...prev, newPart]);
    setTracks((prev) => [...prev, newTrack]);
    setSelectedPartId(newPartId);
    showToast(`Pasted "${newPart.name}"`, 'success');
  }, [clipboardData, characterParts, showToast]);

  const duplicateSelectedPart = useCallback(() => {
    if (!selectedPartId) return;
    const part = characterParts.find((p) => p.id === selectedPartId);
    if (!part) return;
    const track = tracks.find((t) => t.partId === selectedPartId);
    const newPartId = `part_${part.type}_${Date.now()}`;
    const newPart: CharacterPart = {
      ...JSON.parse(JSON.stringify(part)),
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
      id: `track_${newPartId}`,
      partId: newPartId,
      name: newPart.name,
      color: part.fillColor || '#3b82f6',
      keyframes: [],
      channels: { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [] },
      visible: true,
      locked: false,
      expanded: false,
    };

    if (track) {
      const clonedTrack: Track = JSON.parse(JSON.stringify(track));
      newTrack = {
        ...clonedTrack,
        id: `track_${newPartId}`,
        partId: newPartId,
        keyframes: clonedTrack.keyframes.map((k, idx) => ({
          ...k,
          id: `kf_${newPartId}_${k.frame}_${Date.now()}_${idx}`,
        })),
      };
      if (clonedTrack.channels) {
        newTrack.channels = {
          x: clonedTrack.channels.x.map((pk) => ({ ...pk, id: `pkf_x_${pk.frame}_${Date.now()}` })),
          y: clonedTrack.channels.y.map((pk) => ({ ...pk, id: `pkf_y_${pk.frame}_${Date.now()}` })),
          rotation: clonedTrack.channels.rotation.map((pk) => ({ ...pk, id: `pkf_rot_${pk.frame}_${Date.now()}` })),
          scaleX: clonedTrack.channels.scaleX.map((pk) => ({ ...pk, id: `pkf_sx_${pk.frame}_${Date.now()}` })),
          scaleY: clonedTrack.channels.scaleY.map((pk) => ({ ...pk, id: `pkf_sy_${pk.frame}_${Date.now()}` })),
          opacity: clonedTrack.channels.opacity.map((pk) => ({ ...pk, id: `pkf_op_${pk.frame}_${Date.now()}` })),
        };
      }
    }

    setCharacterParts((prev) => [...prev, newPart]);
    setTracks((prev) => [...prev, newTrack]);
    setSelectedPartId(newPartId);
    showToast(`Duplicated "${newPart.name}"`, 'success');
  }, [selectedPartId, characterParts, tracks, showToast]);

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
      // Copy: Ctrl + C
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedPartId) {
          e.preventDefault();
          copySelectedPart();
        }
      }
      // Paste: Ctrl + V
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteCopiedPart();
      }
      // Duplicate: Ctrl + D
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedPartId) {
          e.preventDefault();
          duplicateSelectedPart();
        }
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
  }, [selectedPartId, deletePart, undo, redo, copySelectedPart, pasteCopiedPart, duplicateSelectedPart]);

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
            x: ch.x.length > 0 ? interpolateChannel(ch.x, frame, legacyTransform.x) : legacyTransform.x,
            y: ch.y.length > 0 ? interpolateChannel(ch.y, frame, legacyTransform.y) : legacyTransform.y,
            rotation: ch.rotation.length > 0 ? interpolateChannel(ch.rotation, frame, legacyTransform.rotation) : legacyTransform.rotation,
            scaleX: ch.scaleX.length > 0 ? interpolateChannel(ch.scaleX, frame, legacyTransform.scaleX) : legacyTransform.scaleX,
            scaleY: ch.scaleY.length > 0 ? interpolateChannel(ch.scaleY, frame, legacyTransform.scaleY) : legacyTransform.scaleY,
            opacity: ch.opacity.length > 0 ? interpolateChannel(ch.opacity, frame, legacyTransform.opacity) : legacyTransform.opacity,
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

      let finalComputed = rawTransform;

      // Feature 2: Responsive Anchor Point Resolution
      if (part && part.anchor && part.anchor !== 'none') {
        const ox = part.anchorOffsetX ?? 0;
        const oy = part.anchorOffsetY ?? 0;
        let ax = 0;
        let ay = 0;
        switch (part.anchor) {
          case 'top-left': ax = -250; ay = -190; break;
          case 'top-center': ax = 0; ay = -190; break;
          case 'top-right': ax = 250; ay = -190; break;
          case 'center-left': ax = -250; ay = 0; break;
          case 'center': ax = 0; ay = 0; break;
          case 'center-right': ax = 250; ay = 0; break;
          case 'bottom-left': ax = -250; ay = 190; break;
          case 'bottom-center': ax = 0; ay = 190; break;
          case 'bottom-right': ax = 250; ay = 190; break;
        }
        finalComputed = {
          ...rawTransform,
          x: ax + ox,
          y: ay + oy,
        };
      }

      // Feature 9: Visibility Range Timing (Start/End Frame)
      if (part) {
        if (part.visibleStartFrame !== undefined && frame < part.visibleStartFrame) {
          return { ...finalComputed, opacity: 0 };
        }
        if (part.visibleEndFrame !== undefined && frame > part.visibleEndFrame) {
          return { ...finalComputed, opacity: 0 };
        }
      }

      return finalComputed;
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
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
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

  const updatePartMedia = (partId: string, url: string, type: 'image' | 'video') => {
    setCharacterParts((prev) =>
      prev.map((p) => (p.id === partId ? { ...p, innerMediaUrl: url, innerMediaType: type } : p))
    );
  };

  const renamePartAndTrack = useCallback((partId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCharacterParts((prev) =>
      prev.map((p) => (p.id === partId ? { ...p, name: trimmed } : p))
    );
    setTracks((prev) =>
      prev.map((t) => (t.partId === partId ? { ...t, name: trimmed.endsWith('Track') ? trimmed : `${trimmed} Track` } : t))
    );
    showToast(`Renamed layer to "${trimmed}"`, 'success');
  }, [showToast]);

  // ── Custom Motion Preset Engine & Sample Sequencer Project Loader ──
  const saveTrackAsPreset = useCallback((partId: string, name: string, type: 'in' | 'out' | 'stunt', startFrame = 0, endFrame = 50) => {
    const part = characterParts.find(p => p.id === partId);
    const track = tracks.find(t => t.partId === partId);
    if (!part || !track || track.keyframes.length === 0) {
      showToast('No keyframes found on layer to save as preset', 'error');
      return;
    }

    const filteredKfs = track.keyframes
      .filter(k => k.frame >= startFrame && k.frame <= endFrame)
      .sort((a, b) => a.frame - b.frame);

    if (filteredKfs.length < 2) {
      showToast('Need at least 2 keyframes in range to save preset', 'error');
      return;
    }

    const minF = filteredKfs[0].frame;
    const maxF = filteredKfs[filteredKfs.length - 1].frame;
    const durF = Math.max(1, maxF - minF);

    // For IN presets, reference origin is ending position
    // For OUT/STUNT presets, reference origin is starting position
    const refBaseX = type === 'in' ? filteredKfs[filteredKfs.length - 1].transform.x : filteredKfs[0].transform.x;
    const refBaseY = type === 'in' ? filteredKfs[filteredKfs.length - 1].transform.y : filteredKfs[0].transform.y;
    const refBaseRot = type === 'in' ? filteredKfs[filteredKfs.length - 1].transform.rotation : filteredKfs[0].transform.rotation;
    const refBaseScaleX = type === 'in' ? filteredKfs[filteredKfs.length - 1].transform.scaleX : filteredKfs[0].transform.scaleX;
    const refBaseScaleY = type === 'in' ? filteredKfs[filteredKfs.length - 1].transform.scaleY : filteredKfs[0].transform.scaleY;

    const presetKeyframes: CustomMotionPresetKeyframe[] = filteredKfs.map(kf => ({
      progress: (kf.frame - minF) / durF,
      deltaX: kf.transform.x - refBaseX,
      deltaY: kf.transform.y - refBaseY,
      rotation: kf.transform.rotation - refBaseRot,
      scaleX: refBaseScaleX && refBaseScaleX !== 0 ? kf.transform.scaleX / refBaseScaleX : 1,
      scaleY: refBaseScaleY && refBaseScaleY !== 0 ? kf.transform.scaleY / refBaseScaleY : 1,
      opacity: kf.transform.opacity,
      easing: kf.easing,
    }));

    const newPreset: CustomMotionPreset = {
      id: `preset_custom_${Date.now()}`,
      name,
      type,
      durationFrames: durF,
      keyframes: presetKeyframes,
    };

    setCustomPresets(prev => [...prev, newPreset]);
    showToast(`Saved preset "${name}"!`, 'success');
  }, [characterParts, tracks, showToast]);

  const deleteCustomPreset = useCallback((presetId: string) => {
    setCustomPresets(prev => prev.filter(p => p.id !== presetId));
    showToast('Deleted preset', 'info');
  }, [showToast]);

  const loadSampleSequencerProject = useCallback(() => {
    try {
      const sampleData = SAMPLE_SEQUENCER_PROJECT;
      setTracks(sampleData.tracks as any);
      setCharacterParts(sampleData.characterParts as any);
      setTotalFramesState(150);
      setFps(60);
      showToast("Loaded sample sequencer-project.json!", "success");
    } catch {
      showToast("Failed to load sample project", "error");
    }
  }, [showToast]);

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
        toggleTrackEditVisibility,
        toggleTrackLock,
        toggleTrackExpanded,
        exportProject,
        importProject,
        resetProject,
        addCustomPart,
        updatePartMedia,
        deletePart,
        copySelectedPart,
        pasteCopiedPart,
        duplicateSelectedPart,
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
        triggerAllBroadcastIn,
        triggerAllBroadcastOut,
        resetBroadcastState,
        customPresets,
        saveTrackAsPreset,
        deleteCustomPreset,
        loadSampleSequencerProject,
        liveStuntsState,
        triggerLiveStunt,
        stopLiveStunt,
        setStuntLoopState,
        stopAllLiveStunts,
        renamePartAndTrack,
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
