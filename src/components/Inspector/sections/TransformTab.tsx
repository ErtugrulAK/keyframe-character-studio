import React, { useState } from 'react';
import { Activity, Plus, Link, Unlink, Maximize2, Move } from 'lucide-react';
import type { CharacterPart, Transform } from '../../../types/animator';

const getPartBaseBounds = (part: CharacterPart): { halfW: number; halfH: number } => {
  let halfW = 32;
  let halfH = 32;

  switch (part.type) {
    case 'custom_card': halfW = 90; halfH = 50; break;
    case 'custom_rect': halfW = 60; halfH = 30; break;
    case 'custom_banner': halfW = 80; halfH = 25; break;
    case 'custom_image':
    case 'custom_video':
      halfW = part.type === 'custom_video' ? 100 : 90;
      halfH = 60;
      break;
  }
  return { halfW, halfH };
};

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
  const decimals = precision ?? (scale !== 1 ? 2 : undefined);
  const displayVal = decimals !== undefined ? parseFloat((value * scale).toFixed(decimals)) : value * scale;

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
      let internal = parsed / scale;
      if (min !== undefined) internal = Math.max(min, internal);
      if (max !== undefined) internal = Math.min(max, internal);
      onChange(internal);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    let parsed = parseFloat(editingValue);
    if (isNaN(parsed)) {
      setEditingValue(String(displayVal));
    } else {
      let internal = parsed / scale;
      if (min !== undefined) internal = Math.max(min, internal);
      if (max !== undefined) internal = Math.min(max, internal);
      const finalDisplay = decimals !== undefined ? parseFloat((internal * scale).toFixed(decimals)) : internal * scale;
      setEditingValue(String(finalDisplay));
      onChange(internal);
    }
  };

  const displayStep = step !== undefined ? step * Math.abs(scale) : undefined;

  return (
    <input
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
  addKeyframeForSelected: () => void;
  updateCurrentTransform: (newTransform: Partial<Transform>) => void;
  handlePartPropChange?: (key: keyof CharacterPart, value: any) => void;
}

