import React from 'react';
import type { CharacterPart, CustomMotionPreset, Track, Transform, TrackChannel } from '../../../types/animator';
import type { SceneCoordinateSystem } from '../../../types/composition';
import type { SavePresetInput, UpdatePresetInput } from '../../../hooks/usePresets';
import { TransformPositionRotationCard } from './transform/TransformPositionRotationCard';
import { TransformScaleCard } from './transform/TransformScaleCard';
import { TransformZIndexCard } from './transform/TransformZIndexCard';
import { TransformControlPoints } from './transform/TransformControlPoints';
import { TransformVertexEditor } from './transform/TransformVertexEditor';

interface TransformTabProps {
  selectedPart: CharacterPart;
  transform: Transform;
  coordinateSystem: SceneCoordinateSystem;
  currentFrame: number;
  updateCurrentTransform: (newTransform: Partial<Transform>) => void;
  updateCurrentPropertyChannel?: (channel: TrackChannel, value: number) => void;
  handlePartPropChange?: (key: keyof CharacterPart, value: any) => void;
  handleZIndexChange?: (zIndex: number) => void;
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
  // M29 — selected keyframe section (raw keyframe values on the existing pipeline)
  track?: Track | null;
  selectedKeyframeId?: string | null;
  activeTemplateId?: string | null;
  isScaleLocked?: boolean;
}

/**
 * Transform inspector section. Thin composition of focused section components:
 * position/rotation, scale, z-index, container assignment, and control points.
 */
export const TransformTab: React.FC<TransformTabProps> = ({
  selectedPart,
  transform,
  coordinateSystem,
  updateCurrentTransform,
  handlePartPropChange,
  handleZIndexChange,
  onCopyAnimation,
  onPasteAnimation,
  onClearAnimation,
  clipboardSourceId,
}) => {

  return (
    <>
      <div className="inspector-section" style={{ paddingTop: 8 }}>

        {/* Unified transform block: position, rotation, scale rows */}
        <div className="panel-card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <TransformPositionRotationCard
              transform={transform}
              coordinateSystem={coordinateSystem}
              onUpdate={updateCurrentTransform}
            />

            <TransformScaleCard
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
            coordinateSystem={coordinateSystem}
            onUpdate={updateCurrentTransform}
          />
        )}

        {/* Freeform shapes get a per-vertex coordinate editor */}
        {selectedPart.type === 'custom_freeform' && handlePartPropChange && (
          <TransformVertexEditor
            selectedPart={selectedPart}
            transform={transform}
            coordinateSystem={coordinateSystem}
            onPartPropChange={handlePartPropChange}
          />
        )}

        {/* Canonical animation-data actions remain useful for named sequences.
            The legacy procedural IN/OUT editor is intentionally de-emphasized
            without removing its data model or runtime support. */}
        {onCopyAnimation && (
          <div className="panel-card" style={{ marginBottom: 10 }}>
            <div className="section-title" style={{ fontSize: 10 }}>ANIMATION DATA</div>
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
          </div>
        )}
      </div>
    </>
  );
};
