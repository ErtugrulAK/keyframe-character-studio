import React from 'react';
import type { Transform } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TransformRotationCardProps {
  transform: Transform;
  onUpdate: (partial: Partial<Transform>) => void;
}

/**
 * R5-14 — Rotation as one cell of the compact transform trio. The labelled
 * "Reset 0°" action is gone: it was a second control writing the same field the
 * input already writes.
 */
export const TransformRotationCard: React.FC<TransformRotationCardProps> = ({ transform, onUpdate }) => (
  <div className="transform-compact-cell">
    <div className="transform-compact-head">
      <span className="transform-property-title">Rotation</span>
    </div>
    <label className="transform-field">
      <span className="transform-field-label text-blue">°</span>
      <SmartNumberInput
        value={transform.rotation}
        ariaLabel="Rotation"
        onChange={(val) => onUpdate({ rotation: val })}
      />
    </label>
  </div>
);
