import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useDialogFocusRestoration, useDialogFocusTrap } from '../../hooks/useDialogFocusRestoration';
import './NewItemModal.css';

interface NewItemModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  onClose: () => void;
  onSubmit: (value: string) => void;
}

export const NewItemModal: React.FC<NewItemModalProps> = ({
  isOpen,
  title,
  subtitle,
  placeholder = 'Enter name...',
  defaultValue = '',
  confirmLabel = 'Create',
  onClose,
  onSubmit,
}) => {
  const [val, setVal] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // The shared dialog lifecycle owns focus: it moves the caret into the field
  // when the dialog opens, wraps Tab/Shift+Tab inside it, keeps Escape as the
  // dialog's own dismiss, and returns focus to the opener once it closes.
  useDialogFocusRestoration(isOpen, inputRef);
  useDialogFocusTrap(isOpen, dialogRef, onClose);

  useEffect(() => {
    // Opening the modal resets its local draft from the caller-owned default.
    // oxlint-disable-next-line react/set-state-in-effect
    if (isOpen) setVal(defaultValue);
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (val.trim()) {
      onSubmit(val.trim());
      onClose();
    }
  };

  return (
    <div className="new-item-modal-overlay" onClick={onClose}>
      <div
        className="new-item-modal-card"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-item-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <Sparkles size={16} className="text-cyan" />
            <h3 className="modal-title" id="new-item-modal-title">{title}</h3>
          </div>
          <button type="button" className="modal-close-btn" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {subtitle && <p className="modal-subtitle">{subtitle}</p>}

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="input-wrapper">
            <input
              ref={inputRef}
              type="text"
              className="modal-input"
              value={val}
              placeholder={placeholder}
              onChange={(e) => setVal(e.target.value)}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-confirm" disabled={!val.trim()}>
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
