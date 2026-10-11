import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterPart } from '../types/animator';

const shape = (id: string, overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id,
  type: 'custom_rect',
  zIndex: 1,
  fillColor: '#336699',
  strokeColor: '#101218',
  width: 100,
  height: 100,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  ...overrides,
});

const animatorCtx = {
  appMode: 'edit',
  characterParts: [] as CharacterPart[],
  tracks: [] as unknown[],
  selectedPartId: null as string | null,
  selectedPartIds: [] as string[],
  setSelectedPartId: vi.fn(),
  setSelectedPartIds: vi.fn(),
  handleSelectPart: vi.fn(),
  deletePart: vi.fn(),
  copySelectedPart: vi.fn(),
  pasteCopiedPart: vi.fn(),
  duplicateSelectedPart: vi.fn(),
  clipboardData: null as { part: CharacterPart } | null,
  reorderParts: vi.fn(),
  booleanOperandEditingGroupId: null as string | null,
  setBooleanOperandEditingGroupId: vi.fn(),
  getComputedTransform: vi.fn(() => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 })),
  showToast: vi.fn(),
  startBatchInteraction: vi.fn(),
  endBatchInteraction: vi.fn(),
  currentFrame: 0,
  activeTemplateId: 'Sequence',
  updatePropertyKeyframeValue: vi.fn(),
  setCharacterParts: vi.fn(),
  setTracks: vi.fn(),
};

vi.mock('../context/useAnimator', () => ({ useAnimator: () => animatorCtx }));

import { EditorContextMenuProvider } from '../context/EditorContextMenuContext';
import { useEditorContextMenu } from '../context/editorContextMenu';

const MenuHarness: React.FC = () => {
  const { openContextMenu } = useEditorContextMenu();
  return (
    <>
      <div className="stage-canvas-container" />
      <button type="button" onClick={() => openContextMenu({ point: { x: 10, y: 20 }, targetId: 'a' })}>object-menu</button>
      <button type="button" onClick={() => openContextMenu({ point: { x: 10, y: 20 }, targetId: null })}>empty-menu</button>
    </>
  );
};

const renderMenu = () => render(
  <EditorContextMenuProvider>
    <MenuHarness />
  </EditorContextMenuProvider>,
);

const openObjectMenu = () => fireEvent.click(screen.getByRole('button', { name: 'object-menu' }));
const openEmptyMenu = () => fireEvent.click(screen.getByRole('button', { name: 'empty-menu' }));
// A menu item's accessible name carries its shortcut ("CopyCtrl+C"), so items
// are matched on the label prefix rather than the full string.
const menuItemPattern = (name: string) => new RegExp(`^${name}`);
const menuItem = (name: string) => screen.getByRole('menuitem', { name: menuItemPattern(name) });
const queryMenuItem = (name: string) => screen.queryByRole('menuitem', { name: menuItemPattern(name) });

