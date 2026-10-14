import React, { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useAnimator } from '../../context/useAnimator';
import { useEditorContextMenu } from '../../context/editorContextMenu';
import type { Transform } from '../../types/animator';
import { type ScaleMode } from './overlays/TransformGizmo';
import { getPartBounds } from '../../utils/bounds';
import { getSelectionFrameBounds } from '../../utils/selectionFrame';
import { rotateAboutWorldPivot, selectionFrameCenterWorld, type WorldPoint } from '../../utils/rotationGesture';
import { resolveCornerResize, resolveEdgeResize, type CornerBounds, type CornerId, type EdgeId } from '../../utils/cornerResize';
import { stackingOrder } from '../../utils/stackingOrder';
import { resolveMarqueeSelection, resolveStageSelectionTarget } from '../../utils/layerGrouping';
import { collectArrangeTargets } from '../../utils/vectorArrange';
import {
  collectLayerSnapCandidates,
  collectStageSnapCandidates,
  resolveSnap,
  unionWorldBounds,
  SNAP_THRESHOLD_SCREEN_PX,
  type SnapGuide,
  type SnapLine,
} from '../../utils/layoutGeometry';
import type { PartWorldBounds } from '../../utils/bounds';
import {
  STAGE_CROP_HANDLES,
  editorPointToStageSpace,
  isStageCropHandle,
  isStagePointInsideRect,
  resizeStageCropRect,
  stageCropHandleCenters,
  stageCropRectFromDrag,
  stageSpaceToEditorRect,
  translateStageCropRect,
  type StageCropHandle,
  type StageCropRect,
} from '../../utils/stageCrop';
import { clampZoom, clientToCameraPoint, getCursorAnchoredCameraCenter, getLocalDelta, getPartsInMarquee, getPointerDelta, getShapeCreationBounds, getShapeCreationPlacement, getStageCameraTransform, getStageFitScale, type StageBox, type StageCameraView } from '../../utils/viewportMath';
import { EDITOR_CAMERA_CENTER, EDITOR_CAMERA_VIEWBOX, getProjectCenter, type CoordinatePoint } from '../../utils/projectCoordinates';
import { buildFreeformPath, normalizeFreeformPoints } from '../../utils/freeform';
import { resolveBondGroup } from '../../utils/partBinding';
import { useFreeformDraw } from '../../hooks/useFreeformDraw';
import { CanvasGridOverlay } from './overlays/CanvasGridOverlay';
import { FreeformTangentOverlay } from './overlays/FreeformTangentOverlay';
import { isFreeformTangentOverlayEligible } from '../../utils/freeformTangentEligibility';
import { ShapeCreationPreview } from './ShapeCreationPreview';
import { SelectionGizmo } from './SelectionGizmo';
import { StagePartLayers } from './StagePartLayers';
import { Sparkles } from 'lucide-react';
import './StageCanvas.css';

/**
 * The four corner handles of the transform gizmo, keyed by the scale mode they
 * report. Edge and single-axis modes intentionally have no corner identity.
 */
const CORNER_BY_SCALE_MODE: Record<string, CornerId | undefined> = {
  scale_corner_tl: 'tl',
  scale_corner_tr: 'tr',
  scale_corner_bl: 'bl',
  scale_corner_br: 'br',
};

/**
 * The four edge handles, keyed by the scale mode they report. A corner and an
 * edge solve share one authority (`resolveCornerResize` / `resolveEdgeResize`):
 * both anchor the handle opposite to the one the pointer grabbed.
 */
