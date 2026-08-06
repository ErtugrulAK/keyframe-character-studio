import React from 'react';
import type { CharacterPart, Transform } from '../../../types/animator';
import { TransformAlignmentBar } from './transform/TransformAlignmentBar';
import { TransformPositionRotationCard } from './transform/TransformPositionRotationCard';
import { TransformScaleCard } from './transform/TransformScaleCard';
import { TransformOpacityCard } from './transform/TransformOpacityCard';
import { TransformZIndexCard } from './transform/TransformZIndexCard';
import { TransformControlPoints } from './transform/TransformControlPoints';

interface TransformTabProps {
  selectedPart: CharacterPart;
  transform: Transform;
  currentFrame: number;
  addKeyframeForSelected?: () => void;
  updateCurrentTransform: (newTransform: Partial<Transform>) => void;
  handlePartPropChange?: (key: keyof CharacterPart, value: any) => void;
  handleZIndexChange?: (zIndex: number) => void;
}

/**
 * Transform inspector tab. Thin composition of focused section components:
 * alignment bar (multi-select), position/rotation, scale, opacity, z-index,
 * and the 4 control points editor.
 */
export const TransformTab: React.FC<TransformTabProps> = ({
  selectedPart,
  transform,
  currentFrame,
  updateCurrentTransform,
  handleZIndexChange,
}) => {
  return (
    <>
      <div className="inspector-section" style={{ paddingTop: 8 }}>
        <TransformAlignmentBar />

        <TransformPositionRotationCard
          transform={transform}
          currentFrame={currentFrame}
          onUpdate={updateCurrentTransform}
        />

        <TransformScaleCard
          transform={transform}
          onUpdate={updateCurrentTransform}
        />

        <TransformOpacityCard
          transform={transform}
          onUpdate={updateCurrentTransform}
        />

        {handleZIndexChange && (
          <TransformZIndexCard
            zIndex={selectedPart.zIndex}
            onZIndexChange={handleZIndexChange}
          />
        )}

        <TransformControlPoints
          selectedPart={selectedPart}
          transform={transform}
          onUpdate={updateCurrentTransform}
        />
      </div>
    </>
  );
};
