import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useAnimator } from '../../context/useAnimator';
import { useEditorContextMenu } from '../../context/editorContextMenu';
import type { CharacterPart, Transform } from '../../types/animator';
import { type ScaleMode } from './overlays/TransformGizmo';
import { getPartBounds } from '../../utils/bounds';
import { resolveCornerResize, resolveEdgeResize, type CornerBounds, type CornerId, type EdgeId } from '../../utils/cornerResize';
import { stackingOrder } from '../../utils/stackingOrder';
import { clampZoom, clientToCameraPoint, getCursorAnchoredCameraCenter, getLocalDelta, getPartsInMarquee, getPointerDelta, getShapeCreationBounds, getShapeCreationPlacement, getStageCameraTransform, getStageFitScale, type StageBox, type StageCameraView } from '../../utils/viewportMath';
import { EDITOR_CAMERA_CENTER, EDITOR_CAMERA_VIEWBOX, getProjectCenter } from '../../utils/projectCoordinates';
import { buildFreeformPath, normalizeFreeformPoints } from '../../utils/freeform';
import { useFreeformDraw } from '../../hooks/useFreeformDraw';
import { CanvasViewportToolbar } from './overlays/CanvasViewportToolbar';
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

/**
 * True when `partId` is a descendant of `groupId` through the relationship
 * chain (`parentId`, with the Boolean-group link as the other carrier).
 */
