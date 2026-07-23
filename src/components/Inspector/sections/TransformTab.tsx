import React from 'react';
import { Activity, Compass, Zap, Plus } from 'lucide-react';
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

      <div className="input-grid">
        <div className="input-field">
          <label>POSITION X</label>
          <SmartNumberInput
            value={transform.x}
            onChange={(val) => updateCurrentTransform({ x: val })}
          />
        </div>

        <div className="input-field">
          <label>POSITION Y ↑+</label>
          <SmartNumberInput
            value={-transform.y}
            onChange={(val) => updateCurrentTransform({ y: -val })}
          />
        </div>

        <div className="input-field">
          <label>ROTATION (°)</label>
          <SmartNumberInput
            value={transform.rotation}
            onChange={(val) => updateCurrentTransform({ rotation: val })}
          />
        </div>

        <div className="input-field">
          <label>OPACITY (0-1)</label>
          <SmartNumberInput
            value={transform.opacity}
            min={0}
            max={1}
            step={0.1}
            onChange={(val) => updateCurrentTransform({ opacity: val })}
          />
        </div>

        <div className="input-field">
          <label style={{ color: 'var(--accent-teal)' }}>APPEAR AT (FRAME)</label>
          <SmartNumberInput
            value={selectedPart.visibleStartFrame ?? 0}
            min={0}
            max={1200}
            onChange={(val) => handlePartPropChange('visibleStartFrame', val <= 0 ? undefined : val)}
          />
        </div>

        <div className="input-field">
          <label style={{ color: 'var(--accent-red, #ef4444)' }}>DISAPPEAR AT (FRAME)</label>
          <SmartNumberInput
            value={selectedPart.visibleEndFrame ?? 0}
            min={0}
            max={1200}
            onChange={(val) => handlePartPropChange('visibleEndFrame', val <= 0 ? undefined : val)}
          />
        </div>

        <div className="input-field">
          <label>SCALE X</label>
          <SmartNumberInput
            value={transform.scaleX}
            step={0.1}
            onChange={(val) => updateCurrentTransform({ scaleX: val })}
          />
        </div>

        <div className="input-field">
          <label>SCALE Y</label>
          <SmartNumberInput
            value={transform.scaleY}
            step={0.1}
            onChange={(val) => updateCurrentTransform({ scaleY: val })}
          />
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
