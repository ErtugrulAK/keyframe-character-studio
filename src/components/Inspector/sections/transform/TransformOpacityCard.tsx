import React from 'react';
import { Sun } from 'lucide-react';
import type { Transform } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TransformOpacityCardProps {
  transform: Transform;
  onUpdate: (partial: Partial<Transform>) => void;
}

/**
 * Compact opacity control (same style as the rotation input): a single small
 * number input with a 0-1 range. Values above 1 are clamped to 1 immediately,
 * values below 0 to 0.
 */
export const TransformOpacityCard: React.FC<TransformOpacityCardProps> = ({ transform, onUpdate }) => {
  return (
    <div className="panel-card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.4px' }}>
          <Sun size={13} /> OPACITY & TRANSPARENCY
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.12)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
          {Math.round(transform.opacity * 100)}%
        </span>
      </div>

      <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
        <span className="form-label text-gold" style={{ fontSize: 9 }}>OPACITY (0-1)</span>
        <SmartNumberInput
          value={transform.opacity}
          min={0}
          max={1}
          step={0.01}
          precision={2}
          onChange={(val) => onUpdate({ opacity: val })}
        />
      </div>
    </div>
  );
};
