import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastPortal } from '../components/Toast/ToastPortal';
import type {
  CharacterPart,
  BodyPartType,
  Track,
  Transform,
  ToolType,
  EasingType,
  TrackChannel,
  AppMode,
  BroadcastObjectState,
  CustomMotionPreset,
  LiveStuntType,
  MotionTemplate,
  ProjectTemplate,
} from '../types/animator';
import type { SceneCoordinateSystem } from '../types/composition';
import { useClipboard } from '../hooks/useClipboard';
import { useSelection } from '../hooks/useSelection';
import { usePlayback } from '../hooks/usePlayback';
import { duplicateKeyframeGroup as duplicateKeyframeGroupTrack } from '../utils/keyframeDuplicate';
import { pasteKeyframeGroupData, type KeyframeCopyPayload } from '../utils/keyframeCopyPaste';

export interface ToastItem {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
}
import { useHistory } from '../hooks/useHistory';
import { useBroadcast } from '../hooks/useBroadcast';
import type { NamedSequenceRuntimeState } from '../utils/broadcastEngine';
import { useToolbar } from '../hooks/useToolbar';
import { useInspector } from '../hooks/useInspector';
import { useTimeline } from '../hooks/useTimeline';
import { useTemplates } from '../hooks/useTemplates';
import { useMath } from '../hooks/useMath';
import { useSerialization } from '../hooks/useSerialization';
import { useToast } from '../hooks/useToast';
import { usePresets, type SavePresetInput, type UpdatePresetInput } from '../hooks/usePresets';
import { useProjectState } from '../hooks/useProjectState';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

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
  selectedPartIds: string[];
  setSelectedPartIds: (ids: string[]) => void;
  handleSelectPart: (id: string | null, isMulti?: boolean) => void;
  focusModeNodeId: string | null;
  setFocusModeNodeId: (id: string | null) => void;
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
  startBatchInteraction: () => void;
  endBatchInteraction: () => void;

  // Helper getters
  getComputedTransform: (partId: string, frame: number) => Transform;

  // Actions
  addKeyframeToTrack: (trackId: string, frame: number) => void;
  deleteKeyframe: (trackId: string, keyframeId: string) => void;
  updateKeyframeFrame: (trackId: string, keyframeId: string, newFrame: number) => void;
  updateKeyframeBezierPoints: (trackId: string, keyframeId: string, points: [number, number, number, number]) => void;
  updateCurrentTransform: (newTransform: Partial<Transform>, partIdOverride?: string) => void;
  updateCurrentPropertyChannel: (channel: TrackChannel, value: number, partIdOverride?: string) => void;
  toggleTrackVisibility: (trackId: string) => void;
  toggleTrackEditVisibility: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;
  toggleTrackExpanded: (trackId: string) => void;
  exportProject: () => string;
  importProject: (jsonStr: string, defaultName?: string) => boolean;
  migrateLegacyCoordinates: () => boolean;
  resetProject: () => void;
  addCustomPart: (type: BodyPartType, name: string, extraProps?: Partial<CharacterPart>) => void;
  updatePartMedia: (partId: string, url: string, type: 'image' | 'video') => void;
  sceneTitle: string;
  setSceneTitle: (title: string) => void;
  projectTemplates: ProjectTemplate[];
  coordinateSystem: SceneCoordinateSystem;
  activeProjectTemplateId: string;
  setActiveProjectTemplateId: (id: string) => void;
  addProjectTemplate: (name: string) => void;
  renameProjectTemplate: (id: string, newName: string) => void;
  deleteProjectTemplate: (id: string) => void;
  motionTemplates: MotionTemplate[];
  activeTemplateId: string;
  setActiveTemplateId: (id: string) => void;
  addMotionTemplate: (name: string, type?: 'in' | 'out' | 'stunt') => void;
  renameMotionTemplate: (oldId: string, newName: string) => void;
  deleteMotionTemplate: (id: string) => void;
  duplicateMotionTemplate: (id: string) => void;
  updateMotionTemplateDuration: (id: string, durationFrames: number) => void;
  renamePartAndTrack: (partId: string, newName: string) => void;
  reorderParts: (dragIndex: number, hoverIndex: number) => void;
  deletePart: (partId: string) => void;
  copySelectedPart: () => void;
  pasteCopiedPart: () => void;
  duplicateSelectedPart: () => void;
  duplicateMirrored: (axis: 'y' | 'x' | 'origin') => void;
  // M26 — copy/paste ANIMATION onto an existing selected part (26A data layer)
  clipboardData: { part: CharacterPart; track?: Track } | null;
  pasteAnimationOntoSelected: (targetPartId: string) => void;
  // M27 — duplicate the keyframe frame-group at `frame` of `trackId` (27A pure helper)
  duplicateKeyframeGroup: (trackId: string, frame: number) => void;
  // M28 — paste a copied keyframe frame-group onto `trackId` at `frame` (28A pure helper)
  pasteKeyframeClipboard: (trackId: string, frame: number, payload: KeyframeCopyPayload) => void;
  applyMotionTransition: (partId: string, transitionType: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  isScaleLocked: boolean;
  setIsScaleLocked: (locked: boolean) => void;
  addPropertyKeyframe: (trackId: string, channel: TrackChannel, frame: number, value: number, easing?: EasingType) => void;
  deletePropertyKeyframe: (trackId: string, channel: TrackChannel, keyframeId: string) => void;
  updatePropertyKeyframeFrame: (trackId: string, channel: TrackChannel, keyframeId: string, newFrame: number) => void;

  // Broadcast Mode & Custom Presets
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  broadcastState: Record<string, BroadcastObjectState>;
  broadcastSessionActivated: boolean;
  namedSequenceRuntime: NamedSequenceRuntimeState;
  playNamedSequence: (sequenceId: string, durationFrames: number) => void;
  triggerBroadcastIn: (partId: string) => void;
  triggerBroadcastOut: (partId: string) => void;
  triggerAllBroadcastIn: () => void;
  triggerAllBroadcastOut: () => void;
  resetBroadcastState: () => void;

  // Custom Motion Preset Engine
  customPresets: CustomMotionPreset[];
  // M25 — user-saved custom preset library management (25A data layer)
  savePreset: (input: SavePresetInput) => CustomMotionPreset | null;
  updatePreset: (id: string, input: UpdatePresetInput) => CustomMotionPreset | null;
  deletePreset: (id: string) => void;
  importPresets: (presets: CustomMotionPreset[]) => void;

  // Realtime Live Stunts Engine
  liveStuntsState: Record<string, { stunt: LiveStuntType; progress: number; loop?: boolean; customPresetId?: string }>;
  triggerLiveStunt: (partId: string, stunt: LiveStuntType, loop?: boolean, customPresetId?: string) => void;
  stopLiveStunt: (partId: string) => void;
  setStuntLoopState: (loop: boolean) => void;
  stopAllLiveStunts: () => void;
}

