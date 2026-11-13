import React, { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useAnimator } from '../../context/useAnimator';
import { useEditorContextMenu } from '../../context/editorContextMenu';
import type { BezierPath, CharacterPart, Transform } from '../../types/animator';
import { type ScaleMode } from './overlays/TransformGizmo';
import { parseElementDropPayload } from '../../utils/editor/elementDropPayload';
import { getPartBounds } from '../../utils/geometry/bounds';
import type { CornerBounds } from '../../utils/geometry/cornerResize';
import {
  CORNER_BY_SCALE_MODE,
  isCropGesture,
  pointInSolveFrame,
  resolveCropGesture,
  resolveTransformGesture,
  svgPointToWorld,
  type GestureStart,
  type ResizeSolveFrame,
  type StageGestureMode,
} from './stageGestures';
import {
  invertAffine,
  worldAffineOf,
  worldToContainerLocal,
  type WorldAffine,
} from '../../utils/geometry/containerMath';
import { stackingOrder } from '../../utils/layers/stackingOrder';
import { resolveMarqueeSelection, resolveStageSelectionTarget } from '../../utils/layers/layerGrouping';
import { getPartWorldBounds } from '../../utils/geometry/bounds';
import { collectArrangeTargets } from '../../utils/layers/vectorArrange';
import {
  collectLayerSnapCandidates,
  collectStageSnapCandidates,
  resolveSnap,
  unionWorldBounds,
  SNAP_THRESHOLD_SCREEN_PX,
  type SnapGuide,
  type SnapLine,
} from '../../utils/geometry/layoutGeometry';
import type { PartWorldBounds } from '../../utils/geometry/bounds';
import {
  STAGE_CROP_HANDLES,
  editorPointToStageSpace,
  isStageCropHandle,
  isStagePointInsideRect,
  stageCropHandleCenters,
  stageSpaceToEditorRect,
} from '../../utils/geometry/stageCrop';
import { clampZoom, clientToCameraPoint, getCursorAnchoredCameraCenter, getPartsInMarquee, getPointerDelta, getShapeCreationBounds, getShapeCreationPlacement, getStageFitScale, getTextCreationProps, type StageBox, type StageCameraView } from '../../utils/geometry/viewportMath';
import { EDITOR_CAMERA_CENTER, EDITOR_CAMERA_VIEWBOX, getProjectCenter, type CoordinatePoint } from '../../utils/geometry/projectCoordinates';
import { REFIT_UNTOUCHED_CAMERA_COMMAND, REMEASURE_STAGE_BOX_COMMAND, WORKSPACE_LAYOUT_COMMAND_EVENT } from '../../utils/editor/workspaceLayout';
import { normalizeFreeformPoints } from '../../utils/geometry/freeform';
import { buildBezierPathD } from '../../utils/geometry/bezierPath';
import { penAnchorsToPath } from '../../utils/geometry/penDraft';
import { resolveBondGroup } from '../../utils/layers/partBinding';
import { lockedLayerIds, lockedLayersRefusal } from '../../utils/layers/layerLocks';
import { useFreeformDraw, type FreeformFinishReason } from '../../hooks/useFreeformDraw';
import { CanvasGridOverlay } from './overlays/CanvasGridOverlay';
import { CanvasCoordinateOverlay } from './overlays/CanvasCoordinateOverlay';
import { leaveStage, rememberStagePointer } from '../../utils/editor/stagePointer';
import { CanvasCoordinateReadout } from './overlays/CanvasCoordinateReadout';
import { FreeformTangentOverlay } from './overlays/FreeformTangentOverlay';
import { isFreeformTangentOverlayEligible } from '../../utils/geometry/freeformTangentEligibility';
import { ShapeCreationPreview } from './ShapeCreationPreview';
import { SelectionGizmo } from './SelectionGizmo';
import { MaskPathOverlay } from './overlays/MaskPathOverlay';
import { MaskDrawOverlay, type MaskPenDraftState } from './overlays/MaskDrawOverlay';
import { insertMaskVertex, nearestMaskPathSegment } from '../../utils/geometry/maskPathCreation';
import { evaluateLayerMasks } from '../../utils/animation/evaluateLayerMasks';
import { resolveMaskEditBlock, resolveMaskPathFrame } from '../../utils/geometry/maskPathEditing';
import { StagePartLayers } from './StagePartLayers';
import { EditTargetStrip } from './overlays/EditTargetStrip';
import { resolveEditTarget } from '../../utils/layers/editTarget';
import { Sparkles } from 'lucide-react';
import './StageCanvas.css';
import { useLayoutModifiers } from '../../hooks/useLayoutModifiers';

/**
 * A fitted camera centre on WHOLE device pixels. The centre of a stage
 * with an odd size is a half pixel: the origin's axes then sat exactly on a
 * pixel boundary and the smallest float difference between two frames flipped
 * which pixel they were antialiased into (a flicker on every stage resize).
 */
const snapToDevicePixel = (point: CoordinatePoint): CoordinatePoint => {
  const ratio = typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
  return { x: Math.round(point.x * ratio) / ratio, y: Math.round(point.y * ratio) / ratio };
};

/** Half of a length, rounded to whole device pixels. */
const deviceHalf = (length: number): number => {
  const ratio = typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
  return Math.round((length / 2) * ratio) / ratio;
};

/**
 * C7b — the edit SVG's own size: the window's, in whole pixels. It does not
 * follow the stage box, so opening or closing a dock or the timeline never
 * resizes (and so never re-rasterises) the drawing surface; the stage
 * container clips it.
 */
const readEditSurface = (): { width: number; height: number } => ({
  width: Math.max(1, Math.ceil(typeof window !== 'undefined' ? window.innerWidth : 1)),
  height: Math.max(1, Math.ceil(typeof window !== 'undefined' ? window.innerHeight : 1)),
});

/** A right press that travels less than this (CSS px) is a click, not a pan. */
const RIGHT_CLICK_SLOP_PX = 4;
/**
 * How near the outline (in screen pixels) a double-click must land to add a
 * mask point: half the outline's hit band (`CONTOUR_HIT_WIDTH` 12) plus slack.
 */
const MASK_OUTLINE_INSERT_RADIUS = 8;

