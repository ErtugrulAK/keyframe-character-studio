import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import type { CharacterPart, Transform } from '../../types/animator';
import { Grid, ZoomIn, ZoomOut, Compass } from 'lucide-react';
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
  const renderPartPath = (part: CharacterPart, transform: Transform) => {
    const isSelected = selectedPartId === part.id;

    let pathContent: React.ReactNode = null;

    switch (part.type) {
      case 'hair':
        pathContent = (
          <path
            d="M -35 -20 Q -45 -60 0 -65 Q 45 -60 35 -20 Q 40 10 25 25 Q 0 35 -25 25 Q -40 10 -35 -20 Z"
            fill={part.fillColor}
            stroke={isSelected ? '#00d2ff' : part.strokeColor}
            strokeWidth={isSelected ? 3 : 2}
          />
        );
        break;
      case 'head':
        pathContent = (
          <g>
            {/* Head Oval */}
            <ellipse
              cx={0}
              cy={0}
              rx={30}
              ry={35}
              fill={part.fillColor}
              stroke={isSelected ? '#00d2ff' : part.strokeColor}
              strokeWidth={isSelected ? 3 : 2}
            />
            {/* Eyes */}
            <circle cx={-10} cy={-5} r={4} fill="#222" />
            <circle cx={10} cy={-5} r={4} fill="#222" />
            <circle cx={-8} cy={-7} r={1.5} fill="#fff" />
            <circle cx={12} cy={-7} r={1.5} fill="#fff" />
            {/* Smile */}
            <path d="M -8 12 Q 0 20 8 12" fill="none" stroke="#aa5533" strokeWidth={2.5} strokeLinecap="round" />
          </g>
        );
        break;
      case 'torso':
        pathContent = (
          <path
            d="M -30 -45 L 30 -45 L 22 45 L -22 45 Z"
            fill={part.fillColor}
            stroke={isSelected ? '#00d2ff' : part.strokeColor}
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
            fill={part.fillColor}
            stroke={isSelected ? '#00d2ff' : part.strokeColor}
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
              fill={part.fillColor}
              stroke={isSelected ? '#00d2ff' : part.strokeColor}
              strokeWidth={isSelected ? 3 : 2}
            />
            <circle cx={0} cy={55} r={10} fill="#ffdbac" stroke="#d6a374" strokeWidth={2} />
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
            fill={part.fillColor}
            stroke={isSelected ? '#00d2ff' : part.strokeColor}
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
              fill={part.fillColor}
              stroke={isSelected ? '#00d2ff' : part.strokeColor}
              strokeWidth={isSelected ? 3 : 2}
            />
            {/* Shoe */}
            <path d="M -14 55 L 18 55 Q 22 55 22 65 L -14 65 Z" fill="#111" />
          </g>
        );
        break;
      default:
        pathContent = (
          <rect
            x={-20}
            y={-20}
            width={40}
            height={40}
            fill={part.fillColor}
            stroke={isSelected ? '#00d2ff' : part.strokeColor}
            strokeWidth={isSelected ? 3 : 2}
          />
        );
    }

    return (
      <g
        key={part.id}
        transform={`translate(${transform.x}, ${transform.y}) rotate(${transform.rotation}) scale(${transform.scaleX}, ${transform.scaleY})`}
        style={{ opacity: transform.opacity, cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedPartId(part.id);
        }}
      >
        {pathContent}
      </g>
    );
  };

  // Drag interaction handlers
  const handleMouseDown = (mode: 'translate' | 'rotate' | 'scale', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedTransform || !selectedPartId) return;

    setIsDragging(true);
    setDragMode(mode);
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
        const centerX = dragStart.initialTransform.x;
        const centerY = dragStart.initialTransform.y;

        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - panOffset.x) / zoomLevel;
        const mouseY = (e.clientY - rect.top - panOffset.y) / zoomLevel;

        const angleRad = Math.atan2(mouseY - centerY, mouseX - centerX);
        const angleDeg = Math.round((angleRad * 180) / Math.PI);

        updateCurrentTransform({
          rotation: angleDeg,
        });
      } else if (dragMode === 'scale') {
        const scaleDelta = (dx + dy) * 0.005;
        const newScaleX = Math.max(0.2, Math.min(3, dragStart.initialTransform.scaleX + scaleDelta));
        const newScaleY = Math.max(0.2, Math.min(3, dragStart.initialTransform.scaleY + scaleDelta));
        updateCurrentTransform({
          scaleX: Number(newScaleX.toFixed(2)),
          scaleY: Number(newScaleY.toFixed(2)),
        });
      }
    },
    [isDragging, dragMode, dragStart, selectedTransform, selectedPartId, updateCurrentTransform, zoomLevel, panOffset]
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

  const sortedParts = [...characterParts].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      ref={containerRef}
      className={`stage-canvas ${showGrid ? 'bg-grid' : ''}`}
      onClick={() => setSelectedPartId(null)}
    >
      {/* Top Bar Overlay Info */}
      <div className="canvas-header-info">
        <span className="stage-title">2D CHARACTER VIEWPORT</span>
        <span className="info-tool">TOOL: {activeTool.toUpperCase()}</span>
      </div>

      {/* Top Right Viewport Tools Overlay */}
      <div className="viewport-tools-overlay">
        <button
          className={`btn-icon viewport-btn ${showGrid ? 'active' : ''}`}
          onClick={() => setShowGrid(!showGrid)}
          title="Izgarayı Göster/Gizle"
        >
          <Grid size={15} />
        </button>

        <button
          className="btn-icon viewport-btn"
          onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.15))}
          title="Yakınlaş"
        >
          <ZoomIn size={15} />
        </button>

        <span className="zoom-badge">{Math.round(zoomLevel * 100)}%</span>

        <button
          className="btn-icon viewport-btn"
          onClick={() => setZoomLevel((z) => Math.max(0.4, z - 0.15))}
          title="Uzaklaş"
        >
          <ZoomOut size={15} />
        </button>

        <button
          className="btn-icon viewport-btn"
          onClick={() => {
            setZoomLevel(1);
            setPanOffset({ x: 0, y: 0 });
          }}
          title="Görünümü Sıfırla"
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
        {/* Origin Axes */}
        <line x1="300" y1="0" x2="300" y2="100%" stroke="rgba(0, 210, 255, 0.2)" strokeDasharray="4 4" />
        <line x1="0" y1="240" x2="100%" y2="240" stroke="rgba(0, 210, 255, 0.2)" strokeDasharray="4 4" />

        {/* Character Parts */}
        {sortedParts.map((part) => {
          const transform = getComputedTransform(part.id, currentFrame);
          return renderPartPath(part, transform);
        })}

        {/* Interactive Transform Gizmo on Selected Part */}
        {selectedPart && selectedTransform && (
          <g transform={`translate(${selectedTransform.x}, ${selectedTransform.y})`}>
            {/* Center Pivot Axis */}
            <circle cx={0} cy={0} r={4} fill="#00d2ff" className="gizmo-center" />

            {/* Drag Angle Floating Tooltip */}
            {isDragging && dragMode === 'rotate' && (
              <g transform="translate(0, -75)">
                <rect x={-35} y={-14} width={70} height={24} rx={4} fill="rgba(0, 210, 255, 0.9)" />
                <text x={0} y={2} textAnchor="middle" fill="#000" fontSize={11} fontWeight={700} fontFamily="monospace">
                  {selectedTransform.rotation}°
                </text>
              </g>
            )}

            {/* Rotation Ring */}
            {(activeTool === 'rotate' || activeTool === 'select') && (
              <g>
                <circle
                  cx={0}
                  cy={0}
                  r={60}
                  fill="none"
                  stroke="#00d2ff"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  className="gizmo-ring"
                />
                <circle
                  cx={60 * Math.cos((selectedTransform.rotation * Math.PI) / 180)}
                  cy={60 * Math.sin((selectedTransform.rotation * Math.PI) / 180)}
                  r={7}
                  fill="#ffb700"
                  stroke="#000"
                  strokeWidth={2}
                  className="gizmo-handle"
                  onMouseDown={(e) => handleMouseDown('rotate', e)}
                />
              </g>
            )}

            {/* Translation Arrows */}
            {(activeTool === 'move' || activeTool === 'select') && (
              <g>
                <line x1={0} y1={0} x2={50} y2={0} stroke="#ff3366" strokeWidth={3} />
                <polygon points="50,-5 60,0 50,5" fill="#ff3366" />

                <line x1={0} y1={0} x2={0} y2={50} stroke="#10b981" strokeWidth={3} />
                <polygon points="-5,50 0,60 5,50" fill="#10b981" />

                <rect
                  x={-8}
                  y={-8}
                  width={16}
                  height={16}
                  fill="#00d2ff"
                  opacity={0.85}
                  rx={3}
                  className="gizmo-handle"
                  onMouseDown={(e) => handleMouseDown('translate', e)}
                />
              </g>
            )}

            {/* Scale Gizmo Handles */}
            {activeTool === 'scale' && (
              <g>
                <rect
                  x={40}
                  y={40}
                  width={14}
                  height={14}
                  fill="#a855f7"
                  stroke="#fff"
                  strokeWidth={1.5}
                  className="gizmo-handle"
                  onMouseDown={(e) => handleMouseDown('scale', e)}
                />
                <line x1={0} y1={0} x2={40} y2={40} stroke="#a855f7" strokeWidth={2} strokeDasharray="3 3" />
              </g>
            )}
          </g>
        )}
      </svg>

      {/* Bottom Footer Legend */}
      <div className="canvas-footer-legend">
        <span>Fare: Tutamakları Sürükleyin</span>
        <span>|</span>
        <span>Seçili: <strong>{selectedPart ? selectedPart.name : 'Yok'}</strong></span>
      </div>
    </div>
  );
};
