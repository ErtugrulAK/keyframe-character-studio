import React, { useEffect, useRef, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useAnimator } from '../../context/useAnimator';
import { usePartPropertyAuthoring } from '../../hooks/usePartPropertyAuthoring';
import { useLockedRegion } from '../../hooks/useLockedRegion';
import { makeEmptyChannels } from '../../utils/defaults';
import { evaluateLayerMasks } from '../../utils/evaluateLayerMasks';
import { ConfirmationDialog } from '../Modal/ConfirmationDialog';
import { TransformTab } from './sections/TransformTab';
import { LayerParentField } from './LayerParentField';
import { editTargetText, layerTypeLabel, resolveEditTarget } from '../../utils/editTarget';
import { StyleTab } from './sections/StyleTab';
import { evaluateTrimPath } from '../../utils/trimPath';
import { AnimationDataCard } from './sections/AnimationDataCard';
import { StyleCard } from './sections/style/StyleCard';
import { useRetainedUiState } from '../../hooks/useRetainedUiState';
import {
  Sliders,
  Lock,
  MousePointerClick,
} from 'lucide-react';

/** C7 — the Details tabs: what the layer looks like, what cuts it, how it relates and animates. */
type DetailsTab = 'properties' | 'masks' | 'layer';

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

  /*
   * C7 — Details is split into tabs (Radix Tabs: roving arrow keys, Home/End,
   * tab/tabpanel roles): Properties (transform, paint, text, Trim Path,
   * geometry, effects), Masks (layer masks, Track Matte, legacy clip matte) and
   * Layer (parent, animation data). The choice is session UI memory, like an
   * open card. A mask or matte session (editing a mask path, drawing a layer
   * mask, picking a matte source) opens the Masks tab, where its controls are;
   * an effect-only mask stays with Color Correction in Properties.
   */
  const [detailsTab, setDetailsTab] = useRetainedUiState<DetailsTab>('inspector.details-tab', 'properties');
  const [tabPointer, setTabPointer] = useState(false);
  // An effect-only mask (drawing it, or editing it after the draw) belongs to
  // Color Correction, so it keeps the Properties tab.
  const editsEffectMask = sessionTarget?.kind === 'drawing-mask'
    ? maskDrawSession?.purpose === 'effect'
    : sessionTarget?.kind === 'mask'
      && characterParts.find((part) => part.id === maskEditTarget?.ownerPartId)?.masks?.find((mask) => mask.id === maskEditTarget?.maskId)?.affectsAlpha === false;
  const opensMasksTab = Boolean(sessionTarget) && !editsEffectMask;
  useEffect(() => {
    if (opensMasksTab) setDetailsTab('masks');
  }, [opensMasksTab, selectedPartId, setDetailsTab]);

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
  // A group container owns no geometry, so it has no paint, masks or matte.
  const hasMasksTab = Boolean(selectedPart && !selectedPart.isGroup);
  const shownTab: DetailsTab = detailsTab === 'masks' && !hasMasksTab ? 'properties' : detailsTab;
  // Shown on the Masks tab, so a mask or matte is never hidden behind it unnoticed.
  const masksInUse = (selectedPart?.masks?.length ?? 0) + (selectedPart?.trackMatte ? 1 : 0) + (selectedPart?.matte?.sourcePartId ? 1 : 0);
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
            <span className="actor-type-label">{layerTypeLabel(selectedPart)}</span>
          </div>

        </div>
      ) : (
        <div className="details-empty-state">
          <span className="details-empty-icon" aria-hidden="true"><MousePointerClick size={18} /></span>
          <strong className="details-empty-title">No layer selected</strong>
          <span>Select an element on Canvas or Outliner to view details</span>
        </div>
      )}

      {/* C10 — selecting a matte source needs no caption here either. */}
      {selectedPart && sessionTarget && sessionTarget.kind !== 'matte-source' && (
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

      {/* 4. Property Section Body. C8: the header carries no actions — delete,
          duplicate and paste live in the keyboard and the context menu, and
          the duplicate / mirror copies in the Layer tab. */}
      {selectedPart && transform && (
        <Tabs.Root
          className="details-tabs"
          value={shownTab}
          onValueChange={(value) => setDetailsTab(value as DetailsTab)}
        >
          {/* Radix focuses the tab on pointer-down, which Chrome then paints as
              :focus-visible; the ring is for keyboard users only. */}
          <Tabs.List
            className="details-tab-list"
            aria-label="Details sections"
            data-pointer={tabPointer ? 'true' : undefined}
            onPointerDown={() => setTabPointer(true)}
            onKeyDown={() => setTabPointer(false)}
          >
            <Tabs.Trigger className="details-tab" value="properties">Properties</Tabs.Trigger>
            {hasMasksTab && (
              <Tabs.Trigger className="details-tab" value="masks">
                Masks
                {masksInUse > 0 && <span className="details-tab-count" aria-label={`, ${masksInUse} in use`}>{masksInUse}</span>}
              </Tabs.Trigger>
            )}
            <Tabs.Trigger className="details-tab" value="layer">Layer</Tabs.Trigger>
          </Tabs.List>

          <div className="details-body" ref={bodyRef} data-locked={isLocked ? 'true' : undefined}>
            <Tabs.Content className="details-tab-panel" value="properties">
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
              />
              {!selectedPart.isGroup && (
                <StyleTab
                  section="properties"
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
              onColorInteractionStart={startBatchInteraction}
              onColorInteractionEnd={endBatchInteraction}
              colorCorrection={{
                evaluatedMasks,
                onChangeEffects: (effects) => handleDisplayedPartPropChange('effects', effects),
                onDrawEffectMask: (shape) => {
                  const refusal = startMaskDraw(selectedPart.id, shape, 'effect');
                  if (refusal) showToast(refusal, 'error');
                },
                drawingEffectMask: maskDrawSession?.ownerPartId === selectedPart.id && maskDrawSession.purpose === 'effect' ? maskDrawSession.shape : null,
                readOnlyReason: isLocked ? 'This layer is locked.' : null,
              }}
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
            </Tabs.Content>

            {hasMasksTab && (
              <Tabs.Content className="details-tab-panel" value="masks">
                <StyleTab
                  section="masks"
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
              onColorInteractionStart={startBatchInteraction}
              onColorInteractionEnd={endBatchInteraction}
              colorCorrection={{
                evaluatedMasks,
                onChangeEffects: (effects) => handleDisplayedPartPropChange('effects', effects),
                onDrawEffectMask: (shape) => {
                  const refusal = startMaskDraw(selectedPart.id, shape, 'effect');
                  if (refusal) showToast(refusal, 'error');
                },
                drawingEffectMask: maskDrawSession?.ownerPartId === selectedPart.id && maskDrawSession.purpose === 'effect' ? maskDrawSession.shape : null,
                readOnlyReason: isLocked ? 'This layer is locked.' : null,
              }}
              pathEditing={{
                tracks,
                readOnlyReason: isLocked ? 'This layer is locked.' : null,
                onConvert: convertToEditablePath,
                onChangePath: setPartPath,
                selectedIndex: pathVertex?.partId === selectedPart.id ? pathVertex.index : null,
                onSelectIndex: (index) => selectPathVertex(selectedPart.id, index),
              }}
                />
              </Tabs.Content>
            )}

            <Tabs.Content className="details-tab-panel" value="layer">
              {!selectedPart.booleanGroupId && (
                <StyleCard title="HIERARCHY" collapsible defaultOpen retainKey="layer-hierarchy">
                  <LayerParentField part={selectedPart} characterParts={characterParts} tracks={tracks} />
                </StyleCard>
              )}
              <AnimationDataCard
                partId={selectedPart.id}
                defaultOpen
                onCopyAnimation={handleCopyAnimation}
                onPasteAnimation={handlePasteAnimation}
                onClearAnimation={() => setPendingClear(true)}
                clipboardSourceId={clipboardData?.part.id ?? null}
              />
            </Tabs.Content>
          </div>
        </Tabs.Root>
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
