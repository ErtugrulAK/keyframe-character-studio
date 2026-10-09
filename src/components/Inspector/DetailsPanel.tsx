import React, { useState } from 'react';
import { useAnimator } from '../../context/useAnimator';
import { makeEmptyChannels } from '../../utils/defaults';
import { evaluateLayerMasks } from '../../utils/evaluateLayerMasks';
import { isShapeAppearanceEligible, updateShapeAppearance, type ShapeAppearancePatch } from '../../utils/shapeAppearance';
import { isTrimPathEligible } from '../../utils/trimPath';
import { updateTrimPath, type TrimPathAuthoringPatch } from '../../utils/trimPathAuthoring';
import { TransformTab } from './sections/TransformTab';
import { StyleTab } from './sections/StyleTab';
import type { TrimPathChannel } from './sections/style/TrimPathSection';
import { evaluateTrimPath } from '../../utils/trimPath';
import { DuplicateTab } from './sections/DuplicateTab';
import { isBooleanEligible, computeBooleanContours, deriveBooleanGeometry, inspectBooleanOperands, dissolveBooleanGroup as dissolveBooleanGroupState, createBooleanDisplayName, isGeneratedBooleanName, type BooleanOperation } from '../../utils/booleanGeometry';
import { BooleanOperationIcon } from './BooleanOperationIcon';
import { generateId } from '../../utils/idGenerator';
import { bindParts, isRelationshipChainRelated, resolveBondGroup, unbindPart } from '../../utils/partBinding';
import { layerMaskChannel } from '../../types/animator';
import type { CharacterPart } from '../../types/animator';
import {
  Sliders,
  Copy,
  Trash2,
  CopyPlus,
  Unlink,
  Lock,
  Unlock,
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
    updatePropertyKeyframeValue,
    addPropertyKeyframe,
    deletePropertyKeyframe,
    addMaskPathKeyframe,
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
    booleanOperandEditingGroupId,
    setBooleanOperandEditingGroupId,
  } = useAnimator();

  const [activeTabSection, setActiveTabSection] = useState<'edit' | 'duplicate'>('edit');
  const booleanEligibleParts = selectedPartIds
    .map((id) => characterParts.find((part) => part.id === id))
    .filter((part): part is NonNullable<typeof part> => Boolean(part && isBooleanEligible(part)));

  const createBooleanGroup = (operation: BooleanOperation) => {
    if (booleanEligibleParts.length < 2) return;
    const transforms = Object.fromEntries(booleanEligibleParts.map((part) => [part.id, getComputedTransform(part.id, currentFrame)]));
    const readiness = inspectBooleanOperands(booleanEligibleParts, transforms);
    if (!readiness.ready) {
      const names = readiness.unresolved.map((part) => part.name).join(', ');
      showToast(`Could not build the Boolean: no geometry for ${names}. Nothing was created.`, 'error');
      return;
    }
    const contours = computeBooleanContours(operation, booleanEligibleParts, transforms);
    if (contours.length === 0) {
      showToast('The selected shapes produce an empty result.', 'info');
      return;
    }
    const groupId = generateId('boolean');
    const groupPart = {
      ...booleanEligibleParts[0],
      id: groupId,
      name: createBooleanDisplayName(operation, characterParts, undefined, booleanEligibleParts.map((part) => part.name)),
      type: 'custom_freeform' as const,
      zIndex: Math.max(...booleanEligibleParts.map((part) => part.zIndex)) + 1,
      parentId: undefined,
      booleanGroupId: undefined,
      boundPartIds: undefined,
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
    : characterParts.find((part) => part.id === selectedPart?.booleanGroupId);

  const updateBooleanOperation = (operation: BooleanOperation) => {
    if (!selectedBooleanGroup || !selectedBooleanGroup.booleanOperandIds) return;
    const operands = selectedBooleanGroup.booleanOperandIds
      .map((id) => characterParts.find((part) => part.id === id))
      .filter((part): part is NonNullable<typeof part> => Boolean(part));
    const transforms = Object.fromEntries(
      operands.map((operand) => [operand.id, getComputedTransform(operand.id, currentFrame)]),
    );
    const groupTransform = getComputedTransform(selectedBooleanGroup.id, currentFrame);
    const operandNames = operands.map((operand) => operand.name);
    // Switching the operation is refused when an operand has no geometry, so a
    // failed trace never silently becomes a different operation.
    const readiness = inspectBooleanOperands(operands, transforms);
    if (!readiness.ready) {
      const names = readiness.unresolved.map((part) => part.name).join(', ');
      showToast(`Could not switch the Boolean operation: no geometry for ${names}.`, 'error');
      return;
    }
    const derived = deriveBooleanGeometry(operation, operands, transforms, groupTransform);
    const contours = derived.localContours;
    startBatchInteraction();
    setCharacterParts((parts) => parts.map((part) => part.id === selectedBooleanGroup.id
      ? {
        ...part,
        name: isGeneratedBooleanName(part.name)
          ? createBooleanDisplayName(operation, parts, part.name, operandNames)
          : part.name,
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
    const operandWorldTransforms = Object.fromEntries(
      selectedBooleanGroup.booleanOperandIds.map((id) => [id, getComputedTransform(id, currentFrame)]),
    );
    const result = dissolveBooleanGroupState(characterParts, tracks, selectedBooleanGroup.id);
    if (result.operandIds.length === 0) return;
    const bakedParts = result.parts.map((part) => {
      const world = operandWorldTransforms[part.id];
      return world
        ? { ...part, baseTransform: { ...part.baseTransform, ...world }, booleanGroupId: undefined }
        : part;
    });
    startBatchInteraction();
    setCharacterParts(bakedParts);
    setTracks(result.tracks);
    setBooleanOperandEditingGroupId(null);
    setSelectedPartIds(result.operandIds);
    setSelectedPartId(result.operandIds[result.operandIds.length - 1] ?? null);
    endBatchInteraction();
    showToast('Boolean dissolved; operands preserved.', 'success');
  };
  const selectedTrack = selectedPartId ? tracks.find((track) => track.partId === selectedPartId) : undefined;
  const evaluatedMasks = selectedPart && selectedTrack
    ? evaluateLayerMasks(selectedPart, selectedTrack, currentFrame)
    : undefined;
  const inspectorPart = selectedPart && evaluatedMasks ? { ...selectedPart, masks: evaluatedMasks } : selectedPart;
  const transform = selectedPartId ? getComputedTransform(selectedPartId, currentFrame) : null;
  const opacityKeyframeAtFrame = selectedTrack
    ? (selectedTrack.channels?.opacity ?? []).find(
      (keyframe) => keyframe.frame === currentFrame && (keyframe.templateId || 'Sequence') === (activeTemplateId || 'Sequence'),
    )
    : undefined;

  /**
   * Trim Path authoring follows the same rule as every other scalar channel:
   * the field shows the EVALUATED value at the current frame (so a keyed
   * property stops reading as a global edit), and an edit writes the current
   * frame's keyframe once the channel is keyed. `evaluateTrimPath` and
   * `updateCurrentPropertyChannel` are the existing authorities for both halves.
   */
  const activeTrimTemplate = activeTemplateId || 'Sequence';
  const trimChannel = (channel: TrimPathChannel) =>
    (selectedTrack?.channels?.[channel] ?? []).filter(
      (keyframe) => (keyframe.templateId || 'Sequence') === activeTrimTemplate,
    );
  const evaluatedTrim = selectedPart
    ? (() => {
      const resolved = evaluateTrimPath(selectedPart, selectedTrack, currentFrame, activeTrimTemplate);
      return { start: resolved.start, end: resolved.end, offset: resolved.offset };
    })()
    : undefined;
  const trimKeyframedAtFrame: Record<TrimPathChannel, boolean> = {
    trimPathStart: trimChannel('trimPathStart').some((keyframe) => keyframe.frame === currentFrame),
    trimPathEnd: trimChannel('trimPathEnd').some((keyframe) => keyframe.frame === currentFrame),
    trimPathOffset: trimChannel('trimPathOffset').some((keyframe) => keyframe.frame === currentFrame),
  };
  const handleToggleTrimKeyframe = (channel: TrimPathChannel) => {
    if (!selectedTrack || !evaluatedTrim) return;
    const atFrame = trimChannel(channel).find((keyframe) => keyframe.frame === currentFrame);
    if (atFrame) {
      deletePropertyKeyframe(selectedTrack.id, channel, atFrame.id);
      return;
    }
    const value = channel === 'trimPathStart' ? evaluatedTrim.start : channel === 'trimPathEnd' ? evaluatedTrim.end : evaluatedTrim.offset;
    addPropertyKeyframe(selectedTrack.id, channel, currentFrame, value);
  };

  const handlePartPropChange = (key: keyof CharacterPart, value: unknown) => {
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

  const handleDisplayedPartPropChange = (key: keyof CharacterPart, value: unknown) => {
    if (key === 'masks' && Array.isArray(value)) {
      const baseMasks = characterParts.find((part) => part.id === selectedPartId)?.masks ?? [];
      const maskScalarProperties = ['feather', 'opacity', 'expansion'] as const;
      const baseValue = value.map((mask) => {
        const baseMask = baseMasks.find((candidate) => candidate.id === mask.id);
        if (!baseMask || !selectedTrack) return mask;
        const nextMask = { ...mask };
        for (const property of maskScalarProperties) {
          const channel = layerMaskChannel(mask.id, property);
          const keyframe = selectedTrack.maskChannels?.[channel]?.find(
            (candidate) => candidate.frame === currentFrame && (candidate.templateId || 'Sequence') === (activeTemplateId || 'Sequence'),
          );
          if (keyframe && mask[property] !== keyframe.value) {
            updatePropertyKeyframeValue(selectedTrack.id, channel, keyframe.id, Number(mask[property]));
            nextMask[property] = baseMask[property];
          }
        }
        return nextMask;
      });
      const mergedMasks = baseValue.map((mask) => {
        const baseMask = baseMasks.find((candidate) => candidate.id === mask.id);
        return baseMask ? { ...mask, path: baseMask.path } : mask;
      });
      handlePartPropChange(key, mergedMasks);
      return;
    }
    handlePartPropChange(key, value);
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

  const bindSelection = selectedPartIds
    .map((id) => characterParts.find((part) => part.id === id))
    .filter((part): part is NonNullable<typeof part> => Boolean(part));
  const bondGroupIds = selectedPart ? resolveBondGroup(characterParts, selectedPart.id) : [];

  /** Bond the selected layers so a position change on one moves the others. */
  const createBind = () => {
    const ids = bindSelection.map((part) => part.id);
    if (ids.length < 2) return;
    const blocked = ids.some((first, index) =>
      ids.slice(index + 1).some((second) => isRelationshipChainRelated(characterParts, first, second)));
    if (blocked) {
      showToast('Those layers are already parent and child; bonding them would move the child twice.', 'info');
      return;
    }
    startBatchInteraction();
    setCharacterParts((parts) => bindParts(parts, ids));
    endBatchInteraction();
    showToast('Layers bonded: moving one moves the others.', 'success');
  };

  const releaseBind = () => {
    if (!selectedPart) return;
    startBatchInteraction();
    setCharacterParts((parts) => unbindPart(parts, selectedPart.id));
    endBatchInteraction();
    showToast('Bond released.', 'info');
  };

  const bindWorkflowContent = selectedPart && bondGroupIds.length > 1 ? (
    <section className="boolean-editor-section" aria-label="Bound layers">
      <div className="inspector-section-label">BIND</div>
      <p className="boolean-description">Bonded layers move together. Only position follows; rotation and scale stay their own.</p>
      <div className="boolean-operands-list" aria-label="Bonded layers">
        {bondGroupIds.map((boundId) => (
          <button
            key={boundId}
            type="button"
            className="boolean-operand-button"
            onClick={() => {
              setSelectedPartIds([boundId]);
              setSelectedPartId(boundId);
            }}
          >
            {characterParts.find((part) => part.id === boundId)?.name ?? boundId}
          </button>
        ))}
      </div>
      <button type="button" className="btn-secondary boolean-dissolve-button" onClick={releaseBind}>
        <Unlink size={12} /> Unbind
      </button>
    </section>
  ) : bindSelection.length >= 2 ? (
    <section className="shape-operations-section" aria-label="Layer binding">
      <div className="inspector-section-label">BIND</div>
      <p className="shape-operations-description">Bond the selected layers so a position change on one moves the others.</p>
      <div className="shape-operations-grid">
        <button type="button" onClick={createBind} title="Bond the selected layers">Bind</button>
      </div>
    </section>
  ) : null;

  const booleanWorkflowContent = selectedBooleanGroup ? (
    <section className="boolean-editor-section" aria-label="Boolean operation">
      <div className="inspector-section-label">BOOLEAN</div>
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
      <button
        type="button"
        className={`boolean-operand-mode-button ${booleanOperandEditingGroupId === selectedBooleanGroup.id ? 'active' : ''}`}
        aria-pressed={booleanOperandEditingGroupId === selectedBooleanGroup.id}
        onClick={() => setBooleanOperandEditingGroupId(
          booleanOperandEditingGroupId === selectedBooleanGroup.id ? null : selectedBooleanGroup.id,
        )}
      >
        {booleanOperandEditingGroupId === selectedBooleanGroup.id ? <Unlock size={12} /> : <Lock size={12} />}
        {booleanOperandEditingGroupId === selectedBooleanGroup.id ? 'Lock Operands' : 'Edit Operands'}
      </button>
      {booleanOperandEditingGroupId === selectedBooleanGroup.id && (
        <p className="boolean-editing-status">Operand editing is active. Drag a child shape on the canvas.</p>
      )}
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
  ) : booleanEligibleParts.length >= 2 ? (
    <section className="shape-operations-section" aria-label="Shape operations">
      <div className="inspector-section-label">BOOLEAN</div>
      <p className="shape-operations-description">Combine the selected shapes, freeform paths or text layers into a non-destructive Boolean result.</p>
      <div className="shape-operations-grid">
        {(['union', 'subtract', 'intersect', 'exclude'] as const).map((operation) => (
          <button
            key={operation}
            type="button"
            className="shape-operation-button"
            onClick={() => createBooleanGroup(operation)}
            title={`Create ${operation} Boolean`}
            aria-label={`Create ${operation} Boolean`}
          >
            <BooleanOperationIcon operation={operation} />
            <span>{operation[0].toUpperCase() + operation.slice(1)}</span>
          </button>
        ))}
      </div>
    </section>
  ) : selectedPart && isBooleanEligible(selectedPart) ? (
    <section className="shape-operations-section shape-operations-hint" aria-label="Boolean operations unavailable">
      <div className="inspector-section-label">BOOLEAN</div>
      <p>Boolean: select 2 shapes, freeform paths or text layers.</p>
    </section>
  ) : null;

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
            <span className="actor-type-label">{selectedPart.type.replace('custom_', '')}</span>
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
                opacityKeyframedAtCurrentFrame={Boolean(opacityKeyframeAtFrame)}
                onToggleOpacityKeyframe={selectedTrack && transform ? () => {
                  if (opacityKeyframeAtFrame) {
                    deletePropertyKeyframe(selectedTrack.id, 'opacity', opacityKeyframeAtFrame.id);
                    return;
                  }
                  addPropertyKeyframe(selectedTrack.id, 'opacity', currentFrame, transform.opacity);
                } : undefined}
                handlePartPropChange={handlePartPropChange}
                handleZIndexChange={handleZIndexChange}
                editWorkflowContent={<>{booleanWorkflowContent}{bindWorkflowContent}</>}
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

              <StyleTab
                selectedPart={inspectorPart ?? selectedPart}
                characterParts={characterParts}
                transform={transform}
                coordinateSystem={coordinateSystem}
                handlePartPropChange={handleDisplayedPartPropChange}
                handlePartColorChange={handlePartColorChange}
                handleZIndexChange={handleZIndexChange}
                currentFrame={currentFrame}
                evaluatedTrim={evaluatedTrim}
                trimKeyframedAtFrame={trimKeyframedAtFrame}
                onUpdateTrimChannel={updateCurrentPropertyChannel}
                onToggleTrimKeyframe={handleToggleTrimKeyframe}
                onAddMaskKeyframe={(maskId, property, value) => {
                  if (selectedTrack) addPropertyKeyframe(selectedTrack.id, layerMaskChannel(maskId, property), currentFrame, value);
                }}
                onAddMaskPathKeyframe={(maskId, path) => {
                  if (selectedTrack) addMaskPathKeyframe(selectedTrack.id, maskId, currentFrame, path);
                }}
                onChangeMaskPath={(maskId, path) => {
                  if (selectedPartId) authorMaskPath(selectedPartId, maskId, path);
                }}
              />

            </>
          )}

          {activeTabSection === 'duplicate' && <DuplicateTab />}
        </div>
      )}

    </div>
  );
};
