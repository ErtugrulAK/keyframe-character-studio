import React from 'react';
import { Link, Unlink } from 'lucide-react';
import type { Transform } from '../../../../types/animator';
import { useAnimator } from '../../../../context/AnimatorContext';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TransformScaleCardProps {
  transform: Transform;
  onUpdate: (partial: Partial<Transform>) => void;
}

/**
 * Compact scale control in the same format as the opacity card: a single
 * percentage input (50 = half size, 200 = double size). The lock toggle is
 * shared with the canvas corner-drag scaling.
 */
export const TransformScaleCard: React.FC<TransformScaleCardProps> = ({ transform, onUpdate }) => {
  const { isScaleLocked, setIsScaleLocked } = useAnimator();

  const avgScale = (transform.scaleX + transform.scaleY) / 2;

  return (
    <div className="panel-card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.4px' }}>
          SCALE
        </span>
        <button
          type="button"
          className="btn-secondary"
          style={{
            height: 20,
            fontSize: 9,
            padding: '0 6px',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
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

      {/* Percentage scale input: 50 = half size, 200 = double size */}
      <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
        <span className="param-label">SIZE (%)</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
  );
};
