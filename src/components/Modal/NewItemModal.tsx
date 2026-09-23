import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles } from 'lucide-react';
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

  useEffect(() => {
    if (isOpen) {
      setVal(defaultValue);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, defaultValue]);

  // Escape belongs to the dialog, not to the focused control, so it works from
  // the buttons too — and the global shortcut guard stays out of the way because
  // this dialog declares `aria-modal`.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
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
          <button className="modal-close-btn" onClick={onClose}>
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