export const StageCanvas: React.FC = () => {
  const {
    currentFrame,
    characterParts,
    selectedPartId,
    selectedPartIds,
    handleSelectPart,
    setSelectedPartId,
    setSelectedPartIds,
    getComputedTransform,
    updateCurrentTransform,
    activeTool,
    pendingShapeType,
    pendingShapeName,
    addCustomPart,
    updatePartMedia,
    showGrid,
    showCoordinateOverlay,
    snapEnabled,
    cropMode,
    cropRegion,
    setCropRegion,
    totalFrames,
    projectResolution,
    coordinateSystem,
    appMode,
    broadcastState,
    broadcastSessionActivated,
    namedSequenceRuntime,
    activeTemplateId,
    tracks,
    setFocusModeNodeId,
    startBatchInteraction,
    endBatchInteraction,
    setActiveTool,
    showToast,
    isScaleLocked,
    customPresets,
    liveStuntsState,
    booleanOperandEditingGroupId,
    setBooleanOperandEditingGroupId,
    isPlaying,
    maskEditTarget,
    enterMaskEditing,
    exitMaskEditing,
    registerMaskGestureCancel,
    captureMaskGestureSnapshot,
    cancelMaskGesture,
    authorMaskPath,
    maskVertexIndex,
    setMaskVertexIndex,
    applyMaskTopologyEdit,
    maskDrawSession,
    cancelMaskDraw,
    commitMaskDraw,
    registerDraftHistory,
    setPartPath,
    pathVertex,
    selectPathVertex,
    matteReturnTargetId,
    backToMatteTarget,
  } = useAnimator();
  /** The open Mask Pen draft, for the banner's visible Finish control. */
  const [maskPenDraft, setMaskPenDraft] = useState<MaskPenDraftState | null>(null);
  /** WP-02/03: a mask is edited or drawn on the canvas — the layer gestures stand down. */
  const maskInteractionActive = Boolean(maskEditTarget || maskDrawSession);
  /**
   * The freeform path whose points are being edited. A click selects a path
   * (its transform frame); a double-click opens its points; a double-click
   * outside it, Escape or another selection closes them.
   */
  const [pathEditPartId, setPathEditPartId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const { openContextMenu } = useEditorContextMenu();
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  /**
   * Edit-stage camera. `center` is the client position of the camera centre and
   * `baseScale` the px-per-unit it was anchored with. Both belong to the camera,
   * never to the stage box: opening a sidebar or resizing the timeline changes
   * the visible crop only, it cannot move or rescale the authored world.
   */
  const [cameraView, setCameraView] = useState<StageCameraView | null>(null);
  const [stageBox, setStageBox] = useState<StageBox | null>(null);
  const [editSurface, setEditSurface] = useState(readEditSurface);
  useEffect(() => {
    const onResize = () => setEditSurface((current) => {
      const next = readEditSurface();
      return next.width === current.width && next.height === current.height ? current : next;
    });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const cameraViewRef = useRef<StageCameraView | null>(null);
  const stageBoxRef = useRef<StageBox | null>(null);
  const windowSizeRef = useRef<{ width: number; height: number } | null>(null);
  const zoomRef = useRef(zoomLevel);
  // Intentional latest-value mirrors: observers read the live camera without
  // re-subscribing on every camera change.
  // oxlint-disable-next-line react/refs
  cameraViewRef.current = cameraView;
  // oxlint-disable-next-line react/refs
  zoomRef.current = zoomLevel;

  const readStageBox = useCallback((): StageBox | null => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }, []);

  /**
   * Folds a measured stage box into the camera.
   *
   * A panel or timeline layout change only replaces `stageBox`; the rendered
   * transform divides the new layout fit back out, so the world keeps its screen
   * position and magnification. A window change (`reanchor`) keeps the camera's
   * pan offset relative to the new stage centre and re-derives its px-per-unit
   * scale — the long-standing fit behaviour for application-window resizes.
   */
  const applyStageBox = useCallback((box: StageBox, reanchor: boolean) => {
    const previous = stageBoxRef.current;
    // A frame-committed edge (see `commitWorkspaceLayout`) has already folded
    // this exact box into the camera; re-committing it would re-render for
    // nothing. The observer stays the fallback for boxes nobody committed.
    if (previous && !reanchor
      && previous.left === box.left && previous.top === box.top
      && previous.width === box.width && previous.height === box.height) return;
    stageBoxRef.current = box;
    setStageBox(box);
    const stageCenter = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    const baseScale = getStageFitScale(box, EDITOR_CAMERA_VIEWBOX);
    setCameraView((view) => {
      if (!view) return { center: snapToDevicePixel(stageCenter), baseScale };
      if (!reanchor || !previous) return view;
      // A re-anchor carries the camera by exactly the stage centre's own move.
      const previousCenter = { x: previous.left + previous.width / 2, y: previous.top + previous.height / 2 };
      return {
        center: {
          x: view.center.x + (stageCenter.x - previousCenter.x),
          y: view.center.y + (stageCenter.y - previousCenter.y),
        },
        baseScale,
      };
    });
  }, []);

  // Broadcast shows the FULL artboard, centered — never inherit the edit-mode
  // pan/zoom (that would leave the stage off-center with dark 'curtain' bands).
  // The edit camera is remembered and restored when switching back.
  const editViewportRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  const openingCameraSeenRef = useRef(false);
  const openingCameraCenterRef = useRef<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (appMode === 'broadcast') {
      // The committed DOM is already the broadcast layout, so the pan offset is
      // derived from the last *edit* stage box, not from the live one.
      const view = cameraViewRef.current;
      const editBox = stageBoxRef.current;
      editViewportRef.current = {
        zoom: zoomRef.current,
        pan: view && editBox
          ? { x: view.center.x - (editBox.left + editBox.width / 2), y: view.center.y - (editBox.top + editBox.height / 2) }
          : { x: 0, y: 0 },
      };
      // Mode changes intentionally synchronize the camera state with the active surface.
      // oxlint-disable-next-line react/set-state-in-effect
      setZoomLevel(1);
      return;
    }
    const restored = editViewportRef.current;
    const box = readStageBox();
    if (!box) return;
    stageBoxRef.current = box;
    windowSizeRef.current = { width: window.innerWidth, height: window.innerHeight };
    // Mode changes intentionally synchronize the camera state with the active surface.
    // oxlint-disable-next-line react/set-state-in-effect
    setStageBox(box);
    // oxlint-disable-next-line react/set-state-in-effect
    setZoomLevel(restored.zoom);
    // oxlint-disable-next-line react/set-state-in-effect
    setCameraView({
      center: snapToDevicePixel({ x: box.left + box.width / 2 + restored.pan.x, y: box.top + box.height / 2 + restored.pan.y }),
      baseScale: getStageFitScale(box, EDITOR_CAMERA_VIEWBOX),
    });
    // The opening camera, until the user moves it (see REFIT_UNTOUCHED_CAMERA_COMMAND).
    if (!openingCameraSeenRef.current) {
      openingCameraSeenRef.current = true;
      openingCameraCenterRef.current = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    }
  }, [appMode, readStageBox]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const box = readStageBox();
      if (!box) return;
      const windowSize = { width: window.innerWidth, height: window.innerHeight };
      const previousWindow = windowSizeRef.current;
      const windowResized = !!previousWindow
        && (previousWindow.width !== windowSize.width || previousWindow.height !== windowSize.height);
      windowSizeRef.current = windowSize;
      // The camera must be corrected inside the same frame as the layout change.
      flushSync(() => applyStageBox(box, windowResized));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [applyStageBox, readStageBox]);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  /**
   * One right-button press is EITHER a pan (it moved) OR a context-menu
   * request (it did not). Without this the menu opened on release after every
   * right-drag pan, and on platforms that send `contextmenu` on press the pan
   * kept running under the open menu.
   */
  const rightPressRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [dragMode, setDragMode] = useState<StageGestureMode | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [shapeCreationStart, setShapeCreationStart] = useState<{ clientX: number; clientY: number; svgX: number; svgY: number } | null>(null);
  const [shapeCreationPreview, setShapeCreationPreview] = useState<{ type: NonNullable<typeof pendingShapeType>; bounds: ReturnType<typeof getShapeCreationBounds> } | null>(null);
  const [dragStart, setDragStart] = useState<GestureStart>({
    x: 0,
    y: 0,
    initialTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  });

  /**
   * Group body drags: the pointer lands on a child, but the gesture belongs to
   * the container the click targets. This remembers the container when the
   * gesture is a body drag, so the click the browser fires after the drag is
   * suppressed instead of resolving the selection back to the pressed child.
   */
  const groupBodyDragRef = useRef<string | null>(null);
  const groupDragMovedRef = useRef(false);
  const suppressClickSelectRef = useRef(false);
  /**
   * The selection that was live when the marquee box began, captured
   * before the empty-canvas press clears it. The box resolves its hits against
   * exactly the set a click at that moment would have resolved against, so the
   * container-versus-child decision is the same for both gestures.
   */
  const marqueeSelectionOriginRef = useRef<string[]>([]);

  const [dragInitialAngle, setDragInitialAngle] = useState<number>(0);
  const [dragInitialLocalX, setDragInitialLocalX] = useState<number>(1);
  const [dragInitialLocalY, setDragInitialLocalY] = useState<number>(1);
  /** The smart guides of the snap that is active right now (empty while free). */
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

  /**
   * The snap context of the live translate drag, captured ONCE at pointerdown:
   * the moving item's evaluated world box and every candidate line. Both are
   * frozen for the gesture because the drag writes the moving layers on every
   * move — re-measuring them mid-drag would make the moving box (and therefore
   * the snap) chase its own writes. `pxPerWorld` is the camera scale at the
   * moment the drag began, so the screen-pixel threshold stays stable.
   */
  const dragSnapRef = useRef<{ bounds: PartWorldBounds; candidates: SnapLine[]; pxPerWorld: number } | null>(null);

  const selectedPart = characterParts.find((p) => p.id === selectedPartId);
  const selectedTransform = selectedPartId ? getComputedTransform(selectedPartId, currentFrame) : null;
  /**
   * The selection the R4-09 resolver reads. `selectedPartIds` is the canonical
   * set, but a few single-target callers (the marquee, the context menu, the
   * timeline) move `selectedPartId` on its own, so the primary is folded in when
   * it is missing: "is the user working inside this group" must never depend on
   * which of the two stores happened to be updated.
   */
  const canvasSelectionIds = useMemo(
    () => (selectedPartId && !selectedPartIds.includes(selectedPartId)
      ? [...selectedPartIds, selectedPartId]
      : selectedPartIds),
    [selectedPartIds, selectedPartId],
  );
  const outputOrigin = appMode === 'broadcast' ? getProjectCenter(projectResolution) : EDITOR_CAMERA_CENTER;
  const clientToSVG = useCallback(
    (clientX: number, clientY: number): { svgX: number; svgY: number } => {
      if (!containerRef.current || !cameraView) return { svgX: 0, svgY: 0 };
      const svg = containerRef.current.querySelector<SVGSVGElement>('svg.stage-svg');
      const screenMatrix = svg?.getScreenCTM?.();
      if (screenMatrix && typeof DOMPoint !== 'undefined') {
        const point = new DOMPoint(clientX, clientY).matrixTransform(screenMatrix.inverse());
        return { svgX: point.x, svgY: point.y };
      }
      const point = clientToCameraPoint({
        view: cameraView,
        clientX,
        clientY,
        zoom: zoomLevel,
        viewBox: EDITOR_CAMERA_VIEWBOX,
      });
      return { svgX: point.x, svgY: point.y };
    },
    [zoomLevel, cameraView]
  );

  // The crop region is authored in STAGE space (origin at the stage's top-left),
  // so the pointer is converted through the same camera transform every other
  // gesture uses and then translated by the stage origin.
  const clientToStage = useCallback(
    (clientX: number, clientY: number): CoordinatePoint => {
      const { svgX, svgY } = clientToSVG(clientX, clientY);
      return editorPointToStageSpace({ x: svgX, y: svgY }, projectResolution);
    },
    [clientToSVG, projectResolution],
  );

  // Freeform drawing state machine (active only while the tool is selected).
  const freeform = useFreeformDraw({
    enabled: activeTool === 'freeform_draw',
    getStagePoint: useCallback(
      (clientX: number, clientY: number) => {
        const { svgX, svgY } = clientToSVG(clientX, clientY);
        return { x: svgX - EDITOR_CAMERA_CENTER.x, y: svgY - EDITOR_CAMERA_CENTER.y };
      },
      [clientToSVG]
    ),
    getPixelsPerStageUnit: useCallback(() => {
      const svg = containerRef.current?.querySelector<SVGSVGElement>('svg.stage-svg');
      const matrix = svg?.getScreenCTM?.();
      return matrix ? Math.hypot(matrix.a, matrix.b) : 1;
    }, []),
    onComplete: useCallback(
      (stagePath: BezierPath, reason: FreeformFinishReason) => {
        // The layer sits at the centre of its points; the path (points AND
        // their tangents) is stored around it in the layer's local space.
        const { centerX, centerY } = normalizeFreeformPoints(stagePath.points);
        const path: BezierPath = { ...stagePath, points: stagePath.points.map((vertex) => ({
          ...vertex,
          x: vertex.x - centerX,
          y: vertex.y - centerY,
          ...(vertex.handleIn ? { handleIn: { x: vertex.handleIn.x - centerX, y: vertex.handleIn.y - centerY } } : {}),
          ...(vertex.handleOut ? { handleOut: { x: vertex.handleOut.x - centerX, y: vertex.handleOut.y - centerY } } : {}),
        })) };
        addCustomPart('custom_freeform', 'Freeform Shape', {
          path,
          // The legacy anchor list stays in step for readers that still use it.
          points: path.points.map(({ x, y }) => ({ x, y })),
          baseTransform: { x: centerX, y: centerY, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
        });
        // A finished drawing hands the stage back to Select; a tool switch
        // keeps the tool the user just chose.
        if (reason === 'finish') setActiveTool('select');
        // No confirmation for a finish the user asked for; a tool switch
        // finishing it implicitly is still said.
        else showToast('Freeform shape finished when you switched tools', 'info');
      },
      [addCustomPart, setActiveTool, showToast]
    ),
    onCancel: useCallback((hadDraft: boolean) => {
      // Escape is one level: it discards a draft and keeps the Pen; with no
      // draft it leaves the tool so clicks select again.
      if (hadDraft) return;
      setActiveTool('select');
    }, [setActiveTool]),
    onDiscard: useCallback(() => {
      showToast('Drawing discarded: a shape needs at least three points', 'info');
    }, [showToast]),
  });

  // An open freeform draft owns Undo/Redo (its own points), so the
  // command never reaches the scene history while the drawing is unfinished.
  useEffect(() => {
    if (!freeform.isDrawing) return undefined;
    registerDraftHistory({
      undo: freeform.undoDraft,
      redo: freeform.redoDraft,
      canUndo: freeform.canUndoDraft,
      canRedo: freeform.canRedoDraft,
    });
    return () => registerDraftHistory(null);
  }, [freeform.isDrawing, freeform.undoDraft, freeform.redoDraft, freeform.canUndoDraft, freeform.canRedoDraft, registerDraftHistory]);

  useEffect(() => {
    if (activeTool !== 'shape_create' && (shapeCreationStart || shapeCreationPreview)) {
      // Leaving shape-create mode clears its transient pointer session.
      // oxlint-disable-next-line react/set-state-in-effect
      setShapeCreationStart(null);
      setShapeCreationPreview(null);
    }
  }, [activeTool, shapeCreationStart, shapeCreationPreview]);

  const startTranslateDragForPart = (partId: string, e: React.MouseEvent) => {
    if (appMode === 'broadcast' || activeTool !== 'select' || e.button !== 0) return;
    // While a mask is edited on the canvas, no layer body starts a move —
    // the image under the mask must stay exactly where it is.
    if (maskInteractionActive) return;
    if (e.ctrlKey || e.metaKey) return;
    const draggedPart = characterParts.find((part) => part.id === partId);
    if (
      booleanOperandEditingGroupId
      && draggedPart
      && draggedPart.id !== booleanOperandEditingGroupId
      && draggedPart.booleanGroupId !== booleanOperandEditingGroupId
    ) {
      setBooleanOperandEditingGroupId(null);
    }
    e.stopPropagation();

    // The pointer lands on a child, but the gesture belongs to the layer
    // the click TARGETS: the child's group, unless the selection already lives
    // inside that group (the explicit drill-in paths: a canvas double-click or an
    // Outliner child row). A gesture that starts inside the selected group box
    // therefore still moves the container as one unit, and a gesture on a
    // drilled-in child moves that child.
    const dragTargetId = resolveStageSelectionTarget(characterParts, partId, canvasSelectionIds);
    const groupBodyDrag = dragTargetId !== partId;
    groupBodyDragRef.current = groupBodyDrag ? dragTargetId : null;
    groupDragMovedRef.current = false;
    if (groupBodyDrag) {
      // Selecting the container on the way down is what makes a first click on a
      // child select the group (and what the drag then moves).
      if (!selectedPartIds.includes(dragTargetId)) {
        handleSelectPart(dragTargetId);
      } else {
        setSelectedPartId(dragTargetId);
      }
    } else if (!selectedPartIds.includes(partId)) {
      handleSelectPart(partId);
    } else {
      setSelectedPartId(partId);
    }

    const transform = getComputedTransform(dragTargetId, currentFrame);
    if (!transform) return;

    // The snap context for this gesture, frozen now: the moving item's evaluated
    // world box (the union of the selection's group-aware boxes) and every
    // candidate line. `SNAP_THRESHOLD_SCREEN_PX` is a SCREEN radius; the camera
    // scale converts it to world units so the feel is identical at any zoom.
    const dragSelectionIds = selectedPartIds.includes(dragTargetId) ? canvasSelectionIds : [dragTargetId];
    const worldOf = (id: string) => getComputedTransform(id, currentFrame);
    const movingTargets = collectArrangeTargets(characterParts, dragSelectionIds, worldOf);
    // A move that would carry a locked layer (selected from the layer list,
    // or bonded to a moving one) is refused before it starts: all or nothing.
    const lockRefusal = lockedLayersRefusal(characterParts, tracks, movingTargets.flatMap((target) => resolveBondGroup(characterParts, target.id)));
    if (lockRefusal) {
      groupBodyDragRef.current = null;
      showToast(lockRefusal, 'error');
      return;
    }
    const movingBounds = movingTargets.length > 0
      ? unionWorldBounds(movingTargets.map((target) => target.bounds))
      : null;
    // ONE space for the whole snap: `getLayerWorldBounds` measures in the
    // project-relative world (`transform.x` is the offset from the stage centre),
    // and the stage box in that same space is simply ±half the resolution. The
    // overlay converts to the editor camera when it DRAWS a guide, never here.
    const stageBounds: PartWorldBounds = {
      minX: -projectResolution.width / 2,
      minY: -projectResolution.height / 2,
      maxX: projectResolution.width / 2,
      maxY: projectResolution.height / 2,
    };
    const candidates = [
      ...collectStageSnapCandidates(stageBounds),
      ...collectLayerSnapCandidates({
        parts: characterParts,
        // The layers the gesture really moves: the arrangement targets PLUS every
        // layer bonded to them. A bond carries its partners by the same world
        // delta (`updateCurrentTransform`), so a partner is leaving the box a
        // snap would lock onto — it must not be a candidate, exactly like the
        // containers that carry the moving layers.
        movingIds: movingTargets.flatMap((target) => resolveBondGroup(characterParts, target.id)),
        worldOf,
        isVisible: (part) => tracks.find((track) => track.partId === part.id)?.editVisible !== false,
      }),
    ];
    dragSnapRef.current = movingBounds
      ? { bounds: movingBounds, candidates, pxPerWorld: Math.max(1e-6, zoomLevel * (cameraView?.baseScale ?? 1)) }
      : null;
    setSnapGuides([]);

    startBatchInteraction();
    setIsDragging(true);
    setDragMode('translate');
    const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);

    setDragStart({
      x: svgX,
      y: svgY,
      initialTransform: { ...transform },
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // The crop mode owns the stage pointer while it is armed: a press on a handle
    // resizes the region, a press inside it moves it, and a press anywhere else
    // starts a new one. The document is untouched — the region is applied only by
    // the explicit `Apply crop` command.
    if (cropMode && appMode !== 'broadcast' && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      const handleElement = (e.target as Element).closest?.('[data-crop-handle]');
      const rawHandle = handleElement?.getAttribute('data-crop-handle') ?? null;
      const handle = isStageCropHandle(rawHandle) ? rawHandle : null;
      const point = clientToStage(e.clientX, e.clientY);
      const resizeHandle = handle && cropRegion ? handle : null;
      setIsDragging(true);
      setDragMode(resizeHandle
        ? 'crop_resize'
        : cropRegion && isStagePointInsideRect(point, cropRegion)
          ? 'crop_move'
          : 'crop_new');
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        initialTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
        cropAnchor: point,
        cropInitial: cropRegion ?? undefined,
        cropHandle: resizeHandle ?? undefined,
      });
      return;
    }

    if (activeTool === 'freeform_draw' && appMode !== 'broadcast' && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      freeform.beginDraw(e.clientX, e.clientY);
      return;
    }
    if (activeTool === 'shape_create' && appMode !== 'broadcast' && pendingShapeType && e.button === 0) {
      // An armed creation tool owns the press wherever it lands — on empty
      // stage or on top of an image — so drawing never selects what is below.
      const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      setDragMode('shape_create');
      setShapeCreationStart({ clientX: e.clientX, clientY: e.clientY, svgX, svgY });
      setShapeCreationPreview(null);
      return;
    }

    if (e.button === 2 || (e.button === 0 && activeTool === 'pan')) {
      e.preventDefault();
      rightPressRef.current = e.button === 2 ? { x: e.clientX, y: e.clientY, moved: false } : null;
      setIsDragging(true);
      setDragMode('pan');
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        initialTransform: { x: cameraView?.center.x ?? 0, y: cameraView?.center.y ?? 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      });
      return;
    }

    if (appMode === 'broadcast' || activeTool !== 'select') return;
    // An empty-stage press in mask editing neither clears the selection
    // (which would leave the mode) nor starts a layer marquee.
    if (maskInteractionActive) return;

    const target = e.target as HTMLElement;
    if (
      target === containerRef.current
      || target.tagName === 'svg'
      || target.classList.contains('canvas-bg')
      || target.classList.contains('focus-spotlight-dimmer')
    ) {
      handleSelectPart(null);
      setFocusModeNodeId(null);
      // Remembered BEFORE the press clears the selection — the box's
      // container-versus-child decision reads the set that was live on the way
      // down, exactly like a click's does.
      marqueeSelectionOriginRef.current = canvasSelectionIds;
      const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);
      setIsDragging(true);
      setDragMode('marquee');
      setDragStart({
        x: svgX,
        y: svgY,
        initialTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      });
    }
  };
  /**
   * The frame a gesture solves in (see `ResizeSolveFrame`): the layer's own world
   * pose, or its CONTAINER frame when the layer's world map is not a TRS. One
   * authority for the scale AND rotate gestures, so the two can never disagree
   * about which space a drag is expressed in.
   */
  const resolveSolveFrame = (part: CharacterPart, world: Transform & { affine?: WorldAffine }): ResizeSolveFrame => {
    const containerId = part.parentId ?? part.booleanGroupId;
    const containerPart = containerId ? characterParts.find((candidate) => candidate.id === containerId) : undefined;
    const containerWorld = world.affine && containerPart
      ? getComputedTransform(containerPart.id, currentFrame)
      : null;
    const containerInverse = containerWorld ? invertAffine(worldAffineOf(containerWorld)) : null;
    return containerWorld && containerInverse
      ? { transform: worldToContainerLocal(world, containerWorld), containerWorld, containerInverse }
      : { transform: world };
  };

  /** The gizmo of a locked layer (selected from the layer list) does not edit it. */
  const refuseLockedGizmo = (e: React.MouseEvent): boolean => {
    const lockRefusal = selectedPart ? lockedLayersRefusal(characterParts, tracks, resolveBondGroup(characterParts, selectedPart.id)) : null;
    if (!lockRefusal) return false;
    e.stopPropagation();
    showToast(lockRefusal, 'error');
    return true;
  };

  const startRotate = (e: React.MouseEvent) => {
    if (appMode === 'broadcast' || e.button !== 0 || !selectedPart || !selectedTransform) return;
    if (refuseLockedGizmo(e)) return;
    e.stopPropagation();
    startBatchInteraction();
    setIsDragging(true);
    setDragMode('rotate');

    // The layer turns about its own origin — the crosshair the coordinate
    // overlay marks — exactly as a keyframed rotation does, so a gesture and
    // an animation agree on where the layer turns. The angle is measured
    // around that origin in the frame the gesture solves in.
    const solveFrame = resolveSolveFrame(selectedPart, selectedTransform);
    const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);
    const pointer = pointInSolveFrame(svgPointToWorld({ x: svgX, y: svgY }), solveFrame);
    const initialAngleRad = Math.atan2(pointer.y - solveFrame.transform.y, pointer.x - solveFrame.transform.x);

    setDragInitialAngle(initialAngleRad);
    setDragStart({
      x: svgX,
      y: svgY,
      initialTransform: { ...selectedTransform },
      solveFrame,
    });
  };

  const startScale = (e: React.MouseEvent, mode: ScaleMode, bounds?: CornerBounds) => {
    if (appMode === 'broadcast' || e.button !== 0 || !selectedPart || !selectedTransform) return;
    if (refuseLockedGizmo(e)) return;
    e.stopPropagation();
    startBatchInteraction();
    setIsDragging(true);
    setDragMode(mode);

    // The frame the drag solves in: the layer's own world pose, unless the
    // nesting is sheared (a rotated child of an anisotropically scaled
    // container) — then the authored TRS model only holds in that container, so
    // the gesture is solved there and composed back into a world patch.
    const solveFrame = resolveSolveFrame(selectedPart, selectedTransform);

    const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);
    const pointer = pointInSolveFrame(svgPointToWorld({ x: svgX, y: svgY }), solveFrame);
    const dx = pointer.x - solveFrame.transform.x;
    const dy = pointer.y - solveFrame.transform.y;

    const rad = (-solveFrame.transform.rotation * Math.PI) / 180;
    const localX = Math.abs(dx * Math.cos(rad) - dy * Math.sin(rad));
    const localY = Math.abs(dx * Math.sin(rad) + dy * Math.cos(rad));

    setDragInitialLocalX(localX || 1);
    setDragInitialLocalY(localY || 1);
    setDragStart({
      x: svgX,
      y: svgY,
      initialTransform: { ...selectedTransform },
      corner: CORNER_BY_SCALE_MODE[mode],
      localBounds: bounds,
      solveFrame,
    });
  };

  const rafPanRef = useRef<number | null>(null);

  // The move handler runs before the pointer-up callback is declared, so it reads
  // the latest handler through a ref instead of closing over it (no dependency cycle).
  const handleMouseUpRef = useRef<(commitShape?: boolean) => void>(() => {});

  /** Remembers the pointer over the stage (world units): Paste lands there. */
  const handleStagePointerMove = useCallback((event: React.MouseEvent) => {
    const { svgX, svgY } = clientToSVG(event.clientX, event.clientY);
    rememberStagePointer(svgPointToWorld({ x: svgX, y: svgY }));
  }, [clientToSVG]);

  /** The last pointer of the drag, so a modifier key can re-solve it without a move. */
  const lastDragPointerRef = useRef<{ clientX: number; clientY: number; buttons: number } | null>(null);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragMode) return;
      lastDragPointerRef.current = { clientX: e.clientX, clientY: e.clientY, buttons: e.buttons };

      if (e.buttons === 0) {
        handleMouseUpRef.current();
        return;
      }

      // Crop authoring: the region is rewritten on every move and the DOCUMENT is
      // never touched — no batch interaction is open, so no history entry can be
      // produced by drawing or resizing the region.
      if (isCropGesture(dragMode)) {
        const region = resolveCropGesture(dragMode, dragStart, clientToStage(e.clientX, e.clientY), projectResolution);
        if (region) setCropRegion(region);
        return;
      }

      if (dragMode === 'pan') {
        const clientX = e.clientX;
        const clientY = e.clientY;
        const press = rightPressRef.current;
        if (press && !press.moved && Math.hypot(clientX - press.x, clientY - press.y) > RIGHT_CLICK_SLOP_PX) press.moved = true;
        // Below the slop a right press is still a click: the camera stays put.
        if (press && !press.moved) return;
        if (rafPanRef.current) cancelAnimationFrame(rafPanRef.current);
        rafPanRef.current = requestAnimationFrame(() => {
          const dx = clientX - dragStart.x;
          const dy = clientY - dragStart.y;
          setCameraView((view) => view
            ? { ...view, center: { x: dragStart.initialTransform.x + dx, y: dragStart.initialTransform.y + dy } }
            : view);
        });
        return;
      }

      const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);

      if (dragMode === 'marquee') {
        const minX = Math.min(dragStart.x, svgX);
        const minY = Math.min(dragStart.y, svgY);
        const w = Math.abs(svgX - dragStart.x);
        const h = Math.abs(svgY - dragStart.y);
        setMarqueeRect({ x: minX, y: minY, w, h });
        return;
      }
      if (dragMode === 'shape_create' && shapeCreationStart && pendingShapeType) {
        const distance = Math.hypot(e.clientX - shapeCreationStart.clientX, e.clientY - shapeCreationStart.clientY);
        if (distance >= 4) {
          const start = { x: shapeCreationStart.svgX, y: shapeCreationStart.svgY };
          // Shift draws an equal-sided shape (a square, a circle), as in other editors.
          // The Square and the Circle tools always keep equal sides.
          const drawn = getShapeCreationBounds(start, { x: svgX, y: svgY }, pendingShapeType === 'custom_box' || (pendingShapeType === 'custom_circle' && pendingShapeName === 'Circle') || e.shiftKey);
          // Alt draws from the centre: the press point is the middle of the shape.
          const bounds = e.altKey
            ? {
                minX: start.x - drawn.width, maxX: start.x + drawn.width,
                minY: start.y - drawn.height, maxY: start.y + drawn.height,
                width: drawn.width * 2, height: drawn.height * 2,
                centerX: start.x, centerY: start.y,
              }
            : drawn;
          setShapeCreationPreview({ type: pendingShapeType, bounds });
        }
        return;
      }

      if (!selectedPartId) return;

      if (dragMode === 'translate') {
        const { dx: deltaX, dy: deltaY } = getPointerDelta(
          { x: dragStart.x, y: dragStart.y },
          { x: svgX, y: svgY },
        );
        // Past pointer jitter this is a drag, not a click on the layer under it.
        if (Math.hypot(deltaX, deltaY) > 2) {
          groupDragMovedRef.current = true;
          suppressClickSelectRef.current = groupBodyDragRef.current !== null;
        }
        // Snap the PROPOSED world delta onto the frozen candidate lines. X and Y
        // resolve independently, so a corner lock is two axis snaps; the guides
        // are the matched lines the overlay draws. Snapping changes only the
        // authored transform delta — never the camera.
        const snapContext = dragSnapRef.current;
        let snappedDx = deltaX;
        let snappedDy = deltaY;
        if (snapContext) {
          const resolution = resolveSnap({
            movingBounds: snapContext.bounds,
            delta: { x: deltaX, y: deltaY },
            candidates: snapContext.candidates,
            thresholdWorld: SNAP_THRESHOLD_SCREEN_PX / snapContext.pxPerWorld,
            enabled: snapEnabled,
            movingAnchor: { x: dragStart.initialTransform.x, y: dragStart.initialTransform.y },
          });
          snappedDx = resolution.delta.x;
          snappedDy = resolution.delta.y;
          setSnapGuides(resolution.guides);
        }
        // ONE contract: updateCurrentTransform takes WORLD x/y and converts to
        // container-local per part (and propagates bonds). Passing the primary
        // part's world position moves the whole selection when it is multi.
        updateCurrentTransform({
          x: dragStart.initialTransform.x + snappedDx,
          y: dragStart.initialTransform.y + snappedDy,
        });
        return;
      }

      // Every other transform gesture is pure geometry (`stageGestures`): the
      // pointer becomes a WORLD patch, which the write authority converts into
      // the target's container-local space.
      const solved = resolveTransformGesture(dragMode, {
        start: dragStart,
        pointer: { x: svgX, y: svgY },
        initialAngle: dragInitialAngle,
        initialLocalX: dragInitialLocalX,
        initialLocalY: dragInitialLocalY,
        scaleLocked: isScaleLocked,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
      });
      if (solved) updateCurrentTransform(solved.patch, solved.targetId);
    },
    // The pointer-up effect owns the current mouse-up callback; adding the later-declared callback here would create a declaration cycle.
    [isDragging, dragMode, dragStart, clientToSVG, clientToStage, dragInitialAngle, dragInitialLocalX, dragInitialLocalY, selectedPartId, updateCurrentTransform, shapeCreationStart, pendingShapeType, pendingShapeName, isScaleLocked, snapEnabled, setCropRegion, projectResolution]
  );

  /**
   * What a marquee box selects: its hits as the CANONICAL selection — a
   * container when the children it enclosed belong to one (and no child border
   * is drawn for a normalized group), the layers themselves only when the user
   * is already working inside the group. The release commits it; while the box
   * is dragged the same answer is previewed.
   */
  const marqueeSelectionOf = useCallback((rect: { x: number; y: number; w: number; h: number }): string[] => {
    const trackOf = new Map(tracks.map((track) => [track.partId, track]));
    const hits = getPartsInMarquee(
      characterParts,
      (id) => getComputedTransform(id, currentFrame),
      rect,
      EDITOR_CAMERA_CENTER.x,
      EDITOR_CAMERA_CENTER.y,
      (part) => (
        trackOf.get(part.id)?.editVisible !== false
        // A locked layer is not picked by the box (nor by a click).
        && !trackOf.get(part.id)?.locked
        && (!part.booleanGroupId || part.booleanGroupId === booleanOperandEditingGroupId)
        && (!booleanOperandEditingGroupId || !part.booleanOperandIds?.length)
      ),
    );
    return resolveMarqueeSelection(characterParts, hits, marqueeSelectionOriginRef.current);
  }, [characterParts, tracks, currentFrame, getComputedTransform, booleanOperandEditingGroupId]);

  /** The boxes of the layers the marquee would select now (live preview). */
  const marqueePreviewBoxes = useMemo(() => {
    if (!marqueeRect) return [];
    const partById = new Map(characterParts.map((part) => [part.id, part]));
    // The marquee origin ref is set when the box starts; the preview reads it during the drag.
    // oxlint-disable-next-line react/refs
    return marqueeSelectionOf(marqueeRect).flatMap((id) => {
      const part = partById.get(id);
      if (!part) return [];
      const bounds = getPartWorldBounds(part, getComputedTransform(id, currentFrame), EDITOR_CAMERA_CENTER.x, EDITOR_CAMERA_CENTER.y);
      return Number.isFinite(bounds.minX) ? [{ id, ...bounds }] : [];
    });
  }, [marqueeRect, marqueeSelectionOf, characterParts, getComputedTransform, currentFrame]);

  const handleMouseUp = useCallback((commitShape: boolean = true) => {
    if (dragMode === 'shape_create') {
      if (commitShape && pendingShapeType === 'custom_text' && pendingShapeName && shapeCreationStart) {
        // The Text tool: a click places a text, a drag draws its box (and a
        // drawn box sets its size). Its style is picked in the options bar.
        startBatchInteraction();
        addCustomPart('custom_text', pendingShapeName, {
          ...getTextCreationProps(
            shapeCreationPreview?.bounds ?? null,
            { x: shapeCreationStart.svgX, y: shapeCreationStart.svgY },
            EDITOR_CAMERA_CENTER.x,
            EDITOR_CAMERA_CENTER.y,
          ),
        });
      } else if (commitShape && shapeCreationPreview && pendingShapeType && pendingShapeName) {
        const placement = getShapeCreationPlacement(pendingShapeType, shapeCreationPreview.bounds);
        if (placement) {
          startBatchInteraction();
          addCustomPart(pendingShapeType, pendingShapeName, { baseTransform: { ...placement, rotation: 0, opacity: 1 } });
        }
      }
      // Retire the gesture, not the tool: Escape or another tool ends creation.
      setShapeCreationStart(null);
      setShapeCreationPreview(null);
    }

    if (dragMode === 'marquee' && marqueeRect) {
      const selected = marqueeSelectionOf(marqueeRect);
      if (selected.length > 0) {
        setSelectedPartIds(selected);
        setSelectedPartId(selected[selected.length - 1]);
      }
    }

    // A gesture that began inside a group and never moved is a plain click
    // on the group — the container selected on pointerdown stays the selection,
    // and the child under the pointer is never selected by a click-through. The
    // gesture refs only retire here.
    groupBodyDragRef.current = null;
    groupDragMovedRef.current = false;

    // The snap guides are chrome of the live gesture: they go the moment the
    // drag does, along with the frozen context that produced them.
    dragSnapRef.current = null;
    setSnapGuides([]);

    if (isDragging) endBatchInteraction();
    setIsDragging(false);
    lastDragPointerRef.current = null;
    setDragMode(null);
    setMarqueeRect(null);
  }, [dragMode, shapeCreationPreview, shapeCreationStart, pendingShapeType, pendingShapeName, addCustomPart, startBatchInteraction, marqueeRect, marqueeSelectionOf, isDragging, endBatchInteraction, setSelectedPartIds, setSelectedPartId]);
  useEffect(() => {
    handleMouseUpRef.current = handleMouseUp;
  }, [handleMouseUp]);

  const handlePointerUp = useCallback(() => handleMouseUp(), [handleMouseUp]);

  const handlePointerCancel = useCallback(() => handleMouseUp(false), [handleMouseUp]);

  // Shift (equal sides, aspect lock) and Alt (from the centre) apply the moment
  // they are pressed or released, not on the next pointer move: the drag is
  // re-solved at the pointer where it rests.
  useEffect(() => {
    if (!isDragging) return undefined;
    const onModifier = (event: KeyboardEvent) => {
      if (event.key !== 'Shift' && event.key !== 'Alt') return;
      // Alt alone would focus the browser menu on release.
      if (event.key === 'Alt') event.preventDefault();
      const pointer = lastDragPointerRef.current;
      if (!pointer) return;
      handleMouseMove({ ...pointer, shiftKey: event.shiftKey, altKey: event.altKey } as MouseEvent);
    };
    window.addEventListener('keydown', onModifier);
    window.addEventListener('keyup', onModifier);
    return () => {
      window.removeEventListener('keydown', onModifier);
      window.removeEventListener('keyup', onModifier);
    };
  }, [isDragging, handleMouseMove]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handlePointerUp);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerCancel);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [isDragging, handleMouseMove, handlePointerUp, handlePointerCancel]);

  /**
   * Wheel zoom, smooth: the step follows the wheel's own distance (a trackpad
   * pinch sends many small ones, a mouse notch one larger), and every wheel
   * event of one animation frame is applied together, so the stage renders
   * once per frame however fast the events come.
   */
  const pendingWheelRef = useRef<{ deltaY: number; clientX: number; clientY: number; frame: number | null }>({ deltaY: 0, clientX: 0, clientY: 0, frame: null });
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current || !cameraViewRef.current || appMode === 'broadcast') return;
    const pending = pendingWheelRef.current;
    // Lines and pages count as about 40 and 800 pixels.
    pending.deltaY += e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1);
    pending.clientX = e.clientX;
    pending.clientY = e.clientY;
    if (pending.frame !== null) return;
    pending.frame = requestAnimationFrame(() => {
      pending.frame = null;
      const view = cameraViewRef.current;
      const deltaY = Math.max(-600, Math.min(600, pending.deltaY));
      pending.deltaY = 0;
      if (!view || deltaY === 0) return;
      const currentZoom = zoomRef.current;
      // 100 px of wheel (one mouse notch) is a 1.16x step.
      const nextZoom = clampZoom(currentZoom * Math.exp(-deltaY * 0.0015));
      if (nextZoom === currentZoom) return;
      zoomRef.current = nextZoom;
      setZoomLevel(nextZoom);
      setCameraView({
        baseScale: view.baseScale,
        center: getCursorAnchoredCameraCenter({
          view,
          clientX: pending.clientX,
          clientY: pending.clientY,
          zoom: currentZoom,
          nextZoom,
        }),
      });
    });
  }, [appMode]);
  useEffect(() => () => {
    const frame = pendingWheelRef.current.frame;
    if (frame !== null) cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    const handleViewportCommand = (event: Event) => {
      const type = (event as CustomEvent<{ type?: string }>).detail?.type;
      if (type === 'reset-view') {
        // Reset view position: re-centre the camera on the (possibly changed)
        // stage centre and keep the zoom — exactly what the floating viewport
        // toolbar's Reset View Position does. Only the camera moves.
        const box = stageBoxRef.current;
        if (!box) return;
        setCameraView((view) => (view
          ? { ...view, center: snapToDevicePixel({ x: box.left + box.width / 2, y: box.top + box.height / 2 }) }
          : view));
        return;
      }
      if (type === REFIT_UNTOUCHED_CAMERA_COMMAND) {
        const view = cameraViewRef.current;
        const opening = openingCameraCenterRef.current;
        const box = readStageBox();
        if (!view || !opening || !box || zoomRef.current !== 1) return;
        if (Math.hypot(view.center.x - opening.x, view.center.y - opening.y) > 0.5) return;
        const center = snapToDevicePixel({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
        stageBoxRef.current = box;
        openingCameraCenterRef.current = center;
        flushSync(() => {
          setStageBox(box);
          setCameraView({ center, baseScale: getStageFitScale(box, EDITOR_CAMERA_VIEWBOX) });
        });
        return;
      }
      if (type === REMEASURE_STAGE_BOX_COMMAND) {
        // Layout chrome (the timeline workspace) resizing announces itself in the
        // task that resized the DOM. The camera is a projection of the stage box,
        // so folding the new box in HERE — before the frame is painted — is what
        // keeps the authored world from being drawn for one frame against a box
        // it no longer has and then snapping back. The ResizeObserver stays as
        // the general safety net for every other layout change.
        const box = readStageBox();
        if (!box) return;
        flushSync(() => applyStageBox(box, false));
        return;
      }
      if (type !== 'zoom-in' && type !== 'zoom-out') return;
      const nextZoom = clampZoom(zoomRef.current * (type === 'zoom-in' ? 1.1 : 0.9));
      setZoomLevel(nextZoom);
    };
    window.addEventListener(WORKSPACE_LAYOUT_COMMAND_EVENT, handleViewportCommand);
    return () => window.removeEventListener(WORKSPACE_LAYOUT_COMMAND_EVENT, handleViewportCommand);
  }, [applyStageBox, readStageBox]);

  const [isDropTargetHover, setIsDropTargetHover] = useState<boolean>(false);
  const handleDragOverStage = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDropTargetHover) setIsDropTargetHover(true);
  };

  const handleDragLeaveStage = () => {
    setIsDropTargetHover(false);
  };

  const handleDropStage = (e: React.DragEvent) => {
    e.preventDefault();
    if (appMode === 'broadcast') return;
    setIsDropTargetHover(false);

    const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);

    // Handle Files (Canva-style Masking or New Media)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (isVideo || isImage) {
        // Which shape the drop landed on has to be decided now: the transfer's
        // file list is emptied as soon as the handler returns.
        const dropX = Math.round(svgX - EDITOR_CAMERA_CENTER.x);
        const dropY = Math.round(svgY - EDITOR_CAMERA_CENTER.y);
        let targetShapeId = null;
        for (let i = characterParts.length - 1; i >= 0; i--) {
          const part = characterParts[i];
          const transform = getComputedTransform(part.id, currentFrame);

          const dx = svgX - (EDITOR_CAMERA_CENTER.x + transform.x);
          const dy = svgY - (EDITOR_CAMERA_CENTER.y + transform.y);
          const rad = -transform.rotation * Math.PI / 180;
          const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
          const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
          const unscaledX = localX / Math.abs(transform.scaleX || 1);
          const unscaledY = localY / Math.abs(transform.scaleY || 1);

          const { halfW, halfH } = getPartBounds(part, transform);

          if (Math.abs(unscaledX) <= halfW && Math.abs(unscaledY) <= halfH) {
            // Only mask if it's a shape type
            if (part.type === 'custom_rect' || part.type === 'custom_card' || part.type === 'custom_banner') {
              targetShapeId = part.id;
              break;
            }
          }
        }

        // A `blob:` URL belongs to this document only: persisting one left the
        // saved project pointing at an address that dies with the page, so the
        // media came back as a broken image after a reload. The Media drawer
        // already stores self-contained data URLs, so a drop uses that same
        // durable form and keeps the file's bytes in the document.
        const reader = new FileReader();
        reader.onload = () => {
          const url = reader.result;
          if (typeof url !== 'string') {
            showToast(`"${file.name}" could not be read.`, 'error');
            return;
          }
          if (targetShapeId) {
            updatePartMedia(targetShapeId, url, isVideo ? 'video' : 'image');
          } else {
            // Drop in empty area -> create new media part
            addCustomPart(isVideo ? 'custom_video' : 'custom_image', file.name, {
              baseTransform: { x: dropX, y: dropY, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
              ...(isVideo ? { videoUrl: url } : { imageUrl: url }),
            });
          }
        };
        reader.onerror = () => showToast(`"${file.name}" could not be read.`, 'error');
        reader.readAsDataURL(file);
        return;
      }
    }

    // Handle UI Panel JSON drops. The payload rides an attacker-creatable MIME
    // type, so elementDropPayload.ts is the single authority that narrows it;
    // anything it refuses changes nothing in the document.
    const rawData = e.dataTransfer.getData('application/json');
    if (!rawData) return;
    const dropPayload = parseElementDropPayload(rawData);
    if (!dropPayload) {
      console.warn("Invalid drop payload");
      return;
    }
    addCustomPart(dropPayload.type, dropPayload.name, {
      baseTransform: {
        x: Math.round(svgX - EDITOR_CAMERA_CENTER.x),
        y: Math.round(svgY - EDITOR_CAMERA_CENTER.y),
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
      },
    });
  };

  const sortedParts = useMemo(() => stackingOrder(characterParts), [characterParts]);
  // What the stage paints: the layers laid out by their modifiers (text boxes,
  // auto size, follow, justify, repeated copies). The selection frame outlines
  // what is painted: the laid-out layer and its laid-out transform.
  const fittedLayers = useLayoutModifiers(sortedParts, tracks, activeTemplateId || 'Sequence', getComputedTransform);
  const fittedById = useMemo(() => new Map(fittedLayers.parts.map((part) => [part.id, part])), [fittedLayers.parts]);
  const getDisplayedTransform = fittedLayers.displayedTransform;
  /** A repeated copy is picked and dragged as the layer it repeats. */
  const stagePartIdOf = (id: string): string => fittedById.get(id)?.repeatSourceId ?? id;

  const selectPartFromStage = (id: string, event: React.MouseEvent) => {
    // A canvas click does not retarget the selection while
    // a mask is edited; the Outliner or Exit leaves the mode.
    if (maskInteractionActive) return;
    // The browser still fires a click when a drag ends on the
    // element it started on; that click must not steal the
    // selection back from the group the drag just moved.
    if (suppressClickSelectRef.current) {
      suppressClickSelectRef.current = false;
      return;
    }
    // A plain click selects the GROUP the geometry belongs
    // to; the layer itself is selected through an explicit
    // drill-in (`onDrillIn`) or from the timeline Outliner.
    handleSelectPart(
      resolveStageSelectionTarget(characterParts, id, canvasSelectionIds),
      event.ctrlKey || event.metaKey,
    );
  };
  const drillIntoPart = (id: string) => {
    if (maskInteractionActive) return;
    // Double-click enters the group: the pressed layer itself
    // becomes the selection, so the next click or drag on it edits
    // that layer. `selectedPartIds` keeps the primary a member of
    // the canonical set (the resolver reads it on the next press).
    setSelectedPartId(id);
    setSelectedPartIds([id]);
  };
  /**
   * The part layers are memoized: a camera or dock-layout frame (which
   * re-renders this canvas) re-renders no layer whose inputs are unchanged
   * (measured: every dock frame re-rendered every part). Their actions are one
   * stable bag that reads the latest handlers at call time.
   */
  const partLayerLatest = useRef({ selectPartFromStage, drillIntoPart, startTranslateDragForPart, stagePartIdOf });
  useLayoutEffect(() => {
    partLayerLatest.current = { selectPartFromStage, drillIntoPart, startTranslateDragForPart, stagePartIdOf };
  });
  const partLayerActions = useMemo(() => ({
    onSelect: (id: string, event: React.MouseEvent) => partLayerLatest.current.selectPartFromStage(partLayerLatest.current.stagePartIdOf(id), event),
    onDrillIn: (id: string) => partLayerLatest.current.drillIntoPart(partLayerLatest.current.stagePartIdOf(id)),
    onStartTranslateDrag: (partId: string, event: React.MouseEvent) => partLayerLatest.current.startTranslateDragForPart(partLayerLatest.current.stagePartIdOf(partId), event),
  }), []);
  const isPanning = activeTool === 'pan' || (isDragging && dragMode === 'pan');
  // A primitive draw tool that is armed (waiting for its drag) owns the stage
  // cursor: the canvas reads as a creation surface until Escape or the next
  // tool exits it, and the cursor returns with the state change itself.
  const isDrawToolArmed = (activeTool === 'shape_create' && Boolean(pendingShapeType)) || activeTool === 'freeform_draw';
  /*
   * The edit camera lives in the viewBox, not in a CSS scale.
   *
   * The viewBox spans the stage box at the camera's final scale
   * (baseScale × zoom), so the browser rasterises the world directly at the
   * size it is shown; the CSS transform is a pure translation whose fractional
   * part does not depend on the stage size (the viewBox origin is anchored at
   * the stage's whole-pixel centre). Before, the fixed 600×480 viewBox's fit
   * scale changed with every stage resize and a CSS scale undid it: the same
   * picture re-rasterised at a different scale and sub-pixel offset on every
   * frame of a timeline height drag or a dock settle — thin lines and edges
   * visibly shimmered. World-to-screen is unchanged:
   *   screen = view.center + (world − CAMERA_CENTER) × baseScale × zoom.
   */
  /*
   * C7b — the SVG itself has a fixed, whole-pixel size (the window's, see
   * `readEditSurface`) instead of the stage box's. A dock or timeline change
   * then leaves its size AND its viewBox untouched; at most the translation
   * changes (when the stage's left/top edge moves), which the compositor
   * applies without redrawing. Sizing it to the stage box re-rasterised the
   * whole drawing on every frame of a timeline ease and once per dock toggle,
   * at a fractional size: thin lines (the X axis, the grid) jumped between
   * two pixel rows for a frame — the "coordinate plane flickers" report.
   */
  const cameraScale = cameraView ? cameraView.baseScale * zoomLevel : 0;
  const surfaceHalfX = deviceHalf(editSurface.width);
  const surfaceHalfY = deviceHalf(editSurface.height);
  const editViewBox = appMode !== 'broadcast' && cameraView && stageBox && cameraScale > 0
    ? {
      x: EDITOR_CAMERA_CENTER.x - surfaceHalfX / cameraScale,
      y: EDITOR_CAMERA_CENTER.y - surfaceHalfY / cameraScale,
      width: editSurface.width / cameraScale,
      height: editSurface.height / cameraScale,
    }
    : null;
  /*
   * Screen pixels per stage unit. An authored shape stroke is drawn
   * non-scaling (so the layer's own scale, uniform or not, never thickens it:
   * a large rectangle is drawn as a scaled 120-unit one) and multiplied by
   * this, so it still zooms with the view. It is a CSS variable on the SVG:
   * a zoom step restyles it without re-rendering a single part.
   */
  const strokeViewScale = appMode === 'broadcast'
    ? (stageBox ? getStageFitScale(stageBox, projectResolution) : 1)
    : cameraScale > 0
      ? cameraScale
      : (stageBox ? getStageFitScale(stageBox, EDITOR_CAMERA_VIEWBOX) : 1);
  // The part of the camera space the stage box shows (the axis badges
  // sit at the visible end of each axis, not past the window's edge).
  const visibleCameraRect = cameraView && stageBox && cameraScale > 0
    ? {
      left: EDITOR_CAMERA_CENTER.x + (stageBox.left - cameraView.center.x) / cameraScale,
      right: EDITOR_CAMERA_CENTER.x + (stageBox.left + stageBox.width - cameraView.center.x) / cameraScale,
      top: EDITOR_CAMERA_CENTER.y + (stageBox.top - cameraView.center.y) / cameraScale,
      bottom: EDITOR_CAMERA_CENTER.y + (stageBox.top + stageBox.height - cameraView.center.y) / cameraScale,
    }
    : null;
  const cameraTransform = editViewBox && cameraView && stageBox
    ? {
      translateX: cameraView.center.x - stageBox.left - surfaceHalfX,
      translateY: cameraView.center.y - stageBox.top - surfaceHalfY,
      scale: 1,
    }
    : null;
  /**
   * The stage's dotted backdrop is anchored to the CAMERA, not to the
   * container's corner. Opening or closing a panel moves the container's edge
   * while the world keeps its screen position; a corner-anchored pattern then
   * slid under the content for the whole dock transition (measured: its phase
   * against the artboard changed 20 px → 12 px on a left-drawer toggle). With
   * this anchor the backdrop moves only with the camera (pan), never with
   * layout.
   */
  const backdropStyle = appMode !== 'broadcast' && cameraView && stageBox
    ? { backgroundPosition: `${cameraView.center.x - stageBox.left}px ${cameraView.center.y - stageBox.top}px, center center` }
    : undefined;

  /**
   * Pointer ownership. While a creation tool (Rectangle/Circle armed,
   * Pen), the Hand or the crop mode is active, the TOOL owns a primary press
   * on the stage: it is handled in the capture phase, before any layer body,
   * group frame or transform gizmo can turn it into a selection or a move, and
   * the click/double-click that follow are kept from selecting or drilling in.
   * Mask editing/drawing owns its own overlay and is excluded here. Stage
   * chrome (banners) is never a canvas press.
   */
  const toolOwnsStagePointer = appMode !== 'broadcast' && !maskInteractionActive && (
    cropMode
    || activeTool === 'freeform_draw'
    || activeTool === 'pan'
    || (activeTool === 'shape_create' && Boolean(pendingShapeType))
  );
  // The selection's transform handles are NOT chrome: while a tool owns the
  // stage, a press on a handle draws/pans like any other press (the gizmo is
  // shown passive, see `tool-owns-pointer` in StageCanvas.css). Resizing needs
  // Select (V / Escape).
  const isStageChrome = (target: EventTarget | null): boolean =>
    target instanceof Element && target.closest('[data-stage-chrome]') !== null;
  const handleToolOwnedMouseDownCapture = (e: React.MouseEvent) => {
    if (!toolOwnsStagePointer || e.button !== 0 || isStageChrome(e.target)) return;
    e.stopPropagation();
    handleMouseDown(e);
  };
  const handleToolOwnedClickCapture = (e: React.MouseEvent) => {
    if (!toolOwnsStagePointer || isStageChrome(e.target)) return;
    e.stopPropagation();
  };
  const handleToolOwnedDoubleClickCapture = (e: React.MouseEvent) => {
    if (!toolOwnsStagePointer || isStageChrome(e.target)) return;
    e.stopPropagation();
    if (activeTool === 'freeform_draw') {
      e.preventDefault();
      freeform.finishDraw();
    }
  };

  /**
   * The canvas mask-editing context: the owner, its mask as the
   * renderer evaluates it at this frame of the active sequence, the owner's
   * evaluated pose, and the reason editing is refused (locked mask, an IN/OUT
   * preset moving the layer, a collapsed map), if any.
   */
  const maskEditing = (() => {
    if (!maskEditTarget || appMode === 'broadcast') return null;
    const owner = characterParts.find((part) => part.id === maskEditTarget.ownerPartId);
    if (!owner) return null;
    const ownerTrack = tracks.find((track) => track.partId === owner.id);
    const mask = evaluateLayerMasks(owner, ownerTrack, currentFrame, activeTemplateId || 'Sequence')
      ?.find((candidate) => candidate.id === maskEditTarget.maskId);
    if (!mask) return null;
    const transform = getComputedTransform(owner.id, currentFrame);
    const block = resolveMaskEditBlock({
      part: owner,
      mask,
      tracks,
      totalFrames,
      frame: currentFrame,
      customPresets,
      hasLiveStunt: Object.prototype.hasOwnProperty.call(liveStuntsState, owner.id),
      frameMap: resolveMaskPathFrame(owner, mask.path.coordinateSpace, transform),
      isPlaying,
    });
    return { owner, mask, transform, block };
  })();

  /** The mask-drawing context: owner, pose and refusal reason. */
  const maskDrawing = (() => {
    if (!maskDrawSession || appMode === 'broadcast') return null;
    const owner = characterParts.find((part) => part.id === maskDrawSession.ownerPartId);
    if (!owner) return null;
    const transform = getComputedTransform(owner.id, currentFrame);
    const block = resolveMaskEditBlock({
      part: owner,
      mask: { id: '', name: '', mode: 'add', path: { version: 1, coordinateSpace: 'normalized', closed: true, points: [] } },
      tracks,
      totalFrames,
      frame: currentFrame,
      customPresets,
      hasLiveStunt: Object.prototype.hasOwnProperty.call(liveStuntsState, owner.id),
      frameMap: resolveMaskPathFrame(owner, 'normalized', transform),
      isPlaying,
    });
    return { owner, shape: maskDrawSession.shape, transform, block };
  })();

  /** What is being edited: one description for the strip and the Inspector. */
  const editTarget = resolveEditTarget({
    characterParts,
    selectedPartId,
    selectedPartIds,
    maskEditTarget,
    maskDrawSession,
    matteReturnTargetId,
    activeTool,
    pendingShapeType,
    freeformPointCount: freeform.isDrawing ? freeform.points.length : null,
    lockedIds: lockedLayerIds(tracks),
  });

  /**
   * Right-click on the stage opens the shared authoring menu. The target is the
   * topmost rendered layer under the pointer, read from the real DOM (the
   * rendered part node carries `data-part-id`) instead of a second hit-test
   * implementation; no layer under the pointer means the empty-stage menu.
   */
  // The path's points close when the selection moves to another layer
  // (adjusted while rendering, React's pattern for state that follows a prop).
  const [pathEditSelection, setPathEditSelection] = useState(selectedPartId);
  if (pathEditSelection !== selectedPartId) {
    setPathEditSelection(selectedPartId);
    if (pathEditPartId && pathEditPartId !== selectedPartId) setPathEditPartId(null);
  }
  useEffect(() => {
    if (!pathEditPartId) return undefined;
    // Escape during a point or handle drag cancels the drag (the overlay's
    // own Escape); only with no button held does it close the points.
    let pressed = false;
    const onDown = () => { pressed = true; };
    const onUp = () => { pressed = false; };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pressed) setPathEditPartId(null);
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [pathEditPartId]);

  /**
   * Double-click edit modes, with the Select tool:
   * - a freeform path opens its points;
   * - a Boolean result opens its operands (they can be selected and moved);
   * - a layer with a mask opens the mask on the canvas.
   * A double-click outside the layer being edited, or on it again, closes the
   * mode. (Inside an open path or mask, a double-click on its outline still
   * adds a point: those overlays take the event first.)
   */
  const handleStageDoubleClick = (event: React.MouseEvent): boolean => {
    if (appMode === 'broadcast' || activeTool !== 'select') return false;
    // The layer under the pointer, through the selection frame and other
    // chrome drawn over it.
    const targetId = (typeof document.elementsFromPoint === 'function'
      ? document.elementsFromPoint(event.clientX, event.clientY)
      : [event.target as Element])
      .map((element) => element.closest('[data-part-id]')?.getAttribute('data-part-id'))
      .find((id): id is string => Boolean(id)) ?? null;
    const part = targetId ? characterParts.find((candidate) => candidate.id === targetId) : undefined;
    if (pathEditPartId) {
      setPathEditPartId(null);
      return true;
    }
    if (maskEditTarget) {
      exitMaskEditing();
      return true;
    }
    if (booleanOperandEditingGroupId) {
      setBooleanOperandEditingGroupId(null);
      if (part?.booleanGroupId === booleanOperandEditingGroupId) handleSelectPart(booleanOperandEditingGroupId);
      return true;
    }
    if (!part) return false;
    const group = part.booleanOperandIds?.length ? part : part.booleanGroupId ? characterParts.find((candidate) => candidate.id === part.booleanGroupId) : undefined;
    if (group) {
      setBooleanOperandEditingGroupId(group.id);
      handleSelectPart(part.id !== group.id ? part.id : group.booleanOperandIds?.[0] ?? group.id);
      return true;
    }
    if (part.type === 'custom_freeform' && !part.booleanContours) {
      handleSelectPart(part.id);
      setPathEditPartId(part.id);
      return true;
    }
    if (part.masks?.length) {
      handleSelectPart(part.id);
      const refusal = enterMaskEditing(part.id, part.masks[part.masks.length - 1].id);
      if (refusal) showToast(refusal, 'error');
      return true;
    }
    return false;
  };

  /**
   * The second press of a double-click (the browser's click count): the first
   * press already selected and may have re-drawn the layer, so the browser's
   * own dblclick event is not reliable here. A double-click inside an open path
   * or mask belongs to that overlay (it adds a point or switches its type).
   */
  const handleStageMouseDownCapture = (event: React.MouseEvent) => {
    const inEditOverlay = (event.target as Element).closest('[data-testid="freeform-tangent-overlay"], [data-testid="mask-path-overlay"]');
    if (event.button === 0 && event.detail === 2 && !inEditOverlay && handleStageDoubleClick(event)) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    handleToolOwnedMouseDownCapture(event);
  };

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    const press = rightPressRef.current;
    rightPressRef.current = null;
    // A right-drag panned the stage: its release is not a menu request.
    if (press?.moved) return;
    // `contextmenu` on press (macOS): the menu wins and the pan never starts.
    if (press && (event.buttons & 2)) {
      setIsDragging(false);
      setDragMode(null);
    }
    if (appMode === 'broadcast') return;
    const target = event.target as Element | null;
    const partId = target?.closest('[data-part-id]')?.getAttribute('data-part-id') ?? null;
    openContextMenu({ point: { x: event.clientX, y: event.clientY }, targetId: partId });
  }, [appMode, openContextMenu]);

  return (
    <div
      className={`stage-canvas-container ${isPanning ? 'panning' : ''} ${activeTool === 'pan' ? 'hand-tool' : 'select-tool'} ${isDragging ? 'interaction-dragging' : ''} ${cropMode ? 'crop-mode' : ''} ${isDrawToolArmed ? 'drawing-tool' : ''} ${toolOwnsStagePointer ? 'tool-owns-pointer' : ''}`}
      data-camera-zoom={zoomLevel}
      style={backdropStyle}
      ref={containerRef}
      onMouseDownCapture={handleStageMouseDownCapture}
      onClickCapture={handleToolOwnedClickCapture}
      onDoubleClickCapture={handleToolOwnedDoubleClickCapture}
      onMouseDown={handleMouseDown}
      onMouseMove={handleStagePointerMove}
      data-edit-mode={pathEditPartId ? 'path' : maskEditTarget ? 'mask' : booleanOperandEditingGroupId ? 'boolean' : undefined}
      onMouseLeave={leaveStage}
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOverStage}
      onDragLeave={handleDragLeaveStage}
      onDrop={handleDropStage}
    >
      {isDropTargetHover && (
        <div className="canvas-drop-zone-overlay">
          <div style={{ color: 'var(--accent-teal)', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} />
            <span>RELEASE TO DROP ELEMENT ONTO STAGE CANVAS</span>
          </div>
        </div>
      )}

      <svg
        className={`stage-svg${editViewBox ? ' is-edit-surface' : ''}`}
        width={editViewBox ? editSurface.width : '100%'}
        height={editViewBox ? editSurface.height : '100%'}
        viewBox={appMode === 'broadcast'
          ? `0 0 ${projectResolution.width} ${projectResolution.height}`
          : editViewBox
            ? `${editViewBox.x} ${editViewBox.y} ${editViewBox.width} ${editViewBox.height}`
            : `0 0 ${EDITOR_CAMERA_VIEWBOX.width} ${EDITOR_CAMERA_VIEWBOX.height}`}
        preserveAspectRatio="xMidYMid meet"

        style={{
          // Identity while broadcast shows the fitted artboard and while the
          // edit camera has not been anchored yet (the mount view).
          transform: cameraTransform
            ? `translate(${cameraTransform.translateX}px, ${cameraTransform.translateY}px)`
            : 'translate(0px, 0px)',
          transformOrigin: '0 0',
          ...(editViewBox ? { width: `${editSurface.width}px`, height: `${editSurface.height}px` } : {}),
          cursor: isDrawToolArmed ? 'crosshair' : undefined,
          ['--kcs-stroke-scale' as string]: String(strokeViewScale),
        }}
      >
        <defs>
          {/* Minor grid: 50px cells anchored at the origin (2 cells = 100px = 1 unit) */}
          <pattern
            id="svg-grid-minor"
            width="50"
            height="50"
            patternUnits="userSpaceOnUse"
            x={EDITOR_CAMERA_CENTER.x}
            y={EDITOR_CAMERA_CENTER.y}
          >
            {/* Both edges of the tile, so a line is centred on its grid position
                (one edge alone left half the line clipped, off the axis), and
                one screen pixel wide at any zoom. */}
            <path d="M 0 0 V 50 M 50 0 V 50 M 0 0 H 50 M 0 50 H 50" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth={1 / Math.max(0.05, zoomLevel)} />
          </pattern>
          {/* Major grid: 100px lines anchored at the origin (1 cell = 100px = 1 unit) */}
          <pattern
            id="svg-grid-major"
            width="100"
            height="100"
            patternUnits="userSpaceOnUse"
            x={EDITOR_CAMERA_CENTER.x}
            y={EDITOR_CAMERA_CENTER.y}
          >
            <path d="M 0 0 V 100 M 100 0 V 100 M 0 0 H 100 M 0 100 H 100" fill="none" stroke="rgba(255, 255, 255, 0.10)" strokeWidth={1 / Math.max(0.05, zoomLevel)} />
          </pattern>
          <clipPath id="artboard-clip">
            <rect
              x={outputOrigin.x - projectResolution.width / 2}
              y={outputOrigin.y - projectResolution.height / 2}
              width={projectResolution.width}
              height={projectResolution.height}
            />
          </clipPath>
          <filter id="artboard-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="12" stdDeviation="24" floodColor="#000000" floodOpacity="0.8" />
          </filter>
        </defs>

        {(() => {
          const zScale = 1 / Math.max(0.05, zoomLevel);
          const artX = outputOrigin.x - projectResolution.width / 2;
          const artY = outputOrigin.y - projectResolution.height / 2;

          return (
            <>
              {/* Artboard Base & Shadow */}
              <rect
                className="canvas-bg"
                x={artX}
                y={artY}
                width={projectResolution.width}
                height={projectResolution.height}
                fill="var(--bg-darkest)"
                filter="url(#artboard-shadow)"
              />

              {/* Grid & Origin Axes Overlay */}
              <CanvasGridOverlay
                artX={artX}
                artY={artY}
                width={projectResolution.width}
                height={projectResolution.height}
                zScale={zScale}
                showGrid={appMode === 'broadcast' ? false : showGrid}
                appMode={appMode}
                origin={EDITOR_CAMERA_CENTER}
              />

              {/* Character Parts Active Render (Clipped in Broadcast mode, unclipped & visible in Edit mode) */}
              <StagePartLayers
                sortedParts={fittedLayers.parts}
                appMode={appMode}
                broadcastState={broadcastState}
                broadcastSessionActivated={broadcastSessionActivated}
                namedSequenceRuntime={namedSequenceRuntime}
                activeTemplateId={activeTemplateId}
                currentFrame={currentFrame}
                totalFrames={totalFrames}
                tracks={fittedLayers.tracks}
                selectedPartId={selectedPartId}
                selectedPartIds={selectedPartIds}
                booleanOperandEditingGroupId={booleanOperandEditingGroupId}
                onSelect={partLayerActions.onSelect}
                onDrillIn={partLayerActions.onDrillIn}
                customPresets={customPresets}
                liveStuntsState={liveStuntsState}
                onStartTranslateDrag={partLayerActions.onStartTranslateDrag}
                projectResolution={projectResolution}
              />

              {appMode !== 'broadcast' && showCoordinateOverlay && (
                <CanvasCoordinateOverlay
                  artX={artX}
                  artY={artY}
                  width={projectResolution.width}
                  height={projectResolution.height}
                  origin={EDITOR_CAMERA_CENTER}
                  zScale={zScale}
                  visibleRect={visibleCameraRect}
                />
              )}

              {/* Pen drawing preview: the path so far (with its tangents), the
                  live segment to the cursor, and the handles of the point being
                  shaped. */}
              {freeform.isDrawing && freeform.points.length > 0 && (
                <g transform={`translate(${EDITOR_CAMERA_CENTER.x}, ${EDITOR_CAMERA_CENTER.y})`} pointerEvents="none" data-testid="pen-draft">
                  <path
                    data-testid="pen-draft-path"
                    d={buildBezierPathD({
                      ...penAnchorsToPath([...freeform.points, ...(freeform.cursorPoint && !freeform.cursorClosesShape ? [freeform.cursorPoint] : [])], 'local', freeform.cursorClosesShape),
                    })}
                    fill="rgba(56, 189, 248, 0.10)"
                    stroke="var(--accent-cyan)"
                    strokeWidth={1.5 * zScale}
                    strokeDasharray="5 3"
                    strokeLinejoin="round"
                  />
                  {freeform.points.map((p, i) => {
                    const shaping = freeform.activeIndex === i || (freeform.activeIndex === null && i === freeform.points.length - 1);
                    return (
                      <g key={`vf-${i}`}>
                        {shaping && [p.handleIn, p.handleOut].map((handle, side) => handle && (
                          <g key={side} data-testid="pen-draft-handle">
                            <line x1={p.x} y1={p.y} x2={handle.x} y2={handle.y} stroke="#facc15" strokeWidth={1.2 * zScale} />
                            <circle cx={handle.x} cy={handle.y} r={3.5 * zScale} fill="#facc15" stroke="#0f172a" strokeWidth={1 * zScale} />
                          </g>
                        ))}
                        <circle
                          data-testid="freeform-draft-point"
                          data-point-kind={p.handleOut || p.handleIn ? 'smooth' : 'corner'}
                          data-close-target={i === 0 && freeform.cursorClosesShape ? 'true' : undefined}
                          cx={p.x}
                          cy={p.y}
                          r={(i === 0 && freeform.cursorClosesShape ? 6 : i === 0 ? 3.5 : 3) * zScale}
                          fill={i === 0 && freeform.cursorClosesShape ? '#0f172a' : p.handleOut || p.handleIn ? '#0f172a' : '#38bdf8'}
                          stroke="#38bdf8"
                          strokeWidth={1.5 * zScale}
                        />
                      </g>
                    );
                  })}
                  {freeform.cursorPoint && (
                    <text x={freeform.cursorPoint.x} y={freeform.cursorPoint.y - 10 * zScale} fontSize={10 * zScale} fill="#7dd3fc" textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {freeform.cursorClosesShape ? 'Click to close the shape' : freeform.canFinish ? 'Click: corner · Drag: smooth · First point closes' : 'Click: corner point · Drag: smooth point'}
                    </text>
                  )}
                </g>
              )}

              {shapeCreationPreview && pendingShapeType && (
                <ShapeCreationPreview
                  type={pendingShapeType}
                  bounds={shapeCreationPreview.bounds}
                  outputOrigin={EDITOR_CAMERA_CENTER}
                />
              )}

              {/* Rotation ring: while the rotate handle is dragged, a circle
                  around the pivot with the start and current angle, so the turn
                  reads like a dial. Chrome only, never hit-tested. */}
              {isDragging && dragMode === 'rotate' && dragStart && selectedTransform && (() => {
                const pivot = { x: dragStart.initialTransform.x + EDITOR_CAMERA_CENTER.x, y: dragStart.initialTransform.y + EDITOR_CAMERA_CENTER.y };
                const radius = Math.hypot(dragStart.x - pivot.x, dragStart.y - pivot.y);
                if (!(radius > 0)) return null;
                const startAngle = Math.atan2(dragStart.y - pivot.y, dragStart.x - pivot.x);
                const turned = ((selectedTransform.rotation - dragStart.initialTransform.rotation) * Math.PI) / 180;
                const end = startAngle + turned;
                const at = (angle: number) => ({ x: pivot.x + radius * Math.cos(angle), y: pivot.y + radius * Math.sin(angle) });
                const from = at(startAngle);
                const to = at(end);
                const sweep = Math.abs(turned) % (2 * Math.PI);
                return (
                  <g className="rotation-ring" data-testid="rotation-ring" pointerEvents="none">
                    <circle cx={pivot.x} cy={pivot.y} r={radius} fill="none" stroke="rgba(255, 177, 59, 0.55)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                    {sweep > 0.001 && (
                      <path
                        d={`M ${pivot.x} ${pivot.y} L ${from.x} ${from.y} A ${radius} ${radius} 0 ${sweep > Math.PI ? 1 : 0} ${turned > 0 ? 1 : 0} ${to.x} ${to.y} Z`}
                        fill="rgba(255, 177, 59, 0.14)"
                        stroke="none"
                      />
                    )}
                    <line x1={pivot.x} y1={pivot.y} x2={from.x} y2={from.y} stroke="rgba(255, 255, 255, 0.35)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                    <line x1={pivot.x} y1={pivot.y} x2={to.x} y2={to.y} stroke="#ffb13b" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                  </g>
                );
              })()}

              {/* Marquee live preview: the layers the release will select. */}
              {marqueePreviewBoxes.length > 0 && (
                <g className="marquee-preview" data-testid="marquee-preview" pointerEvents="none">
                  {(marqueePreviewBoxes.length > 200
                    ? [{
                        id: 'union',
                        minX: Math.min(...marqueePreviewBoxes.map((box) => box.minX)),
                        minY: Math.min(...marqueePreviewBoxes.map((box) => box.minY)),
                        maxX: Math.max(...marqueePreviewBoxes.map((box) => box.maxX)),
                        maxY: Math.max(...marqueePreviewBoxes.map((box) => box.maxY)),
                      }]
                    : marqueePreviewBoxes
                  ).map((box) => (
                    <rect
                      key={box.id}
                      data-preview-part-id={box.id}
                      x={box.minX}
                      y={box.minY}
                      width={box.maxX - box.minX}
                      height={box.maxY - box.minY}
                      fill="none"
                      stroke="var(--accent-cyan)"
                      strokeWidth={1.5}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </g>
              )}

              {/* Marquee Tool */}
              {marqueeRect && (
                <rect
                  x={marqueeRect.x}
                  y={marqueeRect.y}
                  width={marqueeRect.w}
                  height={marqueeRect.h}
                  fill="rgba(56, 189, 248, 0.1)"
                  stroke="var(--accent-cyan)"
                  strokeWidth={1 / zoomLevel}
                  strokeDasharray="4,4"
                  pointerEvents="none"
                  z-index="1000"
                />
              )}

              {/* Outer Matte Mask (Soft dim in Edit mode, 100% Solid Black in Broadcast mode) */}
              <path
                className="canvas-bg"
                d={`M-300000,-300000 L300000,-300000 L300000,300000 L-300000,300000 Z M${artX},${artY} L${artX},${artY + projectResolution.height} L${artX + projectResolution.width},${artY + projectResolution.height} L${artX + projectResolution.width},${artY} Z`}
                fill={appMode === 'broadcast' ? '#000000' : 'rgba(0, 0, 0, 0.45)'}
                fillRule="evenodd"
                pointerEvents="none"
              />

              {/* Artboard Border Outline */}
              <rect
                x={artX}
                y={artY}
                width={projectResolution.width}
                height={projectResolution.height}
                fill="none"
                stroke={appMode === 'broadcast' ? 'none' : 'rgba(255, 255, 255, 0.15)'}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />

              {/* Stage crop / region of interest. The region is authored in stage
                  space and drawn here in the editor camera; the eight handles are
                  the pointer targets of the resize gesture. Nothing here writes
                  the document — `Apply crop` does, as one undo step. */}
              {cropMode && appMode !== 'broadcast' && (() => {
                const handleSize = 9 * zScale;
                const half = handleSize / 2;
                const region = cropRegion ? stageSpaceToEditorRect(cropRegion, projectResolution) : null;
                const centers = region ? stageCropHandleCenters(region) : null;
                return (
                  <g className="stage-crop-overlay" data-crop-active="true">
                    {region && (
                      <>
                        <path
                          className="stage-crop-dimmer"
                          d={`M-300000,-300000 L300000,-300000 L300000,300000 L-300000,300000 Z M${region.x},${region.y} L${region.x},${region.y + region.height} L${region.x + region.width},${region.y + region.height} L${region.x + region.width},${region.y} Z`}
                          fillRule="evenodd"
                          pointerEvents="none"
                        />
                        <rect
                          className="stage-crop-region"
                          x={region.x}
                          y={region.y}
                          width={region.width}
                          height={region.height}
                          strokeWidth={2 * zScale}
                          pointerEvents="none"
                        />
                        <text
                          className="stage-crop-size"
                          x={region.x}
                          y={region.y - 6 * zScale}
                          fontSize={11 * zScale}
                          pointerEvents="none"
                        >
                          {`${Math.round(region.width)} × ${Math.round(region.height)}`}
                        </text>
                        {centers && STAGE_CROP_HANDLES.map((handle) => {
                          const center = centers[handle];
                          return (
                            <rect
                              key={handle}
                              className={`stage-crop-handle stage-crop-handle-${handle}`}
                              data-crop-handle={handle}
                              x={center.x - half}
                              y={center.y - half}
                              width={handleSize}
                              height={handleSize}
                            />
                          );
                        })}
                      </>
                    )}
                    {!region && (
                      <text
                        className="stage-crop-hint"
                        x={EDITOR_CAMERA_CENTER.x}
                        y={EDITOR_CAMERA_CENTER.y}
                        fontSize={12 * zScale}
                        textAnchor="middle"
                        pointerEvents="none"
                      >
                        Drag a region on the stage, then apply the crop
                      </text>
                    )}
                  </g>
                );
              })()}

              {/* Smart guides of the live snap: decorative chrome, no pointer
                  events, gone the instant the snap is no longer active. Both the
                  locked coordinate and the band it is drawn over arrive from the
                  resolver in project-relative world units, so this block only adds
                  the editor camera origin — it never invents an extent, which is
                  what used to make every fired snap paint the whole canvas. */}
              {snapGuides.length > 0 && (
                <g className="snap-guides" pointerEvents="none" aria-hidden="true">
                  {snapGuides.map((guide) => (guide.axis === 'x'
                    ? (
                      <line
                        key={`snap-x-${guide.value}`}
                        className="snap-guide"
                        x1={EDITOR_CAMERA_CENTER.x + guide.value}
                        y1={EDITOR_CAMERA_CENTER.y + guide.extent.min}
                        x2={EDITOR_CAMERA_CENTER.x + guide.value}
                        y2={EDITOR_CAMERA_CENTER.y + guide.extent.max}
                        strokeWidth={1 / zoomLevel}
                      />
                    )
                    : (
                      <line
                        key={`snap-y-${guide.value}`}
                        className="snap-guide"
                        x1={EDITOR_CAMERA_CENTER.x + guide.extent.min}
                        y1={EDITOR_CAMERA_CENTER.y + guide.value}
                        x2={EDITOR_CAMERA_CENTER.x + guide.extent.max}
                        y2={EDITOR_CAMERA_CENTER.y + guide.value}
                        strokeWidth={1 / zoomLevel}
                      />
                    )))}
                </g>
              )}

              {/* Interactive Transform Gizmo (Only in Edit Mode when not hard-hidden;
                  hidden while a mask is edited, so the layer box cannot be grabbed) */}
              {appMode !== 'broadcast' && !maskInteractionActive && (
                <SelectionGizmo
                  selectedPartIds={selectedPartIds}
                  characterParts={fittedLayers.parts}
                  getComputedTransform={getDisplayedTransform}
                  currentFrame={currentFrame}
                  selectedPart={selectedPart ? fittedById.get(selectedPart.id) ?? selectedPart : selectedPart}
                  selectedTransform={selectedPartId ? getDisplayedTransform(selectedPartId, currentFrame) : selectedTransform}
                  tracks={tracks}
                  zScale={zScale}
                  booleanOperandEditingGroupId={booleanOperandEditingGroupId}
                  onRotateStart={startRotate}
                  onScaleStart={startScale}
                  onTranslateStart={startTranslateDragForPart}
                  outputOrigin={EDITOR_CAMERA_CENTER}
                  isPlaying={isPlaying}
                />
              )}

              {/* Direct tangent-handle authoring for the selected freeform layer */}
              {!maskInteractionActive && selectedPart && selectedTransform && pathEditPartId === selectedPart.id && isFreeformTangentOverlayEligible({
                appMode,
                activeTool,
                selectedPartIds,
                selectedPart,
                selectedTransform,
                tracks,
                isDragging,
              }) && (
                <FreeformTangentOverlay
                  part={selectedPart}
                  transform={selectedTransform}
                  zScale={zScale}
                  toWorld={clientToSVG}
                  outputOrigin={EDITOR_CAMERA_CENTER}
                  onPathChange={(nextPath) => setPartPath(selectedPart.id, nextPath)}
                  onBatchStart={startBatchInteraction}
                  onBatchEnd={endBatchInteraction}
                  selectedIndex={pathVertex?.partId === selectedPart.id ? pathVertex.index : null}
                  onSelectIndex={(index) => selectPathVertex(selectedPart.id, index)}
                />
              )}

              {/* WP-02: on-canvas editing of the targeted layer mask */}
              {maskEditing && (
                <MaskPathOverlay
                  owner={maskEditing.owner}
                  maskId={maskEditing.mask.id}
                  path={maskEditing.mask.path}
                  transform={maskEditing.transform}
                  zScale={zScale}
                  toWorld={clientToSVG}
                  editKey={`${activeTemplateId || 'Sequence'}@${currentFrame}`}
                  interactive={!maskEditing.block}
                  onPathChange={(nextPath) => authorMaskPath(maskEditing.owner.id, maskEditing.mask.id, nextPath)}
                  onBatchStart={startBatchInteraction}
                  onBatchEnd={endBatchInteraction}
                  captureSnapshot={() => captureMaskGestureSnapshot(maskEditing.owner.id)}
                  cancelGesture={cancelMaskGesture}
                  registerGestureCancel={registerMaskGestureCancel}
                  selectedIndex={maskVertexIndex}
                  onSelectIndex={setMaskVertexIndex}
                  onInsertVertex={(world) => {
                    const frame = resolveMaskPathFrame(maskEditing.owner, maskEditing.mask.path.coordinateSpace, maskEditing.transform);
                    if (!frame) return;
                    // A point goes on the outline only: the hit area also fills
                    // the inside (to drag the mask), and a double-click there
                    // used to add a point on the nearest edge. Inside, the
                    // double-click closes the mask, as one on a path's body
                    // closes its points (the second double-click leaves the mode).
                    const near = nearestMaskPathSegment(maskEditing.mask.path, frame, world);
                    if (!near || near.distance > MASK_OUTLINE_INSERT_RADIUS * zScale) {
                      exitMaskEditing();
                      return;
                    }
                    applyMaskTopologyEdit(maskEditing.owner.id, maskEditing.mask.id, (basePath) => {
                      const hit = nearestMaskPathSegment(basePath, frame, world);
                      return hit ? insertMaskVertex(basePath, hit.segmentIndex, hit.t) : null;
                    }, 'A point could not be added here.');
                  }}
                />
              )}

              {/* WP-03: drawing a new mask on the selected layer */}
              {maskDrawing && (
                <MaskDrawOverlay
                  owner={maskDrawing.owner}
                  shape={maskDrawing.shape}
                  transform={maskDrawing.transform}
                  zScale={zScale}
                  toWorld={clientToSVG}
                  interactive={!maskDrawing.block}
                  onCommit={(nextPath) => { commitMaskDraw(nextPath); }}
                  onDegenerate={(message) => showToast(message, 'info')}
                  registerDraftHistory={registerDraftHistory}
                  onPenDraftChange={setMaskPenDraft}
                />
              )}
            </>
          );
        })()}
      </svg>
      {/*
        C5 — ONE status strip names what is being edited (the same description
        the Inspector header shows), with the mode's own Finish / Cancel / Back
        control. Its text never takes a stage gesture; only its buttons do.
      */}
      {appMode !== 'broadcast' && !cropMode && editTarget && (() => {
        if (editTarget.kind === 'drawing-shape') {
          return (
            <EditTargetStrip
              target={editTarget}
              testId="freeform-draft-banner"
              hint="Click to add points, drag to draw freely · click the first point or double-click to finish · Esc cancels"
            >
              <button
                type="button"
                className="mask-edit-banner-exit"
                disabled={!freeform.canFinish}
                title={freeform.canFinish ? 'Finish the shape (Enter)' : 'Add at least three points to finish the shape'}
                onClick={freeform.finishDraw}
              >
                Finish drawing
              </button>
              <button type="button" className="mask-edit-banner-exit is-secondary" title="Discard this drawing (Esc)" onClick={freeform.cancelDraw}>
                Cancel drawing
              </button>
            </EditTargetStrip>
          );
        }
        if (editTarget.kind === 'drawing-mask' && maskDrawing) {
          return (
            <EditTargetStrip
              target={editTarget}
              testId="mask-draw-banner"
              hintTestId="mask-draw-hint"
              blocked={Boolean(maskDrawing.block)}
              hint={maskDrawing.block
                ? maskDrawing.block.message
                : maskDrawing.shape === 'pen'
                  ? 'Click: corner point · drag: smooth point · click the first point, double-click or Enter to finish · Backspace removes a point · Esc cancels'
                  : 'Drag on the canvas to draw · Esc cancels'}
            >
              {maskDrawing.shape === 'pen' && maskPenDraft && (
                <button
                  type="button"
                  className="mask-edit-banner-exit"
                  disabled={!maskPenDraft.canFinish}
                  title={maskPenDraft.canFinish ? 'Close and create the mask (Enter)' : 'Add at least three points to finish the mask'}
                  onClick={maskPenDraft.finish}
                >
                  Finish mask ({maskPenDraft.count} points)
                </button>
              )}
              <button type="button" className="mask-edit-banner-exit is-secondary" onClick={cancelMaskDraw}>
                Cancel Drawing
              </button>
            </EditTargetStrip>
          );
        }
        if (editTarget.kind === 'mask' && maskEditing) {
          return (
            <EditTargetStrip
              target={editTarget}
              testId="mask-edit-banner"
              hintTestId="mask-edit-hint"
              blocked={Boolean(maskEditing.block)}
              hint={maskEditing.block
                ? maskEditing.block.message
                : `${maskEditing.mask.enabled === false ? 'Disabled — outline only. ' : ''}Drag the path to move it, a point to reshape it · Arrow keys nudge (Shift ×10) · Esc finishes`}
            >
              <button
                type="button"
                className="mask-edit-banner-exit"
                aria-label={`Finish mask editing — back to ${maskEditing.owner.name}`}
                title={`Finish editing the mask and go back to the layer “${maskEditing.owner.name}” (Esc)`}
                onClick={exitMaskEditing}
              >
                Finish
              </button>
            </EditTargetStrip>
          );
        }
        if (editTarget.kind === 'matte-source') {
          // Only the way back: no "Matte source · matte of …" caption.
          const returnTarget = characterParts.find((part) => part.id === matteReturnTargetId);
          return (
            <EditTargetStrip target={editTarget} testId="edit-target-strip" bare>
              <button type="button" className="mask-edit-banner-exit" title="Select the layer this matte belongs to" onClick={backToMatteTarget}>
                Back to {returnTarget?.name ?? 'layer'}
              </button>
            </EditTargetStrip>
          );
        }
        if (editTarget.kind === 'new-shape') {
          return <EditTargetStrip target={editTarget} testId="edit-target-strip" hint={activeTool === 'freeform_draw' ? 'Click to add points, drag to draw freely · Esc leaves the tool' : 'Drag on the canvas to draw the shape · Esc leaves the tool'} />;
        }
        return <EditTargetStrip target={editTarget} testId="edit-target-strip" />;
      })()}

      {appMode !== 'broadcast' && showCoordinateOverlay && selectedTransform && (
        <CanvasCoordinateReadout
          transform={selectedTransform}
          coordinateSystem={coordinateSystem}
        />
      )}
    </div>
  );
};
