import React, { useState } from 'react';
import { Link, Maximize2, Unlink } from 'lucide-react';
import type { Transform } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TransformScaleCardProps {
  transform: Transform;
  onUpdate: (partial: Partial<Transform>) => void;
}

export const TransformScaleCard: React.FC<TransformScaleCardProps> = ({ transform, onUpdate }) => {
  const [isScaleLocked, setIsScaleLocked] = useState<boolean>(true);

  return (
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
            onClick={() => onUpdate({ scaleX: 1, scaleY: 1 })}
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
            onUpdate({ scaleX: val, scaleY: val });
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
              onClick={() => onUpdate({ scaleX: s, scaleY: s })}
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
                onUpdate({ scaleX: val, scaleY: parseFloat((val * (ratio || 1)).toFixed(3)) });
              } else {
                onUpdate({ scaleX: val });
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
                onUpdate({ scaleY: val, scaleX: parseFloat((val * (ratio || 1)).toFixed(3)) });
              } else {
                onUpdate({ scaleY: val });
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};