export const TransformTab: React.FC<TransformTabProps> = ({
  selectedPart,
  transform,
  currentFrame,
  addKeyframeForSelected,
  updateCurrentTransform,
}) => {
  const [isScaleLocked, setIsScaleLocked] = useState<boolean>(true);
  const [pointMode, setPointMode] = useState<'edge' | 'corner'>('edge');

  return (
    <div className="inspector-section">
      <div className="section-title-bar">
        <div className="section-title">
          <Activity size={13} />
          <span>TRANSFORM (FRAME {currentFrame})</span>
        </div>
        <button
          className="btn-secondary add-kf-prop-btn"
          onClick={addKeyframeForSelected}
          title="Add explicit keyframe at current frame for selected object"
        >
          <Plus size={12} className="text-gold" /> Keyframe
        </button>
      </div>

      <div className="transform-param-grid">
        <div className="param-row">
          <span className="param-label text-red">POS X</span>
          <SmartNumberInput
            value={transform.x}
            step={1}
            displayScale={0.01}
            precision={2}
            onChange={(val) => updateCurrentTransform({ x: val })}
          />
        </div>

        <div className="param-row">
          <span className="param-label text-green">POS Y</span>
          <SmartNumberInput
            value={-transform.y}
            step={1}
            displayScale={0.01}
            precision={2}
            onChange={(val) => updateCurrentTransform({ y: -val })}
          />
        </div>

        <div className="param-row">
          <span className="param-label text-blue">ROT (°)</span>
          <SmartNumberInput
            value={transform.rotation}
            onChange={(val) => updateCurrentTransform({ rotation: val })}
          />
        </div>

        <div className="param-row">
          <span className="param-label text-gold">OPACITY</span>
          <SmartNumberInput
            value={transform.opacity}
            min={0}
            max={1}
            step={0.1}
            onChange={(val) => updateCurrentTransform({ opacity: val })}
          />
        </div>
      </div>

      {/* ── 4 CONTROL POINTS (STAGE X & Y COORDINATES) ── */}
      {(() => {
        const { halfW: baseHalfW, halfH: baseHalfH } = getPartBaseBounds(selectedPart);
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
              /* ── 4 EDGE MIDPOINTS (SUPPORT ZERO-WIDTH / ZERO-HEIGHT COLLAPSING) ── */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {/* LEFT EDGE POINT */}
                <div style={{ background: '#0e1118', padding: '6px 8px', borderRadius: 5, border: '1px solid #232836' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8' }} /> LEFT POINT
                    </span>
                  </div>
                  <div className="param-row" style={{ marginBottom: 4 }}>
                    <span className="param-label text-red" style={{ fontSize: 9 }}>X</span>
                    <SmartNumberInput
                      value={cx - currentHalfW}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetLeftX) => {
                        const fixedRightX = cx + currentHalfW;
                        const newWidth = Math.max(0, fixedRightX - targetLeftX);
                        const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
                        const newCx = Math.round((targetLeftX + fixedRightX) / 2);
                        updateCurrentTransform({ scaleX: newScaleX, x: newCx });
                      }}
                    />
                  </div>
                  <div className="param-row">
                    <span className="param-label text-green" style={{ fontSize: 9 }}>Y</span>
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
                  <div className="param-row" style={{ marginBottom: 4 }}>
                    <span className="param-label text-red" style={{ fontSize: 9 }}>X</span>
                    <SmartNumberInput
                      value={cx + currentHalfW}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetRightX) => {
                        const fixedLeftX = cx - currentHalfW;
                        const newWidth = Math.max(0, targetRightX - fixedLeftX);
                        const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
                        const newCx = Math.round((fixedLeftX + targetRightX) / 2);
                        updateCurrentTransform({ scaleX: newScaleX, x: newCx });
                      }}
                    />
                  </div>
                  <div className="param-row">
                    <span className="param-label text-green" style={{ fontSize: 9 }}>Y</span>
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
                  <div className="param-row" style={{ marginBottom: 4 }}>
                    <span className="param-label text-red" style={{ fontSize: 9 }}>X</span>
                    <SmartNumberInput
                      value={cx}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetX) => updateCurrentTransform({ x: targetX })}
                    />
                  </div>
                  <div className="param-row">
                    <span className="param-label text-green" style={{ fontSize: 9 }}>Y</span>
                    <SmartNumberInput
                      value={cy + currentHalfH}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetTopY) => {
                        const fixedBottomY = cy - currentHalfH;
                        const newHeight = Math.max(0, targetTopY - fixedBottomY);
                        const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
                        const newCy = Math.round((targetTopY + fixedBottomY) / 2);
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
                  <div className="param-row" style={{ marginBottom: 4 }}>
                    <span className="param-label text-red" style={{ fontSize: 9 }}>X</span>
                    <SmartNumberInput
                      value={cx}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetX) => updateCurrentTransform({ x: targetX })}
                    />
                  </div>
                  <div className="param-row">
                    <span className="param-label text-green" style={{ fontSize: 9 }}>Y</span>
                    <SmartNumberInput
                      value={cy - currentHalfH}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetBottomY) => {
                        const fixedTopY = cy + currentHalfH;
                        const newHeight = Math.max(0, fixedTopY - targetBottomY);
                        const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
                        const newCy = Math.round((fixedTopY + targetBottomY) / 2);
                        updateCurrentTransform({ scaleY: newScaleY, y: -newCy });
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* ── 4 CORNER POINTS (TL, TR, BR, BL) (SUPPORT ZERO COLLAPSING) ── */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {/* TOP-LEFT (TL) */}
                <div style={{ background: '#0e1118', padding: '6px 8px', borderRadius: 5, border: '1px solid #232836' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8', display: 'block', marginBottom: 4 }}>
                    ↖ TOP-LEFT (TL)
                  </span>
                  <div className="param-row" style={{ marginBottom: 4 }}>
                    <span className="param-label text-red" style={{ fontSize: 9 }}>X</span>
                    <SmartNumberInput
                      value={cx - currentHalfW}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetTLX) => {
                        const fixedRightX = cx + currentHalfW;
                        const newWidth = Math.max(0, fixedRightX - targetTLX);
                        const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
                        const newCx = Math.round((targetTLX + fixedRightX) / 2);
                        updateCurrentTransform({ scaleX: newScaleX, x: newCx });
                      }}
                    />
                  </div>
                  <div className="param-row">
                    <span className="param-label text-green" style={{ fontSize: 9 }}>Y</span>
                    <SmartNumberInput
                      value={cy + currentHalfH}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetTLY) => {
                        const fixedBottomY = cy - currentHalfH;
                        const newHeight = Math.max(0, targetTLY - fixedBottomY);
                        const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
                        const newCy = Math.round((targetTLY + fixedBottomY) / 2);
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
                  <div className="param-row" style={{ marginBottom: 4 }}>
                    <span className="param-label text-red" style={{ fontSize: 9 }}>X</span>
                    <SmartNumberInput
                      value={cx + currentHalfW}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetTRX) => {
                        const fixedLeftX = cx - currentHalfW;
                        const newWidth = Math.max(0, targetTRX - fixedLeftX);
                        const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
                        const newCx = Math.round((fixedLeftX + targetTRX) / 2);
                        updateCurrentTransform({ scaleX: newScaleX, x: newCx });
                      }}
                    />
                  </div>
                  <div className="param-row">
                    <span className="param-label text-green" style={{ fontSize: 9 }}>Y</span>
                    <SmartNumberInput
                      value={cy + currentHalfH}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetTRY) => {
                        const fixedBottomY = cy - currentHalfH;
                        const newHeight = Math.max(0, targetTRY - fixedBottomY);
                        const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
                        const newCy = Math.round((targetTRY + fixedBottomY) / 2);
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
                  <div className="param-row" style={{ marginBottom: 4 }}>
                    <span className="param-label text-red" style={{ fontSize: 9 }}>X</span>
                    <SmartNumberInput
                      value={cx - currentHalfW}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetBLX) => {
                        const fixedRightX = cx + currentHalfW;
                        const newWidth = Math.max(0, fixedRightX - targetBLX);
                        const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
                        const newCx = Math.round((targetBLX + fixedRightX) / 2);
                        updateCurrentTransform({ scaleX: newScaleX, x: newCx });
                      }}
                    />
                  </div>
                  <div className="param-row">
                    <span className="param-label text-green" style={{ fontSize: 9 }}>Y</span>
                    <SmartNumberInput
                      value={cy - currentHalfH}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetBLY) => {
                        const fixedTopY = cy + currentHalfH;
                        const newHeight = Math.max(0, fixedTopY - targetBLY);
                        const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
                        const newCy = Math.round((fixedTopY + targetBLY) / 2);
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
                  <div className="param-row" style={{ marginBottom: 4 }}>
                    <span className="param-label text-red" style={{ fontSize: 9 }}>X</span>
                    <SmartNumberInput
                      value={cx + currentHalfW}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetBRX) => {
                        const fixedLeftX = cx - currentHalfW;
                        const newWidth = Math.max(0, targetBRX - fixedLeftX);
                        const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
                        const newCx = Math.round((fixedLeftX + targetBRX) / 2);
                        updateCurrentTransform({ scaleX: newScaleX, x: newCx });
                      }}
                    />
                  </div>
                  <div className="param-row">
                    <span className="param-label text-green" style={{ fontSize: 9 }}>Y</span>
                    <SmartNumberInput
                      value={cy - currentHalfH}
                      step={1}
                      displayScale={0.01}
                      precision={2}
                      onChange={(targetBRY) => {
                        const fixedTopY = cy + currentHalfH;
                        const newHeight = Math.max(0, fixedTopY - targetBRY);
                        const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
                        const newCy = Math.round((fixedTopY + targetBRY) / 2);
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

      {/* ── PROPORTIONAL SCALE & RATIO SECTION ── */}
      <div className="panel-card" style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.4px' }}>
            <Maximize2 size={13} /> PROPORTIONAL SCALE & RATIO
          </span>
          <button
            type="button"
            className="btn-secondary"
            style={{ 
              height: 22,
              fontSize: 10, 
              padding: '0 8px', 
              color: isScaleLocked ? '#10b981' : '#64748b', 
              background: isScaleLocked ? 'rgba(16, 185, 129, 0.12)' : '#101218',
              border: `1px solid ${isScaleLocked ? 'rgba(16, 185, 129, 0.4)' : '#232836'}`,
              borderRadius: 4,
            }}
            onClick={() => setIsScaleLocked(!isScaleLocked)}
            title={isScaleLocked ? 'Aspect Ratio Locked (Uniform Scale)' : 'Aspect Ratio Unlocked (Free Scale)'}
          >
            {isScaleLocked ? <Link size={11} /> : <Unlink size={11} />}
            <span>{isScaleLocked ? 'Ratio Locked' : 'Ratio Unlocked'}</span>
          </button>
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
        <div className="transform-param-grid">
          <div className="param-row">
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

          <div className="param-row">
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

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button
          className="btn-secondary"
          style={{ flex: 1, fontSize: 11 }}
          onClick={() => updateCurrentTransform({ rotation: 0 })}
        >
          Reset Rotation (0°)
        </button>
        <button
          className="btn-secondary"
          style={{ flex: 1 }}
          onClick={() => updateCurrentTransform({ scaleX: 1, scaleY: 1 })}
        >
          Reset Scale (1.0)
        </button>
      </div>

    </div>
  );
};
