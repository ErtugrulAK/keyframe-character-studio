import React from 'react';
import type { CharacterPart, FreeformPoint, Transform } from '../../../../types/animator';
import type { SceneCoordinateSystem } from '../../../../types/composition';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { StyleCard } from '../style/StyleCard';
import { freeformVertexToDisplay, freeformVertexToLocal } from '../../../../utils/freeform';

interface TransformVertexEditorProps {
  selectedPart: CharacterPart;
  transform: Transform;
  coordinateSystem: SceneCoordinateSystem;
  onPartPropChange: (key: keyof CharacterPart, value: unknown) => void;
}

const VERTEX_COLORS = ['#38bdf8', '#10b981', '#f59e0b', '#c084fc', '#f43f5e', '#22d3ee', '#a3e635', '#fb7185'];

/** Per-vertex coordinate editor for freeform shapes. */
export const TransformVertexEditor: React.FC<TransformVertexEditorProps> = ({ selectedPart, transform, coordinateSystem, onPartPropChange }) => {
  const points = selectedPart.points || [];
  if (points.length === 0) return null;
  const positionDisplayScale = coordinateSystem === 'legacy-unknown' || coordinateSystem === 'legacy-centi-unit' ? 0.01 : undefined;
  const updateVertex = (index: number, patch: Partial<FreeformPoint>) => {
    onPartPropChange('points', points.map((point, i) => (i === index ? { ...point, ...patch } : point)));
  };

  return (
    <StyleCard title={`FREE DRAW VERTICES (${points.length})`} collapsible defaultOpen={false}>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>
        Same coordinates as POS X / POS Y (canvas center = 0). Numbered markers on the canvas show which vertex is which.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
        {points.map((point, index) => {
          const color = VERTEX_COLORS[index % VERTEX_COLORS.length];
          const display = freeformVertexToDisplay(point, transform);
          return (
            <div key={index} className="form-field-group" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', justifyContent: 'space-between', margin: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color, width: 54, flexShrink: 0 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />#{index + 1}
              </span>
              <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}>
                  <span className="form-label text-red" style={{ fontSize: 9 }}>X</span>
                  <SmartNumberInput value={display.x} step={1} displayScale={positionDisplayScale} precision={2} onChange={(value) => updateVertex(index, { x: freeformVertexToLocal(value, display.y, transform).x })} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}>
                  <span className="form-label text-green" style={{ fontSize: 9 }}>Y</span>
                  <SmartNumberInput value={display.y} step={1} displayScale={positionDisplayScale} precision={2} onChange={(value) => updateVertex(index, { y: freeformVertexToLocal(display.x, value, transform).y })} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </StyleCard>
  );
};
