import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { isConvertibleShapeType, shapeToPathBlockReason } from '../utils/geometry/shapeToPath';
import { useAnimatorSlice } from './useAnimator';
import { EditorContextMenuContext, type ContextMenuRequest } from './editorContextMenu';
import { useBooleanAuthoring } from '../hooks/useBooleanAuthoring';
import { useLayerGrouping } from '../hooks/useLayerGrouping';
import { EditorContextMenu, type ContextMenuGroup } from '../components/Canvas/EditorContextMenu';
import { isBlockingModalOpen } from '../utils/editor/modalBoundary';
import { isEditableElement } from '../utils/editor/keyboardFocus';
import { detectShortcutPlatform, formatShortcutHint, type ShortcutCommandId } from '../utils/editor/shortcuts';
import { selectAllLayers } from '../utils/layers/layerSelection';
import { lockedLayerIds } from '../utils/layers/layerLocks';
import { useLayerParenting } from '../hooks/useLayerParenting';
import { requestOutlinerCommand } from '../utils/layers/outlinerCommands';
import { relationshipParentId } from '../utils/layers/partBinding';
import { deletionCommandLabel, describeDeletionScope } from '../utils/layers/partDeletion';

/**
 * The one right-click menu of the editor, shared by the stage and the outliner.
 *
 * It owns the menu's open/closed state and the item model only. Every item runs
 * an authority that already exists (clipboard, part deletion, layer reordering,
 * selection), so the menu adds no second implementation of any editor action.
 * Items are built from the LIVE selection, which is why the target of an object
 * right-click is selected (or kept) before the menu opens.
 */