const AnimatorContext = createContext<AnimatorContextType | null>(null);

export const AnimatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toasts, showToast, removeToast } = useToast();

  // Shared scale-lock state: used by the inspector scale card AND the canvas
  // corner-drag scaling so both respect the same setting.
  const [isScaleLocked, setIsScaleLocked] = useState<boolean>(true);

  const [coordinateSystem, setCoordinateSystem] = useState<SceneCoordinateSystem>('project-unit-center-v1');

  const {
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
    fpsRef,
  } = usePlayback();
  
  const { tracks, setTracks, tracksRef, characterParts, setCharacterParts, characterPartsRef } = useProjectState();

  const { customPresets, customPresetsRef, savePreset, updatePreset, deletePreset, importPresets } = usePresets();

  const {
    appMode,
    setAppMode,
    broadcastState,
    broadcastSessionActivated,
    namedSequenceRuntime,
    playNamedSequence,
    stopNamedSequence,
    updateNamedSequenceDuration,
    triggerBroadcastIn,
    triggerBroadcastOut,
    triggerAllBroadcastIn,
    triggerAllBroadcastOut,
    resetBroadcastState,
    liveStuntsState,
    triggerLiveStunt,
    stopLiveStunt,
    setStuntLoopState,
    stopAllLiveStunts,
  } = useBroadcast({
    setIsPlaying,
    setCurrentFrame,
    characterParts,
    tracksRef,
    characterPartsRef,
    customPresetsRef,
    fpsRef,
    showToast,
  });


  const {
    setTemplateCanvasStore,
    projectTemplates,
    setProjectTemplates,
    activeProjectTemplateId,
    setActiveProjectTemplateIdState,
    sceneTitle,
    setSceneTitle,
    setSceneTitleState,
    activeTemplateId,
    setActiveTemplateIdState,
    motionTemplates,
    setMotionTemplates,
    setActiveTemplateId,
    addMotionTemplate,
    renameMotionTemplate,
    deleteMotionTemplate,
    duplicateMotionTemplate,
    updateMotionTemplateDuration,
    setActiveProjectTemplateId,
    addProjectTemplate,
    renameProjectTemplate,
    deleteProjectTemplate,
  } = useTemplates({
    characterParts,
    setCharacterParts,
    tracks,
    setTracks,
    setFps,
    setCurrentFrame,
    setIsPlaying,
    appMode,
    coordinateSystem,
    setCoordinateSystem,
    showToast,
    onSequenceDeleted: stopNamedSequence,
    onSequenceDurationChanged: updateNamedSequenceDuration,
  });

  const [projectResolution, setProjectResolution] = useState<{ width: number; height: number }>({ width: 1920, height: 1080 });

  const {
    selectedPartId,
    setSelectedPartId,
    selectedPartIds,
    setSelectedPartIds,
    handleSelectPart,
    focusModeNodeId,
    setFocusModeNodeId,
    selectedKeyframeId,
    setSelectedKeyframeId,
  } = useSelection();
  const {
    activeTool,
    setActiveTool,
    addCustomPart,
  } = useToolbar({
    tracks,
    setTracks,
    characterParts,
    setCharacterParts,
    setSelectedPartId,
  });



  const {
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
    applyMotionTransition,
    renamePartAndTrack,
    reorderParts,
  } = useTimeline({
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
    getComputedTransform: (id, f) => getComputedTransform(id, f),
    showToast,
  });


  const {
    undo,
    redo,
    canUndo,
    canRedo,
    startBatchInteraction,
    endBatchInteraction,
  } = useHistory({
    tracks,
    setTracks,
    tracksRef,
    characterParts,
    setCharacterParts,
    characterPartsRef,
    motionTemplates,
    setMotionTemplates,
  });





  const { copySelectedPart, pasteCopiedPart, duplicateSelectedPart, duplicateMirrored, pasteAnimationOntoSelected, clipboardData } = useClipboard({
    characterParts,
    tracks,
    selectedPartId,
    showToast,
    setTracks,
    setCharacterParts,
    setSelectedPartId,
  });



  useKeyboardShortcuts({
    selectedPartId,
    undo,
    redo,
    copySelectedPart,
    pasteCopiedPart,
    duplicateSelectedPart,
    deleteSelectedKeyframe,
    deletePart,
  });

  const { getComputedTransform } = useMath({
    characterParts,
    tracks,
    activeTemplateId,
  });





  const {
    updateCurrentTransform,
    updateCurrentPropertyChannel,
    updatePartMedia,
  } = useInspector({
    selectedPartId,
    selectedPartIds,
    activeTemplateId,
    currentFrame,
    tracks,
    setTracks,
    setCharacterParts,
    getComputedTransform,
    addKeyframeToTrack,
  });



  const {
    lastSavedAt,
    triggerManualSave,
    exportProject,
    importProject,
    resetProject,
    migrateLegacyCoordinates,
  } = useSerialization({
    fps,
    setFps,
    totalFrames,
    setTotalFrames,
    projectResolution,
    coordinateSystem,
    setCoordinateSystem,
    setProjectResolution,
    tracks,
    setTracks,
    characterParts,
    setCharacterParts,
    activeProjectTemplateId,
    setActiveProjectTemplateIdState,
    motionTemplates,
    setMotionTemplates,
    activeTemplateId,
    setActiveTemplateIdState,
    sceneTitle,
    setSceneTitleState,
    setProjectTemplates,
    setTemplateCanvasStore,
    setCurrentFrame,
    setIsPlaying,
  });





  // M27 — duplicate keyframe frame-group (27A pure helper) as ONE logical
  // undo entry (existing batch pattern — no new history system).
  const duplicateKeyframeGroup = useCallback(
    (trackId: string, frame: number) => {
      startBatchInteraction();
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? duplicateKeyframeGroupTrack(t, frame, 1, totalFrames).track : t)),
      );
      endBatchInteraction();
    },
    [setTracks, startBatchInteraction, endBatchInteraction, totalFrames]
  );

  // M28 — paste copied keyframe frame-group (28A pure helper) as ONE logical
  // undo entry (existing batch pattern). Collision/invalid frames → helper
  // no-op → setTracks returns identical state → no history entry.
  const pasteKeyframeClipboard = useCallback(
    (trackId: string, frame: number, payload: KeyframeCopyPayload) => {
      startBatchInteraction();
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? pasteKeyframeGroupData(t, frame, payload, totalFrames).track : t)),
      );
      endBatchInteraction();
    },
    [setTracks, startBatchInteraction, endBatchInteraction, totalFrames]
  );

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
        selectedPartIds,
        setSelectedPartIds,
        handleSelectPart,
        focusModeNodeId,
        setFocusModeNodeId,
        selectedKeyframeId,
        setSelectedKeyframeId,
        activeTool,
        setActiveTool,
        isScaleLocked,
        setIsScaleLocked,
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
        startBatchInteraction,
        endBatchInteraction,
        getComputedTransform,
        addKeyframeToTrack,
        deleteKeyframe,
        updateKeyframeFrame,
        updateKeyframeBezierPoints,
        updateCurrentTransform,
        updateCurrentPropertyChannel,
        toggleTrackVisibility,
        toggleTrackEditVisibility,
        toggleTrackLock,
        toggleTrackExpanded,
        exportProject,
        importProject,
        migrateLegacyCoordinates,
        resetProject,
        addCustomPart,
        updatePartMedia,
        deletePart,
        copySelectedPart,
        pasteCopiedPart,
        duplicateSelectedPart,
        duplicateMirrored,
        pasteAnimationOntoSelected,
        clipboardData,
        duplicateKeyframeGroup,
        pasteKeyframeClipboard,
        applyMotionTransition,
        showToast,
        addPropertyKeyframe,
        deletePropertyKeyframe,
        updatePropertyKeyframeFrame,
        appMode,
        setAppMode,
        broadcastState,
        broadcastSessionActivated,
        namedSequenceRuntime,
        playNamedSequence,
        triggerBroadcastIn,
        triggerBroadcastOut,
        triggerAllBroadcastIn,
        triggerAllBroadcastOut,
        resetBroadcastState,
        customPresets,
        savePreset,
        updatePreset,
        deletePreset,
        importPresets,
        liveStuntsState,
        triggerLiveStunt,
        stopLiveStunt,
        setStuntLoopState,
        stopAllLiveStunts,
        renamePartAndTrack,
        reorderParts,
        sceneTitle,
        setSceneTitle,
        projectTemplates,
        coordinateSystem,
        activeProjectTemplateId,
        setActiveProjectTemplateId,
        addProjectTemplate,
        renameProjectTemplate,
        deleteProjectTemplate,
        motionTemplates,
        activeTemplateId,
        setActiveTemplateId,
        addMotionTemplate,
        renameMotionTemplate,
        deleteMotionTemplate,
        duplicateMotionTemplate,
        updateMotionTemplateDuration,
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