const EDGE_BY_SCALE_MODE: Record<string, EdgeId | undefined> = {
  scale_left: 'left',
  scale_right: 'right',
  scale_top: 'top',
  scale_bottom: 'bottom',
};

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
    clearShapeCreation,
    addCustomPart,
    updatePartMedia,
    showGrid,
    snapEnabled,
    cropMode,
    cropRegion,
    setCropRegion,
    totalFrames,
    projectResolution,
    appMode,
    broadcastState,
    broadcastSessionActivated,
    namedSequenceRuntime,
    activeTemplateId,
    tracks,
    setCharacterParts,
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
  } = useAnimator();

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
    stageBoxRef.current = box;
    setStageBox(box);
    const center = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    const baseScale = getStageFitScale(box, EDITOR_CAMERA_VIEWBOX);
    setCameraView((view) => {
      if (!view) return { center, baseScale };
      if (!reanchor || !previous) return view;
      const previousCenter = { x: previous.left + previous.width / 2, y: previous.top + previous.height / 2 };
      return {
        center: {
          x: view.center.x + (center.x - previousCenter.x),
          y: view.center.y + (center.y - previousCenter.y),
        },
        baseScale,
      };
    });
  }, []);

  // Broadcast shows the FULL artboard, centered — never inherit the edit-mode
  // pan/zoom (that would leave the stage off-center with dark 'curtain' bands).
  // The edit camera is remembered and restored when switching back.
  const editViewportRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
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
      center: { x: box.left + box.width / 2 + restored.pan.x, y: box.top + box.height / 2 + restored.pan.y },
      baseScale: getStageFitScale(box, EDITOR_CAMERA_VIEWBOX),
    });
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
  const [dragMode, setDragMode] = useState<'translate' | 'rotate' | 'scale_corner_tl' | 'scale_corner_tr' | 'scale_corner_bl' | 'scale_corner_br' | 'scale_x' | 'scale_y' | 'scale_left' | 'scale_right' | 'scale_top' | 'scale_bottom' | 'pan' | 'marquee' | 'shape_create' | 'child_frame_scale' | 'child_frame_rotate' | 'crop_new' | 'crop_move' | 'crop_resize' | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [shapeCreationStart, setShapeCreationStart] = useState<{ clientX: number; clientY: number; svgX: number; svgY: number } | null>(null);
  const [shapeCreationPreview, setShapeCreationPreview] = useState<{ type: NonNullable<typeof pendingShapeType>; bounds: ReturnType<typeof getShapeCreationBounds> } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; initialTransform: Transform; mediaCenter?: { x: number; y: number }; partId?: string; initialChildScaleX?: number; initialChildScaleY?: number; initialChildRot?: number; corner?: CornerId; localBounds?: CornerBounds; pivot?: WorldPoint; cropAnchor?: { x: number; y: number }; cropInitial?: StageCropRect; cropHandle?: StageCropHandle }>({
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
   * R5-08 — the selection that was live when the marquee box began, captured
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
    onComplete: useCallback(
      (stagePoints) => {
        const { points, centerX, centerY } = normalizeFreeformPoints(stagePoints);
        addCustomPart('custom_freeform', 'Freeform Shape', {
          points,
          baseTransform: { x: centerX, y: centerY, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
        });
        setActiveTool('select');
        showToast('Freeform shape created', 'success');
      },
      [addCustomPart, setActiveTool, showToast]
    ),
    onCancel: useCallback(() => {
      // Esc pressed while drawing: exit the tool so clicks work normally again.
      setActiveTool('select');
      showToast('Drawing cancelled', 'info');
    }, [setActiveTool, showToast]),
  });

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

    // R4-09 — the pointer lands on a child, but the gesture belongs to the layer
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
      const target = e.target as HTMLElement;
      const isCanvasTarget = target === containerRef.current
        || target.tagName === 'svg'
        || target.classList.contains('canvas-bg')
        || target.classList.contains('focus-spotlight-dimmer');
      if (!isCanvasTarget) return;
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

    const target = e.target as HTMLElement;
    if (
      target === containerRef.current
      || target.tagName === 'svg'
      || target.classList.contains('canvas-bg')
      || target.classList.contains('focus-spotlight-dimmer')
    ) {
      handleSelectPart(null);
      setFocusModeNodeId(null);
      // R5-08: remembered BEFORE the press clears the selection — the box's
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
  const startRotate = (e: React.MouseEvent) => {
    if (appMode === 'broadcast' || e.button !== 0 || !selectedPart || !selectedTransform) return;
    e.stopPropagation();
    startBatchInteraction();
    setIsDragging(true);
    setDragMode('rotate');

    // ONE pivot, taken at pointerdown and held for the whole gesture: the world
    // centre of the box the frame draws right now (the group aggregate's centre
    // for a container). Re-deriving it from the rotating bounds on every move
    // would let the visible centre wander while the layer turns.
    const frameBounds = getSelectionFrameBounds(selectedPart, {
      characterParts,
      getComputedTransform,
      currentFrame,
      transform: selectedTransform,
    });
    const pivot = frameBounds
      ? selectionFrameCenterWorld(selectedTransform, frameBounds)
      : { x: selectedTransform.x, y: selectedTransform.y };

    const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);
    const dx = svgX - (EDITOR_CAMERA_CENTER.x + pivot.x);
    const dy = svgY - (EDITOR_CAMERA_CENTER.y + pivot.y);
    const initialAngleRad = Math.atan2(dy, dx);

    setDragInitialAngle(initialAngleRad);
    setDragStart({
      x: svgX,
      y: svgY,
      initialTransform: { ...selectedTransform },
      pivot,
    });
  };

  const startScale = (e: React.MouseEvent, mode: ScaleMode, bounds?: CornerBounds) => {
    if (appMode === 'broadcast' || e.button !== 0 || !selectedPart || !selectedTransform) return;
    e.stopPropagation();
    startBatchInteraction();
    setIsDragging(true);
    setDragMode(mode);

    const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);
    const centerX = EDITOR_CAMERA_CENTER.x + selectedTransform.x;
    const centerY = EDITOR_CAMERA_CENTER.y + selectedTransform.y;
    const dx = svgX - centerX;
    const dy = svgY - centerY;

    const rad = (-selectedTransform.rotation * Math.PI) / 180;
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
    });
  };

  const rafPanRef = useRef<number | null>(null);

  // The move handler runs before the pointer-up callback is declared, so it reads
  // the latest handler through a ref instead of closing over it (no dependency cycle).
  const handleMouseUpRef = useRef<(commitShape?: boolean) => void>(() => {});

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragMode) return;

      if (e.buttons === 0) {
        handleMouseUpRef.current();
        return;
      }

      // Crop authoring: the region is rewritten on every move and the DOCUMENT is
      // never touched — no batch interaction is open, so no history entry can be
      // produced by drawing or resizing the region.
      if (dragMode === 'crop_new' || dragMode === 'crop_move' || dragMode === 'crop_resize') {
        const point = clientToStage(e.clientX, e.clientY);
        const initial = dragStart.cropInitial;
        if (dragMode === 'crop_new') {
          setCropRegion(stageCropRectFromDrag(dragStart.cropAnchor ?? point, point, projectResolution));
          return;
        }
        if (!initial) return;
        if (dragMode === 'crop_move') {
          const anchor = dragStart.cropAnchor ?? point;
          setCropRegion(translateStageCropRect(
            initial,
            { x: point.x - anchor.x, y: point.y - anchor.y },
            projectResolution,
          ));
          return;
        }
        if (dragStart.cropHandle) {
          setCropRegion(resizeStageCropRect(initial, dragStart.cropHandle, point, projectResolution));
        }
        return;
      }

      if (dragMode === 'pan') {
        const clientX = e.clientX;
        const clientY = e.clientY;
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
          setShapeCreationPreview({
            type: pendingShapeType,
            bounds: getShapeCreationBounds(
              { x: shapeCreationStart.svgX, y: shapeCreationStart.svgY },
              { x: svgX, y: svgY },
              pendingShapeType === 'custom_box',
            ),
          });
        }
        return;
      }

      if (!selectedPartId) return;

      if (dragMode === 'child_frame_scale') {
        // Uniform scale of a shape child around its center (world space),
        // then convert the new world scale back into container-local space.
        const c = dragStart.mediaCenter!;
        const initDist = Math.hypot(dragStart.x - c.x, dragStart.y - c.y);
        const curDist = Math.hypot(svgX - c.x, svgY - c.y);
        const factor = initDist > 0.001 ? curDist / initDist : 1;
        const newWorldScale = Math.max(0.05, Math.round((dragStart.initialChildScaleX || 1) * factor * 100) / 100);
        const targetId = dragStart.partId ?? selectedPartId;
        // World-space contract: updateCurrentTransform converts to the target's
        // container-local space itself.
        updateCurrentTransform({ scaleX: newWorldScale, scaleY: newWorldScale }, targetId);
        return;
      }

      if (dragMode === 'child_frame_rotate') {
        // Rotate a shape child around its center (world space); the world
        // rotation is converted to container-local space by
        // updateCurrentTransform, exactly like every other caller.
        const c = dragStart.mediaCenter!;
        const initAngle = (Math.atan2(dragStart.y - c.y, dragStart.x - c.x) * 180) / Math.PI;
        const curAngle = (Math.atan2(svgY - c.y, svgX - c.x) * 180) / Math.PI;
        const delta = ((curAngle - initAngle + 540) % 360) - 180;
        const newWorldRot = Math.round(((dragStart.initialChildRot || 0) + delta) * 100) / 100;
        const targetId = dragStart.partId ?? selectedPartId;
        updateCurrentTransform({ rotation: newWorldRot }, targetId);
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

      if (dragMode === 'rotate') {
        // The pivot was captured at pointerdown and never moves: the write
        // authority turns the layer AND translates it so the frame's centre
        // stays exactly where the user grabbed the rotation from.
        const pivot = dragStart.pivot ?? { x: dragStart.initialTransform.x, y: dragStart.initialTransform.y };
        const dx = svgX - (EDITOR_CAMERA_CENTER.x + pivot.x);
        const dy = svgY - (EDITOR_CAMERA_CENTER.y + pivot.y);
        const currentAngleRad = Math.atan2(dy, dx);
        const deltaAngleRad = currentAngleRad - dragInitialAngle;
        const deltaAngleDeg = (deltaAngleRad * 180) / Math.PI;

        const rotation = Math.round(dragStart.initialTransform.rotation + deltaAngleDeg);
        updateCurrentTransform(rotateAboutWorldPivot({
          transform: dragStart.initialTransform,
          pivot,
          rotation,
        }));
      } else if (CORNER_BY_SCALE_MODE[dragMode]) {
        // ONE geometry authority: the pure corner solver keeps the diagonally
        // opposite corner fixed in world space and puts the dragged corner under
        // the pointer. It answers in WORLD space — the write authority converts
        // the patch into the layer's container-local space, exactly like every
        // other canvas gesture.
        const corner = CORNER_BY_SCALE_MODE[dragMode];
        if (!corner || !dragStart.localBounds) return;
        updateCurrentTransform(resolveCornerResize({
          transform: dragStart.initialTransform,
          bounds: dragStart.localBounds,
          corner,
          startPointer: { x: dragStart.x, y: dragStart.y },
          pointer: { x: svgX, y: svgY },
          uniform: isScaleLocked,
        }));
      } else if (EDGE_BY_SCALE_MODE[dragMode]) {
        // The same geometry authority as the corners, restricted to one axis:
        // the opposite edge is the fixed point of the gesture, so a group's
        // aggregate frame resizes from its own box instead of the geometryless
        // container's fallback extents.
        const edge = EDGE_BY_SCALE_MODE[dragMode];
        const bounds = dragStart.localBounds;
        if (!edge || !bounds) return;
        updateCurrentTransform(resolveEdgeResize({
          transform: dragStart.initialTransform,
          bounds,
          edge,
          startPointer: { x: dragStart.x, y: dragStart.y },
          pointer: { x: svgX, y: svgY },
        }));
      } else if (dragMode === 'scale_x') {
        const centerX = EDITOR_CAMERA_CENTER.x + dragStart.initialTransform.x;
        const centerY = EDITOR_CAMERA_CENTER.y + dragStart.initialTransform.y;
        const dx = svgX - centerX;
        const dy = svgY - centerY;

        const { dxLocal } = getLocalDelta(dx, dy, dragStart.initialTransform.rotation);
        const currentLocalX = Math.abs(dxLocal);
        const ratioX = currentLocalX / Math.max(0.001, dragInitialLocalX);

        const newScaleX = parseFloat(Math.max(0.05, dragStart.initialTransform.scaleX * ratioX).toFixed(2));
        updateCurrentTransform({ scaleX: newScaleX });
      } else if (dragMode === 'scale_y') {
        const centerX = EDITOR_CAMERA_CENTER.x + dragStart.initialTransform.x;
        const centerY = EDITOR_CAMERA_CENTER.y + dragStart.initialTransform.y;
        const dx = svgX - centerX;
        const dy = svgY - centerY;

        const { dyLocal } = getLocalDelta(dx, dy, dragStart.initialTransform.rotation);
        const currentLocalY = Math.abs(dyLocal);
        const ratioY = currentLocalY / Math.max(0.001, dragInitialLocalY);

        const newScaleY = parseFloat(Math.max(0.05, dragStart.initialTransform.scaleY * ratioY).toFixed(2));
        updateCurrentTransform({ scaleY: newScaleY });
      }
    },
    // The pointer-up effect owns the current mouse-up callback; adding the later-declared callback here would create a declaration cycle.
    [isDragging, dragMode, dragStart, clientToSVG, clientToStage, dragInitialAngle, dragInitialLocalX, dragInitialLocalY, selectedPartId, updateCurrentTransform, shapeCreationStart, pendingShapeType, isScaleLocked, snapEnabled, setCropRegion, projectResolution]
  );

  const handleMouseUp = useCallback((commitShape: boolean = true) => {
    if (dragMode === 'shape_create') {
      if (commitShape && shapeCreationPreview && pendingShapeType && pendingShapeName) {
        const placement = getShapeCreationPlacement(pendingShapeType, shapeCreationPreview.bounds);
        if (placement) {
          startBatchInteraction();
          addCustomPart(pendingShapeType, pendingShapeName, { baseTransform: { ...placement, rotation: 0, opacity: 1 } });
        }
      }
      clearShapeCreation();
      setShapeCreationStart(null);
      setShapeCreationPreview(null);
    }

    if (dragMode === 'marquee' && marqueeRect) {
      const hits = getPartsInMarquee(
        characterParts,
        (id) => getComputedTransform(id, currentFrame),
        marqueeRect,
        EDITOR_CAMERA_CENTER.x,
        EDITOR_CAMERA_CENTER.y,
        (part) => (
          tracks.find((track) => track.partId === part.id)?.editVisible !== false
          && (!part.booleanGroupId || part.booleanGroupId === booleanOperandEditingGroupId)
          && (!booleanOperandEditingGroupId || !part.booleanOperandIds?.length)
        ),
      );
      // R5-08: the box's hits become the CANONICAL selection — a container when
      // the children it enclosed belong to one (and no child border is drawn for
      // a normalized group), the layers themselves only when the user is already
      // working inside the group.
      const selected = resolveMarqueeSelection(characterParts, hits, marqueeSelectionOriginRef.current);
      if (selected.length > 0) {
        setSelectedPartIds(selected);
        setSelectedPartId(selected[selected.length - 1]);
      }
    }

    // R4-09: a gesture that began inside a group and never moved is a plain click
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
    setDragMode(null);
    setMarqueeRect(null);
  }, [dragMode, shapeCreationPreview, pendingShapeType, pendingShapeName, clearShapeCreation, addCustomPart, startBatchInteraction, marqueeRect, characterParts, currentFrame, getComputedTransform, tracks, isDragging, endBatchInteraction, setSelectedPartIds, setSelectedPartId, booleanOperandEditingGroupId]);
  useEffect(() => {
    handleMouseUpRef.current = handleMouseUp;
  }, [handleMouseUp]);

  const handlePointerUp = useCallback(() => handleMouseUp(), [handleMouseUp]);

  const handlePointerCancel = useCallback(() => handleMouseUp(false), [handleMouseUp]);

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

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const view = cameraViewRef.current;
    if (!containerRef.current || !view || appMode === 'broadcast') return;
    const currentZoom = zoomRef.current;
    const nextZoom = clampZoom(currentZoom * (e.deltaY < 0 ? 1.1 : 0.9));
    setZoomLevel(nextZoom);
    setCameraView({
      baseScale: view.baseScale,
      center: getCursorAnchoredCameraCenter({
        view,
        clientX: e.clientX,
        clientY: e.clientY,
        zoom: currentZoom,
        nextZoom,
      }),
    });
  }, [appMode]);
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
          ? { ...view, center: { x: box.left + box.width / 2, y: box.top + box.height / 2 } }
          : view));
        return;
      }
      if (type === 'remeasure-stage-box') {
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
    window.addEventListener('canvas-viewport-command', handleViewportCommand);
    return () => window.removeEventListener('canvas-viewport-command', handleViewportCommand);
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

    // Handle UI Panel JSON drops
    const rawData = e.dataTransfer.getData('application/json');
    if (!rawData) return;
    try {
      const data = JSON.parse(rawData);

      addCustomPart(data.type, data.name || 'Dropped Element', {
        baseTransform: {
          x: Math.round(svgX - EDITOR_CAMERA_CENTER.x),
          y: Math.round(svgY - EDITOR_CAMERA_CENTER.y),
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
        },
      });
    } catch {
      console.warn("Invalid drop payload");
    }
  };

  const sortedParts = stackingOrder(characterParts);
  const isPanning = activeTool === 'pan' || (isDragging && dragMode === 'pan');
  const cameraTransform = appMode === 'broadcast' || !cameraView || !stageBox
    ? null
    : getStageCameraTransform({ view: cameraView, stage: stageBox, zoom: zoomLevel, viewBox: EDITOR_CAMERA_VIEWBOX });

  /**
   * Right-click on the stage opens the shared authoring menu. The target is the
   * topmost rendered layer under the pointer, read from the real DOM (the
   * rendered part node carries `data-part-id`) instead of a second hit-test
   * implementation; no layer under the pointer means the empty-stage menu.
   */
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    if (appMode === 'broadcast') return;
    const target = event.target as Element | null;
    const partId = target?.closest('[data-part-id]')?.getAttribute('data-part-id') ?? null;
    openContextMenu({ point: { x: event.clientX, y: event.clientY }, targetId: partId });
  }, [appMode, openContextMenu]);

  return (
    <div
      className={`stage-canvas-container ${isPanning ? 'panning' : ''} ${activeTool === 'pan' ? 'hand-tool' : 'select-tool'} ${isDragging ? 'interaction-dragging' : ''} ${cropMode ? 'crop-mode' : ''}`}
      data-camera-zoom={zoomLevel}
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOverStage}
      onDragLeave={handleDragLeaveStage}
      onDrop={handleDropStage}
    >
      {isDropTargetHover && (
        <div className="canvas-drop-zone-overlay">
          <div style={{ color: 'var(--accent-teal)', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} />
            <span>RELEASE TO DROP ELEMENT ONTO STAGE CANVAS</span>
          </div>
        </div>
      )}

      <svg
        className="stage-svg"
        width="100%"
        height="100%"
        viewBox={appMode === 'broadcast'
          ? `0 0 ${projectResolution.width} ${projectResolution.height}`
          : `0 0 ${EDITOR_CAMERA_VIEWBOX.width} ${EDITOR_CAMERA_VIEWBOX.height}`}
        preserveAspectRatio="xMidYMid meet"
        onDoubleClick={(e) => {
          if (activeTool === 'freeform_draw') {
            e.preventDefault();
            freeform.finishDraw();
          }
        }}
        style={{
          // Identity while broadcast shows the fitted artboard and while the
          // edit camera has not been anchored yet (the mount view).
          transform: cameraTransform
            ? `translate(${cameraTransform.translateX}px, ${cameraTransform.translateY}px) scale(${cameraTransform.scale})`
            : 'translate(0px, 0px) scale(1)',
          transformOrigin: 'center center',
          cursor: activeTool === 'freeform_draw' ? 'crosshair' : undefined,
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
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(56, 189, 248, 0.10)" strokeWidth="1" />
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
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(56, 189, 248, 0.22)" strokeWidth="1" />
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
          const zScale = 1 / Math.max(0.15, zoomLevel);
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
                sortedParts={sortedParts}
                appMode={appMode}
                broadcastState={broadcastState}
                broadcastSessionActivated={broadcastSessionActivated}
                namedSequenceRuntime={namedSequenceRuntime}
                activeTemplateId={activeTemplateId}
                currentFrame={currentFrame}
                totalFrames={totalFrames}
                tracks={tracks}
                selectedPartId={selectedPartId}
                selectedPartIds={selectedPartIds}
                booleanOperandEditingGroupId={booleanOperandEditingGroupId}
                onSelect={(id, event) => {
                  // The browser still fires a click when a drag ends on the
                  // element it started on; that click must not steal the
                  // selection back from the group the drag just moved.
                  if (suppressClickSelectRef.current) {
                    suppressClickSelectRef.current = false;
                    return;
                  }
                  // R4-09: a plain click selects the GROUP the geometry belongs
                  // to; the layer itself is selected through an explicit
                  // drill-in (`onDrillIn`) or from the timeline Outliner.
                  handleSelectPart(
                    resolveStageSelectionTarget(characterParts, id, canvasSelectionIds),
                    event.ctrlKey || event.metaKey,
                  );
                }}
                onDrillIn={(id) => {
                  // Double-click enters the group: the pressed layer itself
                  // becomes the selection, so the next click or drag on it edits
                  // that layer. `selectedPartIds` keeps the primary a member of
                  // the canonical set (the resolver reads it on the next press).
                  setSelectedPartId(id);
                  setSelectedPartIds([id]);
                }}
                customPresets={customPresets}
                liveStuntsState={liveStuntsState}
                onStartTranslateDrag={startTranslateDragForPart}
                projectResolution={projectResolution}
              />

              {/* Freeform Drawing Preview (active draw tool) */}
              {freeform.isDrawing && freeform.points.length > 0 && (
                <g transform={`translate(${EDITOR_CAMERA_CENTER.x}, ${EDITOR_CAMERA_CENTER.y})`} pointerEvents="none">
                  <path
                    d={buildFreeformPath([...freeform.points, ...(freeform.cursorPoint ? [freeform.cursorPoint] : [])])}
                    fill="rgba(56, 189, 248, 0.10)"
                    stroke="var(--accent-cyan)"
                    strokeWidth={1.5 * zScale}
                    strokeDasharray="5 3"
                    strokeLinejoin="round"
                  />
                  {freeform.points.map((p, i) => (
                    <circle key={`vf-${i}`} cx={p.x} cy={p.y} r={2.5 * zScale} fill="#38bdf8" />
                  ))}
                  {freeform.points.length > 0 && freeform.cursorPoint && (
                    <text x={freeform.cursorPoint.x} y={freeform.cursorPoint.y - 10 * zScale} fontSize={10 * zScale} fill="#7dd3fc" textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {freeform.points.length < 3 ? 'Click to add corners • Drag to draw freely' : 'Double-click or Enter to finish • Esc to cancel'}
                    </text>
                  )}
                </g>
              )}

              {shapeCreationPreview && pendingShapeType && (
                <ShapeCreationPreview
                  type={pendingShapeType}
                  bounds={shapeCreationPreview.bounds}
                  outputOrigin={EDITOR_CAMERA_CENTER}
                  zoom={zoomLevel}
                />
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
                strokeWidth={2 * zScale}
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
                  events, gone the instant the snap is no longer active. The
                  candidate values are project-relative world coordinates, so the
                  overlay adds the editor camera origin to draw them. */}
              {snapGuides.length > 0 && (
                <g className="snap-guides" pointerEvents="none" aria-hidden="true">
                  {snapGuides.map((guide) => (guide.axis === 'x'
                    ? (
                      <line
                        key={`snap-x-${guide.value}`}
                        className="snap-guide"
                        x1={EDITOR_CAMERA_CENTER.x + guide.value}
                        y1={0}
                        x2={EDITOR_CAMERA_CENTER.x + guide.value}
                        y2={EDITOR_CAMERA_VIEWBOX.height}
                        strokeWidth={1 / zoomLevel}
                      />
                    )
                    : (
                      <line
                        key={`snap-y-${guide.value}`}
                        className="snap-guide"
                        x1={0}
                        y1={EDITOR_CAMERA_CENTER.y + guide.value}
                        x2={EDITOR_CAMERA_VIEWBOX.width}
                        y2={EDITOR_CAMERA_CENTER.y + guide.value}
                        strokeWidth={1 / zoomLevel}
                      />
                    )))}
                </g>
              )}

              {/* Interactive Transform Gizmo (Only in Edit Mode when not hard-hidden) */}
              {appMode !== 'broadcast' && (
                <SelectionGizmo
                  selectedPartIds={selectedPartIds}
                  characterParts={characterParts}
                  getComputedTransform={getComputedTransform}
                  currentFrame={currentFrame}
                  selectedPart={selectedPart}
                  selectedTransform={selectedTransform}
                  tracks={tracks}
                  zScale={zScale}
                  booleanOperandEditingGroupId={booleanOperandEditingGroupId}
                  onRotateStart={startRotate}
                  onScaleStart={startScale}
                  onTranslateStart={startTranslateDragForPart}
                  outputOrigin={EDITOR_CAMERA_CENTER}
                />
              )}

              {/* Direct tangent-handle authoring for the selected freeform layer */}
              {selectedPart && selectedTransform && isFreeformTangentOverlayEligible({
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
                  onPathChange={(nextPath) => {
                    setCharacterParts((previous) => previous.map((part) => (
                      part.id === selectedPart.id ? { ...part, path: nextPath } : part
                    )));
                  }}
                  onBatchStart={startBatchInteraction}
                  onBatchEnd={endBatchInteraction}
                />
              )}
            </>
          );
        })()}
      </svg>
    </div>
  );
};
