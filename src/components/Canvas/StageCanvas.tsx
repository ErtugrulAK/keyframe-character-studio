import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import type { Transform } from '../../types/animator';
import { PartRenderer } from './renderers/PartRenderer';
import { TransformGizmo } from './overlays/TransformGizmo';
import { SkeletalBones } from './overlays/SkeletalBones';
import { OnionSkinning } from './overlays/OnionSkinning';
import { Grid, ZoomIn, ZoomOut, Compass, Bone, Layers, Sparkles } from 'lucide-react';
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
  const [showBones, setShowBones] = useState<boolean>(false);
  const [showOnionSkin, setShowOnionSkin] = useState<boolean>(false);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragMode, setDragMode] = useState<'translate' | 'rotate' | 'scale' | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; initialTransform: Transform }>({
    x: 0,
    y: 0,
    initialTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  });

  const [dragInitialAngle, setDragInitialAngle] = useState<number>(0);
  const [dragInitialDist, setDragInitialDist] = useState<number>(1);

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
    if (appMode === 'broadcast') return;

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
    const dx = svgX - (300 + selectedTransform.x);
    const dy = svgY - (240 + selectedTransform.y);
    const startAngleRad = Math.atan2(dy, dx);

    setDragInitialAngle(startAngleRad);
    setDragStart({
      x: svgX,
      y: svgY,
      initialTransform: { ...selectedTransform },
    });
  };

  const startScale = (e: React.MouseEvent) => {
    if (appMode === 'broadcast' || e.button !== 0 || !selectedPart || !selectedTransform) return;
    e.stopPropagation();
    setIsDragging(true);
    setDragMode('scale');

    const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);
    const centerX = 300 + selectedTransform.x;
    const centerY = 240 + selectedTransform.y;
    const dx = svgX - centerX;
    const dy = svgY - centerY;
    const initialDist = Math.sqrt(dx * dx + dy * dy);

    setDragInitialDist(initialDist || 1);
    setDragStart({
      x: svgX,
      y: svgY,
      initialTransform: { ...selectedTransform },
    });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragMode) return;

      if ((dragMode as any) === 'pan') {
        const dx = (e.clientX - dragStart.x) / zoomLevel;
        const dy = (e.clientY - dragStart.y) / zoomLevel;
        setPanOffset({
          x: dragStart.initialTransform.x + dx,
          y: dragStart.initialTransform.y + dy,
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
      } else if (dragMode === 'scale') {
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
      }
    },
    [isDragging, dragMode, dragStart, clientToSVG, dragInitialAngle, dragInitialDist, selectedPartId, updateCurrentTransform, zoomLevel]
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

  const getPartBounds = (partType: string): { halfW: number; halfH: number } => {
    let halfW = 32; let halfH = 32;
    switch (partType) {
      case 'custom_card': halfW = 90; halfH = 50; break;
      case 'custom_rect': halfW = 60; halfH = 30; break;
      case 'custom_banner': halfW = 80; halfH = 25; break;
      case 'custom_image':
      case 'custom_video': halfW = partType === 'custom_video' ? 100 : 90; halfH = 60; break;
    }
    return { halfW, halfH };
  };

  const handleDropStage = (e: React.DragEvent) => {
    e.preventDefault();
    if (appMode === 'broadcast') return;
    setIsDropTargetHover(false);

    try {
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
            
            const { halfW, halfH } = getPartBounds(part.type);
            
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
              innerMediaUrl: url,
              innerMediaType: isVideo ? 'video' : 'image'
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
    } catch (err) {
      console.error('Error handling dropped object on canvas:', err);
    }
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

      {/* Top Bar Overlay Info */}
      <div className="canvas-header-info">
        <span className="stage-title">2D ANIMATION VIEWPORT</span>
        <span className="info-tool">MOD: {isPanning ? 'PAN NAV' : activeTool.toUpperCase()}</span>
      </div>

      {/* Viewport Floating Glass Toolbar */}
      <div className="viewport-tools-overlay">
        <button
          className={`btn-icon viewport-btn ${showGrid ? 'active' : ''}`}
          onClick={() => setShowGrid(!showGrid)}
          title={showGrid ? 'Grid Overlay: ON (Click to Hide)' : 'Grid Overlay: OFF (Click to Show)'}
        >
          <Grid size={14} />
        </button>

        <button
          className={`btn-icon viewport-btn ${showBones ? 'active' : ''}`}
          onClick={() => setShowBones(!showBones)}
          title={showBones ? 'Skeletal Bones: ON (Click to Hide)' : 'Skeletal Bones: OFF (Click to Show)'}
        >
          <Bone size={14} />
        </button>

        <button
          className={`btn-icon viewport-btn ${showOnionSkin ? 'active' : ''}`}
          onClick={() => setShowOnionSkin(!showOnionSkin)}
          title={showOnionSkin ? 'Onion Skinning: ON (Click to Hide)' : 'Onion Skinning: OFF (Click to Show)'}
        >
          <Layers size={14} />
        </button>

        <div style={{ height: 16, width: 1, background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />

        <button
          className="btn-icon viewport-btn"
          onClick={() => setZoomLevel((z) => Math.max(0.3, parseFloat((z - 0.1).toFixed(2))))}
          title="Zoom Out (-)"
        >
          <ZoomOut size={14} />
        </button>

        <span
          className="zoom-badge"
          onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}
          title="Click to Reset View to 100% Fit Stage"
        >
          {Math.round(zoomLevel * 100)}%
        </span>

        <button
          className="btn-icon viewport-btn"
          onClick={() => setZoomLevel((z) => Math.min(3.0, parseFloat((z + 0.1).toFixed(2))))}
          title="Zoom In (+)"
        >
          <ZoomIn size={14} />
        </button>

        <button
          className="btn-icon viewport-btn"
          onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}
          title="Reset Viewport Pan & Zoom (Center Stage)"
        >
          <Compass size={14} />
        </button>
      </div>

      <svg
        className="stage-svg"
        width="100%"
        height="100%"
        viewBox="0 0 600 480"
        preserveAspectRatio="xMidYMid meet"
        style={{ transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`, transformOrigin: 'center center' }}
      >
        <defs>
          <pattern id="svg-dashed-grid" width="40" height="40" patternUnits="userSpaceOnUse" x="300" y="240">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(56, 189, 248, 0.22)" strokeWidth="1" strokeDasharray="3 3" />
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

              {/* Dashed Grid Lines (Edit mode only) */}
              {appMode !== 'broadcast' && showGrid && (
                <rect 
                  className="canvas-bg"
                  x={artX} y={artY} width={projectResolution.width} height={projectResolution.height} 
                  fill="url(#svg-dashed-grid)" 
                />
              )}

              {/* Origin Center Grid Axes (Edit mode only when Grid is enabled) */}
              {appMode !== 'broadcast' && showGrid && (
                <g clipPath="url(#artboard-clip)">
                  <line x1="-300000" y1="240" x2="300000" y2="240" stroke="rgba(239, 68, 68, 0.75)" strokeWidth={1.5 * zScale} strokeDasharray={`${6 * zScale} ${4 * zScale}`} />
                  <line x1="300" y1="-300000" x2="300" y2="300000" stroke="rgba(16, 185, 129, 0.75)" strokeWidth={1.5 * zScale} strokeDasharray={`${6 * zScale} ${4 * zScale}`} />
                  <circle cx={300} cy={240} r={5 * Math.min(3, zScale)} fill="#38bdf8" stroke="#ffffff" strokeWidth={1.5 * zScale} />
                </g>
              )}

              {/* ONION SKINNING */}
              {appMode !== 'broadcast' && showOnionSkin && (
                <OnionSkinning
                  sortedParts={sortedParts}
                  currentFrame={currentFrame}
                  totalFrames={totalFrames}
                  selectedPartId={selectedPartId}
                  getComputedTransform={getComputedTransform}
                  onSelect={setSelectedPartId}
                  onStartTranslateDrag={startTranslateDragForPart}
                />
              )}

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

              {/* Skeletal Bone Hierarchy Links (Edit mode only) */}
              {appMode !== 'broadcast' && showBones && (
                <SkeletalBones
                  characterParts={characterParts}
                  selectedPartId={selectedPartId}
                  currentFrame={currentFrame}
                  zScale={zScale}
                  getComputedTransform={getComputedTransform}
                />
              )}

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