const isDescendantOf = (parts: CharacterPart[], partId: string, groupId: string): boolean => {
  const seen = new Set<string>();
  let current = parts.find((part) => part.id === partId)?.parentId;
  while (current && !seen.has(current)) {
    if (current === groupId) return true;
    seen.add(current);
    current = parts.find((part) => part.id === current)?.parentId;
  }
  return false;
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
    setShowGrid,
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
  const [dragMode, setDragMode] = useState<'translate' | 'rotate' | 'scale_corner_tl' | 'scale_corner_tr' | 'scale_corner_bl' | 'scale_corner_br' | 'scale_x' | 'scale_y' | 'scale_left' | 'scale_right' | 'scale_top' | 'scale_bottom' | 'pan' | 'marquee' | 'shape_create' | 'child_frame_scale' | 'child_frame_rotate' | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [shapeCreationStart, setShapeCreationStart] = useState<{ clientX: number; clientY: number; svgX: number; svgY: number } | null>(null);
  const [shapeCreationPreview, setShapeCreationPreview] = useState<{ type: NonNullable<typeof pendingShapeType>; bounds: ReturnType<typeof getShapeCreationBounds> } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; initialTransform: Transform; mediaCenter?: { x: number; y: number }; partId?: string; initialChildScaleX?: number; initialChildScaleY?: number; initialChildRot?: number; corner?: CornerId; localBounds?: CornerBounds }>({
    x: 0,
    y: 0,
    initialTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  });

  /**
   * Group body drags: the pointer lands on a child, but the gesture belongs to
   * the selected container. This remembers the layer under the pointer so a
   * click that never moved can still select it, and records whether the gesture
   * actually moved so the click-select after a real drag is suppressed.
   */
  const pendingGroupClickRef = useRef<string | null>(null);
  const groupDragMovedRef = useRef(false);
  const suppressClickSelectRef = useRef(false);

  const [dragInitialAngle, setDragInitialAngle] = useState<number>(0);
  const [dragInitialLocalX, setDragInitialLocalX] = useState<number>(1);
  const [dragInitialLocalY, setDragInitialLocalY] = useState<number>(1);

  const selectedPart = characterParts.find((p) => p.id === selectedPartId);
  const selectedTransform = selectedPartId ? getComputedTransform(selectedPartId, currentFrame) : null;
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

    // A gesture that starts inside the SELECTED group box moves the container as
    // one unit: the pointer lands on a child, but the child is not the target of
    // the drag. The container stays selected, and a click that never moved still
    // selects the layer under the pointer (see handleMouseUp).
    const selectedGroup = characterParts.find((part) => part.id === selectedPartId && part.isGroup === true);
    const insideSelectedGroup = Boolean(
      selectedGroup
      && selectedPartIds.length <= 1
      && partId !== selectedGroup.id
      && isDescendantOf(characterParts, partId, selectedGroup.id),
    );
    pendingGroupClickRef.current = insideSelectedGroup ? partId : null;
    groupDragMovedRef.current = false;
    const dragTargetId = insideSelectedGroup ? selectedGroup!.id : partId;
    if (!insideSelectedGroup) {
      if (!selectedPartIds.includes(partId)) {
        handleSelectPart(partId);
      } else {
        setSelectedPartId(partId);
      }
    }

    const transform = getComputedTransform(dragTargetId, currentFrame);
    if (!transform) return;

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

    const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);
    const centerX = EDITOR_CAMERA_CENTER.x + selectedTransform.x;
    const centerY = EDITOR_CAMERA_CENTER.y + selectedTransform.y;
    const dx = svgX - centerX;
    const dy = svgY - centerY;
    const initialAngleRad = Math.atan2(dy, dx);

    setDragInitialAngle(initialAngleRad);
    setDragStart({
      x: svgX,
      y: svgY,
      initialTransform: { ...selectedTransform },
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
          suppressClickSelectRef.current = pendingGroupClickRef.current !== null;
        }
        // ONE contract: updateCurrentTransform takes WORLD x/y and converts to
        // container-local per part (and propagates bonds). Passing the primary
        // part's world position moves the whole selection when it is multi.
        updateCurrentTransform({
          x: dragStart.initialTransform.x + deltaX,
          y: dragStart.initialTransform.y + deltaY,
        });
        return;
      }

      if (dragMode === 'rotate') {
        const centerX = EDITOR_CAMERA_CENTER.x + dragStart.initialTransform.x;
        const centerY = EDITOR_CAMERA_CENTER.y + dragStart.initialTransform.y;
        const dx = svgX - centerX;
        const dy = svgY - centerY;
        const currentAngleRad = Math.atan2(dy, dx);
        const deltaAngleRad = currentAngleRad - dragInitialAngle;
        const deltaAngleDeg = (deltaAngleRad * 180) / Math.PI;

        const newRotation = Math.round(dragStart.initialTransform.rotation + deltaAngleDeg);
        updateCurrentTransform({ rotation: newRotation });
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
    [isDragging, dragMode, dragStart, clientToSVG, dragInitialAngle, dragInitialLocalX, dragInitialLocalY, selectedPartId, updateCurrentTransform, shapeCreationStart, pendingShapeType, isScaleLocked]
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
      const selected = getPartsInMarquee(
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
      if (selected.length > 0) {
        setSelectedPartIds(selected);
        setSelectedPartId(selected[selected.length - 1]);
      }
    }

    // A gesture that began inside the selected group and never moved is a plain
    // click on the layer under the pointer.
    const pendingClickId = pendingGroupClickRef.current;
    if (pendingClickId && !groupDragMovedRef.current) {
      suppressClickSelectRef.current = false;
      handleSelectPart(pendingClickId);
    }
    pendingGroupClickRef.current = null;
    groupDragMovedRef.current = false;

    if (isDragging) endBatchInteraction();
    setIsDragging(false);
    setDragMode(null);
    setMarqueeRect(null);
  }, [dragMode, shapeCreationPreview, pendingShapeType, pendingShapeName, clearShapeCreation, addCustomPart, startBatchInteraction, marqueeRect, characterParts, currentFrame, getComputedTransform, tracks, isDragging, endBatchInteraction, setSelectedPartIds, setSelectedPartId, booleanOperandEditingGroupId, handleSelectPart]);
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
      if (type !== 'zoom-in' && type !== 'zoom-out') return;
      const nextZoom = clampZoom(zoomRef.current * (type === 'zoom-in' ? 1.1 : 0.9));
      setZoomLevel(nextZoom);
    };
    window.addEventListener('canvas-viewport-command', handleViewportCommand);
    return () => window.removeEventListener('canvas-viewport-command', handleViewportCommand);
  }, []);

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

  // The viewport toolbar still resets the camera with an offset from the stage
  // centre; the camera authority turns that into an absolute view centre.
  const setPanOffset = useCallback((next: { x: number; y: number }) => {
    const box = stageBoxRef.current;
    if (!box) return;
    setCameraView((view) => view
      ? { ...view, center: { x: box.left + box.width / 2 + next.x, y: box.top + box.height / 2 + next.y } }
      : view);
  }, []);

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
      className={`stage-canvas-container ${isPanning ? 'panning' : ''} ${activeTool === 'pan' ? 'hand-tool' : 'select-tool'} ${isDragging ? 'interaction-dragging' : ''}`}
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

      {/* Viewport Floating Glass Toolbar (Edit Mode Only) */}
      {appMode !== 'broadcast' && (
        <CanvasViewportToolbar
          showGrid={showGrid}
          setShowGrid={setShowGrid}
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
          setPanOffset={setPanOffset}
          activeTool={activeTool === 'pan' ? 'pan' : 'select'}
          setActiveTool={setActiveTool}
        />
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
                  handleSelectPart(id, event.ctrlKey || event.metaKey);
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
