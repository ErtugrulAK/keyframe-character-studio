import React, { useState } from 'react';
import { Activity, Compass, Zap, Plus, Link, Unlink, Maximize2 } from 'lucide-react';
import type { CharacterPart, Transform } from '../../../types/animator';

interface SmartNumberInputProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
}

const SmartNumberInput: React.FC<SmartNumberInputProps> = ({ value, min, max, step = 1, onChange }) => {
  const [editingValue, setEditingValue] = React.useState<string>(String(value));
  const [isFocused, setIsFocused] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!isFocused) {
      setEditingValue(String(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setEditingValue(valStr);
    let parsed = parseFloat(valStr);
    if (!isNaN(parsed)) {
      if (min !== undefined) parsed = Math.max(min, parsed);
      if (max !== undefined) parsed = Math.min(max, parsed);
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    let parsed = parseFloat(editingValue);
    if (isNaN(parsed)) {
      setEditingValue(String(value));
    } else {
      if (min !== undefined) parsed = Math.max(min, parsed);
      if (max !== undefined) parsed = Math.min(max, parsed);
      setEditingValue(String(parsed));
      onChange(parsed);
    }
  };

  return (
    <input
      type="number"
      value={isFocused ? editingValue : value}
      min={min}
      max={max}
      step={step}
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
  handlePartPropChange: (key: keyof CharacterPart, value: any) => void;
}

export const TransformTab: React.FC<TransformTabProps> = ({
  selectedPart,
  transform,
  currentFrame,
  addKeyframeForSelected,
  updateCurrentTransform,
  handlePartPropChange,
}) => {
  const [isScaleLocked, setIsScaleLocked] = useState<boolean>(true);
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
            onChange={(val) => updateCurrentTransform({ x: val })}
          />
        </div>

        <div className="param-row">
          <span className="param-label text-green">POS Y</span>
          <SmartNumberInput
            value={-transform.y}
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

      {/* ── PROPORTIONAL SCALE & RATIO SECTION ── */}
      <div 
        style={{ 
          marginTop: 12, 
          background: 'var(--bg-dark)', 
          border: '1px solid var(--border-color)', 
          borderRadius: 8, 
          padding: 10 
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-teal)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Maximize2 size={13} /> PROPORTIONAL SCALE & RATIO
          </span>
          <button
            type="button"
            className="btn-secondary"
            style={{ 
              fontSize: 10, 
              padding: '3px 8px', 
              color: isScaleLocked ? '#10b981' : 'var(--text-muted)', 
              background: isScaleLocked ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-input)',
              border: `1px solid ${isScaleLocked ? '#10b981' : 'var(--border-color)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
            onClick={() => setIsScaleLocked(!isScaleLocked)}
            title={isScaleLocked ? 'Aspect Ratio Locked (Uniform Scale)' : 'Aspect Ratio Unlocked (Free Scale)'}
          >
            {isScaleLocked ? <Link size={12} /> : <Unlink size={12} />}
            <span>{isScaleLocked ? 'Ratio Locked' : 'Ratio Unlocked'}</span>
          </button>
        </div>

        {/* Master Uniform Scale Control */}
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 6, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>UNIFORM SCALE MULTIPLIER</label>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-teal)' }}>
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
            style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent-teal)', marginBottom: 6 }}
          />
          {/* Quick Presets */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[0.5, 1.0, 1.5, 2.0, 5.0, 6.42].map((s) => (
              <button
                key={`scale-preset-${s}`}
                type="button"
                className="btn-secondary"
                style={{ flex: 1, fontSize: 9, padding: '3px 0', textAlign: 'center' }}
                onClick={() => updateCurrentTransform({ scaleX: s, scaleY: s })}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Scale X & Scale Y Inputs */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="input-field" style={{ flex: 1 }}>
            <label style={{ fontSize: 10 }}>SCALE X</label>
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

          <button
            type="button"
            onClick={() => setIsScaleLocked(!isScaleLocked)}
            style={{
              background: 'none',
              border: 'none',
              color: isScaleLocked ? '#10b981' : 'var(--text-muted)',
              cursor: 'pointer',
              padding: '12px 2px 0 2px',
            }}
            title={isScaleLocked ? 'Scale values linked proportionally' : 'Scale values unlinked'}
          >
            {isScaleLocked ? <Link size={14} /> : <Unlink size={14} />}
          </button>

          <div className="input-field" style={{ flex: 1 }}>
            <label style={{ fontSize: 10 }}>SCALE Y</label>
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
          style={{ flex: 1, fontSize: 11 }}
          onClick={() => updateCurrentTransform({ scaleX: 1, scaleY: 1 })}
        >
          Reset Scale (1.0)
        </button>
      </div>

      {/* RESPONSIVE ANCHOR POINT 3x3 PICKER */}
      <div className="section-title" style={{ marginTop: 12 }}>
        <Compass size={13} className="text-cyan" />
        <span>RESPONSIVE ANCHOR POINT</span>
      </div>

      <div className="input-field">
        <label>ANCHOR PRESET</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, width: '100%', margin: '4px 0' }}>
          {[
            { id: 'top-left', label: '↖ TL' },
            { id: 'top-center', label: '↑ TC' },
            { id: 'top-right', label: '↗ TR' },
            { id: 'center-left', label: '← CL' },
            { id: 'center', label: '• C' },
            { id: 'center-right', label: '→ CR' },
            { id: 'bottom-left', label: '↙ BL' },
            { id: 'bottom-center', label: '↓ BC' },
            { id: 'bottom-right', label: '↘ BR' },
          ].map((preset) => (
            <button
              key={preset.id}
              className={`btn-secondary ${selectedPart.anchor === preset.id ? 'active' : ''}`}
              style={{
                fontSize: 10,
                padding: '4px 2px',
                backgroundColor: selectedPart.anchor === preset.id ? 'var(--accent-teal)' : undefined,
                color: selectedPart.anchor === preset.id ? '#ffffff' : undefined,
              }}
              onClick={() =>
                handlePartPropChange(
                  'anchor',
                  selectedPart.anchor === preset.id ? 'none' : preset.id
                )
              }
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {selectedPart.anchor && selectedPart.anchor !== 'none' && (
        <div className="input-grid">
          <div className="input-field">
            <label>OFFSET X (PX)</label>
            <SmartNumberInput
              value={selectedPart.anchorOffsetX || 0}
              onChange={(val) => handlePartPropChange('anchorOffsetX', val)}
            />
          </div>
          <div className="input-field">
            <label>OFFSET Y (PX)</label>
            <SmartNumberInput
              value={selectedPart.anchorOffsetY || 0}
              onChange={(val) => handlePartPropChange('anchorOffsetY', val)}
            />
          </div>
        </div>
      )}

      {/* SPRING PHYSICS MODIFIER */}
      <div className="section-title" style={{ marginTop: 12 }}>
        <Zap size={13} className="text-gold" />
        <span>SPRING PHYSICS & DELAY</span>
      </div>

      <div className="input-field">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={selectedPart.springEnabled || false}
            onChange={(e) => handlePartPropChange('springEnabled', e.target.checked)}
          />
          <span>ENABLE SPRING ELASTICITY</span>
        </label>
      </div>

      {selectedPart.springEnabled && (
        <div className="input-grid">
          <div className="input-field">
            <label>STIFFNESS (10-100)</label>
            <SmartNumberInput
              value={selectedPart.springStiffness || 45}
              min={10}
              max={100}
              onChange={(val) => handlePartPropChange('springStiffness', val)}
            />
          </div>
          <div className="input-field">
            <label>DAMPING (5-50)</label>
            <SmartNumberInput
              value={selectedPart.springDamping || 18}
              min={5}
              max={50}
              onChange={(val) => handlePartPropChange('springDamping', val)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
