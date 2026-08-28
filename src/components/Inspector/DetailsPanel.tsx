import React, { useState } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import { makeEmptyChannels } from '../../utils/defaults';
import { isShapeAppearanceEligible, updateShapeAppearance, type ShapeAppearancePatch } from '../../utils/shapeAppearance';
import { isTrimPathEligible } from '../../utils/trimPath';
import { updateTrimPath, type TrimPathAuthoringPatch } from '../../utils/trimPathAuthoring';
import { TransformTab } from './sections/TransformTab';
import { StyleTab } from './sections/StyleTab';
import { DuplicateTab } from './sections/DuplicateTab';
import { isBooleanEligible, computeBooleanContours, dissolveBooleanGroup as dissolveBooleanGroupState, type BooleanOperation } from '../../utils/booleanGeometry';
import { generateId } from '../../utils/idGenerator';
import {
  Sliders,
  Copy,
  Trash2,
  Activity,
  CopyPlus,
  Unlink,
} from 'lucide-react';

export const DetailsPanel: React.FC = () => {
  const {
    currentFrame,
    selectedPartId,
    selectedPartIds,
    characterParts,
    setSelectedPartId,
    setSelectedPartIds,
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
    activeTemplateId,
    isScaleLocked,
    coordinateSystem,
  } = useAnimator();

  const [activeTabSection, setActiveTabSection] = useState<'edit' | 'duplicate'>('edit');
  const booleanEligibleParts = selectedPartIds
    .map((id) => characterParts.find((part) => part.id === id))
    .filter((part): part is NonNullable<typeof part> => Boolean(part && isBooleanEligible(part)));

  const createBooleanGroup = (operation: BooleanOperation) => {
    if (booleanEligibleParts.length < 2) return;
    const contours = computeBooleanContours(
      operation,
      booleanEligibleParts,
      Object.fromEntries(booleanEligibleParts.map((part) => [part.id, getComputedTransform(part.id, currentFrame)])),
    );
    if (contours.length === 0) {
      showToast('The selected shapes produce an empty result.', 'info');
      return;
    }
    const groupId = generateId('boolean');
    const groupPart = {
      ...booleanEligibleParts[0],
      id: groupId,
      name: `Boolean · ${operation[0].toUpperCase()}${operation.slice(1)}`,
      type: 'custom_freeform' as const,
      zIndex: Math.max(...booleanEligibleParts.map((part) => part.zIndex)) + 1,
      parentId: undefined,
      booleanGroupId: undefined,
      matte: undefined,
      booleanOperation: operation,
      booleanOperandIds: booleanEligibleParts.map((part) => part.id),
      booleanContours: contours,
      points: contours[0],
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    };
    startBatchInteraction();
    setCharacterParts((parts) => [
      ...parts.map((part) => booleanEligibleParts.some((operand) => operand.id === part.id) ? { ...part, booleanGroupId: groupId } : part),
      groupPart,
    ]);
    setTracks((currentTracks) => [
      ...currentTracks,
      {
        id: generateId('track'),
        partId: groupId,
        name: groupPart.name,
        color: '#38bdf8',
        visible: true,
        locked: false,
        channels: makeEmptyChannels(),
      },
    ]);
    endBatchInteraction();
    setSelectedPartIds([groupId]);
    setSelectedPartId(groupId);
    showToast(`${operation[0].toUpperCase()}${operation.slice(1)} boolean created`, 'success');
  };

  const selectedPart = characterParts.find((p) => p.id === selectedPartId);
  const selectedBooleanGroup = selectedPart?.booleanOperandIds?.length
    ? selectedPart
    : undefined;

  const updateBooleanOperation = (operation: BooleanOperation) => {
    if (!selectedBooleanGroup || !selectedBooleanGroup.booleanOperandIds) return;
    const operands = selectedBooleanGroup.booleanOperandIds
      .map((id) => characterParts.find((part) => part.id === id))
      .filter((part): part is NonNullable<typeof part> => Boolean(part));
    const transforms = Object.fromEntries(
      operands.map((operand) => [operand.id, getComputedTransform(operand.id, currentFrame)]),
    );
    const contours = computeBooleanContours(operation, operands, transforms);
    startBatchInteraction();
    setCharacterParts((parts) => parts.map((part) => part.id === selectedBooleanGroup.id
      ? {
        ...part,
        name: `Boolean · ${operation[0].toUpperCase()}${operation.slice(1)}`,
        booleanOperation: operation,
        booleanContours: contours,
        points: contours[0] ?? [],
      }
      : part));
    endBatchInteraction();
    if (contours.length === 0) showToast('Boolean result is empty.', 'info');
  };
  const dissolveBooleanGroup = () => {
    if (!selectedBooleanGroup?.booleanOperandIds) return;
    const result = dissolveBooleanGroupState(characterParts, tracks, selectedBooleanGroup.id);
    if (result.operandIds.length === 0) return;
    startBatchInteraction();
    setCharacterParts(result.parts);
    setTracks(result.tracks);
    setSelectedPartIds(result.operandIds);
    setSelectedPartId(result.operandIds[result.operandIds.length - 1] ?? null);
    endBatchInteraction();
    showToast('Boolean dissolved; operands preserved.', 'success');
  };
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
              onClick={selectedBooleanGroup ? dissolveBooleanGroup : () => deletePart(selectedPart.id)}
              title={selectedBooleanGroup ? 'Dissolve Boolean and preserve operands' : 'Delete Actor Instance'}
              aria-label={selectedBooleanGroup ? 'Dissolve Boolean' : 'Delete Actor Instance'}
            >
              {selectedBooleanGroup ? <Unlink size={12} /> : <Trash2 size={12} />}
            </button>
          </div>
        </div>
      ) : (
        <div className="details-empty-state">
          <span>Select an element on Canvas or Outliner to view details</span>
        </div>
      )}
      {booleanEligibleParts.length >= 2 && (
        <section className="shape-operations-section" aria-label="Shape operations">
          <div className="inspector-section-label">SHAPE OPERATIONS</div>
          <p className="shape-operations-description">Combine eligible closed vector shapes into a non-destructive Boolean result.</p>
          <div className="shape-operations-grid">
            {(['union', 'subtract', 'intersect', 'exclude'] as const).map((operation) => (
              <button key={operation} type="button" onClick={() => createBooleanGroup(operation)} title={`Create ${operation} Boolean`}>
                {operation[0].toUpperCase() + operation.slice(1)}
              </button>
            ))}
          </div>
        </section>
      )}
      {selectedBooleanGroup && (
        <section className="boolean-editor-section" aria-label="Boolean operation">
          <div className="inspector-section-label">BOOLEAN RESULT</div>
          <p className="boolean-description">Combine vector geometry. Operands remain authored and editable.</p>
          <label className="boolean-operation-field">
            <span>Operation</span>
            <select
              aria-label="Boolean operation"
              value={selectedBooleanGroup.booleanOperation ?? 'union'}
              onChange={(event) => updateBooleanOperation(event.target.value as BooleanOperation)}
            >
              <option value="union">Union</option>
              <option value="subtract">Subtract</option>
              <option value="intersect">Intersect</option>
              <option value="exclude">Exclude</option>
            </select>
          </label>
          <div className="boolean-operands-list" aria-label="Boolean operands">
            {selectedBooleanGroup.booleanOperandIds?.map((operandId) => (
              <button
                key={operandId}
                type="button"
                className="boolean-operand-button"
                onClick={() => {
                  setSelectedPartIds([operandId]);
                  setSelectedPartId(operandId);
                }}
              >
                {characterParts.find((part) => part.id === operandId)?.name ?? operandId}
              </button>
            ))}
          </div>
          {selectedBooleanGroup.booleanContours?.length === 0 && (
            <p className="boolean-empty-message">Boolean result is empty.</p>
          )}
          <button type="button" className="btn-secondary boolean-dissolve-button" onClick={dissolveBooleanGroup}>
            <Unlink size={12} /> Dissolve Boolean
          </button>
        </section>
      )}
      {selectedPart && !selectedBooleanGroup && booleanEligibleParts.length < 2 && (
        <section className="shape-operations-section shape-operations-hint" aria-label="Boolean operations unavailable">
          <div className="inspector-section-label">SHAPE OPERATIONS</div>
          <p>Boolean: select 2 closed vector shapes.</p>
        </section>
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
                activeTemplateId={activeTemplateId}
                isScaleLocked={isScaleLocked}
              />

              <StyleTab
                selectedPart={selectedPart}
                characterParts={characterParts}
                handlePartPropChange={handlePartPropChange}
                handlePartColorChange={handlePartColorChange}
                handleZIndexChange={handleZIndexChange}
              />

            </>
          )}

          {activeTabSection === 'duplicate' && <DuplicateTab />}
        </div>
      )}

    </div>
  );
};
