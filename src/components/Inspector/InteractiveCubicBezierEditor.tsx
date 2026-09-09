import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Copy, Check, X, Play, Pause, Sparkles } from 'lucide-react';
import type { PropertyKeyframe, TemporalHandle } from '../../types/animator';
import { TemporalGraphPanel } from './TemporalGraphPanel';
import { solveCubicBezier } from '../../utils/defaults';
interface InteractiveCubicBezierEditorProps {
  controlPoints?: [number, number, number, number]; // [x1, y1, x2, y2]
  onChange: (points: [number, number, number, number]) => void;
  initialModalOpen?: boolean;
  onCloseModal?: () => void;
  valueKeyframes?: PropertyKeyframe[];
  onChangeKeyframeValue?: (keyframeId: string, value: number) => void;
  onChangeKeyframeHandles?: (
    keyframeId: string,
    patch: { bezierIn?: TemporalHandle; bezierOut?: TemporalHandle },
  ) => void;
}

const PRESET_BEZIERS: { label: string; points: [number, number, number, number] }[] = [
  { label: 'Linear', points: [0.25, 0.25, 0.75, 0.75] },
  { label: 'Ease In', points: [0.42, 0.0, 1.0, 1.0] },
  { label: 'Ease Out', points: [0.0, 0.0, 0.58, 1.0] },
  { label: 'Ease In Out', points: [0.42, 0.0, 0.58, 1.0] },
  { label: 'Overshoot', points: [0.175, 0.885, 0.32, 1.275] },
  { label: 'Anticipate', points: [0.6, -0.28, 0.735, 0.045] },
  { label: 'Slow Mo', points: [0.1, 1.0, 0.1, 1.0] },
  { label: 'Elastic', points: [0.68, -0.55, 0.265, 1.55] },
];
const clampControlPoint = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const InteractiveCubicBezierEditor: React.FC<InteractiveCubicBezierEditorProps> = ({
  controlPoints = [0.42, 0.0, 0.58, 1.0],
  onChange,
  initialModalOpen = true,
  onCloseModal,
  valueKeyframes = [],
  onChangeKeyframeValue,
  onChangeKeyframeHandles,
}) => {
  const [copied, setCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(initialModalOpen);
  const [draggingPoint, setDraggingPoint] = useState<1 | 2 | null>(null);
  const [graphMode, setGraphMode] = useState<'value' | 'speed'>('value');

  // Pro Studio Modal State
  const [previewDuration, setPreviewDuration] = useState<number>(1.2);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);

  const modalSvgRef = useRef<SVGSVGElement>(null);
  const previewBallRef = useRef<HTMLDivElement>(null);
  const modalCardRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseModalRef = useRef(onCloseModal);
  const draggingPointerIdRef = useRef<number | null>(null);
  const draggingPointRef = useRef<1 | 2 | null>(null);
  const suppressBackdropClickRef = useRef(false);

  const [p1, setP1] = useState<{ x: number; y: number }>({ x: controlPoints[0], y: controlPoints[1] });
  const [p2, setP2] = useState<{ x: number; y: number }>({ x: controlPoints[2], y: controlPoints[3] });

  useEffect(() => {
    setP1({ x: controlPoints[0], y: controlPoints[1] });
    setP2({ x: controlPoints[2], y: controlPoints[3] });
  }, [controlPoints]);
  useEffect(() => {
    onCloseModalRef.current = onCloseModal;
  }, [onCloseModal]);
  useEffect(() => {
    if (!isModalOpen) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const getFocusableElements = () => Array.from(
      modalCardRef.current?.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [],
    );
    const focusInitial = () => getFocusableElements()[0]?.focus();
    const handleModalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsModalOpen(false);
        onCloseModalRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const frame = window.requestAnimationFrame(focusInitial);
    window.addEventListener('keydown', handleModalKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleModalKeyDown);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [isModalOpen]);

  useEffect(() => {
    const ball = previewBallRef.current;
    if (!ball || typeof ball.animate !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cancelAnimations = () => ball.getAnimations().forEach((animation) => animation.cancel());
    const handleMotionPreferenceChange = () => {
      if (mediaQuery.matches) cancelAnimations();
    };
    mediaQuery.addEventListener?.('change', handleMotionPreferenceChange);
    cancelAnimations();
    if (mediaQuery.matches || !isPreviewPlaying) {
      return () => mediaQuery.removeEventListener?.('change', handleMotionPreferenceChange);
    }
    const keyframes = Array.from({ length: 25 }, (_, index) => {
      const progress = index / 24;
      const eased = solveCubicBezier(p1.x, p1.y, p2.x, p2.y, progress);
      const bounded = Math.max(0, Math.min(1, eased));
      return {
        left: `clamp(14px, ${bounded * 100}%, calc(100% - 40px))`,
      };
    });
    const animation = ball.animate(keyframes, {
      duration: previewDuration * 1000,
      easing: 'linear',
      iterations: Infinity,
      direction: 'alternate',
    });
    return () => {
      animation.cancel();
      mediaQuery.removeEventListener?.('change', handleMotionPreferenceChange);
    };
  }, [isPreviewPlaying, p1, p2, previewDuration]);

  const cssString = `cubic-bezier(${p1.x}, ${p1.y}, ${p2.x}, ${p2.y})`;

  const updatePoints = React.useCallback((newP1: { x: number; y: number }, newP2: { x: number; y: number }) => {
    setP1(newP1);
    setP2(newP2);
    onChange([newP1.x, newP1.y, newP2.x, newP2.y]);
  }, [onChange]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(cssString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getMotionAnalysis = () => {
    const tags: string[] = [];
    if (p1.y < 0 || p2.y < 0) tags.push('Anticipation pullback');
    if (p1.y > 1 || p2.y > 1) tags.push('Elastic overshoot');
    if (p1.x < 0.2 && p2.x < 0.2) tags.push('Instant velocity burst');
    if (p1.x > 0.8 && p2.x > 0.8) tags.push('Delayed impulse');
    if (tags.length === 0) tags.push('Smooth easing flow');
    return tags.join(' · ');
  };

  // Pointer capture keeps curve-handle drags alive when the pointer leaves the graph or modal.
  const updateDraggedPoint = (clientX: number, clientY: number) => {
    const point = draggingPointRef.current;
    const svg = modalSvgRef.current;
    if (!point || !svg) return;
    const rect = svg.getBoundingClientRect();
    const paddingX = 50;
    const paddingY = 40;
    const innerWidth = rect.width - paddingX * 2;
    const innerHeight = rect.height - paddingY * 2;
    const mouseX = clientX - rect.left - paddingX;
    const mouseY = clientY - rect.top - paddingY;
    const xClamped = Math.max(0, Math.min(1, parseFloat((mouseX / innerWidth).toFixed(2))));
    const yNormalized = Math.max(0, Math.min(1, 1 - mouseY / innerHeight));
    const yMath = parseFloat((-1.0 + yNormalized * 3.0).toFixed(2));
    if (point === 1) {
      updatePoints({ x: xClamped, y: yMath }, p2);
    } else {
      updatePoints(p1, { x: xClamped, y: yMath });
    }
  };

  const finishPointerDrag = () => {
    if (!draggingPointRef.current) return;
    draggingPointRef.current = null;
    draggingPointerIdRef.current = null;
    setDraggingPoint(null);
    suppressBackdropClickRef.current = true;
    window.setTimeout(() => {
      suppressBackdropClickRef.current = false;
    }, 0);
  };

  // Helper for rendering SVG Graph with exact max/min limit red boundary lines [-1.0, 2.0]
  const renderSvgGraph = (
    ref: React.RefObject<SVGSVGElement | null>,
    svgWidth: number,
    svgHeight: number,
    paddingX: number,
    paddingY: number
  ) => {
    const innerWidth = svgWidth - paddingX * 2;
    const innerHeight = svgHeight - paddingY * 2;

    // Y Range mapped strictly to [-1.0, 2.0] (Total range = 3.0)
    // Red dashed lines mark the absolute top (Y = +2.0) and bottom (Y = -1.0) limits!
    const mathToSvg = (mx: number, my: number) => {
      const sx = paddingX + mx * innerWidth;
      const yNormalized = (my - (-1.0)) / 3.0;
      const sy = paddingY + innerHeight - yNormalized * innerHeight;
      return { sx, sy };
    };

    const startP = mathToSvg(0, 0);
    const endP = mathToSvg(1, 1);
    const handle1P = mathToSvg(p1.x, p1.y);
    const handle2P = mathToSvg(p2.x, p2.y);

    const zeroBoxP = mathToSvg(0, 0);
    const oneBoxP = mathToSvg(1, 1);
    const topLimitP = mathToSvg(0, 2.0);
    const botLimitP = mathToSvg(0, -1.0);

    const bezierPathD = `M ${startP.sx},${startP.sy} C ${handle1P.sx},${handle1P.sy} ${handle2P.sx},${handle2P.sy} ${endP.sx},${endP.sy}`;

    const handlePointerDown = (pointNum: 1 | 2, event: React.PointerEvent<SVGGElement>) => {
      event.stopPropagation();
      event.preventDefault();
      draggingPointRef.current = pointNum;
      draggingPointerIdRef.current = event.pointerId;
      setDraggingPoint(pointNum);
      event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
      if (draggingPointerIdRef.current !== event.pointerId) return;
      updateDraggedPoint(event.clientX, event.clientY);
    };

    const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
      if (draggingPointerIdRef.current === event.pointerId) finishPointerDrag();
    };

    const handleLostPointerCapture = (event: React.PointerEvent<SVGSVGElement>) => {
      if (draggingPointerIdRef.current === event.pointerId) finishPointerDrag();
    };

    return (
      <svg
        ref={ref}
        width={svgWidth}
        height={svgHeight}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onLostPointerCapture={handleLostPointerCapture}
        style={{ overflow: 'visible', cursor: draggingPoint ? 'grabbing' : 'default', touchAction: 'none' }}
      >
        {/* Unit Box (0 to 1) Solid Outline */}
        <rect
          x={zeroBoxP.sx}
          y={oneBoxP.sy}
          width={innerWidth}
          height={zeroBoxP.sy - oneBoxP.sy}
          fill="none"
          stroke="#2a3245"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        {/* Upper Limit Boundary Line (Y = +2.0 MAX) */}
        <line
          x1={paddingX}
          y1={topLimitP.sy}
          x2={svgWidth - paddingX}
          y2={topLimitP.sy}
          stroke="rgba(239, 68, 68, 0.7)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <text x={svgWidth - paddingX + 6} y={topLimitP.sy + 3} fill="rgba(239, 68, 68, 0.85)" fontSize="10" fontWeight="700" fontFamily="monospace">
          Y = +2.0 (MAX)
        </text>

        {/* Lower Limit Boundary Line (Y = -1.0 MIN) */}
        <line
          x1={paddingX}
          y1={botLimitP.sy}
          x2={svgWidth - paddingX}
          y2={botLimitP.sy}
          stroke="rgba(239, 68, 68, 0.7)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <text x={svgWidth - paddingX + 6} y={botLimitP.sy + 3} fill="rgba(239, 68, 68, 0.85)" fontSize="10" fontWeight="700" fontFamily="monospace">
          Y = -1.0 (MIN)
        </text>

        {/* Control Handle Lines */}
        <line
          x1={startP.sx}
          y1={startP.sy}
          x2={handle1P.sx}
          y2={handle1P.sy}
          stroke="#38bdf8"
          strokeWidth="2"
          strokeDasharray="3 3"
        />
        <line
          x1={endP.sx}
          y1={endP.sy}
          x2={handle2P.sx}
          y2={handle2P.sy}
          stroke="#fbbf24"
          strokeWidth="2"
          strokeDasharray="3 3"
        />

        {/* Cubic Bezier Curve Line */}
        <path d={bezierPathD} fill="none" stroke="#2dd4bf" strokeWidth="3.5" strokeLinecap="round" />

        {/* Start (0,0) and End (1,1) Fixed Anchor Dots */}
        <circle cx={startP.sx} cy={startP.sy} r="6" fill="#818cf8" stroke="#ffffff" strokeWidth="2" />
        <circle cx={endP.sx} cy={endP.sy} r="6" fill="#2dd4bf" stroke="#ffffff" strokeWidth="2" />

        {/* Interactive P1 Handle Dot (Cyan) */}
        <g
          transform={`translate(${handle1P.sx}, ${handle1P.sy})`}
          style={{ cursor: 'grab' }}
          onPointerDown={(event) => handlePointerDown(1, event)}
        >
          <circle r="12" fill="rgba(56, 189, 248, 0.2)" />
          <circle r="7" fill="#38bdf8" stroke="#ffffff" strokeWidth="2.5" />
          <text x="-20" y="-12" fill="#38bdf8" fontSize="11" fontWeight="700">
            P1 ({p1.x}, {p1.y})
          </text>
        </g>

        {/* Interactive P2 Handle Dot (Gold) */}
        <g
          transform={`translate(${handle2P.sx}, ${handle2P.sy})`}
          style={{ cursor: 'grab' }}
          onPointerDown={(event) => handlePointerDown(2, event)}
        >
          <circle r="12" fill="rgba(251, 191, 36, 0.2)" />
          <circle r="7" fill="#fbbf24" stroke="#ffffff" strokeWidth="2.5" />
          <text x="10" y="16" fill="#fbbf24" fontSize="11" fontWeight="700">
            P2 ({p2.x}, {p2.y})
          </text>
        </g>
      </svg>
    );
  };
  if (!isModalOpen) return null;


  return ReactDOM.createPortal(
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(10, 14, 23, 0.88)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || suppressBackdropClickRef.current || draggingPointRef.current) return;
        setIsModalOpen(false);
        onCloseModalRef.current?.();
      }}
    >
      <div
        ref={modalCardRef}
        className="bezier-modal-card bezier-modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bezier-modal-title"
        style={{
          width: '100%',
          maxWidth: 920,
          maxHeight: 'calc(100vh - 40px)',
          background: '#131722',
          border: '1px solid #242a3a',
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.85)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          position: 'relative',
          margin: '0 auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Row with Close Button */}
        <div className="bezier-modal-header v3-graph-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px 0 24px' }}>
          <h2 id="bezier-modal-title" className="bezier-modal-title">Motion Curve Editor</h2>
          <button
            className="btn-icon"
            onClick={() => {
              setIsModalOpen(false);
              onCloseModal?.();
            }}
            title="Close"
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              background: '#1c2230',
              border: '1px solid #2d3548',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Content Grid */}
        <div className="bezier-modal-grid v3-graph-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, padding: '12px 28px 28px 28px' }}>
          {/* Left Column: SVG Canvas + P1/P2 Coordinates */}
          <div className="bezier-modal-column bezier-modal-main v3-graph-main" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* SVG Canvas Box with Exact Red Limit Lines */}
            <div className="bezier-graph-surface"
              style={{
                background: '#090b10',
                borderRadius: 12,
                border: '1px solid #232838',
                padding: '24px 16px',
                display: 'flex',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              {renderSvgGraph(modalSvgRef, 500, 360, 50, 40)}
            </div>

            {/* Direct Coordinate Inputs */}
            <div className="bezier-handle-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="bezier-handle-card" style={{ background: '#181d2a', padding: '12px 14px', borderRadius: 8, border: '1px solid #283044' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', display: 'block', marginBottom: 8 }}>
                  P1 HANDLE (CYAN)
                </span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="bezier-p1-x" style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 3 }}>X1 (0..1)</label>
                    <input id="bezier-p1-x" className="input-control"
                type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={p1.x}
                      style={{ width: '100%', background: '#0e1118', border: '1px solid #2a3348', color: '#fff', borderRadius: 5, padding: '6px 8px', fontSize: 12, fontWeight: 600 }}
                      onChange={(e) => updatePoints({ x: clampControlPoint(parseFloat(e.target.value) || 0, 0, 1), y: p1.y }, p2)}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="bezier-p1-y" style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Y1 (-1.0..2.0)</label>
                    <input id="bezier-p1-y" className="input-control"
                type="number"
                      min={-1}
                      max={2}
                      step={0.05}
                      value={p1.y}
                      onChange={(e) => updatePoints({ x: p1.x, y: clampControlPoint(parseFloat(e.target.value) || 0, -1, 2) }, p2)}
                    />
                  </div>
                </div>
              </div>

              <div className="bezier-handle-card" style={{ background: '#181d2a', padding: '12px 14px', borderRadius: 8, border: '1px solid #283044' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', display: 'block', marginBottom: 8 }}>
                  P2 HANDLE (GOLD)
                </span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="bezier-p2-x" style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 3 }}>X2 (0..1)</label>
                    <input id="bezier-p2-x" className="input-control"
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={p2.x}
                      style={{ width: '100%', background: '#0e1118', border: '1px solid #2a3348', color: '#fff', borderRadius: 5, padding: '6px 8px', fontSize: 12, fontWeight: 600 }}
                      onChange={(e) => updatePoints(p1, { x: clampControlPoint(parseFloat(e.target.value) || 0, 0, 1), y: p2.y })}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="bezier-p2-y" style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Y2 (-1.0..2.0)</label>
                    <input id="bezier-p2-y" className="input-control"
                      type="number"
                      min={-1}
                      max={2}
                      step={0.05}
                      value={p2.y}
                      style={{ width: '100%', background: '#0e1118', border: '1px solid #2a3348', color: '#fff', borderRadius: 5, padding: '6px 8px', fontSize: 12, fontWeight: 600 }}
                      onChange={(e) => updatePoints(p1, { x: p2.x, y: clampControlPoint(parseFloat(e.target.value) || 0, -1, 2) })}
                    />
                </div>
                  </div>
                </div>
            {onChangeKeyframeValue && (
              <div className="bezier-value-graph-card" style={{ background: '#181d2a', borderRadius: 10, border: '1px solid #283044', padding: 14 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                  {(['value', 'speed'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className="btn-secondary"
                      aria-pressed={graphMode === mode}
                      onClick={() => setGraphMode(mode)}
                    >
                      {mode === 'value' ? 'Value Graph' : 'Speed Graph'}
                    </button>
                  ))}
                </div>
                <TemporalGraphPanel
                  keyframes={valueKeyframes}
                  mode={graphMode}
                  onChangeKeyframeValue={onChangeKeyframeValue}
                  onChangeKeyframeHandles={onChangeKeyframeHandles}
                />
              </div>
            )}
            </div>
          </div>

          {/* Right Column: Live Motion Simulation, Presets, Easing Code & Apply */}
          <div className="bezier-modal-column bezier-modal-side v3-graph-support" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Live Motion Test Box */}
            <div className="bezier-preview-card">
              <div className="bezier-preview-toolbar">
                <div className="bezier-preview-speed">
                  <span>Test Speed</span>
                  <div className="bezier-preview-speed-options">
                    {[0.6, 1.2, 1.8, 3.0].map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        className={previewDuration === dur ? 'is-active' : ''}
                        onClick={() => setPreviewDuration(dur)}
                      >
                        {dur}s
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-icon bezier-preview-play"
                  onClick={() => {
                    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
                    setIsPreviewPlaying((playing) => !playing);
                  }}
                  title={isPreviewPlaying ? 'Pause Preview' : 'Play Preview'}
                  aria-label={isPreviewPlaying ? 'Pause Preview' : 'Play Preview'}
                >
                  {isPreviewPlaying ? <Pause size={12} /> : <Play size={12} />}
                </button>
              </div>

              <div className="bezier-mini-stage" data-testid="bezier-mini-stage">
                <div className="bezier-mini-stage-track" />
                <div
                  ref={previewBallRef}
                  className={`bezier-preview-ball${isPreviewPlaying ? ' is-playing' : ''}`}
                />
              </div>

              <div className="bezier-preview-status" aria-live="polite">
                {isPreviewPlaying ? 'Playing preview' : 'Preview paused'} · {getMotionAnalysis()}
              </div>
            </div>

            {/* Presets Grid */}
            <div className="bezier-presets-section">
              <label className="form-label" style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 8 }}>
                STUDIO BEZIER PRESETS
              </label>
              <div className="bezier-presets-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {PRESET_BEZIERS.map((preset) => (
                  <button
                    key={preset.label}
                    style={{
                      fontSize: 11,
                      padding: '8px 10px',
                      background: '#181d2a',
                      border: '1px solid #283044',
                      color: '#f8fafc',
                      borderRadius: 6,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontWeight: 600,
                    }}
                    onClick={() => updatePoints({ x: preset.points[0], y: preset.points[1] }, { x: preset.points[2], y: preset.points[3] })}
                  >
                    <span>{preset.label}</span>
                    <Sparkles size={12} className="text-teal" />
                  </button>
                ))}
              </div>
            </div>

            {/* CSS Code Output */}
            <div className="bezier-css-card" style={{ background: '#181d2a', padding: 12, borderRadius: 8, border: '1px solid #283044' }}>
              <label className="form-label" style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 4 }}>CSS EASING CODE</label>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700 }}>
                  {cssString}
                </span>
                <button className="btn-icon" onClick={copyToClipboard} title="Copy CSS code" style={{ width: 24, height: 24, background: '#0e1118', border: '1px solid #2a3348', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {copied ? <Check size={13} className="text-green" /> : <Copy size={13} />}
                </button>
              </div>
            </div>

            {/* Apply Button */}
            <button
              className="btn-primary w-full bezier-apply-button"
              onClick={() => {
                setIsModalOpen(false);
                onCloseModal?.();
              }}
              style={{
                marginTop: 'auto',
                padding: '12px 0',
                fontSize: 13,
                fontWeight: 700,
                background: '#14b8a6',
                color: '#000',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: '0 4px 14px rgba(20, 184, 166, 0.4)',
              }}
            >
              <Check size={16} />
              <span>Apply</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
