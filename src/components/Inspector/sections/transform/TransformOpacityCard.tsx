import React from 'react';
import type { Transform } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TransformOpacityCardProps {
  transform: Transform;
  onUpdate: (partial: Partial<Transform>) => void;
}

/**
 * Opacity row used inside the unified TRANSFORM card: a single percentage
 * input (0-100). Values above 100 are clamped to 100 immediately.
 */
export const TransformOpacityCard: React.FC<TransformOpacityCardProps> = ({ transform, onUpdate }) => {
  return (
    <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
      <span className="form-label text-gold" style={{ fontSize: 9 }}>OPACITY (%)</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <SmartNumberInput
          value={Math.round((transform.opacity ?? 1) * 100)}
          min={0}
          max={100}
          step={1}
          precision={0}
          onChange={(val) => onUpdate({ opacity: val / 100 })}
        />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>%</span>
      </div>
    </div>
  );
};
