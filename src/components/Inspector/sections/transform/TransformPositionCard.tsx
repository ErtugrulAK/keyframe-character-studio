import React from 'react';
import type { Transform } from '../../../../types/animator';
import type { SceneCoordinateSystem } from '../../../../types/composition';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TransformPositionCardProps {
  transform: Transform;
  coordinateSystem: SceneCoordinateSystem;
  onUpdate: (partial: Partial<Transform>) => void;
}

/**
 * R5-14 — the TRANSFORM section's Position row: the project-space X and Y
 * columns, side by side. The field reports the evaluated transform at the
 * current frame and every edit goes through the canonical transform path.
 */
export const TransformPositionCard: React.FC<TransformPositionCardProps> = ({ transform, coordinateSystem, onUpdate }) => {
  const usesRawProjectUnits = coordinateSystem === 'project-unit-center-v1';
  const positionDisplayScale = usesRawProjectUnits ? undefined : 0.01;

  return (
    <div className="transform-property-group">
      <div className="transform-property-title">Position</div>
      <div className="transform-property-row transform-position-row">
        <label className="transform-field">
          <span className="transform-field-label text-red">X</span>
          <SmartNumberInput
            value={transform.x}
            step={1}
            displayScale={positionDisplayScale}
            precision={2}
            ariaLabel="Position X"
            onChange={(val) => onUpdate({ x: val })}
          />
        </label>
        <label className="transform-field">
          <span className="transform-field-label text-green">Y</span>
          <SmartNumberInput
            value={-transform.y}
            step={1}
            displayScale={positionDisplayScale}
            precision={2}
            ariaLabel="Position Y"
            onChange={(val) => onUpdate({ y: -val })}
          />
        </label>
      </div>
    </div>
  );
};
