import React, { useState } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import { makeEmptyChannels } from '../../utils/defaults';
import { isShapeAppearanceEligible, updateShapeAppearance, type ShapeAppearancePatch } from '../../utils/shapeAppearance';
import { isTrimPathEligible } from '../../utils/trimPath';
import { updateTrimPath, type TrimPathAuthoringPatch } from '../../utils/trimPathAuthoring';
import { TransformTab } from './sections/TransformTab';
import { StyleTab } from './sections/StyleTab';
import { KeyframesTab } from './sections/KeyframesTab';
import { DuplicateTab } from './sections/DuplicateTab';
import {
  Sliders,
  Copy,
  Trash2,
  Activity,
  CopyPlus,
} from 'lucide-react';

export const DetailsPanel: React.FC = () => {
  const {
    currentFrame,
    selectedPartId,
    characterParts,
    setCharacterParts,
    setTracks,
    getComputedTransform,
    updateCurrentTransform,
    updateCurrentPropertyChannel,
    deletePart,
    duplicateSelectedPart,
    customPresets,
    savePreset,
    updatePreset,
    deletePreset,
    importPresets,
    copySelectedPart,
    pasteAnimationOntoSelected,
    clipboardData,
    startBatchInteraction,
    endBatchInteraction,
    showToast,
    tracks,
    selectedKeyframeId,
    activeTemplateId,
    isScaleLocked,
    coordinateSystem,
  } = useAnimator();

  const [activeTabSection, setActiveTabSection] = useState<'edit' | 'duplicate'>('edit');

  const selectedPart = characterParts.find((p) => p.id === selectedPartId);
  const transform = selectedPartId ? getComputedTransform(selectedPartId, currentFrame) : null;

  const handlePartPropChange = (key: any, value: any) => {
    if (!selectedPartId) return;
    setCharacterParts((prev) =>
      prev.map((p) => {
        if (p.id !== selectedPartId) return p;
        if (isShapeAppearanceEligible(p.type) && [
          'fillEnabled', 'fillColor', 'fillOpacity', 'strokeEnabled', 'strokeColor', 'strokeWidth', 'strokeOpacity', 'strokeAlignment',
        ].includes(key)) {
          return updateShapeAppearance(p, { [key]: value } as ShapeAppearancePatch);
        }
        if (isTrimPathEligible(p.type) && [
          'trimPathEnabled', 'trimPathStart', 'trimPathEnd', 'trimPathOffset',
        ].includes(key)) {
          return updateTrimPath(p, { [key]: value } as TrimPathAuthoringPatch);
        }
        return { ...p, [key]: value };
      })
    );
  };

  const handlePartColorChange = (key: 'fillColor' | 'strokeColor', color: string) => {
    handlePartPropChange(key, color);
  };

  const handleZIndexChange = (zIndex: number) => {
    handlePartPropChange('zIndex', zIndex);
  };

  // M26 — copy/paste/clear ANIMATION (26A data layer + 26B UI).
  // Paste + Clear wrap the two setState halves in ONE batch interaction so
  // Ctrl+Z reverts the whole transfer as a single logical undo entry.
  const handleCopyAnimation = () => {
    copySelectedPart();
  };

  const handlePasteAnimation = () => {
    if (!selectedPartId) return;
    startBatchInteraction();
    pasteAnimationOntoSelected(selectedPartId);
    endBatchInteraction();
  };

  const handleClearAnimation = () => {
    if (!selectedPartId) return;
    startBatchInteraction();
    setCharacterParts((prev) =>
      prev.map((p) =>
        p.id === selectedPartId
          ? { ...p, inAnimPreset: 'none', outAnimPreset: 'none', inAnimDuration: 30, outAnimDuration: 30 }
          : p,
      ),
    );
    setTracks((prev) =>
      prev.map((t) =>
        t.partId === selectedPartId
          ? { ...t, keyframes: [], channels: makeEmptyChannels() }
          : t,
      ),
    );
    endBatchInteraction();
    showToast('Animation cleared', 'success');
  };

  return (
    <div className="details-container">
      {/* 1. Header Bar */}
      <div className="details-header">
        <div className="details-title-group">
          <Sliders size={14} className="text-cyan" />
          <span className="details-title">Details</span>
        </div>
      </div>

      {/* 2. Selected Actor Instance Header */}
      {selectedPart ? (
        <div className="details-actor-header">
          <div className="actor-title-box">
            <span className="actor-main-name">{selectedPart.name}</span>
          </div>

          <div className="actor-quick-actions">
            <button
              className="btn-icon-small"
              onClick={duplicateSelectedPart}
              title="Duplicate Actor Instance"
            >
              <Copy size={12} />
            </button>
            <button
              className="btn-icon-small danger"
              onClick={() => deletePart(selectedPart.id)}
              title="Delete Actor Instance"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ) : (
        <div className="details-empty-state">
          <span>Select an element on Canvas or Outliner to view details</span>
        </div>
      )}

      {/* 3. Section Navigation Tabs */}
      {selectedPart && (
        <div className="details-tabs-bar">
          <button
            className={`tab-btn ${activeTabSection === 'edit' ? 'active' : ''}`}
            onClick={() => setActiveTabSection('edit')}
          >
            <Activity size={12} />
            <span>Edit</span>
          </button>
          <button
            className={`tab-btn ${activeTabSection === 'duplicate' ? 'active' : ''}`}
            onClick={() => setActiveTabSection('duplicate')}
          >
            <CopyPlus size={12} className="text-teal" />
            <span>Duplicate</span>
          </button>
        </div>
      )}

      {/* 4. Property Section Body */}
      {selectedPart && transform && (
        <div className="details-body">
          {activeTabSection === 'edit' && (
            <>
              <div className="inspector-subsection-heading">
                <Activity size={12} />
                <span>Transform</span>
              </div>
              <TransformTab
                selectedPart={selectedPart}
                transform={transform}
                coordinateSystem={coordinateSystem}
                currentFrame={currentFrame}
                updateCurrentTransform={updateCurrentTransform}
                updateCurrentPropertyChannel={updateCurrentPropertyChannel}
                handlePartPropChange={handlePartPropChange}
                handleZIndexChange={handleZIndexChange}
                customPresets={customPresets}
                onSavePreset={savePreset}
                onUpdatePreset={updatePreset}
                onDeletePreset={deletePreset}
                onImportPresets={importPresets}
                showToast={showToast}
                onCopyAnimation={handleCopyAnimation}
                onPasteAnimation={handlePasteAnimation}
                onClearAnimation={handleClearAnimation}
                clipboardSourceId={clipboardData?.part.id ?? null}
                track={tracks.find((t) => t.partId === selectedPartId) ?? null}
                selectedKeyframeId={selectedKeyframeId}
                activeTemplateId={activeTemplateId}
                isScaleLocked={isScaleLocked}
              />

              <div className="inspector-subsection-heading">
                <Activity size={12} />
                <span>Style</span>
              </div>
              <StyleTab
                selectedPart={selectedPart}
                characterParts={characterParts}
                handlePartPropChange={handlePartPropChange}
                handlePartColorChange={handlePartColorChange}
                handleZIndexChange={handleZIndexChange}
              />

              <div className="inspector-subsection-heading">
                <Activity size={12} />
                <span>Animation</span>
              </div>
              <KeyframesTab selectedPart={selectedPart} />
            </>
          )}

          {activeTabSection === 'duplicate' && <DuplicateTab />}
        </div>
      )}

    </div>
  );
};
