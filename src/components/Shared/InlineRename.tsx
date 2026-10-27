import React, { useEffect, useRef, useState } from 'react';
import './InlineRename.css';

interface InlineRenameProps {
  value: string;
  ariaLabel: string;
  className?: string;
  onCommit: (value: string) => void;
  onCancel?: () => void;
}

export const InlineRename: React.FC<InlineRenameProps> = ({ value, ariaLabel, className, onCommit, onCancel }) => {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  // Enter or Escape settles the edit once; the blur that follows the unmount
  // (or the focus move) must not commit a cancelled edit.
  const settledRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    const next = draft.trim();
    if (next) onCommit(next);
    else onCancel?.();
  };

  return (
    <input
      ref={inputRef}
      className={`kcs-inline-rename ${className ?? ''}`}
      type="text"
      aria-label={ariaLabel}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') {
          settledRef.current = true;
          onCancel?.();
        }
      }}
      onBlur={commit}
    />
  );
};
