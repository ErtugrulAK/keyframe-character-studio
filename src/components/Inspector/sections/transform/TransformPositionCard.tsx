import React from 'react';
import type { Transform } from '../../../../types/animator';
import type { SceneCoordinateSystem } from '../../../../types/composition';
import { getPositionDisplayScale } from '../../../../utils/editor/coordinateDisplay';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TransformPositionCardProps {
  transform: Transform;
  coordinateSystem: SceneCoordinateSystem;
  onUpdate: (partial: Partial<Transform>) => void;
}

/**
 * The TRANSFORM section's Position row: the project-space X and Y
 * columns, side by side. The field reports the evaluated transform at the
 * current frame and every edit goes through the canonical transform path.
 */
export const TransformPositionCard: React.FC<TransformPositionCardProps> = ({ transform, coordinateSystem, onUpdate }) => {
  const positionDisplayScale = getPositionDisplayScale(coordinateSystem);

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
