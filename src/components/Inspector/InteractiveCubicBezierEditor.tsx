import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Copy, Check, Maximize2, X, Play, Pause, Sparkles, RefreshCw, Activity, Zap } from 'lucide-react';

interface InteractiveCubicBezierEditorProps {
  controlPoints?: [number, number, number, number]; // [x1, y1, x2, y2]
  onChange: (points: [number, number, number, number]) => void;
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

export const InteractiveCubicBezierEditor: React.FC<InteractiveCubicBezierEditorProps> = ({
  controlPoints = [0.42, 0.0, 0.58, 1.0],
  onChange,
}) => {
  const [copied, setCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draggingPoint, setDraggingPoint] = useState<1 | 2 | null>(null);

  // Pro Studio Modal State
  const [previewShape, setPreviewShape] = useState<'ball' | 'card' | 'arrow' | 'heart'>('ball');
  const [previewDuration, setPreviewDuration] = useState<number>(1.6);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(true);

  const panelSvgRef = useRef<SVGSVGElement>(null);
  const modalSvgRef = useRef<SVGSVGElement>(null);

  const [p1, setP1] = useState<{ x: number; y: number }>({ x: controlPoints[0], y: controlPoints[1] });
  const [p2, setP2] = useState<{ x: number; y: number }>({ x: controlPoints[2], y: controlPoints[3] });

  // Sync internal state when external controlPoints change
  useEffect(() => {
    setP1({ x: controlPoints[0], y: controlPoints[1] });
    setP2({ x: controlPoints[2], y: controlPoints[3] });
  }, [controlPoints]);

  const cssString = `cubic-bezier(${p1.x}, ${p1.y}, ${p2.x}, ${p2.y})`;

  const updatePoints = (newP1: { x: number; y: number }, newP2: { x: number; y: number }) => {
    setP1(newP1);
    setP2(newP2);
    onChange([newP1.x, newP1.y, newP2.x, newP2.y]);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(cssString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Analyze motion characteristics
  const getMotionAnalysis = () => {
    let tags = [];
    if (p1.y < 0 || p2.y < 0) tags.push('🎒 Anticipation Pullback');
    if (p1.y > 1 || p2.y > 1) tags.push('🎯 Elastic Overshoot');
    if (p1.x < 0.2 && p2.x < 0.2) tags.push('⚡ Instant Velocity Burst');
    if (p1.x > 0.8 && p2.x > 0.8) tags.push('🐢 Delayed Impulse');
    if (tags.length === 0) tags.push('✨ Smooth Easing Flow');
    return tags.join(' • ');
  };

  // Helper for rendering SVG Graph
  const renderSvgGraph = (
    ref: React.RefObject<SVGSVGElement | null>,
    svgWidth: number,
    svgHeight: number,
    paddingX: number,
    paddingY: number,
    isInteractive = true
  ) => {
    const innerWidth = svgWidth - paddingX * 2;
    const innerHeight = svgHeight - paddingY * 2;

    // Y Range is mapped from [-1.4, 2.4] (Total range = 3.8)
    // This pushes Y=-1.0 boundary line way down and Y=2.0 boundary line way up!
    // Gives generous 40+ pixels of vertical padding so extreme curves never touch canvas edges!
    const mathToSvg = (mx: number, my: number) => {
      const sx = paddingX + mx * innerWidth;
      const yNormalized = (my - (-1.4)) / 3.8;
      const sy = paddingY + innerHeight - yNormalized * innerHeight;
      return { sx, sy };
    };

    const startP = mathToSvg(0, 0);
    const endP = mathToSvg(1, 1);
    const handle1P = mathToSvg(p1.x, p1.y);
    const handle2P = mathToSvg(p2.x, p2.y);

    const zeroBoxP = mathToSvg(0, 0);
    const oneBoxP = mathToSvg(1, 1);

    const bezierPathD = `M ${startP.sx},${startP.sy} C ${handle1P.sx},${handle1P.sy} ${handle2P.sx},${handle2P.sy} ${endP.sx},${endP.sy}`;

    const handlePointerDown = (pointNum: 1 | 2, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setDraggingPoint(pointNum);
    };

    return (
      <svg
        ref={ref}
        width={svgWidth}
        height={svgHeight}
        style={{ overflow: 'visible', cursor: draggingPoint ? 'grabbing' : 'default' }}
      >
        {/* Unit Box (0 to 1) Solid Outline */}
        <rect
          x={zeroBoxP.sx}
          y={oneBoxP.sy}
          width={oneBoxP.sx - zeroBoxP.sx}
          height={zeroBoxP.sy - oneBoxP.sy}
          fill="rgba(255,255,255,0.025)"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={1.5}
        />

        {/* Center Guide Lines inside Unit Box */}
        <line x1={zeroBoxP.sx} y1={oneBoxP.sy + (zeroBoxP.sy - oneBoxP.sy) / 2} x2={oneBoxP.sx} y2={oneBoxP.sy + (zeroBoxP.sy - oneBoxP.sy) / 2} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
        <line x1={zeroBoxP.sx + (oneBoxP.sx - zeroBoxP.sx) / 2} y1={oneBoxP.sy} x2={zeroBoxP.sx + (oneBoxP.sx - zeroBoxP.sx) / 2} y2={zeroBoxP.sy} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />

        {/* Extended Overshoot Upper/Lower Boundaries (-1.0 & 2.0) - Pushed way out for total freedom! */}
        <line x1={zeroBoxP.sx} y1={mathToSvg(0, 2.0).sy} x2={oneBoxP.sx} y2={mathToSvg(1, 2.0).sy} stroke="rgba(244,63,94,0.3)" strokeDasharray="3 3" />
        <text x={oneBoxP.sx + 6} y={mathToSvg(0, 2.0).sy + 3} fill="rgba(244,63,94,0.6)" fontSize={9} fontFamily="monospace">Y = +2.0</text>

        <line x1={zeroBoxP.sx} y1={mathToSvg(0, -1.0).sy} x2={oneBoxP.sx} y2={mathToSvg(1, -1.0).sy} stroke="rgba(244,63,94,0.3)" strokeDasharray="3 3" />
        <text x={oneBoxP.sx + 6} y={mathToSvg(0, -1.0).sy + 3} fill="rgba(244,63,94,0.6)" fontSize={9} fontFamily="monospace">Y = -1.0</text>

        {/* Tangent Handle Lines */}
        <line x1={startP.sx} y1={startP.sy} x2={handle1P.sx} y2={handle1P.sy} stroke="#00d2ff" strokeWidth={1.75} strokeDasharray="4 3" />
        <line x1={endP.sx} y1={endP.sy} x2={handle2P.sx} y2={handle2P.sy} stroke="#fbbf24" strokeWidth={1.75} strokeDasharray="4 3" />

        {/* Cubic Bezier Easing Curve */}
        <path d={bezierPathD} fill="none" stroke="var(--accent-teal)" strokeWidth={3.5} strokeLinecap="round" />

        {/* Handle Knob 1 (P1 - Cyan) */}
        <circle
          cx={handle1P.sx}
          cy={handle1P.sy}
          r={svgWidth > 350 ? 9 : 7}
          fill="#00d2ff"
          stroke="#ffffff"
          strokeWidth={2}
          style={{ cursor: isInteractive ? 'grab' : 'default' }}
          onMouseDown={(e) => isInteractive && handlePointerDown(1, e)}
        />
        <text
          x={Math.max(10, Math.min(svgWidth - 110, handle1P.sx + 12))}
          y={Math.max(16, Math.min(svgHeight - 10, handle1P.sy - 8))}
          fill="#00d2ff"
          fontSize={svgWidth > 350 ? 11 : 9}
          fontWeight={700}
          fontFamily="monospace"
        >
          P1 ({p1.x}, {p1.y})
        </text>

        {/* Handle Knob 2 (P2 - Gold) */}
        <circle
          cx={handle2P.sx}
          cy={handle2P.sy}
          r={svgWidth > 350 ? 9 : 7}
          fill="#fbbf24"
          stroke="#ffffff"
          strokeWidth={2}
          style={{ cursor: isInteractive ? 'grab' : 'default' }}
          onMouseDown={(e) => isInteractive && handlePointerDown(2, e)}
        />
        <text
          x={Math.max(10, Math.min(svgWidth - 110, handle2P.sx + 12))}
          y={Math.max(16, Math.min(svgHeight - 10, handle2P.sy + 14))}
          fill="#fbbf24"
          fontSize={svgWidth > 350 ? 11 : 9}
          fontWeight={700}
          fontFamily="monospace"
        >
          P2 ({p2.x}, {p2.y})
        </text>

        {/* Start & End Anchor Points */}
        <circle cx={startP.sx} cy={startP.sy} r={5} fill="#6366f1" />
        <circle cx={endP.sx} cy={endP.sy} r={5} fill="#10b981" />
      </svg>
    );
  };

  // Dragging event listeners
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const activeRef = isModalOpen ? modalSvgRef : panelSvgRef;
      if (!draggingPoint || !activeRef.current) return;
      const rect = activeRef.current.getBoundingClientRect();
      const mouseSx = e.clientX - rect.left;
      const mouseSy = e.clientY - rect.top;

      const svgW = isModalOpen ? 560 : 280;
      const svgH = isModalOpen ? 360 : 180;
      const padX = isModalOpen ? 50 : 35;
      const padY = isModalOpen ? 35 : 25;
      const innerW = svgW - padX * 2;
      const innerH = svgH - padY * 2;

      const mx = Number(Math.max(0, Math.min(1, (mouseSx - padX) / innerW)).toFixed(2));
      const yNorm = (padY + innerH - mouseSy) / innerH;
      const my = Number(Math.max(-1.2, Math.min(2.2, -1.4 + yNorm * 3.8)).toFixed(2));

      if (draggingPoint === 1) {
        updatePoints({ x: mx, y: my }, p2);
      } else if (draggingPoint === 2) {
        updatePoints(p1, { x: mx, y: my });
      }
    };

    const handleUp = () => setDraggingPoint(null);

    if (draggingPoint) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [draggingPoint, isModalOpen, p1, p2]);

  return (
    <div className="cubic-bezier-editor-container" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Top Controls Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.5px' }}>
          <Activity size={13} className="text-teal" /> BEZIER GRAPH
        </span>
        <button
          className="btn-primary"
          onClick={() => setIsModalOpen(true)}
          title="Open Fullscreen High-Precision Curve Studio"
          style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, borderRadius: 20, fontWeight: 600 }}
        >
          <Maximize2 size={12} />
          <span>Expand Studio</span>
        </button>
      </div>

