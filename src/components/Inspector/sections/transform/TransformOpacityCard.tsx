import React from 'react';
import type { Transform } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TransformOpacityCardProps {
  transform: Transform;
  onUpdate: (partial: Partial<Transform>) => void;
}

/**
 * Compact opacity control in the same format as the scale card: a single
 * percentage input (0-100). Values above 100 are clamped to 100 immediately.
 */
export const TransformOpacityCard: React.FC<TransformOpacityCardProps> = ({ transform, onUpdate }) => {
  return (
    <div className="panel-card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.4px' }}>
          OPACITY
        </span>
      </div>

      <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
        <span className="param-label" style={{ color: '#f59e0b' }}>OPACITY (%)</span>
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
    </div>
  );
};
