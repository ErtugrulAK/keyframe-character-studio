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
 * Scale row used inside the unified TRANSFORM card: a single percentage
 * input (50 = half size, 200 = double size) with the aspect-lock toggle.
 * The lock is shared with the canvas corner-drag scaling.
 */
export const TransformScaleCard: React.FC<TransformScaleCardProps> = ({ transform, onUpdate }) => {
  const { isScaleLocked, setIsScaleLocked } = useAnimator();

  const avgScale = (transform.scaleX + transform.scaleY) / 2;

  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: '0.6px', marginBottom: 4 }}>SCALE</div>
      <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
        <span className="form-label text-blue" style={{ fontSize: 9 }}>SIZE (%)</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
              whiteSpace: 'nowrap',
            }}
            onClick={() => setIsScaleLocked(!isScaleLocked)}
            title={isScaleLocked ? 'Aspect Ratio Locked (Uniform Scale)' : 'Aspect Ratio Unlocked (Free Scale)'}
          >
            {isScaleLocked ? <Link size={10} /> : <Unlink size={10} />}
            <span>{isScaleLocked ? 'Locked' : 'Free'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
