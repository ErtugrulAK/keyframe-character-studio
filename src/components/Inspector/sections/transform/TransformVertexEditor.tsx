import React from 'react';
import { PenTool } from 'lucide-react';
import type { CharacterPart, FreeformPoint, Transform } from '../../../../types/animator';
import type { SceneCoordinateSystem } from '../../../../types/composition';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { freeformVertexToDisplay, freeformVertexToLocal } from '../../../../utils/freeform';

interface TransformVertexEditorProps {
  selectedPart: CharacterPart;
  transform: Transform;
  coordinateSystem: SceneCoordinateSystem;
  onPartPropChange: (key: keyof CharacterPart, value: any) => void;
}

const VERTEX_COLORS = ['#38bdf8', '#10b981', '#f59e0b', '#c084fc', '#f43f5e', '#22d3ee', '#a3e635', '#fb7185'];

/**
 * Per-vertex coordinate editor for freeform shapes.
 *
 * Displays vertex positions in the same space as the POS X / POS Y fields
 * (canvas-center-relative, Y-up): X = worldX - canvasCenterX, Y = -(worldY -
 * canvasCenterY). Editing converts back into local (center-relative, Y-down)
 * points that the renderer and the canvas markers consume, so typing 0 into
 * X puts the vertex exactly on the canvas center line.
 */
export const TransformVertexEditor: React.FC<TransformVertexEditorProps> = ({ selectedPart, transform, coordinateSystem, onPartPropChange }) => {
  const points = selectedPart.points || [];
  if (points.length === 0) return null;
  const positionDisplayScale = coordinateSystem === 'legacy-unknown' || coordinateSystem === 'legacy-centi-unit' ? 0.01 : undefined;

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
        Same coordinates as POS X / POS Y (canvas center = 0). Numbered markers on the canvas show which vertex is which.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
        {points.map((p, i) => {
          const color = VERTEX_COLORS[i % VERTEX_COLORS.length];
          const disp = freeformVertexToDisplay(p, transform);
          return (
            <div key={i} className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color, width: 54, flexShrink: 0 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />#{i + 1}
              </span>
              <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}>
                  <span className="form-label text-red" style={{ fontSize: 9 }}>X</span>
                  <SmartNumberInput
                    value={disp.x}
                    step={1}
                    displayScale={positionDisplayScale}
                    precision={2}
                    onChange={(val) => updateVertex(i, { x: freeformVertexToLocal(val, disp.y, transform).x })}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}>
                  <span className="form-label text-green" style={{ fontSize: 9 }}>Y</span>
                  <SmartNumberInput
                    value={disp.y}
                    step={1}
                    displayScale={positionDisplayScale}
                    precision={2}
                    onChange={(val) => updateVertex(i, { y: freeformVertexToLocal(disp.x, val, transform).y })}
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
