import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterPart, Track } from '../types/animator';
import { HEADER_COMMAND_EVENT } from '../utils/editor/headerCommands';

/**
 * The menu bar: each row runs an existing command, disabled rows run
 * nothing, and the bar works from the keyboard.
 */
const part = (id: string): CharacterPart => ({
  id, name: id, type: 'custom_rect', zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
} as CharacterPart);
const track = (partId: string, overrides: Partial<Track> = {}): Track => ({
  id: `track-${partId}`, partId, name: partId, color: '#fff', visible: true, locked: false, channels: {},
  ...overrides,
} as Track);

const ctx = {
  undo: vi.fn(), redo: vi.fn(), canUndo: false, canRedo: true,
  copySelectedPart: vi.fn(), pasteCopiedPart: vi.fn(), duplicateSelectedPart: vi.fn(), duplicateMirrored: vi.fn(),
  clipboardData: null as null | { part: CharacterPart },
  pasteAnimationOntoSelected: vi.fn(),
  selectedPartId: null as string | null, selectedPartIds: [] as string[],
  setSelectedPartId: vi.fn(), setSelectedPartIds: vi.fn(),
  characterParts: [] as CharacterPart[], tracks: [] as Track[],
  convertToEditablePath: vi.fn(), resetSelectedTransforms: vi.fn(), setLayersLocked: vi.fn(), toggleTrackEditVisibility: vi.fn(),
  openShortcutReference: vi.fn(), reorderParts: vi.fn(), setAppMode: vi.fn(),
};
const contextMenu = { selectAll: vi.fn(), deleteSelection: vi.fn() };

vi.mock('../context/useAnimator', () => ({ useAnimatorSlice: () => ctx }));
vi.mock('../context/editorContextMenu', () => ({ useEditorContextMenu: () => contextMenu }));
vi.mock('../hooks/useMediaImport', () => ({ useMediaImport: () => vi.fn() }));
vi.mock('../components/MenuBar/ProjectSettingsDialog', () => ({
  ProjectSettingsDialog: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div role="dialog" aria-label="Project Settings" /> : null),
}));

const { MenuBar } = await import('../components/MenuBar/MenuBar');

const bar = () => screen.getByRole('menubar', { name: 'Editor menu' });
const title = (name: string) => within(bar()).getByRole('menuitem', { name, exact: true });
const openMenu = (name: string) => {
  fireEvent.click(title(name));
  return screen.getByRole('menu', { name });
};
const activeRow = () => bar().querySelector('.menu-bar-item.active')?.textContent;

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(ctx, {
    canUndo: false, canRedo: true, clipboardData: null, selectedPartId: null, selectedPartIds: [],
    characterParts: [part('a'), part('b')], tracks: [track('a'), track('b')],
  });
});
afterEach(() => vi.restoreAllMocks());

describe('MenuBar', () => {
  it('a title opens its menu and a second click closes it', () => {
    render(<MenuBar />);
    openMenu('Edit');
    expect(title('Edit')).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(title('Edit'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('runs a row and closes; a disabled row runs nothing and stays open', () => {
    render(<MenuBar />);
    const edit = openMenu('Edit');
    const undo = within(edit).getByRole('menuitem', { name: /Undo/ });
    expect(undo).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(undo);
    expect(ctx.undo).not.toHaveBeenCalled();
    expect(screen.getByRole('menu', { name: 'Edit' })).toBeInTheDocument();
    fireEvent.click(within(edit).getByRole('menuitem', { name: /Redo/ }));
    expect(ctx.redo).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('File rows go to the header as commands', () => {
    const heard: string[] = [];
    const listener = (event: Event) => heard.push((event as CustomEvent<{ command: string }>).detail.command);
    window.addEventListener(HEADER_COMMAND_EVENT, listener);
    render(<MenuBar />);
    fireEvent.click(within(openMenu('File')).getByRole('menuitem', { name: 'Import…' }));
    fireEvent.click(within(openMenu('File')).getByRole('menuitem', { name: 'Export OGraf Package' }));
    window.removeEventListener(HEADER_COMMAND_EVENT, listener);
    expect(heard).toEqual(['import', 'export-ograf']);
  });

  it('Project Settings opens its dialog', () => {
    render(<MenuBar />);
    fireEvent.click(within(openMenu('File')).getByRole('menuitem', { name: /Project Settings/ }));
    expect(screen.getByRole('dialog', { name: 'Project Settings' })).toBeInTheDocument();
  });

  it('Paste in Place pastes in place; plain Paste does not', () => {
    ctx.clipboardData = { part: part('a') };
    render(<MenuBar />);
    fireEvent.click(within(openMenu('Edit')).getByRole('menuitem', { name: 'Paste in Place' }));
    expect(ctx.pasteCopiedPart).toHaveBeenLastCalledWith({ inPlace: true });
    fireEvent.click(openMenu('Edit').querySelector('[data-menu-item="paste"]')!);
    expect(ctx.pasteCopiedPart).toHaveBeenLastCalledWith();
  });

  it('Object rows follow the selection: front/back by position, Lock becomes Unlock', () => {
    Object.assign(ctx, { selectedPartId: 'a', selectedPartIds: ['a'], tracks: [track('a', { locked: true }), track('b')] });
    render(<MenuBar />);
    const object = openMenu('Object');
    // 'a' is already at the front (index 0).
    expect(within(object).getByRole('menuitem', { name: 'Bring to Front' })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(within(object).getByRole('menuitem', { name: 'Send to Back' }));
    expect(ctx.reorderParts).toHaveBeenCalledWith(0, 1);
    const lock = openMenu('Object').querySelector('[data-menu-item="lock"]')!;
    expect(lock).toHaveTextContent(/^Unlock/);
    fireEvent.click(lock);
    expect(ctx.setLayersLocked).toHaveBeenCalledWith(['a'], false);
  });

  it('works from the keyboard: arrows move between menus and rows (wrapping), Enter runs, Escape closes', () => {
    render(<MenuBar />);
    openMenu('Help');
    fireEvent.keyDown(bar(), { key: 'ArrowRight' });
    expect(screen.getByRole('menu', { name: 'File' })).toBeInTheDocument();
    fireEvent.keyDown(bar(), { key: 'ArrowLeft' });
    expect(screen.getByRole('menu', { name: 'Help' })).toBeInTheDocument();
    fireEvent.keyDown(bar(), { key: 'ArrowLeft' });
    expect(screen.getByRole('menu', { name: 'View' })).toBeInTheDocument();
    expect(activeRow()).toContain('Inspector');
    fireEvent.keyDown(bar(), { key: 'ArrowUp' });
    expect(activeRow()).toContain('Broadcast');
    fireEvent.keyDown(bar(), { key: 'Enter' });
    expect(ctx.setAppMode).toHaveBeenCalledWith('broadcast');
    expect(screen.queryByRole('menu')).toBeNull();

    openMenu('Help');
    fireEvent.keyDown(bar(), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('a press outside closes the open menu; hovering another title switches to it', () => {
    render(<MenuBar />);
    openMenu('Edit');
    fireEvent.pointerEnter(title('Object'));
    expect(screen.getByRole('menu', { name: 'Object' })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    // With nothing open, hovering a title opens nothing.
    fireEvent.pointerEnter(title('Edit'));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
