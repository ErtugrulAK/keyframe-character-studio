import React from 'react';
import type { Transform } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TransformPositionRotationCardProps {
  transform: Transform;
  onUpdate: (partial: Partial<Transform>) => void;
}

const sectionLabel: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: '#64748b',
  letterSpacing: '0.6px',
  marginBottom: 4,
};

/**
 * Position (X/Y) and rotation rows used inside the unified TRANSFORM card.
 */
export const TransformPositionRotationCard: React.FC<TransformPositionRotationCardProps> = ({ transform, onUpdate }) => {
  return (
    <>
      {/* Position */}
      <div>
        <div style={sectionLabel}>POSITION</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, width: "100%" }}>
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
        </div>
      </div>

      {/* Rotation */}
      <div>
        <div style={sectionLabel}>ROTATION</div>
        <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
          <span className="form-label text-blue" style={{ fontSize: 9 }}>ROT (°)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <SmartNumberInput
              value={transform.rotation}
              onChange={(val) => onUpdate({ rotation: val })}
            />
            <button
              type="button"
              className="btn-secondary"
              style={{ height: 20, fontSize: 9, padding: '0 6px', whiteSpace: 'nowrap' }}
              onClick={() => onUpdate({ rotation: 0 })}
              title="Reset rotation angle to 0°"
            >
              Reset 0°
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