      {/* Embedded Panel SVG Canvas Box */}
      <div
        className="bezier-canvas-wrapper"
        style={{
          background: 'linear-gradient(to bottom, #0a0c10, #0d0f14)',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
          padding: 8,
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          overflow: 'hidden'
        }}
      >
        {renderSvgGraph(panelSvgRef, 280, 180, 35, 25)}
      </div>

      {/* Preset Curve Buttons */}
      <div style={{ marginTop: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, display: 'block' }}>PRESETS</span>
        <div className="preset-curves-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {PRESET_BEZIERS.map((preset) => (
            <button
              key={preset.label}
              className="btn-secondary"
              style={{ 
                fontSize: 10, 
                padding: '6px 4px', 
                textAlign: 'center', 
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 4,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'var(--accent-cyan)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
              onClick={() => updatePoints({ x: preset.points[0], y: preset.points[1] }, { x: preset.points[2], y: preset.points[3] })}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* CSS Code Readout & Copy Button */}
      <div
        className="bezier-code-box"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#0a0c10',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 6,
          padding: '8px 12px',
          marginTop: 4
        }}
      >
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--accent-cyan)', fontWeight: 600 }}>
          {cssString}
        </span>
        <button className="btn-icon" onClick={copyToClipboard} title="Copy CSS cubic-bezier code" style={{ width: 22, height: 22 }}>
          {copied ? <Check size={12} className="text-green" /> : <Copy size={12} />}
        </button>
      </div>

      {/* FULLSCREEN HIGH-PRECISION MODAL WINDOW VIA PORTAL */}
      {isModalOpen &&
        ReactDOM.createPortal(
          <div
            className="modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999999,
              background: 'rgba(8, 10, 15, 0.9)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
            onClick={() => setIsModalOpen(false)}
          >
            <div
              className="bezier-modal-card"
              style={{
                width: '100%',
                maxWidth: 980,
                maxHeight: 'calc(100vh - 40px)',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-light)',
                borderRadius: 16,
                boxShadow: '0 24px 60px rgba(0,0,0,0.85)',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 24px',
                  background: 'var(--bg-darkest)',
                  borderBottom: '1px solid var(--border-color)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Sparkles size={20} className="text-teal" />
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                      HIGH-PRECISION MOTION CURVE STUDIO
                    </h3>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Craft custom acceleration physics, test velocity profiles, and inspect live motion dynamics.
                    </span>
                  </div>
                </div>

                <button
                  className="btn-icon"
                  onClick={() => setIsModalOpen(false)}
                  title="Close Studio"
                  style={{ width: 32, height: 32, borderRadius: 8 }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Content Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, padding: 24 }}>
                {/* Left Column: SVG Canvas + Curve Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* SVG Canvas Box */}
                  <div
                    style={{
                      background: '#0a0c10',
                      borderRadius: 12,
                      border: '1px solid var(--border-color)',
                      padding: 16,
                      display: 'flex',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    {renderSvgGraph(modalSvgRef, 560, 340, 50, 35)}
                  </div>

                  {/* Curve Utility Actions Bar (Only in Expanded Studio!) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-dark)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>CURVE UTILITIES:</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn-secondary"
                        style={{ fontSize: 10, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => updatePoints({ x: p2.x, y: p2.y }, { x: p1.x, y: p1.y })}
                        title="Swap P1 and P2 handles"
                      >
                        <RefreshCw size={11} /> Flip P1/P2
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ fontSize: 10, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => updatePoints(p1, { x: Number((1 - p1.x).toFixed(2)), y: Number((1 - p1.y).toFixed(2)) })}
                        title="Set P2 symmetrical to P1"
                      >
                        <Zap size={11} /> Symmetrize
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ fontSize: 10, padding: '4px 8px' }}
                        onClick={() => updatePoints({ x: 0.42, y: 0.0 }, { x: 0.58, y: 1.0 })}
                        title="Reset to Ease In Out"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Direct Coordinate Inputs */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ background: 'var(--bg-dark)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#00d2ff', display: 'block', marginBottom: 6 }}>
                        P1 HANDLE (CYAN)
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>X1 (0..1)</label>
                          <input
                            type="number"
                            step={0.05}
                            value={p1.x}
                            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: 4, padding: '4px 6px', fontSize: 12 }}
                            onChange={(e) => updatePoints({ x: parseFloat(e.target.value) || 0, y: p1.y }, p2)}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>Y1 (-0.6..1.6)</label>
                          <input
                            type="number"
                            step={0.05}
                            value={p1.y}
                            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: 4, padding: '4px 6px', fontSize: 12 }}
                            onChange={(e) => updatePoints({ x: p1.x, y: parseFloat(e.target.value) || 0 }, p2)}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-dark)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', display: 'block', marginBottom: 6 }}>
                        P2 HANDLE (GOLD)
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>X2 (0..1)</label>
                          <input
                            type="number"
                            step={0.05}
                            value={p2.x}
                            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: 4, padding: '4px 6px', fontSize: 12 }}
                            onChange={(e) => updatePoints(p1, { x: parseFloat(e.target.value) || 0, y: p2.y })}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>Y2 (-0.6..1.6)</label>
                          <input
                            type="number"
                            step={0.05}
                            value={p2.y}
                            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: 4, padding: '4px 6px', fontSize: 12 }}
                            onChange={(e) => updatePoints(p1, { x: p2.x, y: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Interactive Motion Physics & Presets */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Live Motion Test Box */}
                  <div style={{ background: 'var(--bg-dark)', borderRadius: 10, border: '1px solid var(--border-color)', padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Activity size={13} /> LIVE MOTION PHYSICS TEST
                      </span>
                      <button
                        className="btn-icon"
                        onClick={() => setIsPreviewPlaying(!isPreviewPlaying)}
                        style={{ width: 22, height: 22 }}
                        title={isPreviewPlaying ? 'Pause Preview' : 'Play Preview'}
                      >
                        {isPreviewPlaying ? <Pause size={12} /> : <Play size={12} />}
                      </button>
                    </div>

                    {/* Preview Shape Selector */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                      {(['ball', 'card', 'arrow', 'heart'] as const).map((shape) => (
                        <button
                          key={shape}
                          className={`btn-secondary ${previewShape === shape ? 'active' : ''}`}
                          style={{ flex: 1, fontSize: 10, padding: '3px 0', textTransform: 'capitalize' }}
                          onClick={() => setPreviewShape(shape)}
                        >
                          {shape}
                        </button>
                      ))}
                    </div>

                    {/* Duration Slider */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Test Speed:</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[0.6, 1.2, 1.8, 3.0].map((dur) => (
                          <button
                            key={dur}
                            className={`btn-secondary ${previewDuration === dur ? 'active' : ''}`}
                            style={{ fontSize: 9, padding: '2px 6px' }}
                            onClick={() => setPreviewDuration(dur)}
                          >
                            {dur}s
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Motion Track */}
                    <div
                      style={{
                        height: 52,
                        background: '#0a0c10',
                        borderRadius: 8,
                        position: 'relative',
                        overflow: 'hidden',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 12px',
                      }}
                    >
                      <style>{`
                        @keyframes curveStudioPreviewAnim {
                          0% { transform: translateX(0px) rotate(0deg); }
                          50% { transform: translateX(210px) rotate(180deg); }
                          100% { transform: translateX(0px) rotate(0deg); }
                        }
                      `}</style>

                      <div
                        style={{
                          width: previewShape === 'card' ? 40 : 28,
                          height: 28,
                          borderRadius: previewShape === 'ball' ? '50%' : 6,
                          background: 'linear-gradient(135deg, var(--accent-teal), #00d2ff)',
                          boxShadow: '0 0 14px var(--accent-teal-glow)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#000',
                          fontWeight: 800,
                          fontSize: 12,
                          animation: isPreviewPlaying ? `curveStudioPreviewAnim ${previewDuration}s ${cssString} infinite` : 'none',
                        }}
                      >
                        {previewShape === 'arrow' && '➔'}
                        {previewShape === 'heart' && '♥'}
                        {previewShape === 'card' && 'CARD'}
                      </div>
                    </div>

                    {/* Motion Characteristics Badge */}
                    <div style={{ marginTop: 10, fontSize: 10, fontWeight: 700, color: 'var(--accent-teal)', textAlign: 'center' }}>
                      {getMotionAnalysis()}
                    </div>
                  </div>

                  {/* Extended Presets Grid */}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                      STUDIO BEZIER PRESETS
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {PRESET_BEZIERS.map((preset) => (
                        <button
                          key={preset.label}
                          className="btn-secondary"
                          style={{ fontSize: 11, padding: '7px 8px', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                          onClick={() => updatePoints({ x: preset.points[0], y: preset.points[1] }, { x: preset.points[2], y: preset.points[3] })}
                        >
                          <span>{preset.label}</span>
                          <Sparkles size={11} className="text-teal" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CSS Code Output */}
                  <div style={{ background: 'var(--bg-dark)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>CSS EASING CODE</label>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                        {cssString}
                      </span>
                      <button className="btn-icon" onClick={copyToClipboard} title="Copy CSS code">
                        {copied ? <Check size={14} className="text-green" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Apply Button */}
                  <button
                    className="btn-primary w-full"
                    onClick={() => setIsModalOpen(false)}
                    style={{ marginTop: 'auto', padding: '12px 0', fontSize: 13, fontWeight: 800 }}
                  >
                    <Check size={16} />
                    <span>Apply Curve to Keyframe</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
