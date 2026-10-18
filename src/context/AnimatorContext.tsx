import { AnimatorContext } from './useAnimator';
import React, { useState, useCallback } from 'react';
import { ToastPortal } from '../components/Toast/ToastPortal';
import type {
  CharacterPart,
  BodyPartType,
  Track,
  Transform,
  ToolType,
  EasingType,
  TrackChannel,
  AnimationChannel,
  LayerMaskPathChannel,
  BezierPath,
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
import { useHistory, type HistoryDocumentState } from '../hooks/useHistory';
import { useBroadcast } from '../hooks/useBroadcast';
import type { NamedSequenceRuntimeState } from '../utils/broadcastEngine';
import { useToolbar } from '../hooks/useToolbar';
import { useInspector } from '../hooks/useInspector';
import { useTimeline } from '../hooks/useTimeline';
import { useTemplates } from '../hooks/useTemplates';
import { useMath } from '../hooks/useMath';
import { useSerialization } from '../hooks/useSerialization';
import { useToast, type ToastOptions } from '../hooks/useToast';
import { usePresets, type SavePresetInput, type UpdatePresetInput } from '../hooks/usePresets';
import { useProjectState } from '../hooks/useProjectState';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { createLayerGroupingActions } from '../hooks/useLayerGrouping';
import { createVectorArrangeActions } from '../hooks/useVectorArrangeAuthoring';
import { createStageCropActions } from '../hooks/useStageCropAuthoring';
import type { StageCropRect } from '../utils/stageCrop';
import { resolveOutermostGroupAncestor } from '../utils/layerGrouping';
import { selectAllLayers } from '../utils/layerSelection';
import { ShortcutReferenceDialog } from '../components/Shortcuts/ShortcutReferenceDialog';
import type { ImportResult } from '../utils/importValidation';

export interface AnimatorContextType {
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
  booleanOperandEditingGroupId: string | null;
  setBooleanOperandEditingGroupId: (id: string | null) => void;
  focusModeNodeId: string | null;
  setFocusModeNodeId: (id: string | null) => void;
  selectedKeyframeId: string | null;
  setSelectedKeyframeId: (id: string | null) => void;
  /** Every selected keyframe; `selectedKeyframeId` is its primary member. */
  selectedKeyframeIds: string[];
  selectKeyframes: (ids: string[], mode?: 'replace' | 'toggle') => void;
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  pendingShapeType: BodyPartType | null;
  pendingShapeName: string | null;
  armShapeCreation: (type: BodyPartType, name: string) => void;
  clearShapeCreation: () => void;

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
  /** True while the open project is the autosave this browser restored at startup. */
  restoredFromLocalStorage: boolean;
  /** True when another writer changed the shared autosave outside this tab; autosave is paused until reload. */
  autosaveConflict: boolean;
  /** Timestamp of the last manual save deferred by a busy autosave lock; not a conflict pause. */
  manualSaveRejectedAt: number | null;
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
  /** Delete every keyframe of one frame group (all stores) of a track. */
  deleteKeyframeFrameGroup: (trackId: string, frame: number) => void;
  /** Move the whole selected keyframe set by a frame delta (one gesture = one entry). */
  moveSelectedKeyframes: (selectedIds: string[], delta: number, expandFrameGroups: boolean) => number;
  updateKeyframeFrame: (trackId: string, keyframeId: string, newFrame: number) => void;
  updateKeyframeBezierPoints: (trackId: string, keyframeId: string, points: [number, number, number, number]) => void;
  updateCurrentTransform: (newTransform: Partial<Transform>, partIdOverride?: string) => void;
  updateCurrentPropertyChannel: (channel: TrackChannel, value: number, partIdOverride?: string) => void;
  toggleTrackVisibility: (trackId: string) => void;
  toggleTrackEditVisibility: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;
  toggleTrackExpanded: (trackId: string) => void;
  exportProject: () => string;
  importProject: (jsonStr: string, defaultName?: string) => ImportResult;
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
  duplicateKeyframeGroupAt: (trackId: string, sourceFrame: number, targetFrame: number) => boolean;
  // M28 — paste a copied keyframe frame-group onto `trackId` at `frame` (28A pure helper)
  pasteKeyframeClipboard: (trackId: string, frame: number, payload: KeyframeCopyPayload) => void;
  applyMotionTransition: (partId: string, transitionType: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info', options?: ToastOptions) => void;
  isScaleLocked: boolean;
  setIsScaleLocked: (locked: boolean) => void;
  /** The canvas snapping (smart guides) master switch; the View band toggles it. */
  snapEnabled: boolean;
  setSnapEnabled: (enabled: boolean) => void;
  /**
   * Stage crop / region of interest. The mode and the region on screen are
   * TRANSIENT authoring state — they are not part of the document and never
   * enter the history stack; only `Apply Crop` writes the document, as one
   * undo entry that restores the previous dimensions and positions together.
   */
  cropMode: boolean;
  setCropMode: (enabled: boolean) => void;
  cropRegion: StageCropRect | null;
  setCropRegion: React.Dispatch<React.SetStateAction<StageCropRect | null>>;
  /** Drops the region on screen without touching the document. */
  clearStageCropRegion: () => void;
  /** Applies the region on screen: new stage size + one uniform scene shift. */
  applyStageCrop: () => boolean;
  /** Crops to the current selection, measured at the current authored frame. */
  cropStageToSelection: () => boolean;
  /** Crops to all canvas-visible content, measured at the current authored frame. */
  cropStageToVisibleContent: () => boolean;
  /** Why the crop commands are unavailable right now, or `null`. */
  stageCropBlockReason: string | null;
  canCropStageToSelection: boolean;
  canCropStageToVisibleContent: boolean;
  addPropertyKeyframe: (trackId: string, channel: AnimationChannel, frame: number, value: number, easing?: EasingType) => void;
  /** K1 (D2) — stopwatch: arm writes the first key at the playhead with the
   * evaluated current value; only an unanimated channel arms. */
  armChannel: (trackId: string, channel: TrackChannel) => void;
  /** K1 (D2) — confirmed disarm: clear the channel's active-sequence keys and
   * keep the evaluated playhead value as static, in one history entry. */
  disableChannelAnimation: (trackId: string, channel: TrackChannel) => void;
  updatePropertyKeyframeValue: (trackId: string, channel: AnimationChannel, keyframeId: string, value: number) => void;
  updatePropertyKeyframeTemporalHandles: (trackId: string, channel: AnimationChannel, keyframeId: string, patch: { bezierIn?: { x: number; y: number }; bezierOut?: { x: number; y: number } }) => void;
  updatePropertyKeyframeFrame: (trackId: string, channel: AnimationChannel, keyframeId: string, frame: number) => void;
  deletePropertyKeyframe: (trackId: string, channel: AnimationChannel, keyframeId: string) => void;
  addMaskPathKeyframe: (trackId: string, maskId: string, frame: number, path: BezierPath, easing?: EasingType) => void;
  updateMaskPathKeyframeValue: (trackId: string, channel: LayerMaskPathChannel, keyframeId: string, path: BezierPath) => void;
  updateMaskPathKeyframeFrame: (trackId: string, channel: LayerMaskPathChannel, keyframeId: string, frame: number) => void;
  deleteMaskPathKeyframe: (trackId: string, channel: LayerMaskPathChannel, keyframeId: string) => void;
  authorMaskPath: (partId: string, maskId: string, path: BezierPath) => void;

  // Broadcast Mode & Custom Presets
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  modeSwapActive: boolean;
  finishModeSwap: () => void;
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

  /**
   * Opens the keyboard shortcut reference. The one authority for it lives here
   * because both ways in — the header control and the `?` key — are editor-wide.
   */
  openShortcutReference: () => void;
}

export const AnimatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toasts, showToast, removeToast } = useToast();

  // Shared scale-lock state: used by the inspector scale card AND the canvas
  // corner-drag scaling so both respect the same setting. The corner drag is
  // free (non-uniform) by default; this lock is the persistent uniform option
  // and Shift is its per-gesture equivalent.
  const [isScaleLocked, setIsScaleLocked] = useState<boolean>(false);

  // Canvas snapping master switch. It is presentation state (a preference), not
  // document state, so it lives beside scale-lock on the provider; the View band
  // toggles it and the stage's translate gesture reads it.
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);

  // Stage crop / region of interest. The armed mode and the region the pointer
  // has described are transient authoring state: they never enter a history
  // snapshot, so drawing or resizing a region is not undoable — only `Apply
  // Crop` is, and it writes the whole crop as one entry.
  const [cropMode, setCropMode] = useState<boolean>(false);
  const [cropRegion, setCropRegion] = useState<StageCropRect | null>(null);

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
    modeSwapActive,
    finishModeSwap,
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
    setTotalFrames,
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
    booleanOperandEditingGroupId,
    setBooleanOperandEditingGroupId,
    focusModeNodeId,
    setFocusModeNodeId,
    selectedKeyframeId,
    setSelectedKeyframeId,
    selectedKeyframeIds,
    selectKeyframes,
  } = useSelection();
  const {
    activeTool,
    setActiveTool,
    pendingShapeType,
    pendingShapeName,
    armShapeCreation,
    clearShapeCreation,
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
    armChannel,
        disableChannelAnimation,
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
    updatePropertyKeyframeFrame,
    deleteSelectedKeyframes,
    applyMotionTransition,
    renamePartAndTrack,
    reorderParts,
  } = useTimeline({
    setCharacterParts,
    characterParts,
    tracks,
    setTracks,
    tracksRef,
    selectedPartId,
    setSelectedPartId,
    selectedPartIds,
    setSelectedPartIds,
    selectedKeyframeId,
    selectedKeyframeIds,
    setSelectedKeyframeId,
    booleanOperandEditingGroupId,
    setBooleanOperandEditingGroupId,
    currentFrame,
    totalFrames,
    activeTemplateId,
    getComputedTransform: (id, f) => getComputedTransform(id, f),
    showToast,
  });


  /**
   * Applies a document snapshot verbatim when undo/redo restores one. The
   * setters are the raw state setters (not the sequence-switch wrapper), so the
   * snapshot is what returns — including its `totalFrames`.
   */
  const restoreDocumentState = useCallback((state: HistoryDocumentState) => {
    setFps(state.fps);
    setTotalFrames(state.totalFrames);
    setProjectResolution(state.projectResolution);
    setCoordinateSystem(state.coordinateSystem);
    setSceneTitleState(state.sceneTitle);
    setActiveTemplateIdState(state.activeTemplateId);
  }, [setFps, setTotalFrames, setSceneTitleState, setActiveTemplateIdState]);

  // Recomputed every render so a snapshot always carries the values on screen;
  // `useHistory` compares its content, not its identity.
  const historyDocumentState: HistoryDocumentState = {
    fps,
    totalFrames,
    projectResolution,
    coordinateSystem,
    sceneTitle,
    activeTemplateId,
  };

  const {
    undo,
    redo,
    canUndo,
    canRedo,
    startBatchInteraction,
    endBatchInteraction,
    requestBaselineReset,
  } = useHistory({
    tracks,
    setTracks,
    tracksRef,
    characterParts,
    setCharacterParts,
    characterPartsRef,
    motionTemplates,
    setMotionTemplates,
    documentState: historyDocumentState,
    restoreDocumentState,
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



  const { getComputedTransform } = useMath({
    characterParts,
    tracks,
    activeTemplateId,
  });

  /**
   * The layer-group actions the keyboard commands run. They are the SAME actions
   * the toolbar, the Inspector and the context menu run (one implementation,
   * `createLayerGroupingActions`), built here from the provider's own locals
   * because a hook cannot be called from inside its own provider.
   */
  const { groupSelection, ungroupSelection } = createLayerGroupingActions({
    currentFrame,
    selectedPartId,
    selectedPartIds,
    characterParts,
    tracks,
    setCharacterParts,
    setTracks,
    setSelectedPartId,
    setSelectedPartIds,
    getComputedTransform,
    startBatchInteraction,
    endBatchInteraction,
    showToast,
  });

  const {
    updateCurrentTransform,
    updateCurrentPropertyChannel,
    updatePartMedia,
  } = useInspector({
    selectedPartId,
    selectedPartIds,
    activeTemplateId,
    characterParts,
    currentFrame,
    tracks,
    setTracks,
    setCharacterParts,
    getComputedTransform,
  });

  const [isShortcutReferenceOpen, setIsShortcutReferenceOpen] = useState<boolean>(false);

  /**
   * The vector arrange commands the keyboard runs. They are the SAME actions the
   * toolbar's align/distribute/rotate/flip controls run (one implementation,
   * `createVectorArrangeActions`), built here from the provider's own locals
   * because a hook cannot be called from inside its own provider.
   */
  const { rotate: rotateSelection, flip: flipSelection } = createVectorArrangeActions({
    currentFrame,
    selectedPartId,
    selectedPartIds,
    characterParts,
    getComputedTransform,
    updateCurrentTransform,
    startBatchInteraction,
    endBatchInteraction,
    showToast,
  });

  /**
   * The stage-crop commands the Crop band and the crop overlay run. They are the
   * SAME authority (one implementation, `createStageCropActions`), built from the
   * provider's own locals, and every crop is one batch interaction — one undo
   * entry that restores the previous stage size AND the previous positions.
   */
  const stageCrop = createStageCropActions({
    currentFrame,
    characterParts,
    tracks,
    selectedPartId,
    selectedPartIds,
    projectResolution,
    getComputedTransform,
    startBatchInteraction,
    endBatchInteraction,
    setCharacterParts,
    setTracks,
    setProjectResolution,
    onRegionApplied: () => setCropRegion(null),
    showToast,
  });

  useKeyboardShortcuts({
    selectedPartId,
    undo,
    redo,
    copySelectedPart,
    pasteCopiedPart,
    duplicateSelectedPart,
    deleteSelectedKeyframes,
    deletePart,
    setActiveTool,
    activeTool,
    cancelShapeCreation: pendingShapeType ? clearShapeCreation : undefined,
    /**
     * Escape leaves the crop mode: it drops the region the pointer described,
     * or leaves the mode itself when there is none. It runs after the armed
     * creation gesture (which owns Escape while it is armed) and before the
     * freeform tool's own listener.
     */
    cancelStageCrop: () => {
      if (cropRegion) {
        setCropRegion(null);
        return true;
      }
      if (cropMode) {
        setCropMode(false);
        return true;
      }
      return false;
    },
    exitBooleanOperandEditing: () => {
      if (!booleanOperandEditingGroupId) return false;
      setBooleanOperandEditingGroupId(null);
      return true;
    },
    armShapeCreation,
    addCustomPart,
    selectAllLayers: () => selectAllLayers(characterParts, { setSelectedPartIds, setSelectedPartId }),
    groupSelection,
    ungroupSelection,
    rotateSelection,
    flipSelection,
    /** Escape steps out of a grouped child onto the container that holds it. */
    exitGroupDrillIn: () => {
      if (!selectedPartId) return false;
      const container = resolveOutermostGroupAncestor(characterParts, selectedPartId);
      if (container === null || container === selectedPartId) return false;
      setSelectedPartIds([container]);
      setSelectedPartId(container);
      return true;
    },
    clearKeyframeSelection: () => {
      if (selectedKeyframeIds.length === 0) return false;
      selectKeyframes([], 'replace');
      return true;
    },
    setIsPlaying,
    appMode,
    openShortcutReference: () => setIsShortcutReferenceOpen(true),
  });



  const {
    lastSavedAt,
    restoredFromLocalStorage,
    autosaveConflict,
    manualSaveRejectedAt,
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
    requestHistoryBaseline: requestBaselineReset,
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

  // K2 — the alt-drag duplicate: the same pure helper with a dynamic target
  // frame. Returns whether the copy landed (false = refused, zero mutation;
  // the caller owns the single D1 warning). No batch of its own: the gesture
  // already owns one, and a nested pair would record a spurious undo entry.
  const duplicateKeyframeGroupAt = useCallback(
    (trackId: string, sourceFrame: number, targetFrame: number): boolean => {
      const track = tracks.find((t) => t.id === trackId);
      if (!track) return false;
      const result = duplicateKeyframeGroupTrack(track, sourceFrame, targetFrame - sourceFrame, totalFrames);
      if (!result.duplicated) return false;
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? result.track : t)),
      );
      return true;
    },
    [tracks, totalFrames, setTracks]
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
        booleanOperandEditingGroupId,
        setBooleanOperandEditingGroupId,
        focusModeNodeId,
        setFocusModeNodeId,
        selectedKeyframeId,
        setSelectedKeyframeId,
        selectedKeyframeIds,
        selectKeyframes,
        activeTool,
        setActiveTool,
        pendingShapeType,
        pendingShapeName,
        armShapeCreation,
        addCustomPart,
        clearShapeCreation,
        setIsScaleLocked,
        isScaleLocked,
        snapEnabled,
        setSnapEnabled,
        cropMode,
        setCropMode,
        cropRegion,
        setCropRegion,
        clearStageCropRegion: () => setCropRegion(null),
        applyStageCrop: () => stageCrop.applyCropRegion(cropRegion),
        cropStageToSelection: stageCrop.cropToSelection,
        cropStageToVisibleContent: stageCrop.cropToVisibleContent,
        stageCropBlockReason: stageCrop.blockReason,
        canCropStageToSelection: stageCrop.canCropToSelection,
        canCropStageToVisibleContent: stageCrop.canCropToVisibleContent,
        tracks,
        setTracks,
        characterParts,
        setCharacterParts,
        timelineZoom,
        setTimelineZoom,
        showGrid,
        setShowGrid,
        lastSavedAt,
        restoredFromLocalStorage,
        autosaveConflict,
        manualSaveRejectedAt,
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
        deleteKeyframeFrameGroup,
        moveSelectedKeyframes,
        deletePart,
        updateKeyframeFrame,
        updateKeyframeBezierPoints,
        updatePartMedia,
        updateCurrentTransform,
        updateCurrentPropertyChannel,
        toggleTrackVisibility,
        toggleTrackEditVisibility,
        toggleTrackLock,
        toggleTrackExpanded,
        resetProject,
        migrateLegacyCoordinates,
        exportProject,
        importProject,
        applyMotionTransition,
        showToast,
        updatePropertyKeyframeFrame,
        addPropertyKeyframe,
        armChannel,
        disableChannelAnimation,
        updatePropertyKeyframeValue,
        updatePropertyKeyframeTemporalHandles,
        deletePropertyKeyframe,
        addMaskPathKeyframe,
        updateMaskPathKeyframeValue,
        updateMaskPathKeyframeFrame,
        deleteMaskPathKeyframe,
        copySelectedPart,
        pasteCopiedPart,
        duplicateSelectedPart,
        authorMaskPath,
        duplicateMirrored,
        pasteAnimationOntoSelected,
        clipboardData,
        duplicateKeyframeGroup,
        duplicateKeyframeGroupAt,
        pasteKeyframeClipboard,
        appMode,
        setAppMode,
        modeSwapActive,
        finishModeSwap,
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
        openShortcutReference: () => setIsShortcutReferenceOpen(true),
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
        updateMotionTemplateDuration,
      }}
    >
      {children}

      <ShortcutReferenceDialog
        isOpen={isShortcutReferenceOpen}
        onClose={() => setIsShortcutReferenceOpen(false)}
      />

      {/* Floating Glassmorphism Toast Notification Portal */}
      <ToastPortal toasts={toasts} removeToast={removeToast} />
    </AnimatorContext.Provider>
  );
};
