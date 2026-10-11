import React, { useCallback, useEffect, useState } from 'react';
import { useAnimator } from './useAnimator';
import { EditorContextMenuContext, type ContextMenuRequest } from './editorContextMenu';
import { useBooleanAuthoring } from '../hooks/useBooleanAuthoring';
import { EditorContextMenu, type ContextMenuGroup } from '../components/Canvas/EditorContextMenu';
import { isBlockingModalOpen } from '../utils/modalBoundary';

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
  } = useAnimator();
  const { selectedBooleanGroup, dissolveBooleanGroup } = useBooleanAuthoring();
  const [menu, setMenu] = useState<ContextMenuRequest | null>(null);

  const closeContextMenu = useCallback(() => setMenu(null), []);

  /** Select All writes through the ordinary selection setters — no separate authority. */
  const selectAll = useCallback(() => {
    const ids = characterParts.map((part) => part.id);
    setSelectedPartIds(ids);
    setSelectedPartId(ids.length > 0 ? ids[ids.length - 1] : null);
  }, [characterParts, setSelectedPartId, setSelectedPartIds]);

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
      if (clipboardData) emptyStage.push({ id: 'paste', label: 'Paste', shortcut: 'Ctrl+V', run: pasteCopiedPart });
      if (characterParts.length > 0) emptyStage.push({ id: 'select-all', label: 'Select All', run: selectAll });
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
    if (hasPrimary) clipboardGroup.push({ id: 'copy', label: 'Copy', shortcut: 'Ctrl+C', run: copySelectedPart });
    clipboardGroup.push({
      id: 'paste',
      label: 'Paste',
      shortcut: 'Ctrl+V',
      disabled: !clipboardData,
      run: pasteCopiedPart,
    });
    if (hasPrimary) clipboardGroup.push({ id: 'duplicate', label: 'Duplicate', shortcut: 'Ctrl+D', run: duplicateSelectedPart });
    if (hasPrimary) clipboardGroup.push({ id: 'delete', label: 'Delete', shortcut: 'Del', run: deleteSelection });

    const arrangement: ContextMenuGroup = [
      { id: 'bring-forward', label: 'Bring Forward', disabled: !single || index <= 0, run: () => reorderParts(index, index - 1) },
      { id: 'send-backward', label: 'Send Backward', disabled: !single || index < 0 || index >= total - 1, run: () => reorderParts(index, index + 1) },
      { id: 'bring-to-front', label: 'Bring to Front', disabled: !single || index <= 0, run: () => reorderParts(index, 0) },
      { id: 'send-to-back', label: 'Send to Back', disabled: !single || index < 0 || index >= total - 1, run: () => reorderParts(index, total - 1) },
    ];

    return [clipboardGroup, [{ id: 'select-all', label: 'Select All', run: selectAll }], arrangement];
  }, [
    characterParts,
    clipboardData,
    copySelectedPart,
    deleteSelection,
    duplicateSelectedPart,
    pasteCopiedPart,
    reorderParts,
    selectAll,
    selectedPartId,
    selectedPartIds,
  ]);

  const openContextMenu = useCallback((request: ContextMenuRequest) => {
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

  // Shift+F10 / the ContextMenu key opens the same menu for the current
  // selection, anchored on the layer's rendered box (or the stage centre).
  useEffect(() => {
    if (appMode !== 'edit') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMenuKey = event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10');
      if (!isMenuKey || isBlockingModalOpen()) return;
      const active = document.activeElement;
      if (active && (
        active.tagName === 'INPUT'
        || active.tagName === 'TEXTAREA'
        || active.tagName === 'SELECT'
        || (active as HTMLElement).isContentEditable
      )) return;
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
    <EditorContextMenuContext.Provider value={{ openContextMenu, closeContextMenu }}>
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
