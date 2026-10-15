import React from 'react';
import { Link, Unlink } from 'lucide-react';
import type { Transform } from '../../../../types/animator';
import { useAnimator } from '../../../../context/useAnimator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TransformScaleCardProps {
  transform: Transform;
  onUpdate: (partial: Partial<Transform>) => void;
}

/**
 * R5-14 — Scale as one cell of the compact transform trio: a single percentage
 * input (50 = half size, 200 = double size) that writes `scaleX` and `scaleY`
 * together, exactly as this control has always done — the two channels stay
 * independent in the model, and the aspect lock below is what governs a uniform
 * canvas corner drag.
 *
 * The labelled "Locked"/"Free" button is gone from the row; the capability stays
 * as one compact glyph in the cell's header, because removing it outright would
 * make a free (non-uniform) corner drag unreachable.
 */
export const TransformScaleCard: React.FC<TransformScaleCardProps> = ({ transform, onUpdate }) => {
  const { isScaleLocked, setIsScaleLocked } = useAnimator();
  const avgScale = (Math.abs(transform.scaleX) + Math.abs(transform.scaleY)) / 2;

  return (
    <div className="transform-compact-cell">
      <div className="transform-compact-head">
        <span className="transform-property-title">Scale</span>
        <button
          type="button"
          className={`transform-scale-lock${isScaleLocked ? ' is-locked' : ''}`}
          aria-pressed={isScaleLocked}
          aria-label="Lock aspect ratio"
          title={isScaleLocked
            ? 'Aspect ratio locked: the canvas corner drag keeps the shape uniform (hold Shift to unlock for one drag)'
            : 'Aspect ratio free: the canvas corner drag scales X and Y independently (hold Shift to keep the shape uniform for one drag)'}
          onClick={() => setIsScaleLocked(!isScaleLocked)}
        >
          {isScaleLocked ? <Link size={11} aria-hidden="true" /> : <Unlink size={11} aria-hidden="true" />}
        </button>
      </div>
      <label className="transform-field">
        <span className="transform-field-label text-blue">%</span>
        <SmartNumberInput
          value={Math.round(avgScale * 100)}
          min={5}
          max={2000}
          step={1}
          precision={0}
          ariaLabel="Scale"
          onChange={(val) => {
            const factor = val / 100;
            onUpdate({ scaleX: factor, scaleY: factor });
          }}
        />
      </label>
    </div>
  );
};
