import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { useAnimatorSlice } from '../../context/useAnimator';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * History (Edit > History…): the undo steps by name, oldest first. A click
 * goes straight to that step; the steps after it stay (dimmed) for redo until
 * a new edit replaces them. The panel floats beside the work and stays open
 * while editing, so it is not modal: no backdrop, no focus trap. Escape (with
 * the focus inside it) or its close button closes it.
 */
export const HistoryPanel: React.FC<HistoryPanelProps> = ({ isOpen, onClose }) => {
  const { historySteps, historyIndex, jumpToHistoryStep, historyLocked } = useAnimatorSlice('historySteps', 'historyIndex', 'jumpToHistoryStep', 'historyLocked');
  const currentRef = useRef<HTMLButtonElement>(null);
  const openedRef = useRef(false);

  // Keep the current step in view; take the focus only when the panel opens.
  useEffect(() => {
    if (!isOpen) {
      openedRef.current = false;
      return;
    }
    currentRef.current?.scrollIntoView?.({ block: 'nearest' });
    if (!openedRef.current) {
      openedRef.current = true;
      currentRef.current?.focus();
    }
  }, [isOpen, historyIndex, historySteps.length]);

  if (!isOpen) return null;
  return ReactDOM.createPortal(
    <section
      className="history-panel"
      role="dialog"
      aria-label="History"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="history-panel-header">
        <h2>History</h2>
        <button type="button" className="btn-icon" aria-label="Close history" onClick={onClose}>
          <X size={14} />
        </button>
      </header>
      {historyLocked && <p className="history-panel-note" role="note">Finish the drawing to use the list.</p>}
      <ol className="history-panel-list">
        {historySteps.map((label, index) => (
          // Steps have no id of their own; their place in the stack is their identity.
          // oxlint-disable-next-line react/no-array-index-key
          <li key={index}>
            <button
              type="button"
              ref={index === historyIndex ? currentRef : undefined}
              className={`history-step${index === historyIndex ? ' current' : ''}${index > historyIndex ? ' undone' : ''}`}
              aria-current={index === historyIndex ? 'step' : undefined}
              disabled={historyLocked}
              title={index === historyIndex ? 'The scene is here' : index < historyIndex ? 'Go back to this step' : 'Go forward to this step'}
              onClick={() => jumpToHistoryStep(index)}
            >
              <span className="history-step-number">{index}</span>
              <span className="history-step-label">{label}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>,
    document.body,
  );
};
