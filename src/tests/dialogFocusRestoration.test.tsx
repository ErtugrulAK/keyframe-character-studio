import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfirmationDialog } from '../components/Modal/ConfirmationDialog';
import { ImportReportDialog } from '../components/Modal/ImportReportDialog';
import { NewItemModal } from '../components/Modal/NewItemModal';

type DialogKind = 'confirmation' | 'import-report' | 'new-item';

interface DialogHarnessProps {
  kind: DialogKind;
  removeOpenerOnClose?: boolean;
}

const DialogHarness: React.FC<DialogHarnessProps> = ({ kind, removeOpenerOnClose = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showOpener, setShowOpener] = useState(true);
  const openerLabel = kind === 'confirmation'
    ? 'Open confirmation'
    : kind === 'import-report' ? 'Open import report' : 'Open new item';

  const close = () => {
    if (removeOpenerOnClose) setShowOpener(false);
    setIsOpen(false);
  };

  return (
    <>
      {showOpener && (
        <button type="button" onClick={() => setIsOpen(true)}>
          {openerLabel}
        </button>
      )}
      {kind === 'confirmation' && (
        <ConfirmationDialog
          isOpen={isOpen}
          title="Delete sequence?"
          description="Channels will be removed."
          onCancel={close}
          onConfirm={close}
        />
      )}
      {kind === 'import-report' && (
        <ImportReportDialog
          isOpen={isOpen}
          fileName="scene.lottie.json"
          layerCount={1}
          frameCount={24}
          diagnostics={[]}
          onCancel={close}
          onConfirm={close}
        />
      )}
      {kind === 'new-item' && (
        <NewItemModal
          isOpen={isOpen}
          title="New sequence"
          defaultValue="Sequence 2"
          onClose={close}
          onSubmit={() => undefined}
        />
      )}
    </>
  );
};

const dialogCases = [
  { kind: 'confirmation' as const, openerLabel: 'Open confirmation', confirmLabel: 'Delete' },
  { kind: 'import-report' as const, openerLabel: 'Open import report', confirmLabel: 'Import and replace project' },
  { kind: 'new-item' as const, openerLabel: 'Open new item', confirmLabel: 'Create' },
];

/** Dialogs whose initial action is Cancel; the naming dialog focuses its field. */
const cancelFirstCases = dialogCases.filter((entry) => entry.kind !== 'new-item');

const openDialog = (kind: DialogKind, openerLabel: string, removeOpenerOnClose = false): HTMLButtonElement => {
  render(<DialogHarness kind={kind} removeOpenerOnClose={removeOpenerOnClose} />);
  const opener = screen.getByRole('button', { name: openerLabel });
  opener.focus();
  fireEvent.click(opener);
  return opener;
};

describe('dialog focus restoration', () => {
  it.each(cancelFirstCases)('$kind moves focus to Cancel and restores the opener on cancel', ({ kind, openerLabel }) => {
    const opener = openDialog(kind, openerLabel);

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(document.activeElement).toBe(cancel);
    fireEvent.click(cancel);

    expect(document.activeElement).toBe(opener);
  });

  it('new-item moves focus into its name field and restores the opener on cancel', () => {
    const opener = openDialog('new-item', 'Open new item');

    expect(document.activeElement).toBe(screen.getByRole('textbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(document.activeElement).toBe(opener);
  });

  it.each(dialogCases)('$kind restores the opener on confirm', ({ kind, openerLabel, confirmLabel }) => {
    const opener = openDialog(kind, openerLabel);

    fireEvent.click(screen.getByRole('button', { name: confirmLabel }));

    expect(document.activeElement).toBe(opener);
  });

  it.each(dialogCases)('$kind restores the opener on Escape', ({ kind, openerLabel }) => {
    const opener = openDialog(kind, openerLabel);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(document.activeElement).toBe(opener);
  });

  it.each(dialogCases)('$kind ignores an opener removed during close', ({ kind, openerLabel }) => {
    const opener = openDialog(kind, openerLabel, true);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(opener.isConnected).toBe(false);
    expect(document.activeElement).toBe(document.body);
  });
});

/**
 * Astra F-08: the naming dialog left the keyboard free to walk out of the modal
 * and did not return focus to its opener.
 */
describe('new item modal focus lifecycle', () => {
  const openNewItem = () => {
    render(<DialogHarness kind="new-item" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open new item' }));
  };

  it('moves focus into the name field on open', () => {
    openNewItem();

    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });

  it('wraps Tab and Shift+Tab around the dialog\'s own stops', () => {
    openNewItem();
    const close = screen.getByRole('button', { name: 'Close' });
    const input = screen.getByRole('textbox');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const create = screen.getByRole('button', { name: 'Create' });

    // The dialog's stops, in document order, are close -> field -> Cancel -> Create:
    // focus wraps at both ends instead of walking into the editor behind it.
    create.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    close.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(create);

    // Inside the loop the dialog leaves the move to the browser.
    cancel.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);

    input.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(input);
  });

  it('keeps the keyboard inside the dialog while its confirm is disabled', () => {
    render(<DialogHarness kind="new-item" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open new item' }));
    const close = screen.getByRole('button', { name: 'Close' });
    const input = screen.getByRole('textbox');
    const cancel = screen.getByRole('button', { name: 'Cancel' });

    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();

    // A disabled control is not a stop, so Cancel is now the last one.
    cancel.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    close.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(cancel);

    input.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(input);
  });

  it('pulls focus back into the dialog when it sits outside', () => {
    openNewItem();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();

    fireEvent.keyDown(document, { key: 'Tab' });

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
    outside.remove();
  });

  it('dismisses on Escape and returns focus to the opener', () => {
    render(<DialogHarness kind="new-item" />);
    const opener = screen.getByRole('button', { name: 'Open new item' });
    opener.focus();
    fireEvent.click(opener);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('submits the typed name and returns focus to the opener', () => {
    const submitted: string[] = [];
    const Harness = () => {
      const [isOpen, setIsOpen] = useState(true);
      return (
        <NewItemModal
          isOpen={isOpen}
          title="New sequence"
          onClose={() => setIsOpen(false)}
          onSubmit={(value) => submitted.push(value)}
        />
      );
    };
    render(<Harness />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Intro  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(submitted).toEqual(['Intro']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('names its icon-only close control', () => {
    openNewItem();

    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });
});
