import React from 'react';
import type { CharacterPart, CustomMotionPreset, Transform } from '../../../types/animator';
import type { SceneCoordinateSystem } from '../../../types/composition';
import type { SavePresetInput, UpdatePresetInput } from '../../../hooks/usePresets';
import { TransformPositionCard } from './transform/TransformPositionCard';
import { TransformRotationCard } from './transform/TransformRotationCard';
import { TransformScaleCard } from './transform/TransformScaleCard';
import { TransformOpacityCard } from './transform/TransformOpacityCard';
import { TransformControlPoints } from './transform/TransformControlPoints';
import { StyleCard } from './style/StyleCard';

interface TransformTabProps {
  selectedPart: CharacterPart;
  transform: Transform;
  coordinateSystem: SceneCoordinateSystem;
  currentFrame: number;
  updateCurrentTransform: (newTransform: Partial<Transform>) => void;
  // M25 — user-saved custom preset library (passed through to the card)
  customPresets: CustomMotionPreset[];
  onSavePreset: (input: SavePresetInput) => CustomMotionPreset | null;
  onUpdatePreset: (id: string, input: UpdatePresetInput) => CustomMotionPreset | null;
  onDeletePreset: (id: string) => void;
  // M30 — preset library export/import (passed through to the card)
  onImportPresets?: (presets: CustomMotionPreset[]) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  // M26 — copy/paste/clear animation (passed through to the card)
  onCopyAnimation?: () => void;
  onPasteAnimation?: () => void;
  onClearAnimation?: () => void;
  clipboardSourceId?: string | null;
}

/**
 * Transform inspector section. Thin composition of focused section components:
 * the Position row, the compact Rotation / Scale / Opacity trio, control points,
 * and the canonical animation-data actions.
 *
 * R5-14 — Details states the transform and nothing else: no "Reset 0°", no
 * labelled aspect-lock button and no keyframe action, because keyframing is the
 * timeline property row's authority. R5-15 — the layer's paint order is not
 * repeated here either: Arrange lives on the authoring toolbar, which writes
 * through the same z-index path.
 */
export const TransformTab: React.FC<TransformTabProps> = ({
  selectedPart,
  transform,
  coordinateSystem,
  updateCurrentTransform,
  onCopyAnimation,
  onPasteAnimation,
  onClearAnimation,
  clipboardSourceId,
}) => {

  return (
    <>
      <StyleCard title="TRANSFORM" collapsible defaultOpen={false}>
        <div className="transform-property-list">
          <TransformPositionCard
            transform={transform}
            coordinateSystem={coordinateSystem}
            onUpdate={updateCurrentTransform}
          />

          {/* R5-14 — the compact trio: one row, three cells, each with its own
              column at every inspector width. */}
          <div className="transform-compact-grid">
            <TransformRotationCard
              transform={transform}
              onUpdate={updateCurrentTransform}
            />

            <TransformScaleCard
              transform={transform}
              onUpdate={updateCurrentTransform}
            />

            {/* Opacity is never inherited, so a container's opacity would not
                reach the layers inside it — the control is not offered. */}
            {!selectedPart.isGroup && (
              <TransformOpacityCard
                opacity={transform.opacity}
                onOpacityChange={(opacity) => updateCurrentTransform({ opacity })}
              />
            )}
          </div>
        </div>
      </StyleCard>

      {/* 4 control points only make sense for regular shapes — hand-drawn
          freeform polygons use the per-vertex editor below instead */}
      {selectedPart.type !== 'custom_freeform' && (
        <StyleCard title="CONTROL POINTS" collapsible defaultOpen={false}>
          <TransformControlPoints
            selectedPart={selectedPart}
            transform={transform}
            coordinateSystem={coordinateSystem}
            onUpdate={updateCurrentTransform}
          />
        </StyleCard>
      )}


      {/* Canonical animation-data actions remain useful for named sequences.
          The legacy procedural IN/OUT editor is intentionally de-emphasized
          without removing its data model or runtime support. */}
      {onCopyAnimation && (
        <StyleCard title="ANIMATION DATA" collapsible defaultOpen={false}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <button
              type="button"
              className="btn-secondary"
              title="Copy animation from this element"
              aria-label="Copy Animation"
              onClick={onCopyAnimation}
            >
              Copy Animation
            </button>
            <button
              type="button"
              className="btn-secondary"
              title="Paste animation onto selected element"
              aria-label="Paste Animation"
              disabled={!clipboardSourceId || clipboardSourceId === selectedPart.id}
              onClick={onPasteAnimation}
            >
              Paste Animation
            </button>
            {onClearAnimation && (
              <button
                type="button"
                className="btn-secondary"
                style={{ color: '#f87171' }}
                title="Clear animation (IN/OUT presets, durations and keyframes)"
                aria-label="Clear Animation"
                onClick={onClearAnimation}
              >
                Clear Animation
              </button>
            )}
          </div>
        </StyleCard>
      )}
    </>
  );
};