export const EditorContextMenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    appMode,
    characterParts,
    tracks,
    selectedPartId,
    selectedPartIds,
    setSelectedPartId,
    setSelectedPartIds,
    handleSelectPart,
    deletePart,
    copySelectedPart,
    pasteCopiedPart,
    duplicateSelectedPart,
    clipboardData,
    reorderParts,
    booleanOperandEditingGroupId,
    setBooleanOperandEditingGroupId,
    setLayersLocked,
    toggleTrackEditVisibility,
    convertToEditablePath,
  } = useAnimatorSlice(
    'appMode', 'characterParts', 'tracks', 'selectedPartId', 'selectedPartIds', 'setSelectedPartId',
    'setSelectedPartIds', 'handleSelectPart', 'deletePart', 'copySelectedPart', 'pasteCopiedPart',
    'duplicateSelectedPart', 'clipboardData', 'reorderParts', 'booleanOperandEditingGroupId',
    'setBooleanOperandEditingGroupId', 'setLayersLocked', 'toggleTrackEditVisibility', 'convertToEditablePath',
  );
  const { selectedBooleanGroup, dissolveBooleanGroup } = useBooleanAuthoring();
  const { selectedGroup, canGroup, groupSelection, ungroupSelection } = useLayerGrouping();
  const { nestIntoLayerAbove, unparentLayer } = useLayerParenting();
  const [menu, setMenu] = useState<ContextMenuRequest | null>(null);

  const closeContextMenu = useCallback(() => setMenu(null), []);

  /**
   * The hint beside a menu row is the keymap's own label for that binding, so a
   * menu row can never advertise a key the editor does not bind, and the labels
   * follow the platform (`Ctrl+C` on Windows/Linux, `⌘C` on macOS).
   */
  const hint = useCallback(
    (id: ShortcutCommandId) => formatShortcutHint(id, detectShortcutPlatform()),
    [],
  );

  /** Select All writes through the ordinary selection setters — no separate authority. */
  const selectAll = useCallback(
    () => selectAllLayers(characterParts, { setSelectedPartIds, setSelectedPartId }, lockedLayerIds(tracks)),
    [characterParts, setSelectedPartId, setSelectedPartIds, tracks],
  );

  /** Delete mirrors the Inspector's own trash action, including Boolean groups. */
  const deleteSelection = useCallback(() => {
    if (selectedBooleanGroup) {
      dissolveBooleanGroup();
      return;
    }
    if (selectedPartId) deletePart(selectedPartId);
  }, [deletePart, dissolveBooleanGroup, selectedBooleanGroup, selectedPartId]);

  /**
   * Builds the item groups for a request. `targetId === null` is the empty-stage
   * menu: it offers only what can actually run there (no disabled clutter), and
   * it never touches the selection. An object menu always includes the target in
   * the current selection and then operates on that selection.
   */
  const buildGroups = useCallback((targetId: string | null): ContextMenuGroup[] => {
    const hasPrimary = Boolean(selectedPartId && characterParts.some((part) => part.id === selectedPartId));
    const index = hasPrimary ? characterParts.findIndex((part) => part.id === selectedPartId) : -1;
    const total = characterParts.length;
    const single = hasPrimary && selectedPartIds.length === 1;

    if (targetId === null) {
      const groups: ContextMenuGroup[] = [];
      const emptyStage: ContextMenuGroup = [];
      if (clipboardData) emptyStage.push({ id: 'paste', label: 'Paste', shortcut: hint('paste'), run: pasteCopiedPart });
      if (characterParts.length > 0) emptyStage.push({ id: 'select-all', label: 'Select All', shortcut: hint('select-all'), run: selectAll });
      if (emptyStage.length > 0) groups.push(emptyStage);
      return groups;
    }

    const clipboardGroup: ContextMenuGroup = [];
    if (single) {
      // Cut copies the primary layer and removes the selection; with more than
      // one selected the copy half would only carry one of them, so it is
      // offered for a single selection only.
      clipboardGroup.push({
        id: 'cut',
        label: 'Cut',
        run: () => {
          copySelectedPart();
          deleteSelection();
        },
      });
    }
    if (hasPrimary) clipboardGroup.push({ id: 'copy', label: 'Copy', shortcut: hint('copy'), run: copySelectedPart });
    clipboardGroup.push({
      id: 'paste',
      label: 'Paste',
      shortcut: hint('paste'),
      disabled: !clipboardData,
      run: pasteCopiedPart,
    });
    if (hasPrimary) clipboardGroup.push({ id: 'duplicate', label: 'Duplicate', shortcut: hint('duplicate'), run: duplicateSelectedPart });
    // The label names the delete's scope: a group takes its layers, a plain
    // parent keeps its children.
    if (hasPrimary) clipboardGroup.push({ id: 'delete', label: selectedBooleanGroup ? 'Delete' : deletionCommandLabel(describeDeletionScope(characterParts, selectedPartIds.includes(selectedPartId as string) ? selectedPartIds : [selectedPartId as string])), shortcut: hint('delete-selection'), run: deleteSelection });

    const arrangement: ContextMenuGroup = [
      { id: 'bring-forward', label: 'Bring Forward', disabled: !single || index <= 0, run: () => reorderParts(index, index - 1) },
      { id: 'send-backward', label: 'Send Backward', disabled: !single || index < 0 || index >= total - 1, run: () => reorderParts(index, index + 1) },
      { id: 'bring-to-front', label: 'Bring to Front', disabled: !single || index <= 0, run: () => reorderParts(index, 0) },
      { id: 'send-to-back', label: 'Send to Back', disabled: !single || index < 0 || index >= total - 1, run: () => reorderParts(index, total - 1) },
    ];

    // Grouping is offered only when it would actually run: an existing group is
    // ungrouped, a valid multi-selection is grouped. Both run the same shared
    // layer-grouping authority the toolbar and the Inspector use.
    // Naming and hierarchy for one layer, through the layer tree and the
    // one parenting authority (refusals explain themselves in a toast).
    const primaryPart = hasPrimary ? characterParts[index] : undefined;
    const hasParent = Boolean(primaryPart && characterParts.some((part) => part.id === relationshipParentId(primaryPart)));
    const layerActions: ContextMenuGroup = single && primaryPart ? [
      { id: 'rename', label: 'Rename', shortcut: 'F2', run: () => requestOutlinerCommand({ type: 'rename', partId: primaryPart.id }) },
      { id: 'nest-above', label: 'Nest into Layer Above', shortcut: hint('layer-nest'), run: () => { nestIntoLayerAbove(primaryPart.id); } },
      { id: 'unparent', label: 'Unparent', shortcut: hint('layer-unparent'), disabled: !hasParent, run: () => { unparentLayer(primaryPart.id); } },
    ] : [];
    // The layer row's own switches (stage visibility, lock), reachable by
    // keyboard through this menu (Shift+F10) as well as by pointer on the row.
    const primaryTrack = primaryPart ? tracks.find((candidate) => candidate.partId === primaryPart.id) : undefined;
    if (single && primaryPart && primaryTrack) {
      layerActions.push(
        { id: 'toggle-visibility', label: primaryTrack.editVisible === false ? 'Show on Stage' : 'Hide on Stage', run: () => toggleTrackEditVisibility(primaryTrack.id) },
        { id: 'toggle-lock', label: primaryTrack.locked ? 'Unlock' : 'Lock', shortcut: hint('lock-layers'), run: () => setLayersLocked([primaryPart.id], !primaryTrack.locked) },
      );
    }
    // A basic shape can become an editable path; a refused case stays
    // listed, disabled, so the reason is one hover away.
    if (single && primaryPart && isConvertibleShapeType(primaryPart.type)) {
      const blocked = shapeToPathBlockReason(primaryPart, tracks) ?? (primaryTrack?.locked ? 'This layer is locked.' : null);
      layerActions.push({ id: 'convert-to-path', label: 'Convert to Editable Path', disabled: Boolean(blocked), ...(blocked ? { title: blocked } : {}), run: () => { convertToEditablePath(primaryPart.id); } });
    }

    const groupActions: ContextMenuGroup = [];
    if (selectedGroup) groupActions.push({ id: 'ungroup', label: 'Ungroup', run: ungroupSelection });
    else if (canGroup) groupActions.push({ id: 'group', label: 'Group Layers', run: groupSelection });

    return [
      clipboardGroup,
      ...(layerActions.length > 0 ? [layerActions] : []),
      ...(groupActions.length > 0 ? [groupActions] : []),
      [{ id: 'select-all', label: 'Select All', shortcut: hint('select-all'), run: selectAll }],
      arrangement,
    ];
  }, [
    characterParts,
    clipboardData,
    copySelectedPart,
    canGroup,
    convertToEditablePath,
    deleteSelection,
    duplicateSelectedPart,
    groupSelection,
    hint,
    nestIntoLayerAbove,
    pasteCopiedPart,
    reorderParts,
    selectAll,
    selectedBooleanGroup,
    selectedGroup,
    selectedPartId,
    selectedPartIds,
    setLayersLocked,
    toggleTrackEditVisibility,
    tracks,
    ungroupSelection,
    unparentLayer,
  ]);

  const openMenuWithLatest = useCallback((request: ContextMenuRequest) => {
    const { targetId } = request;
    if (targetId === null) {
      // Nothing to offer on an empty stage: the menu simply does not open.
      if (buildGroups(null).length === 0) return;
      setMenu(request);
      return;
    }
    // Object right-click selects the target when it is not already part of the
    // selection, and otherwise only makes it primary — so a multi-selection
    // survives the right-click.
    if (!selectedPartIds.includes(targetId)) {
      handleSelectPart(targetId);
    } else if (selectedPartId !== targetId) {
      setSelectedPartId(targetId);
    }
    const target = characterParts.find((part) => part.id === targetId);
    if (
      booleanOperandEditingGroupId
      && target
      && target.id !== booleanOperandEditingGroupId
      && target.booleanGroupId !== booleanOperandEditingGroupId
    ) {
      setBooleanOperandEditingGroupId(null);
    }
    setMenu(request);
  }, [
    buildGroups,
    booleanOperandEditingGroupId,
    characterParts,
    handleSelectPart,
    selectedPartId,
    selectedPartIds,
    setBooleanOperandEditingGroupId,
    setSelectedPartId,
  ]);
  // A stable opener for the context value (it calls the latest one), so the
  // panels that open menus do not render again whenever this provider does.
  const latestOpener = useRef(openMenuWithLatest);
  useLayoutEffect(() => { latestOpener.current = openMenuWithLatest; });
  const openContextMenu = useCallback((request: ContextMenuRequest) => latestOpener.current(request), []);
  const contextValue = useMemo(() => ({ openContextMenu, closeContextMenu }), [openContextMenu, closeContextMenu]);

  // Shift+F10 / the ContextMenu key opens the same menu for the current
  // selection, anchored on the layer's rendered box (or the stage centre).
  useEffect(() => {
    if (appMode !== 'edit') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMenuKey = event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10');
      if (!isMenuKey || isBlockingModalOpen()) return;
      if (isEditableElement(document.activeElement)) return;
      const stage = document.querySelector('.stage-canvas-container');
      if (!stage) return;
      const node = selectedPartId ? document.querySelector(`[data-part-id="${selectedPartId}"]`) : null;
      const rect = (node ?? stage).getBoundingClientRect();
      event.preventDefault();
      openContextMenu({
        point: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        targetId: selectedPartId ?? null,
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appMode, openContextMenu, selectedPartId]);

  return (
    <EditorContextMenuContext.Provider value={contextValue}>
      {children}
      <EditorContextMenu
        isOpen={menu !== null}
        point={menu?.point ?? null}
        groups={menu ? buildGroups(menu.targetId) : []}
        onClose={closeContextMenu}
      />
    </EditorContextMenuContext.Provider>
  );
};
