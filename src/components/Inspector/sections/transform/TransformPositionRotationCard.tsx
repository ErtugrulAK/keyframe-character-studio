import React from 'react';
import type { Transform } from '../../../../types/animator';
import type { SceneCoordinateSystem } from '../../../../types/composition';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TransformPositionRotationCardProps {
  transform: Transform;
  coordinateSystem: SceneCoordinateSystem;
  onUpdate: (partial: Partial<Transform>) => void;
}

/**
 * Position (X/Y) and rotation rows used inside the unified TRANSFORM section.
 */
export const TransformPositionRotationCard: React.FC<TransformPositionRotationCardProps> = ({ transform, coordinateSystem, onUpdate }) => {
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

      <div className="transform-property-title">Rotation</div>
      <div className="transform-property-row">
        <label className="transform-field transform-field-grow">
          <span className="transform-field-label text-blue">°</span>
          <SmartNumberInput
            value={transform.rotation}
            ariaLabel="Rotation"
            onChange={(val) => onUpdate({ rotation: val })}
          />
        </label>
        <button
          type="button"
          className="btn-secondary transform-compact-action"
          onClick={() => onUpdate({ rotation: 0 })}
          title="Reset rotation angle to 0°"
        >
          Reset 0°
        </button>
      </div>
    </div>
  );
};
