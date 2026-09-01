import React from 'react';
import { Link, Unlink } from 'lucide-react';
import type { Transform } from '../../../../types/animator';
import { useAnimator } from '../../../../context/AnimatorContext';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TransformScaleCardProps {
  transform: Transform;
  onUpdate: (partial: Partial<Transform>) => void;
}

/**
 * Scale row used inside the unified TRANSFORM section: a single percentage
 * input (50 = half size, 200 = double size) with the aspect-lock toggle.
 * The lock is shared with the canvas corner-drag scaling.
 */
export const TransformScaleCard: React.FC<TransformScaleCardProps> = ({ transform, onUpdate }) => {
  const { isScaleLocked, setIsScaleLocked } = useAnimator();
  const avgScale = (Math.abs(transform.scaleX) + Math.abs(transform.scaleY)) / 2;

  return (
    <div className="transform-property-group">
      <div className="transform-property-title">Scale</div>
      <div className="transform-property-row">
        <label className="transform-field transform-field-grow">
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
        <button
          type="button"
          className={`btn-secondary transform-compact-action transform-scale-lock ${isScaleLocked ? 'is-locked' : ''}`}
          onClick={() => setIsScaleLocked(!isScaleLocked)}
          title={isScaleLocked ? 'Aspect Ratio Locked (Uniform Scale)' : 'Aspect Ratio Unlocked (Free Scale)'}
        >
          {isScaleLocked ? <Link size={10} /> : <Unlink size={10} />}
          <span>{isScaleLocked ? 'Locked' : 'Free'}</span>
        </button>
      </div>
    </div>
  );
};
