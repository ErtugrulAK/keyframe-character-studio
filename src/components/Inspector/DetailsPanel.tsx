import React, { useRef, useState } from 'react';
import { useAnimator } from '../../context/useAnimator';
import { usePartPropertyAuthoring } from '../../hooks/usePartPropertyAuthoring';
import { useLockedRegion } from '../../hooks/useLockedRegion';
import { makeEmptyChannels } from '../../utils/defaults';
import { evaluateLayerMasks } from '../../utils/evaluateLayerMasks';
import { layerMaskIdsReferencedByTrack } from '../../utils/layerMasks';
import { transformMaskPathInLayerSpace } from '../../utils/maskPathCreation';
import { ConfirmationDialog } from '../Modal/ConfirmationDialog';
import { TransformTab } from './sections/TransformTab';
import { LayerParentField } from './LayerParentField';
import { editTargetText, resolveEditTarget } from '../../utils/editTarget';
import { StyleTab } from './sections/StyleTab';
import { evaluateTrimPath } from '../../utils/trimPath';
import { DuplicateTab } from './sections/DuplicateTab';
import {
  Sliders,
  Copy,
  Trash2,
  CopyPlus,
  Lock,
} from 'lucide-react';

/**
 * Details is the Inspector's information surface: it reports and edits the
 * SELECTED object's own properties. Structural commands — Group, Bind, Boolean —
 * are authoring operations and live in the top authoring toolbar (and the
 * editor's context menu), so they are not duplicated here.
 */
