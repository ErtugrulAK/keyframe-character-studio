import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import type { Transform } from '../../types/animator';
import { PartRenderer } from './renderers/PartRenderer';
import { TransformGizmo, getPartBounds, type ScaleMode } from './overlays/TransformGizmo';
import { CanvasViewportToolbar } from './overlays/CanvasViewportToolbar';
import { CanvasGridOverlay } from './overlays/CanvasGridOverlay';
import { Sparkles } from 'lucide-react';
import './StageCanvas.css';

export const StageCanvas: React.FC = () => {
  const {
    currentFrame,
    characterParts,
    selectedPartId,
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
  } = useAnimator();

  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragMode, setDragMode] = useState<'translate' | 'rotate' | 'scale' | 'scale_corner' | 'scale_x' | 'scale_y' | 'scale_left' | 'scale_right' | 'scale_top' | 'scale_bottom' | 'pan' | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; initialTransform: Transform }>({
    x: 0,
    y: 0,
    initialTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  });

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

  const startTranslateDragForPart = (partId: string, e: React.MouseEvent) => {
    if (appMode === 'broadcast' || e.button !== 0) return;
    e.stopPropagation();
    setSelectedPartId(partId);

    const transform = getComputedTransform(partId, currentFrame);
    if (!transform) return;

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
      target.classList.contains('canvas-bg')
    ) {
      setSelectedPartId(null);
    }
  };

  const startRotate = (e: React.MouseEvent) => {
    if (appMode === 'broadcast' || e.button !== 0 || !selectedPart || !selectedTransform) return;
    e.stopPropagation();
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

      if (dragMode === 'translate') {
        const dx = svgX - dragStart.x;
        const dy = svgY - dragStart.y;
        updateCurrentTransform({
          x: Math.round(dragStart.initialTransform.x + dx),
          y: Math.round(dragStart.initialTransform.y + dy),
        });
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
    setIsDragging(false);
    setDragMode(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
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
              </g>

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
              {appMode !== 'broadcast' && selectedPart && selectedTransform && (() => {
                const selTrack = tracks.find(t => t.partId === selectedPart.id);
                if (selTrack && selTrack.editVisible === false) return null;
                return (
                  <TransformGizmo
                    selectedPart={selectedPart}
                    selectedTransform={selectedTransform}
                    zScale={zScale}
                    onRotateMouseDown={startRotate}
                    onScaleMouseDown={startScale}
                  />
                );
              })()}
            </>
          );
        })()}
      </svg>
    </div>
  );
};
