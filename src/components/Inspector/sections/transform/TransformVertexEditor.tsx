import React from 'react';
import { PenTool } from 'lucide-react';
import type { CharacterPart, FreeformPoint } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TransformVertexEditorProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: any) => void;
}

/** Colors cycling for the vertex markers, matching the canvas markers. */
const VERTEX_COLORS = ['#38bdf8', '#10b981', '#f59e0b', '#c084fc', '#f43f5e', '#22d3ee', '#a3e635', '#fb7185'];

/**
 * Editable coordinate list for freeform shape vertices. Only rendered when a
 * freeform (Free Draw) part is selected. Numbered rows match the numbered
 * markers drawn on the canvas so each corner is identifiable.
 */
export const TransformVertexEditor: React.FC<TransformVertexEditorProps> = ({ selectedPart, onPartPropChange }) => {
  const points = selectedPart.points || [];
  if (points.length === 0) return null;

  const updateVertex = (index: number, patch: Partial<FreeformPoint>) => {
    const next = points.map((p, i) => (i === index ? { ...p, ...patch } : p));
    onPartPropChange('points', next);
  };

  return (
    <div className="panel-card" style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.4px' }}>
          <PenTool size={13} /> FREE DRAW VERTICES ({points.length})
        </span>
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>
        Coordinates relative to the shape center. The numbered dots on the canvas show which vertex is which.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
        {points.map((p, i) => {
          const color = VERTEX_COLORS[i % VERTEX_COLORS.length];
          return (
            <div
              key={`vertex-${i}`}
              className="form-field-group"
              style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', justifyContent: 'space-between', margin: 0 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color, width: 54, flexShrink: 0 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />#{i + 1}
              </span>
              <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}>
                  <span className="form-label text-red" style={{ fontSize: 9 }}>X</span>
                  <SmartNumberInput
                    value={p.x}
                    step={1}
                    precision={1}
                    onChange={(val) => updateVertex(i, { x: val })}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}>
                  <span className="form-label text-green" style={{ fontSize: 9 }}>Y</span>
                  <SmartNumberInput
                    value={p.y}
                    step={1}
                    precision={1}
                    onChange={(val) => updateVertex(i, { y: val })}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
