import React from 'react';
import type { Transform } from '../../../types/animator';
import type { SceneCoordinateSystem } from '../../../types/composition';
import { formatInspectorCoordinate, toInspectorPositionDisplay } from '../../../utils/editor/coordinateDisplay';

interface CanvasCoordinateReadoutProps {
  transform: Transform;
  coordinateSystem: SceneCoordinateSystem;
}

/**
 * The selected layer's evaluated position, in the exact display convention the
 * Inspector uses. It is visual chrome only: the Inspector remains the
 * accessible authoring surface and the readout never receives pointer events.
 */
export const CanvasCoordinateReadout: React.FC<CanvasCoordinateReadoutProps> = ({
  transform,
  coordinateSystem,
}) => {
  const position = toInspectorPositionDisplay(transform, coordinateSystem);

  return (
    <div
      className="canvas-coordinate-readout"
      data-testid="coordinate-readout"
      aria-hidden="true"
    >
      <span className="canvas-coordinate-readout-axis canvas-coordinate-readout-x">
        <span className="canvas-coordinate-readout-label">X</span>
        <span className="canvas-coordinate-readout-value" data-testid="coordinate-readout-x">
          {formatInspectorCoordinate(position.x)}
        </span>
      </span>
      <span className="canvas-coordinate-readout-axis canvas-coordinate-readout-y">
        <span className="canvas-coordinate-readout-label">Y</span>
        <span className="canvas-coordinate-readout-value" data-testid="coordinate-readout-y">
          {formatInspectorCoordinate(position.y)}
        </span>
      </span>
    </div>
  );
};
