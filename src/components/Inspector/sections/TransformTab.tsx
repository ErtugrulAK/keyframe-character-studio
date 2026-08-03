import React, { useState } from 'react';
import { Activity, Link, Unlink, Maximize2, Move, Sun, AlignLeft, AlignCenter, AlignRight, AlignVerticalSpaceAround } from 'lucide-react';
import type { CharacterPart, Transform } from '../../../types/animator';
import { useAnimator } from '../../../context/AnimatorContext';
import { getPartBounds } from '../../../utils/bounds';


interface SmartNumberInputProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  displayScale?: number; // Display value = internal value * displayScale (e.g. 0.01 shows px/100)
  precision?: number;    // Decimal places for display
  onChange: (val: number) => void;
}

const SmartNumberInput: React.FC<SmartNumberInputProps> = ({ value, min, max, step = 1, displayScale, precision, onChange }) => {
  const scale = displayScale ?? 1;
  const decimals = precision ?? 2;
  const rawVal = (value ?? 0) * scale;
  const displayVal = isNaN(rawVal) ? 0 : Math.round(rawVal * Math.pow(10, decimals)) / Math.pow(10, decimals);

  const [editingValue, setEditingValue] = React.useState<string>(String(displayVal));
  const [isFocused, setIsFocused] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!isFocused) {
      setEditingValue(String(displayVal));
    }
  }, [displayVal, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setEditingValue(valStr);
    let parsed = parseFloat(valStr);
    if (!isNaN(parsed)) {
      let internal = Math.round((parsed / scale) * 100) / 100;
      onChange(internal);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    let parsed = parseFloat(editingValue);
    if (isNaN(parsed)) {
      setEditingValue(String(displayVal));
    } else {
      if (min !== undefined) parsed = Math.max(min, parsed);
      if (max !== undefined) parsed = Math.min(max, parsed);
      const rounded = Math.round(parsed * Math.pow(10, decimals)) / Math.pow(10, decimals);
      setEditingValue(String(rounded));
      onChange(rounded / scale);
    }
  };

  const displayStep = step !== undefined ? step * Math.abs(scale) : undefined;

  return (
    <input
      className="input-control"
      type="number"
      value={isFocused ? editingValue : displayVal}
      min={min !== undefined ? min * scale : undefined}
      max={max !== undefined ? max * scale : undefined}
      step={displayStep}
      onFocus={() => setIsFocused(true)}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
};

interface TransformTabProps {
  selectedPart: CharacterPart;
  transform: Transform;
  currentFrame: number;
  addKeyframeForSelected?: () => void;
  updateCurrentTransform: (newTransform: Partial<Transform>) => void;
  handlePartPropChange?: (key: keyof CharacterPart, value: any) => void;
  handleZIndexChange?: (zIndex: number) => void;
}

export const TransformTab: React.FC<TransformTabProps> = ({
  selectedPart,
  transform,
  currentFrame,
  updateCurrentTransform,
  handleZIndexChange,
}) => {
  const [isScaleLocked, setIsScaleLocked] = useState<boolean>(true);
  const [pointMode, setPointMode] = useState<'edge' | 'corner'>('edge');
  
  const { selectedPartIds, characterParts, getComputedTransform, updateCurrentTransform: ctxUpdateCurrentTransform } = useAnimator();

  const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (selectedPartIds.length < 2) return;
    const partsAndTransforms = selectedPartIds.map(id => {
      const part = characterParts.find(p => p.id === id);
      const t = getComputedTransform(id, currentFrame);
      if (!part || !t) return null;
      const b = getPartBounds(part);
      const w = b.halfW * Math.abs(t.scaleX);
      const h = b.halfH * Math.abs(t.scaleY);
      return { id, t, left: t.x - w, right: t.x + w, top: t.y - h, bottom: t.y + h, cx: t.x, cy: t.y };
    }).filter(Boolean) as any[];

    if (partsAndTransforms.length < 2) return;

    if (type === 'left') {
      const minLeft = Math.min(...partsAndTransforms.map(p => p.left));
      partsAndTransforms.forEach(p => ctxUpdateCurrentTransform({ x: p.t.x - (p.left - minLeft) }, p.id));
    } else if (type === 'right') {
      const maxRight = Math.max(...partsAndTransforms.map(p => p.right));
      partsAndTransforms.forEach(p => ctxUpdateCurrentTransform({ x: p.t.x + (maxRight - p.right) }, p.id));
    } else if (type === 'center') {
      const cx = partsAndTransforms.reduce((acc, p) => acc + p.cx, 0) / partsAndTransforms.length;
      partsAndTransforms.forEach(p => ctxUpdateCurrentTransform({ x: p.t.x + (cx - p.cx) }, p.id));
    } else if (type === 'top') {
      const minTop = Math.min(...partsAndTransforms.map(p => p.top));
      partsAndTransforms.forEach(p => ctxUpdateCurrentTransform({ y: p.t.y - (p.top - minTop) }, p.id));
    } else if (type === 'bottom') {
      const maxBottom = Math.max(...partsAndTransforms.map(p => p.bottom));
      partsAndTransforms.forEach(p => ctxUpdateCurrentTransform({ y: p.t.y + (maxBottom - p.bottom) }, p.id));
    } else if (type === 'middle') {
      const cy = partsAndTransforms.reduce((acc, p) => acc + p.cy, 0) / partsAndTransforms.length;
      partsAndTransforms.forEach(p => ctxUpdateCurrentTransform({ y: p.t.y + (cy - p.cy) }, p.id));
    }
  };

  return (
    <>
      <div className="inspector-section" style={{ paddingTop: 8 }}>
        
        {/* ── ALIGNMENT BAR ── */}
        {selectedPartIds.length > 1 && (
          <div className="panel-card" style={{ marginBottom: 12, padding: 8, display: 'flex', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
            <button className="btn-icon-small" title="Align Left" onClick={() => handleAlign('left')}><AlignLeft size={14} /></button>
            <button className="btn-icon-small" title="Align Center" onClick={() => handleAlign('center')}><AlignCenter size={14} /></button>
            <button className="btn-icon-small" title="Align Right" onClick={() => handleAlign('right')}><AlignRight size={14} /></button>
            <div style={{ width: 1, height: 16, background: 'var(--border-color)', margin: '0 4px' }} />
            <button className="btn-icon-small" title="Align Top" onClick={() => handleAlign('top')}><AlignLeft size={14} style={{transform:'rotate(90deg)'}} /></button>
            <button className="btn-icon-small" title="Align Middle" onClick={() => handleAlign('middle')}><AlignVerticalSpaceAround size={14} style={{transform:'rotate(90deg)'}} /></button>
            <button className="btn-icon-small" title="Align Bottom" onClick={() => handleAlign('bottom')}><AlignRight size={14} style={{transform:'rotate(90deg)'}} /></button>
          </div>
        )}
      {/* ── CARD 1: POSITION & ROTATION ── */}
      <div className="panel-card" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.4px' }}>
            <Activity size={13} /> POSITION & ROTATION (FRAME {currentFrame})
          </span>
          <button
            type="button"
            className="btn-secondary"
            style={{ height: 20, fontSize: 9, padding: '0 6px' }}
            onClick={() => updateCurrentTransform({ rotation: 0 })}
            title="Reset rotation angle to 0°"
          >
            Reset Rot (0°)
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, width: "100%" }}>
          <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 6px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
            <span className="form-label text-red" style={{ fontSize: 9 }}>POS X</span>
            <SmartNumberInput
              value={transform.x}
              step={1}
              displayScale={0.01}
              precision={2}
              onChange={(val) => updateCurrentTransform({ x: val })}
            />
          </div>

          <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 6px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
            <span className="form-label text-green" style={{ fontSize: 9 }}>POS Y</span>
            <SmartNumberInput
              value={-transform.y}
              step={1}
              displayScale={0.01}
              precision={2}
              onChange={(val) => updateCurrentTransform({ y: -val })}
            />
          </div>

          <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 6px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
            <span className="form-label text-blue" style={{ fontSize: 9 }}>ROT (°)</span>
            <SmartNumberInput
              value={transform.rotation}
              onChange={(val) => updateCurrentTransform({ rotation: val })}
            />
          </div>
        </div>
      </div>

      {/* ── CARD 2: PROPORTIONAL SCALE & RATIO ── */}
      <div className="panel-card" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.4px' }}>
            <Maximize2 size={13} /> PROPORTIONAL SCALE & RATIO
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ height: 20, fontSize: 9, padding: '0 6px' }}
              onClick={() => updateCurrentTransform({ scaleX: 1, scaleY: 1 })}
              title="Reset scale multiplier to 1.0"
            >
              Reset Scale
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ 
                height: 20,
                fontSize: 9, 
                padding: '0 6px', 
                color: isScaleLocked ? '#10b981' : '#64748b', 
                background: isScaleLocked ? 'rgba(16, 185, 129, 0.12)' : '#101218',
                border: `1px solid ${isScaleLocked ? 'rgba(16, 185, 129, 0.4)' : '#232836'}`,
                borderRadius: 4,
              }}
              onClick={() => setIsScaleLocked(!isScaleLocked)}
              title={isScaleLocked ? 'Aspect Ratio Locked (Uniform Scale)' : 'Aspect Ratio Unlocked (Free Scale)'}
            >
              {isScaleLocked ? <Link size={10} /> : <Unlink size={10} />}
              <span>{isScaleLocked ? 'Locked' : 'Free'}</span>
            </button>
          </div>
        </div>

        {/* Master Uniform Scale Control */}
        <div style={{ background: '#0e1118', padding: '8px 10px', borderRadius: 6, border: '1px solid #232836', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.4px' }}>UNIFORM SCALE MULTIPLIER</label>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>
              {((transform.scaleX + transform.scaleY) / 2).toFixed(2)}x ({(Math.round(((transform.scaleX + transform.scaleY) / 2) * 100))}% )
            </span>
          </div>
          <input
            type="range" min="0.1" max="15" step="0.1"
            value={(transform.scaleX + transform.scaleY) / 2}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              updateCurrentTransform({ scaleX: val, scaleY: val });
            }}
            style={{ width: '100%', cursor: 'pointer', accentColor: '#38bdf8' }}
          />
          {/* Quick Presets */}
          <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
            {[0.5, 1.0, 1.5, 2.0, 5.0, 6.42].map((s) => (
              <button
                key={`scale-preset-${s}`}
                type="button"
                className="btn-secondary"
                style={{ flex: 1, height: 22, fontSize: 10, fontWeight: 700, padding: 0, textAlign: 'center', borderRadius: 4 }}
                onClick={() => updateCurrentTransform({ scaleX: s, scaleY: s })}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Scale X & Scale Y Inputs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)", width: "100%" }}>
          <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
            <span className="param-label">SCALE X</span>
            <SmartNumberInput
              value={transform.scaleX}
              step={0.1}
              onChange={(val) => {
                if (isScaleLocked) {
                  const ratio = transform.scaleX !== 0 ? transform.scaleY / transform.scaleX : 1;
                  updateCurrentTransform({ scaleX: val, scaleY: parseFloat((val * (ratio || 1)).toFixed(3)) });
                } else {
                  updateCurrentTransform({ scaleX: val });
                }
              }}
            />
          </div>

          <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
            <span className="param-label">SCALE Y</span>
            <SmartNumberInput
              value={transform.scaleY}
              step={0.1}
              onChange={(val) => {
                if (isScaleLocked) {
                  const ratio = transform.scaleY !== 0 ? transform.scaleX / transform.scaleY : 1;
                  updateCurrentTransform({ scaleY: val, scaleX: parseFloat((val * (ratio || 1)).toFixed(3)) });
                } else {
                  updateCurrentTransform({ scaleY: val });
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* ── CARD 3: OPACITY & TRANSPARENCY ── */}
      <div className="panel-card" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.4px' }}>
            <Sun size={13} /> OPACITY & TRANSPARENCY
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.12)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            {Math.round(transform.opacity * 100)}%
          </span>
        </div>

        <div style={{ background: '#0e1118', padding: '8px 10px', borderRadius: 6, border: '1px solid #232836', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', boxSizing: 'border-box', width: '100%' }}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={transform.opacity}
              onChange={(e) => updateCurrentTransform({ opacity: parseFloat(e.target.value) })}
              style={{ flex: 1, minWidth: 0, cursor: 'pointer', accentColor: '#f59e0b' }}
            />
            <div style={{ width: 60, minWidth: 60, flexShrink: 0 }}>
              <SmartNumberInput
                value={transform.opacity}
                min={0}
                max={1}
                step={0.05}
                onChange={(val) => updateCurrentTransform({ opacity: val })}
              />
            </div>
          </div>

          {/* Quick Presets */}
          <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
            {[0, 0.25, 0.50, 0.75, 1.0].map((op) => (
              <button
                key={`op-preset-${op}`}
                type="button"
                className="btn-secondary"
                style={{
                  flex: 1,
                  height: 24,
                  fontSize: 'var(--font-size-caption)',
                  fontWeight: 700,
                  padding: 0,
                  textAlign: 'center',
                  borderRadius: 'var(--radius-xs)',
                  boxSizing: 'border-box',
                  color: Math.abs(transform.opacity - op) < 0.02 ? '#f59e0b' : undefined,
                  borderColor: Math.abs(transform.opacity - op) < 0.02 ? 'rgba(245, 158, 11, 0.5)' : undefined,
                  background: Math.abs(transform.opacity - op) < 0.02 ? 'rgba(245, 158, 11, 0.12)' : undefined,
                }}
                onClick={() => updateCurrentTransform({ opacity: op })}
              >
                {Math.round(op * 100)}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CARD 4: LAYER Z-INDEX ORDER ── */}
      {handleZIndexChange && (
        <div className="panel-card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.4px' }}>
              LAYER Z-INDEX ORDER
            </label>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>
              Index {selectedPart.zIndex}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ flex: 1, padding: '5px 8px', fontSize: 11, fontWeight: 700 }}
              onClick={() => handleZIndexChange(selectedPart.zIndex + 1)}
            >
              Bring Forward (+1)
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ flex: 1, padding: '5px 8px', fontSize: 11, fontWeight: 700 }}
              onClick={() => handleZIndexChange(Math.max(1, selectedPart.zIndex - 1))}
            >
              Send Backward (-1)
            </button>
          </div>
        </div>
      )}

      {/* ── 4 CONTROL POINTS (STAGE X & Y COORDINATES) ── */}
      {(() => {
        const { halfW: baseHalfW, halfH: baseHalfH } = getPartBounds(selectedPart);
        const currentHalfW = Math.round(baseHalfW * transform.scaleX);
        const currentHalfH = Math.round(baseHalfH * transform.scaleY);

        const cx = transform.x;
        const cy = -transform.y; // Cartesian Y

        return (
          <div className="panel-card" style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.4px' }}>
                <Move size={13} /> 4 CONTROL POINTS (X/Y)
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    height: 20,
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '0 6px',
                    color: pointMode === 'edge' ? '#38bdf8' : '#64748b',
                    background: pointMode === 'edge' ? 'rgba(56, 189, 248, 0.15)' : '#0e1118',
                    border: `1px solid ${pointMode === 'edge' ? '#38bdf8' : '#232836'}`,
                    borderRadius: 3,
                  }}
                  onClick={() => setPointMode('edge')}
                >
                  Edge Points
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    height: 20,
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '0 6px',
                    color: pointMode === 'corner' ? '#c084fc' : '#64748b',
                    background: pointMode === 'corner' ? 'rgba(192, 132, 252, 0.15)' : '#0e1118',
                    border: `1px solid ${pointMode === 'corner' ? '#c084fc' : '#232836'}`,
                    borderRadius: 3,
                  }}
                  onClick={() => setPointMode('corner')}
                >
                  Corners
                </button>
              </div>
            </div>

            {pointMode === 'edge' ? (
              /* ── 4 EDGE MIDPOINTS (STRICT OPPOSITE ANCHOR ISOLATION) ── */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {/* LEFT EDGE POINT */}
                <div style={{ background: '#0e1118', padding: '6px 8px', borderRadius: 5, border: '1px solid #232836' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8' }} /> LEFT POINT
                    </span>
                  </div>
                  <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0,  marginBottom: 4 }}>
                    <span className="form-label text-red" style={{ fontSize: 9 }}>X</span>
                    <SmartNumberInput
                      value={cx - currentHalfW}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetLeftX) => {
                        const fixedRightX = cx + currentHalfW;
                        const validLeftX = Math.min(fixedRightX, targetLeftX);
                        const newWidth = fixedRightX - validLeftX;
                        const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
                        const newCx = Math.round((validLeftX + fixedRightX) / 2);
                        updateCurrentTransform({ scaleX: newScaleX, x: newCx });
                      }}
                    />
                  </div>
                  <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
                    <span className="form-label text-green" style={{ fontSize: 9 }}>Y</span>
                    <SmartNumberInput
                      value={cy}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetY) => updateCurrentTransform({ y: -targetY })}
                    />
                  </div>
                </div>

                {/* RIGHT EDGE POINT */}
                <div style={{ background: '#0e1118', padding: '6px 8px', borderRadius: 5, border: '1px solid #232836' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8' }} /> RIGHT POINT
                    </span>
                  </div>
                  <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0,  marginBottom: 4 }}>
                    <span className="form-label text-red" style={{ fontSize: 9 }}>X</span>
                    <SmartNumberInput
                      value={cx + currentHalfW}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetRightX) => {
                        const fixedLeftX = cx - currentHalfW;
                        const validRightX = Math.max(fixedLeftX, targetRightX);
                        const newWidth = validRightX - fixedLeftX;
                        const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
                        const newCx = Math.round((fixedLeftX + validRightX) / 2);
                        updateCurrentTransform({ scaleX: newScaleX, x: newCx });
                      }}
                    />
                  </div>
                  <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
                    <span className="form-label text-green" style={{ fontSize: 9 }}>Y</span>
                    <SmartNumberInput
                      value={cy}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetY) => updateCurrentTransform({ y: -targetY })}
                    />
                  </div>
                </div>

                {/* TOP EDGE POINT */}
                <div style={{ background: '#0e1118', padding: '6px 8px', borderRadius: 5, border: '1px solid #232836' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c084fc' }} /> TOP POINT
                    </span>
                  </div>
                  <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0,  marginBottom: 4 }}>
                    <span className="form-label text-red" style={{ fontSize: 9 }}>X</span>
                    <SmartNumberInput
                      value={cx}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetX) => updateCurrentTransform({ x: targetX })}
                    />
                  </div>
                  <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
                    <span className="form-label text-green" style={{ fontSize: 9 }}>Y</span>
                    <SmartNumberInput
                      value={cy + currentHalfH}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetTopY) => {
                        const fixedBottomY = cy - currentHalfH;
                        const validTopY = Math.max(fixedBottomY, targetTopY);
                        const newHeight = validTopY - fixedBottomY;
                        const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
                        const newCy = Math.round((validTopY + fixedBottomY) / 2);
                        updateCurrentTransform({ scaleY: newScaleY, y: -newCy });
                      }}
                    />
                  </div>
                </div>

                {/* BOTTOM EDGE POINT */}
                <div style={{ background: '#0e1118', padding: '6px 8px', borderRadius: 5, border: '1px solid #232836' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c084fc' }} /> BOTTOM POINT
                    </span>
                  </div>
                  <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0,  marginBottom: 4 }}>
                    <span className="form-label text-red" style={{ fontSize: 9 }}>X</span>
                    <SmartNumberInput
                      value={cx}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetX) => updateCurrentTransform({ x: targetX })}
                    />
                  </div>
                  <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
                    <span className="form-label text-green" style={{ fontSize: 9 }}>Y</span>
                    <SmartNumberInput
                      value={cy - currentHalfH}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetBottomY) => {
                        const fixedTopY = cy + currentHalfH;
                        const validBottomY = Math.min(fixedTopY, targetBottomY);
                        const newHeight = fixedTopY - validBottomY;
                        const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
                        const newCy = Math.round((fixedTopY + validBottomY) / 2);
                        updateCurrentTransform({ scaleY: newScaleY, y: -newCy });
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* ── 4 CORNER POINTS (TL, TR, BR, BL) (STRICT OPPOSITE ANCHOR ISOLATION) ── */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {/* TOP-LEFT (TL) */}
                <div style={{ background: '#0e1118', padding: '6px 8px', borderRadius: 5, border: '1px solid #232836' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8', display: 'block', marginBottom: 4 }}>
                    ↖ TOP-LEFT (TL)
                  </span>
                  <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0,  marginBottom: 4 }}>
                    <span className="form-label text-red" style={{ fontSize: 9 }}>X</span>
                    <SmartNumberInput
                      value={cx - currentHalfW}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetTLX) => {
                        const fixedRightX = cx + currentHalfW;
                        const validTLX = Math.min(fixedRightX, targetTLX);
                        const newWidth = fixedRightX - validTLX;
                        const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
                        const newCx = Math.round((validTLX + fixedRightX) / 2);
                        updateCurrentTransform({ scaleX: newScaleX, x: newCx });
                      }}
                    />
                  </div>
                  <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
                    <span className="form-label text-green" style={{ fontSize: 9 }}>Y</span>
                    <SmartNumberInput
                      value={cy + currentHalfH}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetTLY) => {
                        const fixedBottomY = cy - currentHalfH;
                        const validTLY = Math.max(fixedBottomY, targetTLY);
                        const newHeight = validTLY - fixedBottomY;
                        const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
                        const newCy = Math.round((validTLY + fixedBottomY) / 2);
                        updateCurrentTransform({ scaleY: newScaleY, y: -newCy });
                      }}
                    />
                  </div>
                </div>

                {/* TOP-RIGHT (TR) */}
                <div style={{ background: '#0e1118', padding: '6px 8px', borderRadius: 5, border: '1px solid #232836' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8', display: 'block', marginBottom: 4 }}>
                    ↗ TOP-RIGHT (TR)
                  </span>
                  <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0,  marginBottom: 4 }}>
                    <span className="form-label text-red" style={{ fontSize: 9 }}>X</span>
                    <SmartNumberInput
                      value={cx + currentHalfW}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetTRX) => {
                        const fixedLeftX = cx - currentHalfW;
                        const validTRX = Math.max(fixedLeftX, targetTRX);
                        const newWidth = validTRX - fixedLeftX;
                        const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
                        const newCx = Math.round((fixedLeftX + validTRX) / 2);
                        updateCurrentTransform({ scaleX: newScaleX, x: newCx });
                      }}
                    />
                  </div>
                  <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
                    <span className="form-label text-green" style={{ fontSize: 9 }}>Y</span>
                    <SmartNumberInput
                      value={cy + currentHalfH}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetTRY) => {
                        const fixedBottomY = cy - currentHalfH;
                        const validTRY = Math.max(fixedBottomY, targetTRY);
                        const newHeight = validTRY - fixedBottomY;
                        const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
                        const newCy = Math.round((validTRY + fixedBottomY) / 2);
                        updateCurrentTransform({ scaleY: newScaleY, y: -newCy });
                      }}
                    />
                  </div>
                </div>

                {/* BOTTOM-LEFT (BL) */}
                <div style={{ background: '#0e1118', padding: '6px 8px', borderRadius: 5, border: '1px solid #232836' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#c084fc', display: 'block', marginBottom: 4 }}>
                    ↙ BOTTOM-LEFT (BL)
                  </span>
                  <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0,  marginBottom: 4 }}>
                    <span className="form-label text-red" style={{ fontSize: 9 }}>X</span>
                    <SmartNumberInput
                      value={cx - currentHalfW}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetBLX) => {
                        const fixedRightX = cx + currentHalfW;
                        const validBLX = Math.min(fixedRightX, targetBLX);
                        const newWidth = fixedRightX - validBLX;
                        const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
                        const newCx = Math.round((validBLX + fixedRightX) / 2);
                        updateCurrentTransform({ scaleX: newScaleX, x: newCx });
                      }}
                    />
                  </div>
                  <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
                    <span className="form-label text-green" style={{ fontSize: 9 }}>Y</span>
                    <SmartNumberInput
                      value={cy - currentHalfH}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetBLY) => {
                        const fixedTopY = cy + currentHalfH;
                        const validBLY = Math.min(fixedTopY, targetBLY);
                        const newHeight = fixedTopY - validBLY;
                        const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
                        const newCy = Math.round((fixedTopY + validBLY) / 2);
                        updateCurrentTransform({ scaleY: newScaleY, y: -newCy });
                      }}
                    />
                  </div>
                </div>

                {/* BOTTOM-RIGHT (BR) */}
                <div style={{ background: '#0e1118', padding: '6px 8px', borderRadius: 5, border: '1px solid #232836' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#c084fc', display: 'block', marginBottom: 4 }}>
                    ↘ BOTTOM-RIGHT (BR)
                  </span>
                  <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0,  marginBottom: 4 }}>
                    <span className="form-label text-red" style={{ fontSize: 9 }}>X</span>
                    <SmartNumberInput
                      value={cx + currentHalfW}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetBRX) => {
                        const fixedLeftX = cx - currentHalfW;
                        const validBRX = Math.max(fixedLeftX, targetBRX);
                        const newWidth = validBRX - fixedLeftX;
                        const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
                        const newCx = Math.round((fixedLeftX + validBRX) / 2);
                        updateCurrentTransform({ scaleX: newScaleX, x: newCx });
                      }}
                    />
                  </div>
                  <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
                    <span className="form-label text-green" style={{ fontSize: 9 }}>Y</span>
                    <SmartNumberInput
                      value={cy - currentHalfH}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetBRY) => {
                        const fixedTopY = cy + currentHalfH;
                        const validBRY = Math.min(fixedTopY, targetBRY);
                        const newHeight = fixedTopY - validBRY;
                        const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
                        const newCy = Math.round((fixedTopY + validBRY) / 2);
                        updateCurrentTransform({ scaleY: newScaleY, y: -newCy });
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      </div>
    </>
  );
};
