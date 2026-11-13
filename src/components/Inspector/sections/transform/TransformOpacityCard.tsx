import React from 'react';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TransformOpacityCardProps {
  opacity: number;
  onOpacityChange: (opacity: number) => void;
}

/**
 * Opacity as one cell of the compact transform trio. The value is
 * authored 0..1 and displayed as a percentage; edits go through the canonical
 * transform path: once the `opacity` channel carries keyframes the edit lands on
 * the current frame, otherwise it updates the layer's base transform.
 *
 * The cell holds no keyframe action: keyframing is the timeline property row's
 * authority, and Details does not duplicate it.
 *
 * Named "Layer opacity" so it reads apart from the Fill and Stroke
 * opacities in Appearance (those fade one paint; this fades the whole layer).
 */
export const TransformOpacityCard: React.FC<TransformOpacityCardProps> = ({ opacity, onOpacityChange }) => (
  <div className="transform-compact-cell">
    <div className="transform-compact-head">
      <span className="transform-property-title">Layer opacity</span>
    </div>
    <label className="transform-field">
      <span className="transform-field-label">%</span>
      <SmartNumberInput
        value={opacity}
        displayScale={100}
        min={0}
        max={1}
        step={1}
        precision={0}
        ariaLabel="Layer opacity"
        onChange={onOpacityChange}
      />
    </label>
  </div>
);
