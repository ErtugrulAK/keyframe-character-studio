import React, { useRef } from 'react';
import ReactDOM from 'react-dom';
import { useDialogFocusRestoration, useDialogFocusTrap } from '../../hooks/useDialogFocusRestoration';
import './ConfirmationDialog.css';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocusRestoration(isOpen, cancelRef);
  // Escape dismisses through the caller's handler; Tab wraps the dialog's own
  // stops (Cancel and Confirm) instead of walking into the editor behind it.
  useDialogFocusTrap(isOpen, dialogRef, onCancel);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="confirmation-dialog-backdrop" onMouseDown={onCancel}>
      <div
        className="confirmation-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="confirmation-dialog-title">{title}</h2>
        <p id="confirmation-dialog-description">{description}</p>
        <div className="confirmation-dialog-actions">
          <button type="button" className="confirmation-dialog-cancel" ref={cancelRef} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="confirmation-dialog-confirm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
