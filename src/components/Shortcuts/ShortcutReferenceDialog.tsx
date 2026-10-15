import React, { useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Command, Layers, MousePointer2, Move, PenTool, Scan, Search, Timer, X, type LucideIcon } from 'lucide-react';
import { useDialogFocusRestoration, useDialogFocusTrap } from '../../hooks/useDialogFocusRestoration';
import {
  detectShortcutPlatform,
  formatShortcutCommand,
  formatShortcutGesture,
  SHORTCUT_CATEGORY_LABELS,
  SHORTCUT_CATEGORY_ORDER,
  SHORTCUT_COMMANDS,
  type ShortcutCategory,
} from '../../utils/shortcuts';
import './ShortcutReferenceDialog.css';

interface ShortcutReferenceDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Presentation only; commands, descriptions and gestures stay in shortcuts.ts. */
const CATEGORY_ICONS: Record<ShortcutCategory, LucideIcon> = {
  selection: MousePointer2,
  create: PenTool,
  transform: Move,
  grouping: Layers,
  timeline: Timer,
  view: Scan,
  general: Command,
};

/**
 * The keyboard shortcut reference.
 *
 * It renders the ONE shortcut table (`utils/shortcuts`) — labels, categories,
 * gestures and scopes all come from there, so the panel can never disagree with
 * what the editor binds — and every key is drawn as a platform-formatted chip: a
 * Windows/Linux user reads `Ctrl+Shift+←` and a macOS user reads `⇧⌘←` from the
 * same gesture token.
 *
 * The panel is a filter over that table, not a second copy of it: typing narrows
 * the rows by label, detail, category or the formatted keys themselves. Commands
 * owned by a focused control (the timeline's keyframe keys) are listed too,
 * under Timeline, because the reference is about what the keyboard does — the
 * row says where each one is live.
 */
export const ShortcutReferenceDialog: React.FC<ShortcutReferenceDialogProps> = ({ isOpen, onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState('');
  useDialogFocusRestoration(isOpen, closeRef);
  // Escape closes through the caller's handler; Tab wraps the dialog's own stops.
  useDialogFocusTrap(isOpen, dialogRef, onClose);

  const platform = detectShortcutPlatform();
  const platformLabel = platform === 'mac' ? 'macOS keys' : 'Windows / Linux keys';
  const query = filter.trim().toLowerCase();

  // Filtering walks the table, so a match on a key label (`shift+h`) or on a
  // category name finds the same rows the user would look for by hand.
  const matches = useMemo(() => SHORTCUT_COMMANDS.filter((command) => {
    if (!query) return true;
    const haystack = [
      command.label,
      command.detail ?? '',
      SHORTCUT_CATEGORY_LABELS[command.category],
      formatShortcutCommand(command.id, platform),
    ];
    return haystack.some((text) => text.toLowerCase().includes(query));
  }), [platform, query]);

  if (!isOpen) return null;

  const groups = SHORTCUT_CATEGORY_ORDER
    .map((category) => ({
      category,
      commands: matches.filter((command) => command.category === category),
    }))
    .filter((group) => group.commands.length > 0);

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
          <div className="shortcut-reference-heading">
            <span className="shortcut-reference-eyebrow">Editor reference</span>
            <h2 id="shortcut-reference-title">Keyboard shortcuts</h2>
            <p className="shortcut-reference-platform">{platformLabel} · typing in a field never triggers a command</p>
          </div>
          <label className="shortcut-reference-filter">
            <Search aria-hidden="true" />
            <input
              type="text"
              aria-label="Filter shortcuts"
              placeholder="Filter shortcuts…"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </label>
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
          {groups.length === 0 && (
            <p className="shortcut-reference-empty">No shortcut matches “{filter.trim()}”.</p>
          )}
          {groups.map(({ category, commands }) => {
            const Icon = CATEGORY_ICONS[category];
            return (
              <section key={category} className="shortcut-reference-group" aria-label={SHORTCUT_CATEGORY_LABELS[category]}>
                <h3>
                  <span className="shortcut-reference-category"><Icon aria-hidden="true" />{SHORTCUT_CATEGORY_LABELS[category]}</span>
                  <span className="shortcut-reference-count">{commands.length}</span>
                </h3>
                <dl>
                  {commands.map((command) => (
                    <div key={command.id} className="shortcut-reference-row" title={command.detail ? `${command.label} — ${command.detail}` : command.label}>
                      <dt>
                        <span className="shortcut-reference-name">{command.label}</span>
                        {command.scope === 'timeline' && <span className="shortcut-reference-scope">timeline focus</span>}
                        {command.detail && <span className="shortcut-reference-detail">{command.detail}</span>}
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
