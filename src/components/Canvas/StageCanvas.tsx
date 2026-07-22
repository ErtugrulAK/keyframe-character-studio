import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import type { CharacterPart, Transform } from '../../types/animator';
import { Grid, ZoomIn, ZoomOut, Compass, Bone, Layers } from 'lucide-react';
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
  } = useAnimator();

  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showBones, setShowBones] = useState<boolean>(true);
  const [showOnionSkin, setShowOnionSkin] = useState<boolean>(false);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragMode, setDragMode] = useState<'translate' | 'rotate' | 'scale' | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; initialTransform: Transform }>({
    x: 0,
    y: 0,
    initialTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  });

  const selectedPart = characterParts.find((p) => p.id === selectedPartId);
  const selectedTransform = selectedPartId ? getComputedTransform(selectedPartId, currentFrame) : null;

  // Render 2D Vector Path for each body part
  const renderPartPath = (part: CharacterPart, transform: Transform, isGhost: boolean = false, ghostColor?: string) => {
    const isSelected = !isGhost && selectedPartId === part.id;
    const opacity = isGhost ? 0.35 : transform.opacity;

    let pathContent: React.ReactNode = null;
    const fill = isGhost && ghostColor ? ghostColor : part.fillColor;
    const stroke = isGhost ? ghostColor : isSelected ? '#00d2ff' : part.strokeColor;

    switch (part.type) {
      case 'hair':
        pathContent = (
          <path
            d="M -35 -20 Q -45 -60 0 -65 Q 45 -60 35 -20 Q 40 10 25 25 Q 0 35 -25 25 Q -40 10 -35 -20 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 3 : 2}
          />
        );
        break;
      case 'head':
        pathContent = (
          <g>
            <ellipse
              cx={0}
              cy={0}
              rx={30}
              ry={35}
              fill={fill}
              stroke={stroke}
              strokeWidth={isSelected ? 3 : 2}
            />
            {!isGhost && (
              <>
                <circle cx={-10} cy={-5} r={4} fill="#222" />
                <circle cx={10} cy={-5} r={4} fill="#222" />
                <circle cx={-8} cy={-7} r={1.5} fill="#fff" />
                <circle cx={12} cy={-7} r={1.5} fill="#fff" />
                <path d="M -8 12 Q 0 20 8 12" fill="none" stroke="#aa5533" strokeWidth={2.5} strokeLinecap="round" />
              </>
            )}
          </g>
        );
        break;
      case 'torso':
        pathContent = (
          <path
            d="M -30 -45 L 30 -45 L 22 45 L -22 45 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 3 : 2}
          />
        );
        break;
      case 'upper_arm_l':
      case 'upper_arm_r':
        pathContent = (
          <rect
            x={-12}
            y={0}
            width={24}
            height={55}
            rx={10}
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 3 : 2}
          />
        );
        break;
      case 'lower_arm_l':
      case 'lower_arm_r':
        pathContent = (
          <g>
            <rect
              x={-10}
              y={0}
              width={20}
              height={50}
              rx={8}
              fill={fill}
              stroke={stroke}
              strokeWidth={isSelected ? 3 : 2}
            />
            <circle cx={0} cy={55} r={10} fill={isGhost ? ghostColor : '#ffdbac'} stroke={stroke} strokeWidth={2} />
          </g>
        );
        break;
      case 'upper_leg_l':
      case 'upper_leg_r':
        pathContent = (
          <rect
            x={-15}
            y={0}
            width={30}
            height={65}
            rx={10}
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 3 : 2}
          />
        );
        break;
      case 'lower_leg_l':
      case 'lower_leg_r':
        pathContent = (
          <g>
            <rect
              x={-12}
              y={0}
              width={24}
              height={60}
              rx={8}
              fill={fill}
              stroke={stroke}
              strokeWidth={isSelected ? 3 : 2}
            />
            <path d="M -14 55 L 18 55 Q 22 55 22 65 L -14 65 Z" fill={isGhost ? ghostColor : '#111'} />
          </g>
        );
        break;

      case 'custom_star':
        pathContent = (
          <polygon
            points="0,-35 10,-10 35,-10 15,5 22,30 0,15 -22,30 -15,5 -35,-10 -10,-10"
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
          />
        );
        break;
      case 'custom_circle':
        pathContent = (
          <circle cx={0} cy={0} r={30} fill={fill} stroke={stroke} strokeWidth={isSelected ? 2 : 1.5} vectorEffect="non-scaling-stroke" />
        );
        break;
      case 'custom_box':
        pathContent = (
          <rect x={-30} y={-30} width={60} height={60} rx={8} fill={fill} stroke={stroke} strokeWidth={isSelected ? 2 : 1.5} vectorEffect="non-scaling-stroke" />
        );
        break;
      case 'custom_rect':
        pathContent = (
          <rect x={-60} y={-35} width={120} height={70} rx={10} fill={fill} stroke={stroke} strokeWidth={isSelected ? 2 : 1.5} vectorEffect="non-scaling-stroke" />
        );
        break;
      case 'custom_triangle':
        pathContent = (
          <polygon points="0,-35 35,25 -35,25" fill={fill} stroke={stroke} strokeWidth={isSelected ? 2 : 1.5} vectorEffect="non-scaling-stroke" />
        );
        break;
      case 'custom_text':
        pathContent = (
          <g>
            <text
              x={0}
              y={0}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={fill}
              stroke={stroke}
              strokeWidth={0.5}
              fontSize={part.fontSize || 24}
              fontWeight="bold"
              fontFamily="Inter, system-ui, sans-serif"
              vectorEffect="non-scaling-stroke"
            >
              {part.textValue || 'TEXT'}
            </text>
          </g>
        );
        break;
      case 'custom_banner':
        pathContent = (
          <g>
            <rect
              x={-80}
              y={-25}
              width={160}
              height={50}
              rx={10}
              fill={fill}
              stroke={stroke}
              strokeWidth={isSelected ? 2 : 1.5}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={0}
              y={0}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={part.strokeColor || '#ffffff'}
              fontSize={part.fontSize || 16}
              fontWeight="700"
              fontFamily="Inter, system-ui, sans-serif"
            >
              {part.textValue || 'BANNER LABEL'}
            </text>
          </g>
        );
        break;
      case 'custom_capsule':
        pathContent = (
          <rect
            x={-50}
            y={-20}
            width={100}
            height={40}
            rx={20}
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
          />
        );
        break;
      case 'custom_diamond':
        pathContent = (
          <polygon
            points="0,-35 35,0 0,35 -35,0"
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
          />
        );
        break;
      case 'custom_card':
        pathContent = (
          <g>
            <rect
              x={-90}
              y={-50}
              width={180}
              height={100}
              rx={12}
              fill={fill}
              stroke={stroke}
              strokeWidth={isSelected ? 2 : 1.5}
              vectorEffect="non-scaling-stroke"
            />
            {/* Card Header Pill */}
            <rect x={-80} y={-40} width={160} height={22} rx={6} fill="#0d0f14" opacity={0.7} />
            <circle cx={-68} cy={-29} r={4} fill="#00d2ff" />
            <text x={-58} y={-29} dominantBaseline="middle" fill="#00d2ff" fontSize={11} fontWeight="800" fontFamily="Outfit, sans-serif">
              {part.cardCategory || part.textValue || 'STUDIO CARD'}
            </text>
            {/* Body Title */}
            <text x={-80} y={0} dominantBaseline="middle" fill="#f8fafc" fontSize={13} fontWeight="700" fontFamily="Outfit, sans-serif">
              {part.cardTitle || 'MOTION GRAPHIC'}
            </text>
            {/* Status Action Button */}
            <rect x={-80} y={15} width={75} height={22} rx={4} fill="#00d2ff" />
            <text x={-42.5} y={26} textAnchor="middle" dominantBaseline="middle" fill="#000" fontSize={11} fontWeight="800" fontFamily="Outfit, sans-serif">
              {part.cardButtonText || 'ACTIVE'}
            </text>
          </g>
        );
        break;
      case 'custom_image':
      case 'custom_video': {
        const isVideo = part.type === 'custom_video';
        const fullW = isVideo ? 200 : 180;
        const fullH = isVideo ? 120 : 120;
        const startX = -fullW / 2;
        const startY = -fullH / 2;

        const isCrop = part.cropEnabled ?? false;
        const cropX = part.cropX ?? 25;
        const cropY = part.cropY ?? 10;
        const cropW = part.cropWidth ?? 50;
        const cropH = part.cropHeight ?? 80;

        const cX = startX + (fullW * cropX) / 100;
        const cY = startY + (fullH * cropY) / 100;
        const realCW = (fullW * cropW) / 100;
        const realCH = (fullH * cropH) / 100;

        const clipId = `media-crop-${part.id}`;

        // Overlay Text Caption Y position
        let captionY = startY + fullH - 20;
        if (part.overlayTextPosition === 'top') captionY = startY + 20;
        if (part.overlayTextPosition === 'center') captionY = 0;

        pathContent = (
          <g>
            <defs>
              {isCrop && (
                <clipPath id={clipId}>
                  <rect x={cX} y={cY} width={realCW} height={realCH} rx={4} />
                </clipPath>
              )}
            </defs>

            {/* Background Media Element (Clipped if isCrop) */}
            <g clipPath={isCrop ? `url(#${clipId})` : undefined}>
              {isVideo ? (
                part.videoUrl ? (
                  <foreignObject x={startX} y={startY} width={fullW} height={fullH}>
                    <video
                      src={part.videoUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: 8,
                        pointerEvents: 'none',
                      }}
                    />
                  </foreignObject>
                ) : (
                  <rect x={startX} y={startY} width={fullW} height={fullH} rx={8} fill={fill} />
                )
              ) : part.imageUrl ? (
                <image
                  href={part.imageUrl}
                  x={startX}
                  y={startY}
                  width={fullW}
                  height={fullH}
                  preserveAspectRatio="xMidYMid meet"
                />
              ) : (
                <rect x={startX} y={startY} width={fullW} height={fullH} rx={8} fill={fill} />
              )}
            </g>

            {/* Dark Shaded Overlay & White Corner Crop Brackets for Un-cropped Area */}
            {isCrop && (
              <g style={{ pointerEvents: 'none' }}>
                <rect x={startX} y={startY} width={fullW} height={fullH} fill="rgba(0,0,0,0.55)" rx={8} />
                <g clipPath={`url(#${clipId})`}>
                  {isVideo ? (
                    part.videoUrl ? (
                      <foreignObject x={startX} y={startY} width={fullW} height={fullH}>
                        <video
                          src={part.videoUrl}
                          autoPlay
                          loop
                          muted
                          playsInline
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: 8,
                            pointerEvents: 'none',
                          }}
                        />
                      </foreignObject>
                    ) : (
                      <rect x={startX} y={startY} width={fullW} height={fullH} rx={8} fill={fill} />
                    )
                  ) : part.imageUrl ? (
                    <image
                      href={part.imageUrl}
                      x={startX}
                      y={startY}
                      width={fullW}
                      height={fullH}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  ) : (
                    <rect x={startX} y={startY} width={fullW} height={fullH} rx={8} fill={fill} />
                  )}
                </g>

                {/* White Corner Crop Bracket Handles [ ] matching user screenshot! */}
                <path
                  d={`
                    M ${cX},${cY + 16} L ${cX},${cY} L ${cX + 16},${cY}
                    M ${cX + realCW - 16},${cY} L ${cX + realCW},${cY} L ${cX + realCW},${cY + 16}
                    M ${cX},${cY + realCH - 16} L ${cX},${cY + realCH} L ${cX + 16},${cY + realCH}
                    M ${cX + realCW - 16},${cY + realCH} L ${cX + realCW},${cY + realCH} L ${cX + realCW},${cY + realCH - 16}
                  `}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={3.5}
                  strokeLinecap="square"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )}

            {/* Outer Border Stroke */}
            <rect
              x={startX}
              y={startY}
              width={fullW}
              height={fullH}
              rx={8}
              fill="none"
              stroke={stroke}
              strokeWidth={isSelected ? 2 : 1.5}
              vectorEffect="non-scaling-stroke"
            />

            {/* Overlay Text Caption Box */}
            {part.overlayText && (
              <g style={{ pointerEvents: 'none' }}>
                <rect
                  x={startX + 10}
                  y={captionY - 14}
                  width={fullW - 20}
                  height={28}
                  rx={6}
                  fill={part.overlayTextBg || 'rgba(15, 23, 42, 0.85)'}
                  stroke="rgba(255, 255, 255, 0.25)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={0}
                  y={captionY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={part.overlayTextColor || '#ffffff'}
                  fontSize={12}
                  fontWeight="800"
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {part.overlayText}
                </text>
              </g>
            )}
          </g>
        );
        break;
      }
      default:
        pathContent = (
          <rect
            x={-20}
            y={-20}
            width={40}
            height={40}
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
          />
        );
    }

    // Dynamic Drop Shadow / Glow Filter ID
    const filterId = !isGhost && part.shadowColor ? `drop-shadow-${part.id}` : undefined;

    return (
      <g
        key={`${part.id}${isGhost ? '-ghost-' + ghostColor : ''}`}
        transform={`translate(${transform.x}, ${transform.y}) rotate(${transform.rotation}) scale(${transform.scaleX}, ${transform.scaleY})`}
        style={{
          opacity,
          cursor: isGhost ? 'default' : 'pointer',
          filter: filterId ? `url(#${filterId})` : undefined,
        }}
        onClick={(e) => {
          if (!isGhost) {
            e.stopPropagation();
            setSelectedPartId(part.id);
          }
        }}
      >
        {/* Dynamic SVG Filter definition for Shadow/Glow */}
        {!isGhost && part.shadowColor && (
          <defs>
            <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow
                dx={part.shadowOffsetX || 0}
                dy={part.shadowOffsetY || 4}
                stdDeviation={part.shadowBlur || 8}
                floodColor={part.shadowColor || 'rgba(0,0,0,0.5)'}
                floodOpacity="0.85"
              />
            </filter>
          </defs>
        )}
        {pathContent}
      </g>
    );
  };

  // Convert client (screen) coordinates to SVG world coordinates
  const clientToSVG = useCallback(
    (clientX: number, clientY: number): { svgX: number; svgY: number } => {
      if (!containerRef.current) return { svgX: 0, svgY: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      // Screen position relative to container center
      const relX = clientX - rect.left - rect.width / 2;
      const relY = clientY - rect.top - rect.height / 2;
      // Undo CSS scale and pan to get SVG world coordinates
      const svgX = relX / zoomLevel - panOffset.x + rect.width / 2;
      const svgY = relY / zoomLevel - panOffset.y + rect.height / 2;
      return { svgX, svgY };
    },
    [zoomLevel, panOffset]
  );

  // Store initial angle and distance on drag start for rotation & scaling
  const [dragInitialAngle, setDragInitialAngle] = useState<number>(0);
  const [dragInitialDist, setDragInitialDist] = useState<number>(1);

  // Drag interaction handlers
  const handleMouseDown = (mode: 'translate' | 'rotate' | 'scale', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedTransform || !selectedPartId) return;

    setIsDragging(true);
    setDragMode(mode);

    if (mode === 'rotate') {
      // Calculate the initial angle from object center to mouse position
      const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);
      const initialAngle = Math.atan2(svgY - selectedTransform.y, svgX - selectedTransform.x) * (180 / Math.PI);
      setDragInitialAngle(initialAngle - selectedTransform.rotation);
    } else if (mode === 'scale') {
      const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);
      const dist = Math.max(10, Math.hypot(svgX - selectedTransform.x, svgY - selectedTransform.y));
      setDragInitialDist(dist);
    }

    setDragStart({
      x: e.clientX,
      y: e.clientY,
      initialTransform: { ...selectedTransform },
    });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragMode || !selectedTransform || !selectedPartId) return;

      const dx = (e.clientX - dragStart.x) / zoomLevel;
      const dy = (e.clientY - dragStart.y) / zoomLevel;

      if (dragMode === 'translate') {
        updateCurrentTransform({
          x: Math.round(dragStart.initialTransform.x + dx),
          y: Math.round(dragStart.initialTransform.y + dy),
        });
      } else if (dragMode === 'rotate') {
        // Convert mouse position to SVG world coordinates
        const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);
        const centerX = dragStart.initialTransform.x;
        const centerY = dragStart.initialTransform.y;

        // Calculate angle from object center to current mouse position
        const currentAngle = Math.atan2(svgY - centerY, svgX - centerX) * (180 / Math.PI);
        const newRotation = Math.round(currentAngle - dragInitialAngle);

        updateCurrentTransform({
          rotation: newRotation,
        });
      } else if (dragMode === 'scale') {
        const { svgX, svgY } = clientToSVG(e.clientX, e.clientY);
        const currentDist = Math.hypot(svgX - dragStart.initialTransform.x, svgY - dragStart.initialTransform.y);
        const ratio = currentDist / Math.max(1, dragInitialDist);
        const newScaleX = Math.max(0.05, Math.min(50, Number((dragStart.initialTransform.scaleX * ratio).toFixed(2))));
        const newScaleY = Math.max(0.05, Math.min(50, Number((dragStart.initialTransform.scaleY * ratio).toFixed(2))));
        updateCurrentTransform({
          scaleX: newScaleX,
          scaleY: newScaleY,
        });
      }
    },
    [isDragging, dragMode, dragStart, selectedTransform, selectedPartId, updateCurrentTransform, zoomLevel, clientToSVG, dragInitialAngle, dragInitialDist]
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

  // Canvas Panning State (Right-click or Middle-click drag)
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; initialPan: { x: number; y: number } }>({
    x: 0,
    y: 0,
    initialPan: { x: 0, y: 0 },
  });

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Right Click (button 2) or Middle Click (button 1) or Pan tool initiates map panning
    if (e.button === 2 || e.button === 1 || activeTool === 'pan') {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({
        x: e.clientX,
        y: e.clientY,
        initialPan: { ...panOffset },
      });
    }
  };

  const handlePanMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isPanning) return;
      const dx = (e.clientX - panStart.x) / zoomLevel;
      const dy = (e.clientY - panStart.y) / zoomLevel;
      setPanOffset({
        x: Math.round(panStart.initialPan.x + dx),
        y: Math.round(panStart.initialPan.y + dy),
      });
    },
    [isPanning, panStart, zoomLevel]
  );

  const handlePanMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
    }
  }, [isPanning]);

  useEffect(() => {
    if (isPanning) {
      window.addEventListener('mousemove', handlePanMouseMove);
      window.addEventListener('mouseup', handlePanMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handlePanMouseMove);
      window.removeEventListener('mouseup', handlePanMouseUp);
    };
  }, [isPanning, handlePanMouseMove, handlePanMouseUp]);

  // Direct Mouse Scroll Wheel Zooming (Wheel Up = Zoom In, Wheel Down = Zoom Out)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Direct mouse wheel scroll zooms the map directly
      const zoomDelta = e.deltaY < 0 ? 0.12 : -0.12;
      setZoomLevel((prev) => Math.max(0.2, Math.min(4.0, Number((prev + zoomDelta).toFixed(2)))));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const sortedParts = [...characterParts].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      ref={containerRef}
      className={`stage-canvas ${showGrid ? 'bg-grid' : ''}`}
      style={{ cursor: isPanning ? 'grabbing' : activeTool === 'pan' ? 'grab' : 'default' }}
      onMouseDown={handleCanvasMouseDown}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (!isPanning) setSelectedPartId(null);
      }}
    >
      {/* Top Bar Overlay Info */}
      <div className="canvas-header-info">
        <span className="stage-title">2D ANIMATION VIEWPORT</span>
        <span className="info-tool">MOD: {isPanning ? 'PAN NAV' : activeTool.toUpperCase()}</span>
      </div>

      {/* Top Right Viewport Tools Overlay */}
      <div className="viewport-tools-overlay">
        <button
          className={`btn-icon viewport-btn ${showGrid ? 'active' : ''}`}
          onClick={() => setShowGrid(!showGrid)}
          title="Toggle Grid (Show/Hide)"
        >
          <Grid size={15} />
        </button>

        <button
          className={`btn-icon viewport-btn ${showBones ? 'active' : ''}`}
          onClick={() => setShowBones(!showBones)}
          title="Toggle Bone Hierarchy (Show/Hide)"
        >
          <Bone size={15} />
        </button>

        <button
          className={`btn-icon viewport-btn ${showOnionSkin ? 'active' : ''}`}
          onClick={() => setShowOnionSkin(!showOnionSkin)}
          title="Toggle Onion Skinning (Ghost Frames)"
        >
          <Layers size={15} />
        </button>

        <div className="divider-v-sm" />

        <button
          className="btn-icon viewport-btn"
          onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.15))}
          title="Zoom In"
        >
          <ZoomIn size={15} />
        </button>

        <span className="zoom-badge">{Math.round(zoomLevel * 100)}%</span>

        <button
          className="btn-icon viewport-btn"
          onClick={() => setZoomLevel((z) => Math.max(0.4, z - 0.15))}
          title="Zoom Out"
        >
          <ZoomOut size={15} />
        </button>

        <button
          className="btn-icon viewport-btn"
          onClick={() => {
            setZoomLevel(1);
            setPanOffset({ x: 0, y: 0 });
          }}
          title="Reset View"
        >
          <Compass size={15} />
        </button>
      </div>

      <svg
        className="stage-svg"
        width="100%"
        height="100%"
        style={{ transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`, transformOrigin: 'center center' }}
      >
        <defs>
          <pattern id="svg-dashed-grid" width="40" height="40" patternUnits="userSpaceOnUse" x="300" y="240">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(56, 189, 248, 0.22)" strokeWidth="1" strokeDasharray="3 3" />
          </pattern>
        </defs>

        {/* Dashed Grid Lines (Infinite Canvas Grid in All Directions) */}
        {showGrid && (
          <rect x="-300000" y="-300000" width="600000" height="600000" fill="url(#svg-dashed-grid)" />
        )}

        {/* Origin Center Grid Axes (Infinite Red X-Axis & Green Y-Axis) */}
        <line x1="-300000" y1="240" x2="300000" y2="240" stroke="rgba(239, 68, 68, 0.75)" strokeWidth="1.5" strokeDasharray="6 4" />
        <line x1="300" y1="-300000" x2="300" y2="300000" stroke="rgba(16, 185, 129, 0.75)" strokeWidth="1.5" strokeDasharray="6 4" />
        <circle cx={300} cy={240} r={5} fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
        <text x={310} y={235} fill="rgba(255, 255, 255, 0.7)" fontSize="11" fontWeight="700" fontFamily="JetBrains Mono, monospace">
          (0,0) ORIGIN
        </text>

        {/* ONION SKINNING: Ghost Frame Before (Cyan) & After (Magenta) */}
        {showOnionSkin && currentFrame > 0 && (
          sortedParts.map((part) => {
            const prevTransform = getComputedTransform(part.id, currentFrame - 1);
            return renderPartPath(part, prevTransform, true, '#00d2ff');
          })
        )}
        {showOnionSkin && (
          sortedParts.map((part) => {
            const nextTransform = getComputedTransform(part.id, currentFrame + 1);
            return renderPartPath(part, nextTransform, true, '#ff3366');
          })
        )}

        {/* Character Parts Active Render */}
        {sortedParts.map((part) => {
          const transform = getComputedTransform(part.id, currentFrame);
          return renderPartPath(part, transform);
        })}

        {/* Skeletal Bone Hierarchy Links */}
        {showBones &&
          characterParts.map((part) => {
            if (!part.parentId) return null;
            const parentPart = characterParts.find((p) => p.id === part.parentId);
            if (!parentPart) return null;

            const pT = getComputedTransform(parentPart.id, currentFrame);
            const cT = getComputedTransform(part.id, currentFrame);

            const isSelectedLink = selectedPartId === part.id || selectedPartId === parentPart.id;

            return (
              <g key={`bone-${part.id}`}>
                <line
                  x1={pT.x}
                  y1={pT.y}
                  x2={cT.x}
                  y2={cT.y}
                  stroke={isSelectedLink ? '#ffb700' : 'rgba(0, 210, 255, 0.4)'}
                  strokeWidth={isSelectedLink ? 2.5 : 1.5}
                  strokeDasharray={isSelectedLink ? 'none' : '4 3'}
                />
                <circle cx={pT.x} cy={pT.y} r={3} fill="#00d2ff" />
                <circle cx={cT.x} cy={cT.y} r={3} fill="#ffb700" />
              </g>
            );
          })}

        {/* Interactive Transform Gizmo on Selected Part */}
        {selectedPart && selectedTransform && (
          <g transform={`translate(${selectedTransform.x}, ${selectedTransform.y})`}>
            {/* Center Pivot Axis */}
            <circle cx={0} cy={0} r={5} fill="#00d2ff" stroke="#fff" strokeWidth={1.5} className="gizmo-center" />

            {/* Drag Angle Floating Tooltip */}
            {isDragging && dragMode === 'rotate' && (
              <g transform="translate(0, -75)">
                <rect x={-35} y={-14} width={70} height={24} rx={4} fill="rgba(0, 210, 255, 0.95)" />
                <text x={0} y={2} textAnchor="middle" fill="#000" fontSize={11} fontWeight={700} fontFamily="monospace">
                  {selectedTransform.rotation}°
                </text>
              </g>
            )}

            {/* Unified 360° Dashed Rotation Circle Ring */}
            <g>
              <circle
                cx={0}
                cy={0}
                r={70}
                fill="none"
                stroke="var(--accent-teal)"
                strokeWidth={2}
                strokeDasharray="5 4"
                className="gizmo-ring-360"
                style={{ cursor: 'grab' }}
                onMouseDown={(e) => handleMouseDown('rotate', e)}
              />
              {/* 360° Gold Handle Knob */}
              <circle
                cx={70 * Math.cos((selectedTransform.rotation * Math.PI) / 180)}
                cy={70 * Math.sin((selectedTransform.rotation * Math.PI) / 180)}
                r={8}
                fill="#fbbf24"
                stroke="#12141a"
                strokeWidth={2}
                className="gizmo-handle-gold"
                style={{ cursor: 'grab' }}
                onMouseDown={(e) => handleMouseDown('rotate', e)}
              />
            </g>

            {/* Translation Arrows (Red X / Green Y) */}
            <g>
              <line x1={0} y1={0} x2={55} y2={0} stroke="#f43f5e" strokeWidth={3.5} strokeLinecap="round" />
              <polygon points="55,-6 67,0 55,6" fill="#f43f5e" />

              <line x1={0} y1={0} x2={0} y2={55} stroke="#10b981" strokeWidth={3.5} strokeLinecap="round" />
              <polygon points="-6,55 0,67 6,55" fill="#10b981" />

              {/* Center Move Square Handle */}
              <rect
                x={-9}
                y={-9}
                width={18}
                height={18}
                fill="var(--accent-teal)"
                stroke="#ffffff"
                strokeWidth={1.5}
                rx={4}
                className="gizmo-handle-center"
                style={{ cursor: 'move' }}
                onMouseDown={(e) => handleMouseDown('translate', e)}
              />
            </g>

            {/* Proportional Scale Corner Handles */}
            <g>
              <line x1={0} y1={0} x2={48} y2={48} stroke="#a855f7" strokeWidth={1.5} strokeDasharray="3 3" />
              <rect
                x={42}
                y={42}
                width={14}
                height={14}
                fill="#a855f7"
                stroke="#ffffff"
                strokeWidth={1.5}
                rx={3}
                className="gizmo-handle-scale"
                style={{ cursor: 'nwse-resize' }}
                onMouseDown={(e) => handleMouseDown('scale', e)}
              />
            </g>
          </g>
        )}
      </svg>

      {/* Keyframes Studio Viewport Bottom Bar */}
      <div className="canvas-footer-legend">
        <div className="footer-left">
          <span className="aspect-badge">16:9 Pro Canvas</span>
          <span className="divider-dot">•</span>
          <span>Selected: <strong style={{ color: 'var(--accent-teal)' }}>{selectedPart ? selectedPart.name : 'None'}</strong></span>
        </div>

        <div className="footer-right">
          <button className="footer-btn" onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}>
            Fit Canvas
          </button>
          <span className="zoom-level-text">{Math.round(zoomLevel * 100)}%</span>
        </div>
      </div>
    </div>
  );
};

