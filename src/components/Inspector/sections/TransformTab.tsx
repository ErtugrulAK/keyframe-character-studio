import React from 'react';
import type { CharacterPart, Transform } from '../../../types/animator';
import { TransformAlignmentBar } from './transform/TransformAlignmentBar';
import { TransformPositionRotationCard } from './transform/TransformPositionRotationCard';
import { TransformScaleCard } from './transform/TransformScaleCard';
import { TransformOpacityCard } from './transform/TransformOpacityCard';
import { TransformZIndexCard } from './transform/TransformZIndexCard';
import { TransformControlPoints } from './transform/TransformControlPoints';
import { TransformVertexEditor } from './transform/TransformVertexEditor';

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
 * container assignment, and the 4 control points editor.
 */
export const TransformTab: React.FC<TransformTabProps> = ({
  selectedPart,
  transform,
  updateCurrentTransform,
  handlePartPropChange,
  handleZIndexChange,
}) => {

  return (
    <>
      <div className="inspector-section" style={{ paddingTop: 8 }}>
        <TransformAlignmentBar />

        {/* Unified transform block: position, rotation, scale, opacity rows */}
        <div className="panel-card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <TransformPositionRotationCard
              transform={transform}
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
          </div>
        </div>

        {handleZIndexChange && (
          <TransformZIndexCard
            zIndex={selectedPart.zIndex}
            onZIndexChange={handleZIndexChange}
          />
        )}

        {/* 4 control points only make sense for regular shapes — hand-drawn
            freeform polygons use the per-vertex editor below instead */}
        {selectedPart.type !== 'custom_freeform' && (
          <TransformControlPoints
            selectedPart={selectedPart}
            transform={transform}
            onUpdate={updateCurrentTransform}
          />
        )}

        {/* Freeform shapes get a per-vertex coordinate editor */}
        {selectedPart.type === 'custom_freeform' && handlePartPropChange && (
          <TransformVertexEditor
            selectedPart={selectedPart}
            transform={transform}
            onPartPropChange={handlePartPropChange}
          />
        )}
      </div>
    </>
  );
};