describe('EditorContextMenu', () => {
  beforeEach(() => {
    animatorCtx.appMode = 'edit';
    animatorCtx.characterParts = [shape('a'), shape('b')];
    animatorCtx.clipboardData = null;
    animatorCtx.selectedPartId = 'a';
    animatorCtx.selectedPartIds = ['a'];
    vi.clearAllMocks();
  });

  it('offers only supported object actions — no Inspect and no Group/Ungroup', () => {
    renderMenu();
    openObjectMenu();

    for (const label of ['Cut', 'Copy', 'Paste', 'Duplicate', 'Delete', 'Select All', 'Bring Forward', 'Send Backward', 'Bring to Front', 'Send to Back']) {
      expect(menuItem(label)).toBeTruthy();
    }
    expect(screen.queryByRole('menuitem', { name: /inspect/i })).toBeNull();
    expect(queryMenuItem('Group')).toBeNull();
    expect(queryMenuItem('Ungroup')).toBeNull();
  });

  it('runs Delete, Duplicate, Copy and Paste through the existing editor actions', () => {
    renderMenu();
    openObjectMenu();
    fireEvent.click(menuItem('Delete'));
    expect(animatorCtx.deletePart).toHaveBeenCalledWith('a');

    openObjectMenu();
    fireEvent.click(menuItem('Duplicate'));
    expect(animatorCtx.duplicateSelectedPart).toHaveBeenCalledTimes(1);

    openObjectMenu();
    fireEvent.click(menuItem('Copy'));
    expect(animatorCtx.copySelectedPart).toHaveBeenCalledTimes(1);

    // Paste is unavailable while the editor clipboard is empty.
    openObjectMenu();
    expect(menuItem('Paste')).toBeDisabled();
    expect(animatorCtx.pasteCopiedPart).not.toHaveBeenCalled();
  });

  it('enables Paste once the editor clipboard carries a layer', () => {
    animatorCtx.clipboardData = { part: shape('a') };
    renderMenu();
    openObjectMenu();

    fireEvent.click(menuItem('Paste'));
    expect(animatorCtx.pasteCopiedPart).toHaveBeenCalledTimes(1);
  });

  it('cuts by copying then removing the selection', () => {
    renderMenu();
    openObjectMenu();
    fireEvent.click(menuItem('Cut'));
    expect(animatorCtx.copySelectedPart).toHaveBeenCalledTimes(1);
    expect(animatorCtx.deletePart).toHaveBeenCalledWith('a');
  });

  it('keeps a multi-selection: no Cut, disabled arrangement', () => {
    animatorCtx.selectedPartIds = ['a', 'b'];
    animatorCtx.selectedPartId = 'b';
    renderMenu();
    openObjectMenu();

    expect(queryMenuItem('Cut')).toBeNull();
    expect(menuItem('Bring Forward')).toBeDisabled();
    expect(menuItem('Send Backward')).toBeDisabled();
    expect(menuItem('Bring to Front')).toBeDisabled();
    expect(menuItem('Send to Back')).toBeDisabled();
  });

  it('arranges a single layer through the shared reorder authority', () => {
    animatorCtx.selectedPartIds = ['b'];
    animatorCtx.selectedPartId = 'b';
    renderMenu();
    openObjectMenu();

    expect(menuItem('Bring Forward')).not.toBeDisabled();
    fireEvent.click(menuItem('Bring Forward'));
    expect(animatorCtx.reorderParts).toHaveBeenCalledWith(1, 0);

    openObjectMenu();
    expect(menuItem('Send Backward')).toBeDisabled();

    openObjectMenu();
    fireEvent.click(menuItem('Bring to Front'));
    expect(animatorCtx.reorderParts).toHaveBeenCalledWith(1, 0);

    openObjectMenu();
    // Index 1 of 2 is already the back of the stack.
    expect(menuItem('Send to Back')).toBeDisabled();
  });

  it('shows the empty-stage menu with only the actions that can run there', () => {
    renderMenu();
    openEmptyMenu();

    expect(menuItem('Select All')).toBeTruthy();
    expect(queryMenuItem('Paste')).toBeNull();
    expect(queryMenuItem('Delete')).toBeNull();
    expect(queryMenuItem('Duplicate')).toBeNull();
  });

  it('offers Paste on an empty stage when the clipboard has content', () => {
    animatorCtx.clipboardData = { part: shape('a') };
    renderMenu();
    openEmptyMenu();

    expect(menuItem('Paste')).toBeTruthy();
    expect(menuItem('Select All')).toBeTruthy();
  });

  it('does not open the empty-stage menu when nothing is actionable', () => {
    animatorCtx.characterParts = [];
    animatorCtx.selectedPartId = null;
    animatorCtx.selectedPartIds = [];
    renderMenu();
    openEmptyMenu();

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('selects all layers through the ordinary selection setters', () => {
    renderMenu();
    openObjectMenu();
    fireEvent.click(menuItem('Select All'));

    expect(animatorCtx.setSelectedPartIds).toHaveBeenCalledWith(['a', 'b']);
    expect(animatorCtx.setSelectedPartId).toHaveBeenCalledWith('b');
  });

  it('selects the right-clicked layer when it is not part of the selection', () => {
    animatorCtx.selectedPartIds = [];
    animatorCtx.selectedPartId = null;
    renderMenu();
    openObjectMenu();
    expect(animatorCtx.handleSelectPart).toHaveBeenCalledWith('a');
  });

  it('preserves an existing multi-selection and only makes the target primary', () => {
    animatorCtx.selectedPartIds = ['a', 'b'];
    animatorCtx.selectedPartId = 'b';
    renderMenu();
    openObjectMenu();
    expect(animatorCtx.handleSelectPart).not.toHaveBeenCalled();
    expect(animatorCtx.setSelectedPartId).toHaveBeenCalledWith('a');
  });

  it('closes on Escape and returns focus to where it came from', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'object-menu' });
    trigger.focus();
    openObjectMenu();

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('opens from the ContextMenu key for the current selection', () => {
    renderMenu();
    fireEvent.keyDown(window, { key: 'ContextMenu' });

    const menu = screen.getByRole('menu');
    expect(menu).toBeTruthy();
    expect(menuItem('Delete')).toBeTruthy();
  });

  it('never leaves the menu in the browser-native context menu path', () => {
    renderMenu();
    openObjectMenu();
    const menu = screen.getByRole('menu');
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    menu.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
