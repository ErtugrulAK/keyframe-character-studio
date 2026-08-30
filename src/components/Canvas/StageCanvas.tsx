import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import type { Transform } from '../../types/animator';
import { type ScaleMode } from './overlays/TransformGizmo';
import { getPartBounds } from '../../utils/bounds';
import { clientToSVGPoint, clampZoom, computeEdgeScale, getCursorAnchoredViewport, getLocalDelta, getPartsInMarquee, getPointerDelta, getShapeCreationBounds, getShapeCreationPlacement } from '../../utils/viewportMath';
import { EDITOR_CAMERA_CENTER, EDITOR_CAMERA_VIEWBOX, getProjectCenter } from '../../utils/projectCoordinates';
import { buildFreeformPath, getFreeformVertexWorldPositions, normalizeClosedPoints, normalizeFreeformPoints } from '../../utils/freeform';
import { worldToContainerLocal } from '../../utils/containerMath';
import { useFreeformDraw } from '../../hooks/useFreeformDraw';
import { CanvasViewportToolbar } from './overlays/CanvasViewportToolbar';
import { CanvasGridOverlay } from './overlays/CanvasGridOverlay';
import { ShapeCreationPreview } from './ShapeCreationPreview';
import { SelectionGizmo } from './SelectionGizmo';
import { StagePartLayers } from './StagePartLayers';
import { Sparkles } from 'lucide-react';
import './StageCanvas.css';

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
  } = useAnimator();

  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Broadcast shows the FULL artboard, centered — never inherit the edit-mode
  // pan/zoom (that would leave the stage off-center with dark 'curtain' bands).
  // The edit viewport is remembered and restored when switching back.
  const editViewportRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  const zoomRef = useRef(zoomLevel);
  const panRef = useRef(panOffset);
  zoomRef.current = zoomLevel;
  panRef.current = panOffset;
  useEffect(() => {
    if (appMode === 'broadcast') {
      editViewportRef.current = { zoom: zoomRef.current, pan: panRef.current };
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });
    } else {
      setZoomLevel(editViewportRef.current.zoom);
      setPanOffset(editViewportRef.current.pan);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode]);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragMode, setDragMode] = useState<'translate' | 'rotate' | 'scale' | 'scale_corner' | 'scale_x' | 'scale_y' | 'scale_left' | 'scale_right' | 'scale_top' | 'scale_bottom' | 'pan' | 'marquee' | 'shape_create' | 'child_frame_scale' | 'child_frame_rotate' | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [shapeCreationStart, setShapeCreationStart] = useState<{ clientX: number; clientY: number; svgX: number; svgY: number } | null>(null);
  const [shapeCreationPreview, setShapeCreationPreview] = useState<{ type: NonNullable<typeof pendingShapeType>; bounds: ReturnType<typeof getShapeCreationBounds> } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; initialTransform: Transform; initialTransforms?: Record<string, Transform>; mediaCenter?: { x: number; y: number }; partId?: string; initialChildScaleX?: number; initialChildScaleY?: number; initialChildRot?: number }>({
    x: 0,
    y: 0,
    initialTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  });

  const [dragInitialAngle, setDragInitialAngle] = useState<number>(0);
  const [dragInitialLocalX, setDragInitialLocalX] = useState<number>(1);
  const [dragInitialLocalY, setDragInitialLocalY] = useState<number>(1);

  const selectedPart = characterParts.find((p) => p.id === selectedPartId);
  const selectedTransform = selectedPartId ? getComputedTransform(selectedPartId, currentFrame) : null;
  const outputOrigin = appMode === 'broadcast' ? getProjectCenter(projectResolution) : EDITOR_CAMERA_CENTER;
  const clientToSVG = useCallback(
    (clientX: number, clientY: number): { svgX: number; svgY: number } => {
      if (!containerRef.current) return { svgX: 0, svgY: 0 };
      const svg = containerRef.current.querySelector<SVGSVGElement>('svg.stage-svg');
      const screenMatrix = svg?.getScreenCTM?.();
      if (screenMatrix && typeof DOMPoint !== 'undefined') {
        const point = new DOMPoint(clientX, clientY).matrixTransform(screenMatrix.inverse());
        return { svgX: point.x, svgY: point.y };
      }
      const rect = containerRef.current.getBoundingClientRect();
      const point = clientToSVGPoint({
        rect,
        clientX,
        clientY,
        zoom: zoomLevel,
        pan: panOffset,
        viewBox: EDITOR_CAMERA_VIEWBOX,
      });
      return { svgX: point.x, svgY: point.y };
    },
    [zoomLevel, panOffset]
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
    if (!selectedPartIds.includes(partId)) {
      handleSelectPart(partId);
    } else {
      setSelectedPartId(partId);
    }
    const transform = getComputedTransform(partId, currentFrame);
    if (!transform) return;

    startBatchInteraction();
    setIsDragging(true);
    setDragMode('translate');
    const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);

    const initialTransforms: Record<string, Transform> = {};
    const relevantIds = selectedPartIds.includes(partId) ? selectedPartIds : [partId];
    relevantIds.forEach(id => {
      const t = getComputedTransform(id, currentFrame);
      if (t) initialTransforms[id] = { ...t };
    });

    setDragStart({
      x: svgX,
      y: svgY,
      initialTransform: { ...transform },
      initialTransforms,
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
        initialTransform: { x: panOffset.x, y: panOffset.y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
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

  const startScale = (e: React.MouseEvent, mode: ScaleMode = 'scale_corner') => {
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
    });
  };

  const rafPanRef = useRef<number | null>(null);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragMode) return;

      if (e.buttons === 0) {
        handleMouseUp();
        return;
      }

      if (dragMode === 'pan') {
        const clientX = e.clientX;
        const clientY = e.clientY;
        if (rafPanRef.current) cancelAnimationFrame(rafPanRef.current);
        rafPanRef.current = requestAnimationFrame(() => {
          const dx = clientX - dragStart.x;
          const dy = clientY - dragStart.y;
          setPanOffset({
            x: dragStart.initialTransform.x + dx,
            y: dragStart.initialTransform.y + dy,
          });
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
        const part = characterParts.find((p) => p.id === targetId);
        const relationshipParentId = part?.parentId ?? part?.booleanGroupId;
        const parentT = relationshipParentId ? getComputedTransform(relationshipParentId, currentFrame) : null;
        if (parentT) {
          const worldT = { ...dragStart.initialTransform, scaleX: newWorldScale, scaleY: newWorldScale };
          const local = worldToContainerLocal(worldT, parentT);
          updateCurrentTransform({ scaleX: local.scaleX, scaleY: local.scaleY }, targetId);
        } else {
          updateCurrentTransform({ scaleX: newWorldScale, scaleY: newWorldScale });
        }
        return;
      }

      if (dragMode === 'child_frame_rotate') {
        // Rotate a shape child around its center (world space), then convert
        // the new world rotation into container-local space.
        const c = dragStart.mediaCenter!;
        const initAngle = (Math.atan2(dragStart.y - c.y, dragStart.x - c.x) * 180) / Math.PI;
        const curAngle = (Math.atan2(svgX - c.y, svgY - c.x) * 180) / Math.PI;
        const delta = ((curAngle - initAngle + 540) % 360) - 180;
        const newWorldRot = Math.round(((dragStart.initialChildRot || 0) + delta) * 100) / 100;
        const targetId = dragStart.partId ?? selectedPartId;
        const part = characterParts.find((p) => p.id === targetId);
        const relationshipParentId = part?.parentId ?? part?.booleanGroupId;
        const parentT = relationshipParentId ? getComputedTransform(relationshipParentId, currentFrame) : null;
        if (parentT) {
          const worldT = { ...dragStart.initialTransform, rotation: newWorldRot };
          const local = worldToContainerLocal(worldT, parentT);
          updateCurrentTransform({ rotation: local.rotation }, targetId);
        } else {
          updateCurrentTransform({ rotation: newWorldRot });
        }
        return;
      }

      if (!selectedPartId) return;

      if (dragMode === 'translate') {
        const { dx: deltaX, dy: deltaY } = getPointerDelta(
          { x: dragStart.x, y: dragStart.y },
          { x: svgX, y: svgY },
        );
        // If we have multiple selections and the dragged part is in it, move all of them.
        if (dragStart.initialTransforms) {
          Object.keys(dragStart.initialTransforms).forEach(id => {
            const initT = dragStart.initialTransforms![id];
            const movedPart = characterParts.find((x) => x.id === id);
            const relationshipParentId = movedPart?.parentId ?? movedPart?.booleanGroupId;
            if (relationshipParentId) {
              const pt = getComputedTransform(relationshipParentId, currentFrame);
              const local = worldToContainerLocal({ ...initT, x: initT.x + deltaX, y: initT.y + deltaY }, pt);
              updateCurrentTransform({ x: local.x, y: local.y }, id);
            } else {
              updateCurrentTransform({ x: initT.x + deltaX, y: initT.y + deltaY }, id);
            }
          });
        } else {
          const draggedPart = characterParts.find((x) => x.id === selectedPartId);
          const relationshipParentId = draggedPart?.parentId ?? draggedPart?.booleanGroupId;
          if (relationshipParentId) {
            const pt = getComputedTransform(relationshipParentId, currentFrame);
            const local = worldToContainerLocal(
              { ...dragStart.initialTransform, x: dragStart.initialTransform.x + deltaX, y: dragStart.initialTransform.y + deltaY },
              pt,
            );
            updateCurrentTransform({ x: local.x, y: local.y });
          } else {
            updateCurrentTransform({ x: dragStart.initialTransform.x + deltaX, y: dragStart.initialTransform.y + deltaY });
          }
        }
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
      } else if (dragMode === 'scale_corner' || dragMode === 'scale') {
        const centerX = EDITOR_CAMERA_CENTER.x + dragStart.initialTransform.x;
        const centerY = EDITOR_CAMERA_CENTER.y + dragStart.initialTransform.y;

        // Anchor scaling: the corner opposite the grab point stays fixed.
        // The grabbed corner is derived from the initial click position.
        const grabSignX = dragStart.x >= centerX ? 1 : -1;
        const grabSignY = dragStart.y >= centerY ? 1 : -1;

        // Initial half-extents at drag start (world units, already include scale).
        const initHalfW = Math.max(0.001, dragInitialLocalX);
        const initHalfH = Math.max(0.001, dragInitialLocalY);

        const initScaleX = Math.abs(dragStart.initialTransform.scaleX);
        const initScaleY = Math.abs(dragStart.initialTransform.scaleY);

        const precision = e.shiftKey ? 3 : 2;

        if (isScaleLocked) {
          // Locked: uniform scale around the center (radial factor), so the
          // aspect ratio is preserved and there is no initial jump.
          const dx = svgX - centerX;
          const dy = svgY - centerY;
          const currentDist = Math.sqrt(dx * dx + dy * dy);
          const initDist = Math.hypot(initHalfW, initHalfH);
          const factor = currentDist / Math.max(0.001, initDist);
          updateCurrentTransform({
            scaleX: parseFloat(Math.max(0.05, initScaleX * factor).toFixed(precision)),
            scaleY: parseFloat(Math.max(0.05, initScaleY * factor).toFixed(precision)),
          });
        } else {
          // Unlocked: per-axis scaling anchored to the opposite corner.
          // The pointer distance from the anchor spans TWO half-extents.
          const anchorX = centerX - grabSignX * initHalfW;
          const anchorY = centerY - grabSignY * initHalfH;
          const newHalfW = Math.abs(svgX - anchorX);
          const newHalfH = Math.abs(svgY - anchorY);
          updateCurrentTransform({
            scaleX: parseFloat(Math.max(0.05, (newHalfW / (2 * initHalfW)) * initScaleX).toFixed(precision)),
            scaleY: parseFloat(Math.max(0.05, (newHalfH / (2 * initHalfH)) * initScaleY).toFixed(precision)),
          });
        }
      } else if (
        dragMode === 'scale_right' ||
        dragMode === 'scale_left' ||
        dragMode === 'scale_top' ||
        dragMode === 'scale_bottom'
      ) {
        const part = characterParts.find((p) => p.id === selectedPartId);
        if (!part) return;

        const bounds = getPartBounds(part);

        updateCurrentTransform(
          computeEdgeScale({
            dragMode,
            halfW: bounds.halfW,
            halfH: bounds.halfH,
            deltaWorldX: svgX - dragStart.x,
            deltaWorldY: svgY - dragStart.y,
            rotation: dragStart.initialTransform.rotation,
            initScaleX: dragStart.initialTransform.scaleX,
            initScaleY: dragStart.initialTransform.scaleY,
            initX: dragStart.initialTransform.x,
            initY: dragStart.initialTransform.y,
          })
        );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDragging, dragMode, dragStart, clientToSVG, dragInitialAngle, dragInitialLocalX, dragInitialLocalY, selectedPartId, characterParts, updateCurrentTransform, shapeCreationStart, pendingShapeType, currentFrame, getComputedTransform, isScaleLocked]
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

    if (isDragging) endBatchInteraction();
    setIsDragging(false);
    setDragMode(null);
    setMarqueeRect(null);
  }, [dragMode, shapeCreationPreview, pendingShapeType, pendingShapeName, clearShapeCreation, addCustomPart, startBatchInteraction, marqueeRect, characterParts, currentFrame, getComputedTransform, tracks, isDragging, endBatchInteraction, setSelectedPartIds, setSelectedPartId, booleanOperandEditingGroupId]);
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
    const container = containerRef.current;
    const svg = container?.querySelector<SVGSVGElement>('svg.stage-svg');
    if (!container || !svg || appMode === 'broadcast') return;
    const cssTransform = new DOMMatrix(getComputedStyle(svg).transform);
    const currentZoom = cssTransform.a > 0 ? cssTransform.a : zoomRef.current;
    const nextZoom = clampZoom(currentZoom * (e.deltaY < 0 ? 1.1 : 0.9));
    const anchored = getCursorAnchoredViewport({
      rect: container.getBoundingClientRect(),
      clientX: e.clientX,
      clientY: e.clientY,
      zoom: currentZoom,
      pan: { x: cssTransform.e, y: cssTransform.f },
      nextZoom,
      viewBox: EDITOR_CAMERA_VIEWBOX,
    });
    setZoomLevel(anchored.zoom);
    setPanOffset(anchored.pan);
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
        const url = URL.createObjectURL(file);
        
        // Check if dropped over an existing shape
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

        if (targetShapeId) {
          updatePartMedia(targetShapeId, url, isVideo ? 'video' : 'image');
        } else {
          // Drop in empty area -> create new media part
          addCustomPart(isVideo ? 'custom_video' : 'custom_image', file.name, {
            baseTransform: { x: Math.round(svgX - EDITOR_CAMERA_CENTER.x), y: Math.round(svgY - EDITOR_CAMERA_CENTER.y), rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
            ...(isVideo ? { videoUrl: url } : { imageUrl: url }),
          });
        }
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

  const sortedParts = [...characterParts].sort((a, b) => a.zIndex - b.zIndex);
  const isPanning = activeTool === 'pan' || (isDragging && dragMode === 'pan');

  return (
    <div
      className={`stage-canvas-container ${isPanning ? 'panning' : ''} ${activeTool === 'pan' ? 'hand-tool' : 'select-tool'} ${isDragging ? 'interaction-dragging' : ''}`}
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => e.preventDefault()}
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
        style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`, transformOrigin: 'center center', cursor: activeTool === 'freeform_draw' ? 'crosshair' : undefined }}
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
                currentFrame={currentFrame}
                totalFrames={totalFrames}
                tracks={tracks}
                selectedPartId={selectedPartId}
                selectedPartIds={selectedPartIds}
                booleanOperandEditingGroupId={booleanOperandEditingGroupId}
                onSelect={(id, event) => {
                  handleSelectPart(id, event.ctrlKey || event.metaKey);
                }}
                customPresets={customPresets}
                liveStuntsState={liveStuntsState}
                onStartTranslateDrag={startTranslateDragForPart}
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

              {/* Freeform vertex markers (numbered, matching the inspector vertex list) */}
              {selectedPart?.type === 'custom_freeform' &&
                !selectedPart.booleanOperandIds?.length &&
                selectedTransform &&
                appMode !== 'broadcast' &&
                selectedPart.points &&
                selectedPart.points.length > 0 && (
                  <g pointerEvents="none">
                    {getFreeformVertexWorldPositions(
                      normalizeClosedPoints(selectedPart.points),
                      EDITOR_CAMERA_CENTER.x + selectedTransform.x,
                      EDITOR_CAMERA_CENTER.y + selectedTransform.y,
                      selectedTransform.scaleX,
                      selectedTransform.scaleY,
                      selectedTransform.rotation
                    ).map((v, i) => (
                      <g key={`vm-${i}`} data-testid="freeform-vertex-marker" transform={`translate(${v.x}, ${v.y})`}>
                        <circle r={7 * zScale} fill="#0f172a" stroke="#38bdf8" strokeWidth={1.2 * zScale} />
                        <text y={3 * zScale} fontSize={8.5 * zScale} fontWeight={700} textAnchor="middle" fill="#7dd3fc" style={{ userSelect: 'none' }}>
                          {i + 1}
                        </text>
                      </g>
                    ))}
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
            </>
          );
        })()}
      </svg>
    </div>
  );
};
