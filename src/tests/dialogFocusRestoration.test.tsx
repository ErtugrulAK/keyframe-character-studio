import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfirmationDialog } from '../components/Modal/ConfirmationDialog';
import { ImportReportDialog } from '../components/Modal/ImportReportDialog';

type DialogKind = 'confirmation' | 'import-report';

interface DialogHarnessProps {
  kind: DialogKind;
  removeOpenerOnClose?: boolean;
}

const DialogHarness: React.FC<DialogHarnessProps> = ({ kind, removeOpenerOnClose = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showOpener, setShowOpener] = useState(true);
  const openerLabel = kind === 'confirmation' ? 'Open confirmation' : 'Open import report';

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
      {kind === 'confirmation' ? (
        <ConfirmationDialog
          isOpen={isOpen}
          title="Delete sequence?"
          description="Channels will be removed."
          onCancel={close}
          onConfirm={close}
        />
      ) : (
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
    </>
  );
};

const dialogCases = [
  { kind: 'confirmation' as const, openerLabel: 'Open confirmation', confirmLabel: 'Delete' },
  { kind: 'import-report' as const, openerLabel: 'Open import report', confirmLabel: 'Import and replace project' },
];

const openDialog = (kind: DialogKind, openerLabel: string, removeOpenerOnClose = false): HTMLButtonElement => {
  render(<DialogHarness kind={kind} removeOpenerOnClose={removeOpenerOnClose} />);
  const opener = screen.getByRole('button', { name: openerLabel });
  opener.focus();
  fireEvent.click(opener);
  return opener;
};

describe('dialog focus restoration', () => {
  it.each(dialogCases)('$kind moves focus to Cancel and restores the opener on cancel', ({ kind, openerLabel }) => {
    const opener = openDialog(kind, openerLabel);

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(document.activeElement).toBe(cancel);
    fireEvent.click(cancel);

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
