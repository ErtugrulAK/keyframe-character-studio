import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';

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
];

export const InteractiveCubicBezierEditor: React.FC<InteractiveCubicBezierEditorProps> = ({
  controlPoints = [0.42, 0.0, 0.58, 1.0],
  onChange,
}) => {
  const [copied, setCopied] = useState(false);
  const [draggingPoint, setDraggingPoint] = useState<1 | 2 | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [p1, setP1] = useState<{ x: number; y: number }>({ x: controlPoints[0], y: controlPoints[1] });
  const [p2, setP2] = useState<{ x: number; y: number }>({ x: controlPoints[2], y: controlPoints[3] });

  // Sync internal state when external controlPoints change
  useEffect(() => {
    setP1({ x: controlPoints[0], y: controlPoints[1] });
    setP2({ x: controlPoints[2], y: controlPoints[3] });
  }, [controlPoints]);

  const svgWidth = 280;
  const svgHeight = 180;
  const paddingX = 35;
  const paddingY = 35;
  const innerWidth = svgWidth - paddingX * 2; // 210px
  const innerHeight = svgHeight - paddingY * 2; // 110px

  // Coordinate conversions:
  // Math (x 0..1, y 0..1) -> SVG Screen (x 35..245, y 145..35)
  const mathToSvg = useCallback(
    (mx: number, my: number) => {
      const sx = paddingX + mx * innerWidth;
      const sy = paddingY + innerHeight - my * innerHeight;
      return { sx, sy };
    },
    [innerWidth, innerHeight, paddingX, paddingY]
  );

  const svgToMath = useCallback(
    (sx: number, sy: number) => {
      const mx = Number(Math.max(0, Math.min(1, (sx - paddingX) / innerWidth)).toFixed(2));
      const my = Number(Math.max(-0.5, Math.min(1.5, (paddingY + innerHeight - sy) / innerHeight)).toFixed(2));
      return { mx, my };
    },
    [innerWidth, innerHeight, paddingX, paddingY]
  );

  const startP = mathToSvg(0, 0);
  const endP = mathToSvg(1, 1);
  const handle1P = mathToSvg(p1.x, p1.y);
  const handle2P = mathToSvg(p2.x, p2.y);

  // Bezier Path string
  const bezierPathD = `M ${startP.sx},${startP.sy} C ${handle1P.sx},${handle1P.sy} ${handle2P.sx},${handle2P.sy} ${endP.sx},${endP.sy}`;

  const handlePointerDown = (pointNum: 1 | 2, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingPoint(pointNum);
  };

  const handlePointerMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingPoint || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mouseSx = e.clientX - rect.left;
      const mouseSy = e.clientY - rect.top;
      const { mx, my } = svgToMath(mouseSx, mouseSy);

      if (draggingPoint === 1) {
        const newP1 = { x: mx, y: my };
        setP1(newP1);
        onChange([newP1.x, newP1.y, p2.x, p2.y]);
      } else if (draggingPoint === 2) {
        const newP2 = { x: mx, y: my };
        setP2(newP2);
        onChange([p1.x, p1.y, newP2.x, newP2.y]);
      }
    },
    [draggingPoint, svgToMath, onChange, p1, p2]
  );

  const handlePointerUp = useCallback(() => {
    setDraggingPoint(null);
  }, []);

  useEffect(() => {
    if (draggingPoint) {
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [draggingPoint, handlePointerMove, handlePointerUp]);

  const cssString = `cubic-bezier(${p1.x}, ${p1.y}, ${p2.x}, ${p2.y})`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(cssString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="cubic-bezier-editor-container" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* SVG Canvas Box */}
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
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          style={{ overflow: 'visible', cursor: draggingPoint ? 'grabbing' : 'default' }}
        >
          {/* Background Reference Grid */}
          <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <line x1={paddingX} y1={paddingY + innerHeight / 2} x2={svgWidth - paddingX} y2={paddingY + innerHeight / 2} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <line x1={paddingX} y1={paddingY + innerHeight} x2={svgWidth - paddingX} y2={paddingY + innerHeight} stroke="rgba(255,255,255,0.15)" />

          <line x1={paddingX} y1={paddingY} x2={paddingX} y2={paddingY + innerHeight} stroke="rgba(255,255,255,0.15)" />
          <line x1={paddingX + innerWidth / 2} y1={paddingY} x2={paddingX + innerWidth / 2} y2={paddingY + innerHeight} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <line x1={paddingX + innerWidth} y1={paddingY} x2={paddingX + innerWidth} y2={paddingY + innerHeight} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />

          {/* Handle Lines */}
          <line x1={startP.sx} y1={startP.sy} x2={handle1P.sx} y2={handle1P.sy} stroke="#00d2ff" strokeWidth={1.5} strokeDasharray="3 3" />
          <line x1={endP.sx} y1={endP.sy} x2={handle2P.sx} y2={handle2P.sy} stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="3 3" />

          {/* Bezier Acceleration Curve */}
          <path d={bezierPathD} fill="none" stroke="var(--accent-teal)" strokeWidth={3} strokeLinecap="round" />

          {/* Control Point 1 (P1 - Cyan) */}
          <circle
            cx={handle1P.sx}
            cy={handle1P.sy}
            r={7}
            fill="#00d2ff"
            stroke="#ffffff"
            strokeWidth={2}
            style={{ cursor: 'grab' }}
            onMouseDown={(e) => handlePointerDown(1, e)}
          />

          {/* Control Point 2 (P2 - Gold) */}
          <circle
            cx={handle2P.sx}
            cy={handle2P.sy}
            r={7}
            fill="#fbbf24"
            stroke="#ffffff"
            strokeWidth={2}
            style={{ cursor: 'grab' }}
            onMouseDown={(e) => handlePointerDown(2, e)}
          />

          {/* Start & End Points */}
          <circle cx={startP.sx} cy={startP.sy} r={4} fill="#6366f1" />
          <circle cx={endP.sx} cy={endP.sy} r={4} fill="#10b981" />
        </svg>
      </div>

      {/* Preset Curve Buttons */}
      <div className="preset-curves-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        {PRESET_BEZIERS.map((preset) => (
          <button
            key={preset.label}
            className="btn-secondary"
            style={{ fontSize: 10, padding: '4px 6px' }}
            onClick={() => {
              setP1({ x: preset.points[0], y: preset.points[1] });
              setP2({ x: preset.points[2], y: preset.points[3] });
              onChange(preset.points);
            }}
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
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-cyan)', fontWeight: 600 }}>
          {cssString}
        </span>
        <button
          className="btn-icon"
          onClick={copyToClipboard}
          title="Copy CSS cubic-bezier code"
          style={{ width: 22, height: 22 }}
        >
          {copied ? <Check size={12} className="text-green" /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  );
};
