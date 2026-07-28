import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import type { Transform } from '../../types/animator';
import { PartRenderer } from './renderers/PartRenderer';
import { TransformGizmo, getPartBounds, type ScaleMode } from './overlays/TransformGizmo';
import { MaskGizmo } from './overlays/MaskGizmo';
import { CanvasViewportToolbar } from './overlays/CanvasViewportToolbar';
import { CanvasGridOverlay } from './overlays/CanvasGridOverlay';
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
    tracks,
    focusModeNodeId,
    setFocusModeNodeId,
    updateCharacterPart,
    startBatchInteraction,
    endBatchInteraction,
  } = useAnimator();

  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragMode, setDragMode] = useState<'translate' | 'rotate' | 'scale' | 'scale_corner' | 'scale_x' | 'scale_y' | 'scale_left' | 'scale_right' | 'scale_top' | 'scale_bottom' | 'pan' | 'marquee' | 'mask_point' | 'mask_in' | 'mask_out' | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; initialTransform: Transform; initialTransforms?: Record<string, Transform>; initialMaskX?: number; initialMaskY?: number; initialMaskPoints?: any[] }>({
    x: 0,
    y: 0,
    initialTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  });
  const [dragMaskPointIndex, setDragMaskPointIndex] = useState<number | null>(null);
  const [snapLines, setSnapLines] = useState<{x1: number, y1: number, x2: number, y2: number, color?: string}[]>([]);

  const [dragInitialAngle, setDragInitialAngle] = useState<number>(0);
  const [dragInitialDist, setDragInitialDist] = useState<number>(1);
  const [dragInitialLocalX, setDragInitialLocalX] = useState<number>(1);
  const [dragInitialLocalY, setDragInitialLocalY] = useState<number>(1);

  const selectedPart = characterParts.find((p) => p.id === selectedPartId);
  const selectedTransform = selectedPartId ? getComputedTransform(selectedPartId, currentFrame) : null;

  const clientToSVG = useCallback(
    (clientX: number, clientY: number): { svgX: number; svgY: number } => {
      if (!containerRef.current) return { svgX: 0, svgY: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const scale = Math.min(rect.width / 600, rect.height / 480) || 1;
      const viewBoxX = (clientX - rect.left - (rect.width - 600 * scale) / 2) / scale;
      const viewBoxY = (clientY - rect.top - (rect.height - 480 * scale) / 2) / scale;

      const relX = viewBoxX - 300;
      const relY = viewBoxY - 240;

      const svgX = relX / zoomLevel - panOffset.x + 300;
      const svgY = relY / zoomLevel - panOffset.y + 240;
      return { svgX, svgY };
    },
    [zoomLevel, panOffset]
  );

  const startMaskPointDrag = useCallback((e: React.MouseEvent, index: number, handleType: 'point' | 'in' | 'out') => {
    if (!selectedPartId) return;
    e.stopPropagation();
    setIsDragging(true);
    setDragMode(`mask_${handleType}` as any);
    setDragMaskPointIndex(index);
    startBatchInteraction();

    const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);
    const transform = getComputedTransform(selectedPartId, currentFrame);
    
    const part = characterParts.find(p => p.id === selectedPartId);
    if (!part) return;
    const activeMask = transform.mask || part.mask;
    if (!activeMask) return;

    setDragStart({
      x: svgX,
      y: svgY,
      initialTransform: { ...transform },
      initialMaskPoints: JSON.parse(JSON.stringify(activeMask.points))
    });
  }, [selectedPartId, clientToSVG, getComputedTransform, currentFrame, characterParts, startBatchInteraction]);

  const startTranslateDragForPart = (partId: string, e: React.MouseEvent) => {
    if (appMode === 'broadcast' || e.button !== 0) return;
    e.stopPropagation();
    setSelectedPartId(partId);

    const transform = getComputedTransform(partId, currentFrame);
    if (!transform) return;

    startBatchInteraction();
    setIsDragging(true);
    setDragMode('translate');
    const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);
    
    const part = characterParts.find(p => p.id === partId);
    
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
      initialMaskX: part?.maskOffsetX || 0,
      initialMaskY: part?.maskOffsetY || 0,
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2 || activeTool === 'pan') {
      setIsDragging(true);
      setDragMode('pan' as any);
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        initialTransform: { x: panOffset.x, y: panOffset.y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      });
      return;
    }

    if (appMode === 'broadcast') return;

    const target = e.target as HTMLElement;
    if (
      target === containerRef.current || 
      target.tagName === 'svg' ||
      target.classList.contains('canvas-bg') ||
      target.classList.contains('focus-spotlight-dimmer')
    ) {
      handleSelectPart(null);
      setFocusModeNodeId(null);
      
      const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);
      setIsDragging(true);
      setDragMode('marquee');
      setDragStart({
        x: svgX,
        y: svgY,
        initialTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }
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
    const centerX = 300 + selectedTransform.x;
    const centerY = 240 + selectedTransform.y;
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
    setDragMode(mode as any);

    const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);
    const centerX = 300 + selectedTransform.x;
    const centerY = 240 + selectedTransform.y;
    const dx = svgX - centerX;
    const dy = svgY - centerY;
    const initialDist = Math.sqrt(dx * dx + dy * dy);

    const rad = (-selectedTransform.rotation * Math.PI) / 180;
    const localX = Math.abs(dx * Math.cos(rad) - dy * Math.sin(rad));
    const localY = Math.abs(dx * Math.sin(rad) + dy * Math.cos(rad));

    setDragInitialDist(initialDist || 1);
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

      if (!selectedPartId) return;

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
            const b = getPartBounds(part);
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
              newSnapLines.push({ x1: 300, y1: -1000, x2: 300, y2: 1000, color: '#f472b6' }); // Canvas Center Y-Axis
            }
            if (Math.abs(movingCY - 0) < SNAP_DIST) {
              snappedY -= movingCY;
              newSnapLines.push({ x1: -1000, y1: 240, x2: 1000, y2: 240, color: '#f472b6' }); // Canvas Center X-Axis
            }
            
            // Check other parts
            characterParts.forEach(part => {
              if (relevantIds.includes(part.id)) return;
              const t = getComputedTransform(part.id, currentFrame);
              const cx = t.x; const cy = t.y;
              
              if (Math.abs(movingCX - cx) < SNAP_DIST && newSnapLines.length < 5) {
                snappedX -= (movingCX - cx);
                newSnapLines.push({ x1: 300 + cx, y1: -1000, x2: 300 + cx, y2: 1000, color: '#38bdf8' });
              }
              if (Math.abs(movingCY - cy) < SNAP_DIST && newSnapLines.length < 5) {
                snappedY -= (movingCY - cy);
                newSnapLines.push({ x1: -1000, y1: 240 + cy, x2: 1000, y2: 240 + cy, color: '#38bdf8' });
              }
            });
          }
        }
        
        setSnapLines(newSnapLines);
        
        if (focusModeNodeId === selectedPartId) {
          updateCharacterPart(selectedPartId, {
            maskOffsetX: (dragStart.initialMaskX || 0) + snappedX,
            maskOffsetY: (dragStart.initialMaskY || 0) + snappedY,
          });
        } else {
          // If we have multiple selections and the dragged part is in it, move all of them
          if (dragStart.initialTransforms) {
            Object.keys(dragStart.initialTransforms).forEach(id => {
              const initT = dragStart.initialTransforms![id];
              updateCurrentTransform({ x: initT.x + snappedX, y: initT.y + snappedY }, id);
            });
          } else {
            updateCurrentTransform({ x: dragStart.initialTransform.x + snappedX, y: dragStart.initialTransform.y + snappedY });
          }
        }
        return;
      } else if (dragMode && dragMode.startsWith('mask_') && dragMaskPointIndex !== null && dragStart.initialMaskPoints) {
        const part = characterParts.find((p) => p.id === selectedPartId);
        if (!part || !part.mask) return;

        const deltaWorldX = svgX - dragStart.x;
        const deltaWorldY = svgY - dragStart.y;

        const rotDeg = dragStart.initialTransform.rotation;
        const rad = (rotDeg * Math.PI) / 180;
        const cosR = Math.cos(rad);
        const sinR = Math.sin(rad);

        const sX = dragStart.initialTransform.scaleX;
        const sY = dragStart.initialTransform.scaleY;
        const dxLocal = (deltaWorldX * cosR + deltaWorldY * sinR) / sX;
        const dyLocal = (-deltaWorldX * sinR + deltaWorldY * cosR) / sY;

        const initialPoint = dragStart.initialMaskPoints[dragMaskPointIndex];
        const currentT = getComputedTransform(part.id, currentFrame);
        const activeMask = currentT.mask || part.mask;
        if (!activeMask) return;
        
        const newPoints = [...activeMask.points];

        if (dragMode === 'mask_point') {
          newPoints[dragMaskPointIndex] = {
            ...newPoints[dragMaskPointIndex],
            x: initialPoint.x + dxLocal,
            y: initialPoint.y + dyLocal
          };
        } else if (dragMode === 'mask_in' && initialPoint.handleIn) {
          newPoints[dragMaskPointIndex] = {
            ...newPoints[dragMaskPointIndex],
            handleIn: {
              x: initialPoint.handleIn.x + dxLocal,
              y: initialPoint.handleIn.y + dyLocal
            }
          };
        } else if (dragMode === 'mask_out' && initialPoint.handleOut) {
          newPoints[dragMaskPointIndex] = {
            ...newPoints[dragMaskPointIndex],
            handleOut: {
              x: initialPoint.handleOut.x + dxLocal,
              y: initialPoint.handleOut.y + dyLocal
            }
          };
        }

        updateCurrentTransform({ mask: { ...activeMask, points: newPoints } });
        return;
      } else if (dragMode === 'rotate') {
        const centerX = 300 + dragStart.initialTransform.x;
        const centerY = 240 + dragStart.initialTransform.y;
        const dx = svgX - centerX;
        const dy = svgY - centerY;
        const currentAngleRad = Math.atan2(dy, dx);
        const deltaAngleRad = currentAngleRad - dragInitialAngle;
        const deltaAngleDeg = (deltaAngleRad * 180) / Math.PI;

        const newRotation = Math.round(dragStart.initialTransform.rotation + deltaAngleDeg);
        updateCurrentTransform({ rotation: newRotation });
      } else if (dragMode === 'scale_corner' || (dragMode as any) === 'scale') {
        const centerX = 300 + dragStart.initialTransform.x;
        const centerY = 240 + dragStart.initialTransform.y;
        const dx = svgX - centerX;
        const dy = svgY - centerY;
        const currentDist = Math.sqrt(dx * dx + dy * dy);

        const ratio = currentDist / Math.max(10, dragInitialDist);
        const precision = e.shiftKey ? 3 : 2;
        const newScaleX = parseFloat(Math.max(0.05, dragStart.initialTransform.scaleX * ratio).toFixed(precision));
        const newScaleY = parseFloat(Math.max(0.05, dragStart.initialTransform.scaleY * ratio).toFixed(precision));

        updateCurrentTransform({ scaleX: newScaleX, scaleY: newScaleY });
      } else if (
        dragMode === 'scale_right' ||
        dragMode === 'scale_left' ||
        dragMode === 'scale_top' ||
        dragMode === 'scale_bottom'
      ) {
        const part = characterParts.find((p) => p.id === selectedPartId);
        if (!part) return;

        const bounds = getPartBounds(part);
        const halfW0 = bounds.halfW;
        const halfH0 = bounds.halfH;

        // World displacement vector from drag start
        const deltaWorldX = svgX - dragStart.x;
        const deltaWorldY = svgY - dragStart.y;

        // Convert world delta to local coordinates of the unrotated element
        const rotDeg = dragStart.initialTransform.rotation;
        const rad = (rotDeg * Math.PI) / 180;
        const cosR = Math.cos(rad);
        const sinR = Math.sin(rad);

        // Local displacement along element's X and Y axes
        const dxLocal = deltaWorldX * cosR + deltaWorldY * sinR;
        const dyLocal = -deltaWorldX * sinR + deltaWorldY * cosR;

        const initScaleX = dragStart.initialTransform.scaleX;
        const initScaleY = dragStart.initialTransform.scaleY;
        const initX = dragStart.initialTransform.x;
        const initY = dragStart.initialTransform.y;

        let newScaleX = initScaleX;
        let newScaleY = initScaleY;
        let newX = initX;
        let newY = initY;

        if (dragMode === 'scale_right') {
          // Keep Left edge fixed, stretch ONLY Right
          const newScaleXVal = Math.max(0.05, initScaleX + dxLocal / (2 * halfW0));
          const deltaScaleX = newScaleXVal - initScaleX;
          newScaleX = parseFloat(newScaleXVal.toFixed(2));
          newX = Math.round(initX + deltaScaleX * halfW0 * cosR);
          newY = Math.round(initY + deltaScaleX * halfW0 * sinR);
        } else if (dragMode === 'scale_left') {
          // Keep Right edge fixed, stretch ONLY Left
          const newScaleXVal = Math.max(0.05, initScaleX - dxLocal / (2 * halfW0));
          const deltaScaleX = newScaleXVal - initScaleX;
          newScaleX = parseFloat(newScaleXVal.toFixed(2));
          newX = Math.round(initX - deltaScaleX * halfW0 * cosR);
          newY = Math.round(initY - deltaScaleX * halfW0 * sinR);
        } else if (dragMode === 'scale_bottom') {
          // Keep Top edge fixed, stretch ONLY Bottom
          const newScaleYVal = Math.max(0.05, initScaleY + dyLocal / (2 * halfH0));
          const deltaScaleY = newScaleYVal - initScaleY;
          newScaleY = parseFloat(newScaleYVal.toFixed(2));
          newX = Math.round(initX - deltaScaleY * halfH0 * sinR);
          newY = Math.round(initY + deltaScaleY * halfH0 * cosR);
        } else if (dragMode === 'scale_top') {
          // Keep Bottom edge fixed, stretch ONLY Top
          const newScaleYVal = Math.max(0.05, initScaleY - dyLocal / (2 * halfH0));
          const deltaScaleY = newScaleYVal - initScaleY;
          newScaleY = parseFloat(newScaleYVal.toFixed(2));
          newX = Math.round(initX + deltaScaleY * halfH0 * sinR);
          newY = Math.round(initY - deltaScaleY * halfH0 * cosR);
        }

        updateCurrentTransform({
          x: newX,
          y: newY,
          scaleX: newScaleX,
          scaleY: newScaleY,
        });
      } else if (dragMode === 'scale_x') {
        const centerX = 300 + dragStart.initialTransform.x;
        const centerY = 240 + dragStart.initialTransform.y;
        const dx = svgX - centerX;
        const dy = svgY - centerY;

        const rad = (-dragStart.initialTransform.rotation * Math.PI) / 180;
        const currentLocalX = Math.abs(dx * Math.cos(rad) - dy * Math.sin(rad));
        const ratioX = currentLocalX / Math.max(5, dragInitialLocalX);

        const newScaleX = parseFloat(Math.max(0.05, dragStart.initialTransform.scaleX * ratioX).toFixed(2));
        updateCurrentTransform({ scaleX: newScaleX });
      } else if (dragMode === 'scale_y') {
        const centerX = 300 + dragStart.initialTransform.x;
        const centerY = 240 + dragStart.initialTransform.y;
        const dx = svgX - centerX;
        const dy = svgY - centerY;

        const rad = (-dragStart.initialTransform.rotation * Math.PI) / 180;
        const currentLocalY = Math.abs(dx * Math.sin(rad) + dy * Math.cos(rad));
        const ratioY = currentLocalY / Math.max(5, dragInitialLocalY);

        const newScaleY = parseFloat(Math.max(0.05, dragStart.initialTransform.scaleY * ratioY).toFixed(2));
        updateCurrentTransform({ scaleY: newScaleY });
      }
    },
    [isDragging, dragMode, dragStart, clientToSVG, dragInitialAngle, dragInitialDist, dragInitialLocalX, dragInitialLocalY, selectedPartId, characterParts, updateCurrentTransform, zoomLevel]
  );

  const handleMouseUp = useCallback(() => {
      if (dragMode === 'marquee' && marqueeRect) {
        // Calculate collisions with all parts
        const selected: string[] = [];
        characterParts.forEach(part => {
          const t = getComputedTransform(part.id, currentFrame);
          const bounds = getPartBounds(part);
          const cx = 300 + t.x;
          const cy = 240 + t.y;
          // Rough bounding box intersection
          const partLeft = cx - bounds.halfW * t.scaleX;
          const partRight = cx + bounds.halfW * t.scaleX;
          const partTop = cy - bounds.halfH * t.scaleY;
          const partBottom = cy + bounds.halfH * t.scaleY;
          
          if (
            partRight > marqueeRect.x &&
            partLeft < marqueeRect.x + marqueeRect.w &&
            partBottom > marqueeRect.y &&
            partTop < marqueeRect.y + marqueeRect.h
          ) {
            selected.push(part.id);
          }
        });
        
        if (selected.length > 0) {
          handleSelectPart(selected[selected.length - 1], false);
          // Manually update all selections
          setTimeout(() => {
            selected.forEach((id, i) => {
              if (i < selected.length - 1) handleSelectPart(id, true);
            });
          }, 0);
        }
      }

      if (isDragging) {
        endBatchInteraction();
      }
      setIsDragging(false);
      setDragMode(null);
      setMarqueeRect(null);
      setSnapLines([]);
      setDragMaskPointIndex(null);
  }, [dragMode, marqueeRect, characterParts, currentFrame, handleSelectPart, getComputedTransform]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('pointerup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('pointerup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoomLevel((prev) => Math.min(3, Math.max(0.3, prev * zoomFactor)));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

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
          
          const dx = svgX - (300 + transform.x);
          const dy = svgY - (240 + transform.y);
          const rad = -transform.rotation * Math.PI / 180;
          const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
          const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
          const unscaledX = localX / Math.abs(transform.scaleX || 1);
          const unscaledY = localY / Math.abs(transform.scaleY || 1);
          
          const { halfW, halfH } = getPartBounds(part);
          
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
            baseTransform: { x: Math.round(svgX - 300), y: Math.round(svgY - 240), rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
            ...(isVideo ? { videoUrl: url } : { imageUrl: url }),
          });
        }
        return;
      }
    }

    // Handle UI Panel JSON drops
    const rawData = e.dataTransfer.getData('application/json');
    if (!rawData) return;
    const data = JSON.parse(rawData);

    addCustomPart(data.type, data.name || 'Dropped Element', {
      baseTransform: {
        x: Math.round(svgX - 300),
        y: Math.round(svgY - 240),
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
      },
    });
  };

  const sortedParts = [...characterParts].sort((a, b) => a.zIndex - b.zIndex);
  const isPanning = activeTool === 'pan' || (isDragging && (dragMode as any) === 'pan');

  return (
    <div
      className={`stage-canvas-container ${isPanning ? 'panning' : ''}`}
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
        viewBox="0 0 600 480"
        preserveAspectRatio="xMidYMid meet"
        style={{ transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`, transformOrigin: 'center center' }}
      >
        <defs>
          <pattern
            id="svg-dashed-grid"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
            x={300 - projectResolution.width / 2}
            y={240 - projectResolution.height / 2}
          >
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(56, 189, 248, 0.22)" strokeWidth="1" strokeDasharray="3 3" />
          </pattern>
          <clipPath id="artboard-clip">
            <rect
              x={300 - projectResolution.width / 2}
              y={240 - projectResolution.height / 2}
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
          const artX = 300 - projectResolution.width / 2;
          const artY = 240 - projectResolution.height / 2;

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
              />

              {/* Character Parts Active Render (Clipped in Broadcast mode, unclipped & visible in Edit mode) */}
              <g clipPath={appMode === 'broadcast' ? 'url(#artboard-clip)' : undefined}>
                {sortedParts.map((part) => {
                  if (focusModeNodeId && part.id === focusModeNodeId) return null; // Render later
                  
                  let frameToEvaluate = currentFrame;

                  if (appMode === 'broadcast') {
                    const bState = broadcastState[part.id] || { state: 'hidden', progress: 0 };
                    if (bState.state === 'animating_in' && part.inAnimPreset === 'custom_timeline') {
                      const st = part.inAnimTimelineStart || 0;
                      const en = part.inAnimTimelineEnd || 30;
                      frameToEvaluate = st + bState.progress * (en - st);
                    } else if (bState.state === 'visible' && part.inAnimPreset === 'custom_timeline') {
                      frameToEvaluate = part.inAnimTimelineEnd || 30;
                    } else if (bState.state === 'animating_out' && part.outAnimPreset === 'custom_timeline') {
                      const st = part.outAnimTimelineStart || 0;
                      const en = part.outAnimTimelineEnd || 30;
                      frameToEvaluate = st + bState.progress * (en - st);
                    }
                  }

                  const transform = getComputedTransform(part.id, frameToEvaluate);
                  return (
                    <PartRenderer
                      key={part.id}
                      part={part}
                      transform={transform}
                      isSelected={selectedPartId === part.id}
                      currentFrame={frameToEvaluate}
                      totalFrames={totalFrames}
                      onSelect={setSelectedPartId}
                      onStartTranslateDrag={startTranslateDragForPart}
                    />
                  );
                })}
                
                {/* Focus Mode Overlay and Focused Part */}
                {focusModeNodeId && (
                  <>
                    <rect
                      className="focus-spotlight-dimmer"
                      x={-300000}
                      y={-300000}
                      width={600000}
                      height={600000}
                      fill="rgba(0, 0, 0, 0.7)"
                    />
                    {sortedParts.filter(p => p.id === focusModeNodeId).map((part) => {
                      const transform = getComputedTransform(part.id, currentFrame);
                      return (
                        <g key={`focus-${part.id}`}>
                          <PartRenderer
                            part={part}
                            transform={transform}
                            isSelected={true}
                            currentFrame={currentFrame}
                            totalFrames={totalFrames}
                            onSelect={setSelectedPartId}
                            onStartTranslateDrag={startTranslateDragForPart}
                            isGhost={true}
                            isFocusGhost={true}
                          />
                          <PartRenderer
                            part={part}
                            transform={transform}
                            isSelected={true}
                            currentFrame={currentFrame}
                            totalFrames={totalFrames}
                            onSelect={setSelectedPartId}
                            onStartTranslateDrag={startTranslateDragForPart}
                          />
                        </g>
                      );
                    })}
                  </>
                )}
              </g>

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

              {/* Interactive Transform Gizmo (Only in Edit Mode when not hard-hidden) */}
              {appMode !== 'broadcast' && (() => {
                if (selectedPartIds.length > 1) {
                  let minX = Infinity;
                  let minY = Infinity;
                  let maxX = -Infinity;
                  let maxY = -Infinity;
                  
                  selectedPartIds.forEach(id => {
                    const part = characterParts.find(p => p.id === id);
                    if (!part) return;
                    const t = getComputedTransform(id, currentFrame);
                    const b = getPartBounds(part);
                    const left = t.x - b.halfW * Math.abs(t.scaleX);
                    const right = t.x + b.halfW * Math.abs(t.scaleX);
                    const top = t.y - b.halfH * Math.abs(t.scaleY);
                    const bottom = t.y + b.halfH * Math.abs(t.scaleY);
                    if (left < minX) minX = left;
                    if (right > maxX) maxX = right;
                    if (top < minY) minY = top;
                    if (bottom > maxY) maxY = bottom;
                  });

                  if (minX === Infinity) return null;
                  
                  const groupTransform: Transform = {
                    x: (minX + maxX) / 2,
                    y: (minY + maxY) / 2,
                    rotation: 0,
                    scaleX: 1,
                    scaleY: 1,
                    opacity: 1
                  };
                  
                  const halfW = (maxX - minX) / 2;
                  const halfH = (maxY - minY) / 2;

                  return (
                    <TransformGizmo
                      selectedPart={characterParts[0]} // dummy
                      selectedTransform={groupTransform}
                      zScale={zScale}
                      onRotateMouseDown={() => {}} // disabled for groups
                      onScaleMouseDown={() => {}} // disabled for groups
                      isGroup={true}
                      overrideHalfW={halfW}
                      overrideHalfH={halfH}
                    />
                  );
                } else if (selectedPart && selectedTransform) {
                  const selTrack = tracks.find(t => t.partId === selectedPart.id);
                  if (selTrack && selTrack.editVisible === false) return null;
                  return (
                    <>
                      {activeTool !== 'mask' && (
                        <TransformGizmo
                          selectedPart={selectedPart}
                          selectedTransform={selectedTransform}
                          zScale={zScale}
                          onRotateMouseDown={startRotate}
                          onScaleMouseDown={startScale}
                        />
                      )}
                      {activeTool === 'mask' && selectedPart.mask && selectedPart.mask.enabled && (
                        <g transform={`translate(${300 + selectedTransform.x}, ${240 + selectedTransform.y}) rotate(${selectedTransform.rotation})`}>
                          <MaskGizmo
                            part={selectedPart}
                            transform={selectedTransform}
                            zoomLevel={zScale}
                            onPointDragStart={startMaskPointDrag}
                          />
                        </g>
                      )}
                    </>
                  );
                }
                return null;
              })()}
            </>
          );
        })()}
      </svg>
    </div>
  );
};
