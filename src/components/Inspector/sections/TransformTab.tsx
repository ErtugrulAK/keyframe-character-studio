import React from 'react';
import type { CharacterPart, CustomMotionPreset, Track, Transform } from '../../../types/animator';
import type { SavePresetInput } from '../../../hooks/usePresets';
import { TransformAlignmentBar } from './transform/TransformAlignmentBar';
import { TransformPositionRotationCard } from './transform/TransformPositionRotationCard';
import { TransformScaleCard } from './transform/TransformScaleCard';
import { TransformOpacityCard } from './transform/TransformOpacityCard';
import { TransformZIndexCard } from './transform/TransformZIndexCard';
import { TransformControlPoints } from './transform/TransformControlPoints';
import { TransformVertexEditor } from './transform/TransformVertexEditor';
import { TransformInOutPresetCard } from './transform/TransformInOutPresetCard';
import { SelectedKeyframeSection } from './transform/SelectedKeyframeSection';

interface TransformTabProps {
  selectedPart: CharacterPart;
  transform: Transform;
  currentFrame: number;
  updateCurrentTransform: (newTransform: Partial<Transform>) => void;
  handlePartPropChange?: (key: keyof CharacterPart, value: any) => void;
  handleZIndexChange?: (zIndex: number) => void;
  // M25 — user-saved custom preset library (passed through to the card)
  customPresets: CustomMotionPreset[];
  onSavePreset: (input: SavePresetInput) => CustomMotionPreset | null;
  onDeletePreset: (id: string) => void;
  // M30 — preset library export/import (passed through to the card)
  onImportPresets?: (presets: CustomMotionPreset[]) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  // M26 — copy/paste/clear animation (passed through to the card)
  onCopyAnimation?: () => void;
  onPasteAnimation?: () => void;
  onClearAnimation?: () => void;
  clipboardSourceId?: string | null;
  // M29 — selected keyframe section (raw keyframe values on the existing pipeline)
  track?: Track | null;
  selectedKeyframeId?: string | null;
  activeTemplateId?: string | null;
  isScaleLocked?: boolean;
}

/**
 * Transform inspector tab. Thin composition of focused section components:
 * alignment bar (multi-select), position/rotation, scale, opacity, z-index,
 * container assignment, and the 4 control points editor.
 */
export const TransformTab: React.FC<TransformTabProps> = ({
  selectedPart,
  transform,
  currentFrame,
  updateCurrentTransform,
  handlePartPropChange,
  handleZIndexChange,
  customPresets,
  onSavePreset,
  onDeletePreset,
  onImportPresets,
  showToast,
  onCopyAnimation,
  onPasteAnimation,
  onClearAnimation,
  clipboardSourceId,
  track,
  selectedKeyframeId,
  activeTemplateId,
  isScaleLocked = false,
}) => {

  return (
    <>
      <div className="inspector-section" style={{ paddingTop: 8 }}>
        <TransformAlignmentBar />

        {/* M29 — selected keyframe raw values (hidden without selection) */}
        <SelectedKeyframeSection
          track={track ?? null}
          selectedKeyframeId={selectedKeyframeId ?? null}
          currentFrame={currentFrame}
          transform={transform}
          activeTemplateId={activeTemplateId ?? null}
          isScaleLocked={isScaleLocked}
          onUpdate={updateCurrentTransform}
        />

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

        {/* M23 — IN/OUT animation presets (existing procedural engine,
            exposed via the same onPartPropChange history path) */}
        {handlePartPropChange && (
          <TransformInOutPresetCard
            selectedPart={selectedPart}
            onPartPropChange={handlePartPropChange}
            customPresets={customPresets}
            onSavePreset={onSavePreset}
            onDeletePreset={onDeletePreset}
            onImportPresets={onImportPresets}
            showToast={showToast}
            onCopyAnimation={onCopyAnimation}
            onPasteAnimation={onPasteAnimation}
            onClearAnimation={onClearAnimation}
            clipboardSourceId={clipboardSourceId}
          />
        )}
      </div>
    </>
  );
};
