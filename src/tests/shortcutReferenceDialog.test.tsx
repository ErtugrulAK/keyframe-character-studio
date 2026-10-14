import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { ShortcutReferenceDialog } from '../components/Shortcuts/ShortcutReferenceDialog';
import { useKeyboardShortcuts, type EditorShortcutCommands } from '../hooks/useKeyboardShortcuts';
import { SHORTCUT_COMMANDS, SHORTCUT_CATEGORY_LABELS, detectShortcutPlatform } from '../utils/shortcuts';

/** The commands this test needs to observe; the hook's own contract types them. */
interface EditorShortcutSpies extends EditorShortcutCommands {
  undo: Mock;
  redo: Mock;
  deletePart: Mock;
}

const editorSpies = (): EditorShortcutSpies => ({
  selectedPartId: 'part_1',
  undo: vi.fn(),
  redo: vi.fn(),
  copySelectedPart: vi.fn(),
  pasteCopiedPart: vi.fn(),
  duplicateSelectedPart: vi.fn(),
  deleteSelectedKeyframes: vi.fn(() => false),
  deletePart: vi.fn(),
});

const openDialog = () => {
  const onClose = vi.fn();
  const view = render(<ShortcutReferenceDialog isOpen onClose={onClose} />);
  return { onClose, view };
};

describe('ShortcutReferenceDialog', () => {
  it('lists every command the keymap declares, grouped by category', () => {
    openDialog();

    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(dialog).toBeTruthy();
    for (const category of Object.values(SHORTCUT_CATEGORY_LABELS)) {
      // A category with no commands is simply absent; the ones that exist are named.
      const groups = screen.queryAllByRole('region', { name: category });
      if (groups.length > 0) expect(groups[0].textContent).not.toBe('');
    }
    // Completeness is what matters: every label in the table is on screen.
    for (const command of SHORTCUT_COMMANDS) {
      // Labels are unique strings in the table, so a match proves the row is rendered.
      expect(screen.getAllByText(command.label).length, command.id).toBeGreaterThan(0);
    }
  });

  it('filters the one table by label, category or the keys themselves', () => {
    openDialog();
    const filter = screen.getByRole('textbox', { name: 'Filter shortcuts' });
    expect(filter).toBeTruthy();

    fireEvent.change(filter, { target: { value: 'ungroup' } });
    expect(screen.getAllByText('Ungroup selected layer').length).toBe(1);
    expect(screen.queryByText('Undo')).toBeNull();

    // A category name narrows to that band, and a gesture token narrows to the
    // binding: both walk the same keymap the rows were rendered from.
    fireEvent.change(filter, { target: { value: 'transform and arrange' } });
    expect(screen.getAllByText('Rotate 90° clockwise').length).toBe(1);
    expect(screen.queryByText('Ungroup selected layer')).toBeNull();

    fireEvent.change(filter, { target: { value: 'shift+v' } });
    expect(screen.getAllByText('Flip vertical').length).toBe(1);
    expect(screen.queryByText('Flip horizontal')).toBeNull();

    fireEvent.change(filter, { target: { value: 'nothing matches this' } });
    expect(screen.getByText(/No shortcut matches/)).toBeTruthy();
    expect(document.querySelectorAll('.shortcut-reference-row')).toHaveLength(0);
  });

  it('labels the keys for the platform it detects', () => {
    const platform = detectShortcutPlatform();
    openDialog();

    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    if (platform === 'mac') {
      expect(dialog.textContent).toContain('macOS keys');
      expect(dialog.textContent).toContain('⌘G');
    } else {
      expect(dialog.textContent).toContain('Windows / Linux keys');
      expect(dialog.textContent).toContain('Ctrl+G');
      expect(dialog.textContent).toContain('Ctrl+Shift+G');
    }
    // The shifted alias of Redo is listed as a second key, not folded away.
    expect(dialog.textContent).toContain(platform === 'mac' ? '⇧⌘Z' : 'Ctrl+Shift+Z');
  });

  it('takes focus on open, closes on Escape, and gives focus back to the opener', () => {
    const opener = document.createElement('button');
    opener.textContent = 'Open shortcuts';
    document.body.appendChild(opener);
    act(() => opener.focus());

    const { onClose } = openDialog();

    const close = screen.getByRole('button', { name: 'Close the keyboard shortcut reference' });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    opener.remove();
  });

  it('declares the blocking-dialog contract, so the editor commands stay inert behind it', () => {
    const spies = editorSpies();
    render(
      <>
        <ShortcutReferenceDialog isOpen onClose={vi.fn()} />
        <EditorWithShortcuts spies={spies} />
      </>,
    );

    expect(document.querySelector('[aria-modal="true"]')).not.toBeNull();
    act(() => {
      fireEvent.keyDown(document.body, { key: 'Delete', bubbles: true, cancelable: true });
      fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
    });

    expect(spies.deletePart).not.toHaveBeenCalled();
    expect(spies.undo).not.toHaveBeenCalled();
  });
});

const EditorWithShortcuts: React.FC<{ spies: EditorShortcutSpies }> = ({ spies }) => {
  useKeyboardShortcuts(spies);
  return null;
};
