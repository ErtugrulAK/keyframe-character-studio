import React, { useRef } from 'react';
import { Grid, ZoomIn, ZoomOut, Compass, MousePointer2, Hand } from 'lucide-react';

interface CanvasViewportToolbarProps {
  showGrid: boolean;
  setShowGrid: (val: boolean) => void;
  zoomLevel: number;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
  setPanOffset: (val: { x: number; y: number }) => void;
  activeTool: 'select' | 'pan';
  setActiveTool: (tool: 'select' | 'pan') => void;
}
const VIEWPORT_TOOL_OPTIONS: Array<'select' | 'pan'> = ['select', 'pan'];
const VIEWPORT_TOOL_STEP = 29;

export const CanvasViewportToolbar: React.FC<CanvasViewportToolbarProps> = ({
  showGrid,
  setShowGrid,
  zoomLevel,
  setZoomLevel,
  setPanOffset,
  activeTool,
  setActiveTool,
}) => {
  const toolButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const highlightRef = useRef<HTMLSpanElement | null>(null);
  const highlightAnimationRef = useRef<Animation | null>(null);
  const previousToolRef = useRef(activeTool);
  React.useEffect(() => {
    const previousIndex = VIEWPORT_TOOL_OPTIONS.indexOf(previousToolRef.current);
    const nextIndex = VIEWPORT_TOOL_OPTIONS.indexOf(activeTool);
    if (previousIndex === nextIndex || !highlightRef.current) return;
    const targetTransform = `translateX(${nextIndex * VIEWPORT_TOOL_STEP}px) scaleX(1)`;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      highlightRef.current.style.transform = targetTransform;
      highlightRef.current.style.width = '28px';
      previousToolRef.current = activeTool;
      return;
    }
    const direction = nextIndex > previousIndex ? 1 : -1;
    highlightAnimationRef.current?.cancel();
    highlightAnimationRef.current = highlightRef.current.animate(
      {
        transform: [
          `translateX(${previousIndex * VIEWPORT_TOOL_STEP}px) scaleX(1)`,
          `translateX(${previousIndex * VIEWPORT_TOOL_STEP + direction * 4}px) scaleX(1.24)`,
          `translateX(${nextIndex * VIEWPORT_TOOL_STEP - direction * 2}px) scaleX(.96)`,
          `translateX(${nextIndex * VIEWPORT_TOOL_STEP}px) scaleX(1)`,
        ],
        width: ['28px', '42px', '34px', '28px'],
      },
      { duration: 300, easing: 'cubic-bezier(0.65,0,0.35,1)', fill: 'forwards' },
    );
    previousToolRef.current = activeTool;
    return () => {
      highlightAnimationRef.current?.cancel();
      highlightAnimationRef.current = null;
    };
  }, [activeTool]);
  const handleToolKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = VIEWPORT_TOOL_OPTIONS.indexOf(activeTool);
    const nextIndex = event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? (currentIndex + 1) % VIEWPORT_TOOL_OPTIONS.length
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? (currentIndex - 1 + VIEWPORT_TOOL_OPTIONS.length) % VIEWPORT_TOOL_OPTIONS.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? VIEWPORT_TOOL_OPTIONS.length - 1
            : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextTool = VIEWPORT_TOOL_OPTIONS[nextIndex];
    setActiveTool(nextTool);
    toolButtonRefs.current[nextIndex]?.focus();
  };
  return (
    <div className={`viewport-tools-overlay viewport-tools-${activeTool}`}>
      <span ref={highlightRef} className="viewport-tools-highlight" aria-hidden="true" />
      <button
        ref={(element) => { toolButtonRefs.current[0] = element; }}
        className={`btn-icon viewport-btn viewport-tool-choice${activeTool === 'select' ? ' active' : ''}`}
        onClick={() => setActiveTool('select')}
        onKeyDown={handleToolKeyDown}
        title="Select Tool (V)"
        aria-label="Select Tool"
        aria-pressed={activeTool === 'select'}
        tabIndex={activeTool === 'select' ? 0 : -1}
      >
        <MousePointer2 size={14} />
      </button>
      <button
        ref={(element) => { toolButtonRefs.current[1] = element; }}
        className={`btn-icon viewport-btn viewport-tool-choice${activeTool === 'pan' ? ' active' : ''}`}
        onClick={() => setActiveTool('pan')}
        onKeyDown={handleToolKeyDown}
        title="Hand / Pan Tool (H)"
        aria-label="Hand / Pan Tool"
        aria-pressed={activeTool === 'pan'}
        tabIndex={activeTool === 'pan' ? 0 : -1}
      >
        <Hand size={14} />
      </button>
      <button
        className={`btn-icon viewport-btn ${showGrid ? 'active' : ''}`}
        aria-pressed={showGrid}
        onClick={() => setShowGrid(!showGrid)}
        title={showGrid ? 'Grid Overlay: ON (Click to Hide)' : 'Grid Overlay: OFF (Click to Show)'}
      >
        <Grid size={14} />
      </button>

      <div style={{ height: 16, width: 1, background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />

      <button
        className="btn-icon viewport-btn"
        onClick={() => setZoomLevel((z) => Math.max(0.3, parseFloat((z - 0.1).toFixed(2))))}
        title="Zoom Out (-)"
      >
        <ZoomOut size={14} />
      </button>

      <span className="zoom-level-text">
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
        onClick={() => setPanOffset({ x: 0, y: 0 })}
        title="Reset View Position (Keep Zoom)"
        aria-label="Reset View Position"
      >
        <Compass size={14} />
      </button>
    </div>
  );
};
