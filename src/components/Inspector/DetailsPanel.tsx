import React, { useState } from 'react';
import { useAnimator } from '../../context/useAnimator';
import { usePartPropertyAuthoring } from '../../hooks/usePartPropertyAuthoring';
import { makeEmptyChannels } from '../../utils/defaults';
import { evaluateLayerMasks } from '../../utils/evaluateLayerMasks';
import { TransformTab } from './sections/TransformTab';
import { StyleTab } from './sections/StyleTab';
import { evaluateTrimPath } from '../../utils/trimPath';
import { DuplicateTab } from './sections/DuplicateTab';
import {
  Sliders,
  Copy,
  Trash2,
  CopyPlus,
} from 'lucide-react';

/**
 * Details is the Inspector's information surface: it reports and edits the
 * SELECTED object's own properties. Structural commands — Group, Bind, Boolean —
 * are authoring operations and live in the top authoring toolbar (and the
 * editor's context menu), so they are not duplicated here.
 */
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
    authorMaskPath,
    deletePart,
    customPresets,
    savePreset,
    updatePreset,
    deletePreset,
    duplicateSelectedPart,
    importPresets,
    copySelectedPart,
    pasteAnimationOntoSelected,
    clipboardData,
    startBatchInteraction,
    endBatchInteraction,
    showToast,
    tracks,
    activeTemplateId,
      coordinateSystem,
  } = useAnimator();

  const [activeTabSection, setActiveTabSection] = useState<'edit' | 'duplicate'>('edit');

  const selectedPart = characterParts.find((p) => p.id === selectedPartId);
  const selectedTrack = selectedPartId ? tracks.find((track) => track.partId === selectedPartId) : undefined;
  const evaluatedMasks = selectedPart && selectedTrack
    ? evaluateLayerMasks(selectedPart, selectedTrack, currentFrame)
    : undefined;
  const inspectorPart = selectedPart && evaluatedMasks ? { ...selectedPart, masks: evaluatedMasks } : selectedPart;
  const transform = selectedPartId ? getComputedTransform(selectedPartId, currentFrame) : null;

  /**
   * Trim Path authoring follows the same rule as every other scalar channel:
   * the field shows the EVALUATED value at the current frame (so a keyed
   * property stops reading as a global edit), and an edit writes the current
   * frame's keyframe once the channel is keyed. `evaluateTrimPath` and
   * `updateCurrentPropertyChannel` are the existing authorities for both halves.
   */
  const activeTrimTemplate = activeTemplateId || 'Sequence';
  const evaluatedTrim = selectedPart
    ? (() => {
      const resolved = evaluateTrimPath(selectedPart, selectedTrack, currentFrame, activeTrimTemplate);
      return { start: resolved.start, end: resolved.end, offset: resolved.offset };
    })()
    : undefined;

  const {
    handleDisplayedPartPropChange,
    handlePartColorChange,
  } = usePartPropertyAuthoring();

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
            <span className="actor-type-label">{selectedPart.isGroup ? 'group' : selectedPart.type.replace('custom_', '')}</span>
          </div>

          <div className="actor-action-row" role="group" aria-label="Inspector object actions">
            <button
              type="button"
              className={`actor-context-action ${activeTabSection === 'duplicate' ? 'active' : ''}`}
              aria-expanded={activeTabSection === 'duplicate'}
              aria-label="Duplicate"
              title="Duplicate options"
              onClick={() => setActiveTabSection((section) => section === 'duplicate' ? 'edit' : 'duplicate')}
            >
              <CopyPlus size={13} />
            </button>
            <button
              type="button"
              className="btn-icon-small"
              onClick={duplicateSelectedPart}
              title="Duplicate Actor Instance"
              aria-label="Duplicate Actor Instance"
            >
              <Copy size={12} />
            </button>
            <button
              type="button"
              className="btn-icon-small danger"
              onClick={() => deletePart(selectedPart.id)}
              title="Delete Actor Instance"
              aria-label="Delete Actor Instance"
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


      {/* 4. Property Section Body */}
      {selectedPart && transform && (
        <div className="details-body">
          {activeTabSection === 'edit' && (
            <>
              <TransformTab
                selectedPart={selectedPart}
                transform={transform}
                coordinateSystem={coordinateSystem}
                currentFrame={currentFrame}
                updateCurrentTransform={updateCurrentTransform}
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
              />

              {/* A group container owns no geometry, so paint, masks and Trim
                  Path would be controls over nothing. Its transform stays. */}
              {!selectedPart.isGroup && (
                <StyleTab
                selectedPart={inspectorPart ?? selectedPart}
                characterParts={characterParts}
                transform={transform}
                coordinateSystem={coordinateSystem}
                handlePartPropChange={handleDisplayedPartPropChange}
                handlePartColorChange={handlePartColorChange}
                evaluatedTrim={evaluatedTrim}
                onUpdateTrimChannel={updateCurrentPropertyChannel}
                onChangeMaskPath={(maskId, path) => {
                  if (selectedPartId) authorMaskPath(selectedPartId, maskId, path);
                }}
                onColorInteractionStart={startBatchInteraction}
                onColorInteractionEnd={endBatchInteraction}
              />
              )}

            </>
          )}

          {activeTabSection === 'duplicate' && <DuplicateTab />}
        </div>
      )}

    </div>
  );
};
