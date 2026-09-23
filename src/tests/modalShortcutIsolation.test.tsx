import { renderHook, render, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { ImportReportDialog } from '../components/Modal/ImportReportDialog';
import { ConfirmationDialog } from '../components/Modal/ConfirmationDialog';
import { NewItemModal } from '../components/Modal/NewItemModal';

/**
 * The editor's global commands are only valid while the editor is the active
 * surface. A blocking dialog takes that away, so while one is open no command
 * may reach project state — and once it closes, the commands must come back.
 *
 * The dialogs here are the real ones, so the rendered `aria-modal` contract and
 * each dialog's own keyboard handling are what the guard is measured against
 * rather than a stand-in for them.
 */
interface EditorShortcutSpies {
  undo: ReturnType<typeof vi.fn>;
  redo: ReturnType<typeof vi.fn>;
  copySelectedPart: ReturnType<typeof vi.fn>;
  pasteCopiedPart: ReturnType<typeof vi.fn>;
  duplicateSelectedPart: ReturnType<typeof vi.fn>;
  deleteSelectedKeyframe: ReturnType<typeof vi.fn>;
  deletePart: ReturnType<typeof vi.fn>;
  setActiveTool: ReturnType<typeof vi.fn>;
  cancelShapeCreation: ReturnType<typeof vi.fn>;
  exitBooleanOperandEditing: ReturnType<typeof vi.fn>;
}

const editorSpies = (): EditorShortcutSpies => ({
  undo: vi.fn(),
  redo: vi.fn(),
  copySelectedPart: vi.fn(),
  pasteCopiedPart: vi.fn(),
  duplicateSelectedPart: vi.fn(),
  deleteSelectedKeyframe: vi.fn(() => false),
  deletePart: vi.fn(),
  setActiveTool: vi.fn(),
  cancelShapeCreation: vi.fn(),
  exitBooleanOperandEditing: vi.fn(),
});

const renderEditor = (spies: EditorShortcutSpies) =>
  renderHook(() => useKeyboardShortcuts({ selectedPartId: 'part_1', ...spies }));

/** Names every spy that was reached, so a failure says which command escaped. */
const reachedCommands = (spies: EditorShortcutSpies): string[] =>
  Object.entries(spies)
    .filter(([, spy]) => spy.mock.calls.length > 0)
    .map(([name]) => name);

/** Fires a key the way a browser does: from the focused element, bubbling to document and window. */
const pressKey = (key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    fireEvent.keyDown(document.body, { key, bubbles: true, cancelable: true, ...init });
  });

const importDialog = (isOpen: boolean, onCancel = vi.fn(), onConfirm = vi.fn()) => (
  <ImportReportDialog
    isOpen={isOpen}
    fileName="scene.lottie.json"
    layerCount={3}
    frameCount={120}
    diagnostics={[]}
    title="Lottie import report"
    onCancel={onCancel}
    onConfirm={onConfirm}
  />
);

/** Every global command the editor binds, including the ones that emit viewport commands. */
const EDITOR_COMMANDS: Array<{ label: string; key: string; init?: KeyboardEventInit }> = [
  { label: 'Delete', key: 'Delete' },
  { label: 'Backspace', key: 'Backspace' },
  { label: 'Ctrl+Z (undo)', key: 'z', init: { ctrlKey: true } },
  { label: 'Ctrl+Y (redo)', key: 'y', init: { ctrlKey: true } },
  { label: 'Ctrl+Shift+Z (redo)', key: 'z', init: { ctrlKey: true, shiftKey: true } },
  { label: 'Ctrl+C (copy)', key: 'c', init: { ctrlKey: true } },
  { label: 'Ctrl+V (paste)', key: 'v', init: { ctrlKey: true } },
  { label: 'Ctrl+D (duplicate)', key: 'd', init: { ctrlKey: true } },
  { label: 'V (select tool)', key: 'v' },
  { label: 'H (hand tool)', key: 'h' },
  { label: 'zoom in', key: '+' },
  { label: 'zoom out', key: '-' },
];

describe('blocking dialog owns the keyboard', () => {
  let spies: EditorShortcutSpies;

  // One listener for the file: a per-test registration would stack up, and every
  // test only cares about the commands emitted during its own keystrokes.
  let viewportCommands: string[] = [];
  window.addEventListener('canvas-viewport-command', (event) => {
    viewportCommands.push((event as CustomEvent<{ type: string }>).detail.type);
  });

  beforeEach(() => {
    spies = editorSpies();
    viewportCommands = [];
  });

  it.each(EDITOR_COMMANDS)('does not run $label while the import report is open', ({ key, init }) => {
    render(importDialog(true));
    renderEditor(spies);

    pressKey(key, init);

    expect(reachedCommands(spies)).toEqual([]);
    expect(viewportCommands).toEqual([]);
  });

  it('keeps Escape for the dialog instead of the editor commands', () => {
    const onCancel = vi.fn();
    render(importDialog(true, onCancel));
    renderEditor(spies);

    pressKey('Escape');

    expect(onCancel).toHaveBeenCalledOnce();
    expect(reachedCommands(spies)).toEqual([]);
  });

  it('lets the editor commands through again once the dialog closes', () => {
    const { rerender } = render(importDialog(true));
    renderEditor(spies);

    pressKey('Delete');
    expect(reachedCommands(spies)).toEqual([]);

    rerender(importDialog(false));
    expect(document.querySelector('[aria-modal="true"]')).toBeNull();

    pressKey('Delete');
    pressKey('z', { ctrlKey: true });
    pressKey('+');

    expect(spies.deletePart).toHaveBeenCalledWith('part_1');
    expect(spies.undo).toHaveBeenCalledOnce();
    expect(viewportCommands).toEqual(['zoom-in']);
  });

  it('treats the confirmation dialog as blocking even when a button holds focus', () => {
    render(<ConfirmationDialog isOpen title="Delete sequence?" description="Channels will be removed." onConfirm={vi.fn()} onCancel={vi.fn()} />);
    renderEditor(spies);

    const confirm = document.querySelector<HTMLButtonElement>('.confirmation-dialog-confirm');
    expect(confirm).not.toBeNull();
    act(() => confirm?.focus());

    pressKey('Delete');
    pressKey('d', { ctrlKey: true });

    expect(reachedCommands(spies)).toEqual([]);
  });

  it('treats the new-item dialog as blocking and lets it close on Escape', () => {
    const onClose = vi.fn();
    render(<NewItemModal isOpen title="New sequence" onClose={onClose} onSubmit={vi.fn()} />);
    renderEditor(spies);

    const cancel = document.querySelector<HTMLButtonElement>('.btn-cancel');
    expect(cancel).not.toBeNull();
    act(() => cancel?.focus());

    pressKey('Delete');
    expect(reachedCommands(spies)).toEqual([]);

    pressKey('Escape');
    expect(onClose).toHaveBeenCalled();
  });

  it('leaves a non-modal dialog (an Inspector popover) inside the editor, not above it', () => {
    const popover = document.createElement('div');
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'Save Animation Preset');
    document.body.appendChild(popover);
    renderEditor(spies);

    pressKey('Delete');

    expect(spies.deletePart).toHaveBeenCalledWith('part_1');
    popover.remove();
  });

  it('still ignores commands while an editable element has focus', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.tabIndex = 0;
    Object.defineProperty(editor, 'isContentEditable', { value: true });
    document.body.appendChild(editor);
    act(() => editor.focus());
    renderEditor(spies);

    pressKey('Delete');

    expect(reachedCommands(spies)).toEqual([]);
    editor.remove();
  });
});
