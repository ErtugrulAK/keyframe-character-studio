import React from 'react';

interface TransformZIndexCardProps {
  zIndex: number;
  onZIndexChange: (zIndex: number) => void;
}

/**
 * Layer stacking order controls. The value and actions remain on the
 * existing z-index callback path; only their presentation is compacted into
 * the unified Transform section.
 */
export const TransformZIndexCard: React.FC<TransformZIndexCardProps> = ({ zIndex, onZIndexChange }) => {
  return (
    <div className="transform-property-group transform-layer-group">
      <div className="transform-property-title">Layer</div>
      <div className="transform-property-row transform-layer-row">
        <span className="transform-layer-value" aria-label="Layer index">Index {zIndex}</span>
        <div className="transform-layer-actions">
          <button
            type="button"
            className="btn-secondary transform-compact-action"
            onClick={() => onZIndexChange(zIndex + 1)}
            title="Bring layer forward by one"
          >
            Bring Forward (+1)
          </button>
          <button
            type="button"
            className="btn-secondary transform-compact-action"
            onClick={() => onZIndexChange(Math.max(1, zIndex - 1))}
            title="Send layer backward by one"
          >
            Send Backward (-1)
          </button>
        </div>
      </div>
    </div>
  );
};
