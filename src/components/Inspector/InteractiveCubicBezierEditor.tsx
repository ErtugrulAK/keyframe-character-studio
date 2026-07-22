import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Copy, Check, Maximize2, X, Play, Sparkles } from 'lucide-react';

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

    const mathToSvg = (mx: number, my: number) => {
      const sx = paddingX + mx * innerWidth;
      const sy = paddingY + innerHeight - my * innerHeight;
      return { sx, sy };
    };

    const startP = mathToSvg(0, 0);
    const endP = mathToSvg(1, 1);
    const handle1P = mathToSvg(p1.x, p1.y);
    const handle2P = mathToSvg(p2.x, p2.y);

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
        {/* Grid Background */}
        <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
        <line x1={paddingX} y1={paddingY + innerHeight / 2} x2={svgWidth - paddingX} y2={paddingY + innerHeight / 2} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
        <line x1={paddingX} y1={paddingY + innerHeight} x2={svgWidth - paddingX} y2={paddingY + innerHeight} stroke="rgba(255,255,255,0.18)" />

        <line x1={paddingX} y1={paddingY} x2={paddingX} y2={paddingY + innerHeight} stroke="rgba(255,255,255,0.18)" />
        <line x1={paddingX + innerWidth / 2} y1={paddingY} x2={paddingX + innerWidth / 2} y2={paddingY + innerHeight} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
        <line x1={paddingX + innerWidth} y1={paddingY} x2={paddingX + innerWidth} y2={paddingY + innerHeight} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />

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
        <text x={handle1P.sx + 12} y={handle1P.sy - 8} fill="#00d2ff" fontSize={svgWidth > 350 ? 11 : 9} fontWeight={700} fontFamily="monospace">
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
        <text x={handle2P.sx + 12} y={handle2P.sy + 14} fill="#fbbf24" fontSize={svgWidth > 350 ? 11 : 9} fontWeight={700} fontFamily="monospace">
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

      const svgW = isModalOpen ? 520 : 280;
      const svgH = isModalOpen ? 320 : 180;
      const padX = isModalOpen ? 50 : 35;
      const padY = isModalOpen ? 45 : 35;
      const innerW = svgW - padX * 2;
      const innerH = svgH - padY * 2;

      const mx = Number(Math.max(0, Math.min(1, (mouseSx - padX) / innerW)).toFixed(2));
      const my = Number(Math.max(-0.6, Math.min(1.6, (padY + innerH - mouseSy) / innerH)).toFixed(2));

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Sparkles size={13} className="text-teal" /> CUBIC BEZIER GRAPH
        </span>
        <button
          className="btn-icon"
          onClick={() => setIsModalOpen(true)}
          title="Open Fullscreen High-Precision Curve Studio"
          style={{ padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent-cyan)' }}
        >
          <Maximize2 size={13} />
          <span>Expand Studio</span>
        </button>
      </div>

      {/* Embedded Panel SVG Canvas Box */}
      <div
        className="bezier-canvas-wrapper"
        style={{
          background: '#0d0f14',
          borderRadius: 8,
          border: '1px solid var(--border-color)',
          padding: 8,
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {renderSvgGraph(panelSvgRef, 280, 180, 35, 35)}
      </div>

      {/* Preset Curve Buttons */}
      <div className="preset-curves-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {PRESET_BEZIERS.map((preset) => (
          <button
            key={preset.label}
            className="btn-secondary"
            style={{ fontSize: 10, padding: '4px 2px', textAlign: 'center' }}
            onClick={() => updatePoints({ x: preset.points[0], y: preset.points[1] }, { x: preset.points[2], y: preset.points[3] })}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* CSS Code Readout & Copy Button */}
      <div
        className="bezier-code-box"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-dark)',
          border: '1px solid var(--border-color)',
          borderRadius: 6,
          padding: '6px 10px',
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
              background: 'rgba(8, 10, 15, 0.88)',
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
                maxWidth: 920,
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
                      Drag P1 & P2 handles or enter exact math coordinates to craft custom easing physics.
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, padding: 24 }}>
                {/* Left Column: High-Precision SVG Bezier Canvas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div
                    style={{
                      background: '#0a0c10',
                      borderRadius: 12,
                      border: '1px solid var(--border-color)',
                      padding: 16,
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    {renderSvgGraph(modalSvgRef, 520, 300, 50, 40)}
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

                {/* Right Column: Live Physics Motion Preview & Presets */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Live Motion Test Box */}
                  <div style={{ background: 'var(--bg-dark)', borderRadius: 10, border: '1px solid var(--border-color)', padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Play size={12} /> LIVE PHYSICS MOTION TEST
                      </span>
                    </div>

                    {/* Motion Track */}
                    <div
                      style={{
                        height: 44,
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
                        @keyframes curveLivePreviewAnim {
                          0% { transform: translateX(0px) scale(1); }
                          50% { transform: translateX(200px) scale(1.15); }
                          100% { transform: translateX(0px) scale(1); }
                        }
                      `}</style>

                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          background: 'linear-gradient(135deg, var(--accent-teal), #00d2ff)',
                          boxShadow: '0 0 12px var(--accent-teal-glow)',
                          animation: `curveLivePreviewAnim 1.8s ${cssString} infinite`,
                        }}
                      />
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
