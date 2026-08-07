import React from 'react';
import { Activity } from 'lucide-react';
import type { Transform } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TransformPositionRotationCardProps {
  transform: Transform;
  onUpdate: (partial: Partial<Transform>) => void;
}

export const TransformPositionRotationCard: React.FC<TransformPositionRotationCardProps> = ({ transform, onUpdate }) => {
  return (
    <div className="panel-card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.4px' }}>
          <Activity size={13} /> POSITION & ROTATION
        </span>
        <button
          type="button"
          className="btn-secondary"
          style={{ height: 20, fontSize: 9, padding: '0 6px' }}
          onClick={() => onUpdate({ rotation: 0 })}
          title="Reset rotation angle to 0°"
        >
          Reset Rot (0°)
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, width: "100%" }}>
        <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 6px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
          <span className="form-label text-red" style={{ fontSize: 9 }}>POS X</span>
          <SmartNumberInput
            value={transform.x}
            step={1}
            displayScale={0.01}
            precision={2}
            onChange={(val) => onUpdate({ x: val })}
          />
        </div>

        <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 6px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
          <span className="form-label text-green" style={{ fontSize: 9 }}>POS Y</span>
          <SmartNumberInput
            value={-transform.y}
            step={1}
            displayScale={0.01}
            precision={2}
            onChange={(val) => onUpdate({ y: -val })}
          />
        </div>

        <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 6px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
          <span className="form-label text-blue" style={{ fontSize: 9 }}>ROT (°)</span>
          <SmartNumberInput
            value={transform.rotation}
            onChange={(val) => onUpdate({ rotation: val })}
          />
        </div>
      </div>
    </div>
  );
};
