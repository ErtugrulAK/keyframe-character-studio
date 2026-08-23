import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import type { Transform } from '../../types/animator';
import { type ScaleMode } from './overlays/TransformGizmo';
import { getPartBounds } from '../../utils/bounds';
import { clampZoom, computeEdgeScale, getCursorAnchoredViewport, getLocalDelta, getPartsInMarquee } from '../../utils/viewportMath';
import { EDITOR_CAMERA_CENTER, EDITOR_CAMERA_VIEWBOX, getProjectCenter } from '../../utils/projectCoordinates';
import { buildFreeformPath, getFreeformVertexWorldPositions, normalizeFreeformPoints } from '../../utils/freeform';
import { worldToContainerLocal } from '../../utils/containerMath';
import { useFreeformDraw } from '../../hooks/useFreeformDraw';
import { CanvasViewportToolbar } from './overlays/CanvasViewportToolbar';
import { CanvasGridOverlay } from './overlays/CanvasGridOverlay';
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
    getComputedTransform,
    updateCurrentTransform,
    activeTool,
    showGrid,
    setShowGrid,
    addCustomPart,
    updatePartMedia,
    projectResolution,
    totalFrames,
    appMode,
    broadcastState,
    broadcastSessionActivated,
    namedSequenceRuntime,
    tracks,
    focusModeNodeId,
    setFocusModeNodeId,
    startBatchInteraction,
    endBatchInteraction,
    setActiveTool,
    showToast,
    isScaleLocked,
    customPresets,
    liveStuntsState,
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
  const [dragMode, setDragMode] = useState<'translate' | 'rotate' | 'scale' | 'scale_corner' | 'scale_x' | 'scale_y' | 'scale_left' | 'scale_right' | 'scale_top' | 'scale_bottom' | 'pan' | 'marquee' | 'child_frame_scale' | 'child_frame_rotate' | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; initialTransform: Transform; initialTransforms?: Record<string, Transform>; mediaCenter?: { x: number; y: number }; partId?: string; initialChildScaleX?: number; initialChildScaleY?: number; initialChildRot?: number }>({
    x: 0,
    y: 0,
    initialTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  });
  const [snapLines, setSnapLines] = useState<{x1: number, y1: number, x2: number, y2: number, color?: string}[]>([]);

  const [dragInitialAngle, setDragInitialAngle] = useState<number>(0);
  const [dragInitialLocalX, setDragInitialLocalX] = useState<number>(1);
  const [dragInitialLocalY, setDragInitialLocalY] = useState<number>(1);

  const selectedPart = characterParts.find((p) => p.id === selectedPartId);
  const selectedTransform = selectedPartId ? getComputedTransform(selectedPartId, currentFrame) : null;
  const outputOrigin = appMode === 'broadcast' ? getProjectCenter(projectResolution) : EDITOR_CAMERA_CENTER;

  const clientToSVG = useCallback(
    (clientX: number, clientY: number): { svgX: number; svgY: number } => {
      if (!containerRef.current) return { svgX: 0, svgY: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const scale = Math.min(rect.width / EDITOR_CAMERA_VIEWBOX.width, rect.height / EDITOR_CAMERA_VIEWBOX.height) || 1;
      const viewBoxX = (clientX - rect.left - (rect.width - EDITOR_CAMERA_VIEWBOX.width * scale) / 2) / scale;
      const viewBoxY = (clientY - rect.top - (rect.height - EDITOR_CAMERA_VIEWBOX.height * scale) / 2) / scale;

      const relX = viewBoxX - EDITOR_CAMERA_CENTER.x;
      const relY = viewBoxY - EDITOR_CAMERA_CENTER.y;

      const svgX = relX / zoomLevel - panOffset.x + EDITOR_CAMERA_CENTER.x;
      const svgY = relY / zoomLevel - panOffset.y + EDITOR_CAMERA_CENTER.y;
      return { svgX, svgY };
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

  const startTranslateDragForPart = (partId: string, e: React.MouseEvent) => {
    if (appMode === 'broadcast' || activeTool !== 'select' || e.button !== 0) return;
    e.stopPropagation();
    setSelectedPartId(partId);
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
          const dx = (clientX - dragStart.x) / zoomLevel;
          const dy = (clientY - dragStart.y) / zoomLevel;
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
        if (!targetId) return;
        const part = characterParts.find((p) => p.id === targetId);
        const parentT = part?.parentId ? getComputedTransform(part.parentId, currentFrame) : null;
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
        if (!targetId) return;
        const part = characterParts.find((p) => p.id === targetId);
        const parentT = part?.parentId ? getComputedTransform(part.parentId, currentFrame) : null;
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
        let dx = svgX - dragStart.x;
        let dy = svgY - dragStart.y;
        
        // Snapping Logic
        let snappedX = dx;
        let snappedY = dy;
        const newSnapLines: {x1: number, y1: number, x2: number, y2: number, color?: string}[] = [];
        const SNAP_DIST = 8 / zoomLevel;
        
        if (focusModeNodeId !== selectedPartId) {
          // Compute moving group/part center and bounds
          let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
          
          const relevantIds = selectedPartIds.includes(selectedPartId) ? selectedPartIds : [selectedPartId];
          relevantIds.forEach(id => {
            const part = characterParts.find(p => p.id === id);
            if (!part) return;
            const initT = dragStart.initialTransforms?.[id] || dragStart.initialTransform;
            const b = getPartBounds(part, initT);
            const left = initT.x + dx - b.halfW * Math.abs(initT.scaleX);
            const right = initT.x + dx + b.halfW * Math.abs(initT.scaleX);
            const top = initT.y + dy - b.halfH * Math.abs(initT.scaleY);
            const bottom = initT.y + dy + b.halfH * Math.abs(initT.scaleY);
            if (left < minX) minX = left; if (right > maxX) maxX = right;
            if (top < minY) minY = top; if (bottom > maxY) maxY = bottom;
          });
          
          if (minX !== Infinity) {
            const movingCX = (minX + maxX) / 2;
            const movingCY = (minY + maxY) / 2;
            
            // Check canvas center
            if (Math.abs(movingCX - 0) < SNAP_DIST) {
              snappedX -= movingCX;
              newSnapLines.push({ x1: EDITOR_CAMERA_CENTER.x, y1: -1000, x2: EDITOR_CAMERA_CENTER.x, y2: 1000, color: '#f472b6' }); // Canvas Center Y-Axis
            }
            if (Math.abs(movingCY - 0) < SNAP_DIST) {
              snappedY -= movingCY;
              newSnapLines.push({ x1: -1000, y1: EDITOR_CAMERA_CENTER.y, x2: 1000, y2: EDITOR_CAMERA_CENTER.y, color: '#f472b6' }); // Canvas Center X-Axis
            }
            
            // Check other parts
            characterParts.forEach(part => {
              if (relevantIds.includes(part.id)) return;
              const t = getComputedTransform(part.id, currentFrame);
              const cx = t.x; const cy = t.y;
              
              if (Math.abs(movingCX - cx) < SNAP_DIST && newSnapLines.length < 5) {
                snappedX -= (movingCX - cx);
                newSnapLines.push({ x1: EDITOR_CAMERA_CENTER.x + cx, y1: -1000, x2: EDITOR_CAMERA_CENTER.x + cx, y2: 1000, color: '#38bdf8' });
              }
              if (Math.abs(movingCY - cy) < SNAP_DIST && newSnapLines.length < 5) {
                snappedY -= (movingCY - cy);
                newSnapLines.push({ x1: -1000, y1: EDITOR_CAMERA_CENTER.y + cy, x2: 1000, y2: EDITOR_CAMERA_CENTER.y + cy, color: '#38bdf8' });
              }
            });
          }
        }
        
        setSnapLines(newSnapLines);
        
        // If we have multiple selections and the dragged part is in it, move all of them
        if (dragStart.initialTransforms) {
            Object.keys(dragStart.initialTransforms).forEach(id => {
              const initT = dragStart.initialTransforms![id];
              const movedPart = characterParts.find((x) => x.id === id);
              if (movedPart?.parentId) {
                // Child of a container: the stored position is container-relative,
                // so convert the moved WORLD position back into container space.
                const pt = getComputedTransform(movedPart.parentId, currentFrame);
                const local = worldToContainerLocal({ ...initT, x: initT.x + snappedX, y: initT.y + snappedY }, pt);
                updateCurrentTransform({ x: local.x, y: local.y }, id);
              } else {
                updateCurrentTransform({ x: initT.x + snappedX, y: initT.y + snappedY }, id);
              }
            });
          } else {
            const draggedPart = characterParts.find((x) => x.id === selectedPartId);
            if (draggedPart?.parentId) {
              const pt = getComputedTransform(draggedPart.parentId, currentFrame);
              const local = worldToContainerLocal(
                { ...dragStart.initialTransform, x: dragStart.initialTransform.x + snappedX, y: dragStart.initialTransform.y + snappedY },
                pt
              );
              updateCurrentTransform({ x: local.x, y: local.y });
            } else {
              updateCurrentTransform({ x: dragStart.initialTransform.x + snappedX, y: dragStart.initialTransform.y + snappedY });
            }
          }
        return;
      } else if (dragMode === 'rotate') {
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
    [isDragging, dragMode, dragStart, clientToSVG, dragInitialAngle, dragInitialLocalX, dragInitialLocalY, selectedPartId, characterParts, updateCurrentTransform, zoomLevel]
  );

  const handleMouseUp = useCallback(() => {
    if (dragMode === 'marquee' && marqueeRect) {
      const selected = getPartsInMarquee(
        characterParts,
        (id) => getComputedTransform(id, currentFrame),
        marqueeRect,
        EDITOR_CAMERA_CENTER.x,
        EDITOR_CAMERA_CENTER.y,
        (part) => tracks.find((track) => track.partId === part.id)?.editVisible !== false,
      );
      if (selected.length > 0) {
        handleSelectPart(selected[selected.length - 1], false);
        selected.slice(0, -1).forEach((id) => handleSelectPart(id, true));
      }
    }

    if (isDragging) endBatchInteraction();
    setIsDragging(false);
    setDragMode(null);
    setMarqueeRect(null);
    setSnapLines([]);
  }, [dragMode, marqueeRect, characterParts, currentFrame, handleSelectPart, getComputedTransform, tracks, isDragging, endBatchInteraction]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('pointerup', handleMouseUp);
      window.addEventListener('pointercancel', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('pointerup', handleMouseUp);
      window.removeEventListener('pointercancel', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container || appMode === 'broadcast') return;
    const nextZoom = clampZoom(zoomRef.current * (e.deltaY < 0 ? 1.1 : 0.9));
    const anchored = getCursorAnchoredViewport({
      rect: container.getBoundingClientRect(),
      clientX: e.clientX,
      clientY: e.clientY,
      zoom: zoomRef.current,
      pan: panRef.current,
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
        style={{ transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`, transformOrigin: 'center center', cursor: activeTool === 'freeform_draw' ? 'crosshair' : undefined }}
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
                selectedPartId={selectedPartId}
                totalFrames={totalFrames}
                tracks={tracks}
                projectResolution={projectResolution}
                customPresets={customPresets}
                liveStuntsState={liveStuntsState}
                onSelect={(id) => {
                  setSelectedPartId(id);
                }}
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

              {/* Snap Lines */}
              {snapLines.map((line, i) => (
                <line
                  key={`snap-${i}`}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke={line.color || '#38bdf8'}
                  strokeWidth={1 / zoomLevel}
                  pointerEvents="none"
                  strokeDasharray="4,4"
                />
              ))}

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
                selectedTransform &&
                appMode !== 'broadcast' &&
                selectedPart.points &&
                selectedPart.points.length > 0 && (
                  <g pointerEvents="none">
                    {getFreeformVertexWorldPositions(
                      selectedPart.points,
                      EDITOR_CAMERA_CENTER.x + selectedTransform.x,
                      EDITOR_CAMERA_CENTER.y + selectedTransform.y,
                      selectedTransform.scaleX,
                      selectedTransform.scaleY,
                      selectedTransform.rotation
                    ).map((v, i) => (
                      <g key={`vm-${i}`} transform={`translate(${v.x}, ${v.y})`}>
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
