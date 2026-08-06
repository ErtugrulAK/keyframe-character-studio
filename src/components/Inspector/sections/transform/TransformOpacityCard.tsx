import React from 'react';
import { Sun } from 'lucide-react';
import type { Transform } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TransformOpacityCardProps {
  transform: Transform;
  onUpdate: (partial: Partial<Transform>) => void;
}

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

      <div style={{ background: '#0e1118', padding: '8px 10px', borderRadius: 6, border: '1px solid #232836', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', boxSizing: 'border-box', width: '100%' }}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={transform.opacity}
            onChange={(e) => onUpdate({ opacity: parseFloat(e.target.value) })}
            style={{ flex: 1, minWidth: 0, cursor: 'pointer', accentColor: '#f59e0b' }}
          />
          <div style={{ width: 60, minWidth: 60, flexShrink: 0 }}>
            <SmartNumberInput
              value={transform.opacity}
              min={0}
              max={1}
              step={0.05}
              onChange={(val) => onUpdate({ opacity: val })}
            />
          </div>
        </div>

        {/* Quick Presets */}
        <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
          {[0, 0.25, 0.50, 0.75, 1.0].map((op) => (
            <button
              key={`op-preset-${op}`}
              type="button"
              className="btn-secondary"
              style={{
                flex: 1,
                height: 24,
                fontSize: 'var(--font-size-caption)',
                fontWeight: 700,
                padding: 0,
                textAlign: 'center',
                borderRadius: 'var(--radius-xs)',
                boxSizing: 'border-box',
                color: Math.abs(transform.opacity - op) < 0.02 ? '#f59e0b' : undefined,
                borderColor: Math.abs(transform.opacity - op) < 0.02 ? 'rgba(245, 158, 11, 0.5)' : undefined,
                background: Math.abs(transform.opacity - op) < 0.02 ? 'rgba(245, 158, 11, 0.12)' : undefined,
              }}
              onClick={() => onUpdate({ opacity: op })}
            >
              {Math.round(op * 100)}%
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
