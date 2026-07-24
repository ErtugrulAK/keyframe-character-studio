import React from 'react';
import { Grid, Bone, Layers, ZoomIn, ZoomOut, Compass } from 'lucide-react';

interface CanvasViewportToolbarProps {
  showGrid: boolean;
  setShowGrid: (val: boolean) => void;
  showBones: boolean;
  setShowBones: React.Dispatch<React.SetStateAction<boolean>>;
  showOnionSkin: boolean;
  setShowOnionSkin: React.Dispatch<React.SetStateAction<boolean>>;
  zoomLevel: number;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
  setPanOffset: (val: { x: number; y: number }) => void;
}

export const CanvasViewportToolbar: React.FC<CanvasViewportToolbarProps> = ({
  showGrid,
  setShowGrid,
  showBones,
  setShowBones,
  showOnionSkin,
  setShowOnionSkin,
  zoomLevel,
  setZoomLevel,
  setPanOffset,
}) => {
  return (
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
        onClick={() => {
          setZoomLevel(1);
          setPanOffset({ x: 0, y: 0 });
        }}
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
        onClick={() => {
          setZoomLevel(1);
          setPanOffset({ x: 0, y: 0 });
        }}
        title="Reset Viewport Pan & Zoom (Center Stage)"
      >
        <Compass size={14} />
      </button>
    </div>
  );
};
