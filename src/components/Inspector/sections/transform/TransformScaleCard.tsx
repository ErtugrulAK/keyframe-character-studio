import React, { useState } from 'react';
import { Link, Unlink } from 'lucide-react';
import type { Transform } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TransformScaleCardProps {
  transform: Transform;
  onUpdate: (partial: Partial<Transform>) => void;
}

/**
 * Scale control card. The main control is a single percentage input:
 * typing 50 halves the size, 200 doubles it (uniform scale). The lock toggle
 * and the per-axis SCALE X / SCALE Y inputs remain for fine, non-uniform work.
 */
export const TransformScaleCard: React.FC<TransformScaleCardProps> = ({ transform, onUpdate }) => {
  const [isScaleLocked, setIsScaleLocked] = useState<boolean>(true);

  const avgScale = (transform.scaleX + transform.scaleY) / 2;

  return (
    <div className="panel-card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.4px' }}>
          SCALE
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

      {/* Percentage scale input: 50 = half size, 200 = double size */}
      <div className="form-field-group" style={{ background: '#0e1118', border: '1px solid #232836', padding: '8px 10px', borderRadius: 6, margin: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.4px' }}>SIZE (%)</label>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>
            {Math.round(avgScale * 100)}%
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
            <SmartNumberInput
              value={Math.round(avgScale * 100)}
              min={5}
              max={2000}
              step={1}
              precision={0}
              onChange={(val) => {
                const factor = val / 100;
                onUpdate({ scaleX: factor, scaleY: factor });
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>%</span>
          </div>
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