export const DetailsPanel: React.FC = () => {
  const [pendingClear, setPendingClear] = useState(false);
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
    maskEditTarget,
    enterMaskEditing,
    exitMaskEditing,
    maskDrawSession,
    startMaskDraw,
    matteReturnTargetId,
    selectMatteSource,
    backToMatteTarget,
    handleSelectPart,
    maskVertexIndex,
    setMaskVertexIndex,
    setLayersLocked,
    applyMaskPathOrder,
    convertToEditablePath,
    setPartPath,
    pathVertex,
    selectPathVertex,
  } = useAnimator();

  const [activeTabSection, setActiveTabSection] = useState<'edit' | 'duplicate'>('edit');
  // C5 — the same "what am I editing" description the canvas strip shows; the
  // Inspector names the session (mask path, mask drawing, matte source) under
  // the layer it belongs to. Its controls stay where they are (the canvas
  // strip's Finish, the mask row's toggle, the matte summary's Back), so no
  // second copy of them is added here.
  const editTarget = resolveEditTarget({
    characterParts,
    selectedPartId,
    selectedPartIds: selectedPartId ? [selectedPartId] : [],
    maskEditTarget,
    maskDrawSession,
    matteReturnTargetId,
    activeTool: 'select',
    pendingShapeType: null,
    freeformPointCount: null,
  });
  const sessionTarget = editTarget && (editTarget.kind === 'mask' || editTarget.kind === 'drawing-mask' || editTarget.kind === 'matte-source') ? editTarget : null;

  const selectedPart = characterParts.find((p) => p.id === selectedPartId);
  const selectedTrack = selectedPartId ? tracks.find((track) => track.partId === selectedPartId) : undefined;
  // WP-01: the Inspector shows the ACTIVE sequence's mask, as the renderer does.
  const evaluatedMasks = selectedPart && selectedTrack
    ? evaluateLayerMasks(selectedPart, selectedTrack, currentFrame, activeTemplateId || 'Sequence')
    : undefined;
  const inspectorPart = selectedPart && evaluatedMasks ? { ...selectedPart, masks: evaluatedMasks } : selectedPart;
  const transform = selectedPartId ? getComputedTransform(selectedPartId, currentFrame) : null;
  // C4 — a locked layer is inspected, not edited: its controls are disabled
  // (disclosure and navigation stay), and the banner offers the unlock.
  const isLocked = Boolean(selectedTrack?.locked);
  const bodyRef = useRef<HTMLDivElement>(null);
  useLockedRegion(bodyRef, isLocked);

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

  /**
   * D2 (K1): deleting authored animation is never silent. The button only
   * arms the request; the batch runs behind the dialog's Confirm, and
   * Cancel/Esc mutate nothing.
   */
  const clearKeyCount = (() => {
    const scope = activeTemplateId || 'Sequence';
    const track = tracks.find((t) => t.partId === selectedPartId);
    if (!track) return 0;
    const channelKeys = Object.values(track.channels ?? {}).reduce((sum, keys) => sum + keys.filter((k) => (k.templateId || 'Sequence') === scope).length, 0);
    return channelKeys + (track.keyframes ?? []).filter((k) => (k.templateId || 'Sequence') === scope).length;
  })();

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
            <span className="actor-main-name" title={selectedPart.name}>{selectedPart.name}</span>
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
              disabled={isLocked}
              title={isLocked ? 'A locked layer cannot be deleted' : 'Delete Actor Instance'}
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

      {selectedPart && sessionTarget && (
        <div className="details-edit-target" role="status" data-testid="inspector-edit-target" data-edit-target={sessionTarget.kind}>
          <span className="edit-target-mode">{sessionTarget.mode}</span>
          <span className="details-edit-target-path" title={editTargetText(sessionTarget)}>
            {sessionTarget.path.join(' / ')}
            {sessionTarget.detail ? <span className="details-edit-target-detail"> · {sessionTarget.detail}</span> : null}
          </span>
        </div>
      )}

      {selectedPart && isLocked && (
        <div className="details-lock-banner" role="status" data-testid="details-lock-banner">
          <Lock size={12} aria-hidden="true" />
          <span>This layer is locked. Its properties are shown but cannot be changed.</span>
          <button type="button" className="btn-secondary" onClick={() => setLayersLocked([selectedPart.id], false)}>
            Unlock
          </button>
        </div>
      )}

      {/* 4. Property Section Body */}
      {selectedPart && transform && (
        <div className="details-body" ref={bodyRef} data-locked={isLocked ? 'true' : undefined}>
          {activeTabSection === 'edit' && (
            <>
              <LayerParentField part={selectedPart} characterParts={characterParts} tracks={tracks} />
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
                onClearAnimation={() => setPendingClear(true)}
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
                reservedMaskIds={layerMaskIdsReferencedByTrack(selectedTrack)}
                maskEditTargetId={maskEditTarget?.ownerPartId === selectedPart.id ? maskEditTarget.maskId : null}
                onEditMaskOnCanvas={(maskId) => {
                  const refusal = enterMaskEditing(selectedPart.id, maskId);
                  if (refusal) showToast(refusal, 'error');
                }}
                onExitMaskEditing={exitMaskEditing}
                maskDrawShape={maskDrawSession?.ownerPartId === selectedPart.id ? maskDrawSession.shape : null}
                onStartMaskDraw={(shape) => {
                  const refusal = startMaskDraw(selectedPart.id, shape);
                  if (refusal) showToast(refusal, 'error');
                }}
                maskPathChannels={selectedTrack?.maskPathChannels}
                maskVertexIndex={maskVertexIndex}
                onSelectMaskVertex={setMaskVertexIndex}
                matteReturnTargetId={matteReturnTargetId}
                onSelectMatteSource={selectMatteSource}
                onBackToMatteTarget={backToMatteTarget}
                onPickRefused={(reason) => showToast(reason, 'info')}
                onMaskPathOrder={(maskId, command, index) => {
                  const outcome = applyMaskPathOrder(selectedPart.id, maskId, command, index);
                  if (!outcome.applied) return undefined;
                  if (maskEditTarget?.maskId === maskId) setMaskVertexIndex(outcome.selectedIndex);
                  return outcome.selectedIndex;
                }}
                onSelectMatteTarget={(targetId) => handleSelectPart(targetId)}
                onTransformMaskPath={(maskId, change) => {
                  // The DISPLAYED (active-sequence, current-frame) path is the
                  // one transformed, and the existing writer decides base vs key.
                  const displayed = evaluatedMasks?.find((mask) => mask.id === maskId) ?? selectedPart.masks?.find((mask) => mask.id === maskId);
                  if (!displayed) return;
                  authorMaskPath(selectedPart.id, maskId, transformMaskPathInLayerSpace(displayed.path, selectedPart, change));
                }}
                onColorInteractionStart={startBatchInteraction}
                onColorInteractionEnd={endBatchInteraction}
                pathEditing={{
                  tracks,
                  readOnlyReason: isLocked ? 'This layer is locked.' : null,
                  onConvert: convertToEditablePath,
                  onChangePath: setPartPath,
                  selectedIndex: pathVertex?.partId === selectedPart.id ? pathVertex.index : null,
                  onSelectIndex: (index) => selectPathVertex(selectedPart.id, index),
                }}
              />
              )}

            </>
          )}

          {activeTabSection === 'duplicate' && <DuplicateTab />}
        </div>
      )}

      <ConfirmationDialog
        isOpen={pendingClear}
        title="Clear this layer's animation?"
        description={`Clearing removes the IN/OUT presets and ${clearKeyCount} authored keyframe${clearKeyCount === 1 ? '' : 's'} of the selected layer in the active sequence. The authored property values stay. This edit is undoable.`}
        onCancel={() => setPendingClear(false)}
        onConfirm={() => {
          setPendingClear(false);
          handleClearAnimation();
        }}
      />
    </div>
  );
};
