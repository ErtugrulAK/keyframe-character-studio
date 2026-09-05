import React from 'react';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TransformOpacityCardProps {
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  keyframedAtCurrentFrame: boolean;
  onToggleKeyframe?: () => void;
}

/**
 * Layer opacity row used inside the unified TRANSFORM section. The value is
 * authored 0..1 and displayed as a percentage. Edits go through the canonical
 * transform path: once the `opacity` channel carries keyframes the edit lands
 * on the current frame, otherwise it updates the layer's base transform.
 */
export const TransformOpacityCard: React.FC<TransformOpacityCardProps> = ({
  opacity,
  onOpacityChange,
  keyframedAtCurrentFrame,
  onToggleKeyframe,
}) => {
  return (
    <div className="transform-property-group">
      <div className="transform-property-title">Opacity</div>
      <div className="transform-property-row">
        <label className="transform-field transform-field-grow">
          <span className="transform-field-label">%</span>
          <SmartNumberInput
            value={opacity}
            displayScale={100}
            min={0}
            max={1}
            step={1}
            precision={0}
            ariaLabel="Opacity"
            onChange={onOpacityChange}
          />
        </label>
        {onToggleKeyframe && (
          <button
            type="button"
            className={`btn-secondary transform-compact-action transform-keyframe-action${keyframedAtCurrentFrame ? ' is-active' : ''}`}
            aria-pressed={keyframedAtCurrentFrame}
            aria-label={keyframedAtCurrentFrame ? 'Remove Opacity Keyframe' : 'Add Opacity Keyframe'}
            title={
              keyframedAtCurrentFrame
                ? 'Remove the opacity keyframe at the current frame'
                : 'Add an opacity keyframe at the current frame'
            }
            onClick={onToggleKeyframe}
          >
            {keyframedAtCurrentFrame ? 'Remove Keyframe' : 'Add Keyframe'}
          </button>
        )}
      </div>
    </div>
  );
};
