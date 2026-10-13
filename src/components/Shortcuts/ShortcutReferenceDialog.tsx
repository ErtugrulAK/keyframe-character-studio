import React, { useRef } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { useDialogFocusRestoration, useDialogFocusTrap } from '../../hooks/useDialogFocusRestoration';
import {
  detectShortcutPlatform,
  formatShortcutGesture,
  SHORTCUT_CATEGORY_LABELS,
  SHORTCUT_CATEGORY_ORDER,
  SHORTCUT_COMMANDS,
} from '../../utils/shortcuts';
import './ShortcutReferenceDialog.css';

interface ShortcutReferenceDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The keyboard shortcut reference.
 *
 * It renders the ONE shortcut table (`utils/shortcuts`), so it can never
 * disagree with what the editor actually binds, and it is grouped by the
 * categories the table declares. Every key label is platform-formatted: a
 * Windows/Linux user reads `Ctrl+G` and a macOS user reads `⌘G`, from the same
 * gesture token.
 *
 * Commands owned by a focused control (the timeline's keyframe keys) are listed
 * too, under Timeline, because the reference is about what the keyboard does —
 * the list says where each one is live.
 */
export const ShortcutReferenceDialog: React.FC<ShortcutReferenceDialogProps> = ({ isOpen, onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocusRestoration(isOpen, closeRef);
  // Escape closes through the caller's handler; Tab wraps the dialog's own stops.
  useDialogFocusTrap(isOpen, dialogRef, onClose);

  if (!isOpen) return null;

  const platform = detectShortcutPlatform();
  const platformLabel = platform === 'mac' ? 'macOS keys' : 'Windows / Linux keys';

  return ReactDOM.createPortal(
    <div className="shortcut-reference-backdrop" onMouseDown={onClose}>
      <div
        className="shortcut-reference"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-reference-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="shortcut-reference-header">
          <div>
            <h2 id="shortcut-reference-title">Keyboard shortcuts</h2>
            <p className="shortcut-reference-platform">{platformLabel} · typing in a field never triggers a command</p>
          </div>
          <button
            type="button"
            className="shortcut-reference-close"
            ref={closeRef}
            aria-label="Close the keyboard shortcut reference"
            onClick={onClose}
          >
            <X />
          </button>
        </header>

        <div className="shortcut-reference-body">
          {SHORTCUT_CATEGORY_ORDER.map((category) => {
            const commands = SHORTCUT_COMMANDS.filter((command) => command.category === category);
            if (commands.length === 0) return null;
            return (
              <section key={category} className="shortcut-reference-group" aria-label={SHORTCUT_CATEGORY_LABELS[category]}>
                <h3>{SHORTCUT_CATEGORY_LABELS[category]}</h3>
                <dl>
                  {commands.map((command) => (
                    <div key={command.id} className="shortcut-reference-row">
                      <dt>
                        {command.label}
                        {command.detail && <span className="shortcut-reference-detail">{command.detail}</span>}
                        {command.scope === 'timeline' && <span className="shortcut-reference-scope">timeline focus</span>}
                      </dt>
                      <dd>
                        {command.gestures.map((gesture) => (
                          <kbd key={gesture}>{formatShortcutGesture(gesture, platform)}</kbd>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
};
