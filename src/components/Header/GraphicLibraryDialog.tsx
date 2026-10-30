import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useDialogFocusRestoration, useDialogFocusTrap } from '../../hooks/useDialogFocusRestoration';
import type { LibraryEntrySummary, ProjectLibrary } from '../../utils/projectLibrary';
import '../Modal/ConfirmationDialog.css';
import './GraphicLibraryDialog.css';

interface GraphicLibraryDialogProps {
  isOpen: boolean;
  library: ProjectLibrary;
  /** The current template's name, offered as the name to save under. */
  currentName: string;
  /** The current template as `.kcs` JSON. */
  exportCurrent: () => string;
  /** Adds a saved graphic as a new template tab; false when it was refused. */
  openGraphic: (name: string, scene: string) => boolean;
  onClose: () => void;
}

const formatDate = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/**
 * The graphic library: templates saved in this browser (IndexedDB). Saving
 * stores the current template; opening adds a saved one as a new tab, so the
 * work on screen is never replaced. Deleting asks once more in the row.
 */
export const GraphicLibraryDialog: React.FC<GraphicLibraryDialogProps> = ({ isOpen, library, currentName, exportCurrent, openGraphic, onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocusRestoration(isOpen, closeRef);
  useDialogFocusTrap(isOpen, dialogRef, onClose);

  const [entries, setEntries] = useState<LibraryEntrySummary[] | null>(null);
  const [name, setName] = useState(currentName);
  const [status, setStatus] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const refresh = useCallback(() => library.list().then(setEntries, () => {
    setEntries([]);
    setStatus({ tone: 'error', text: 'The library could not be read in this browser (private window or blocked site data?).' });
  }), [library]);

  // The header mounts the dialog only while it is open, so every opening
  // starts from a fresh name, status and list.
  useEffect(() => {
    if (isOpen) void refresh();
  }, [isOpen, refresh]);

  if (!isOpen) return null;

  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      setStatus({ tone: 'info', text: done });
      await refresh();
    } catch {
      setStatus({ tone: 'error', text: 'The library could not be written (storage full or blocked?). Nothing was changed.' });
    }
  };

  const save = () => run(() => library.save(name, exportCurrent()), `Saved “${name.trim() || 'Untitled'}” to the library.`);

  const open = async (entry: LibraryEntrySummary) => {
    const graphic = await library.open(entry.id);
    if (!graphic) {
      setStatus({ tone: 'error', text: `“${entry.name}” is no longer in the library.` });
      await refresh();
      return;
    }
    if (openGraphic(graphic.name, graphic.scene)) onClose();
    else setStatus({ tone: 'error', text: `“${entry.name}” could not be opened: its scene was refused by the import check.` });
  };

  return ReactDOM.createPortal(
    <div className="confirmation-dialog-backdrop" onMouseDown={onClose}>
      <div
        className="confirmation-dialog graphic-library-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="graphic-library-title"
        aria-describedby="graphic-library-summary"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="graphic-library-title">Library</h2>
        <p id="graphic-library-summary">
          Graphics saved in this browser. Opening one adds it as a new template tab; Export moves a graphic to another machine.
        </p>
        <form
          className="graphic-library-save"
          onSubmit={(event) => { event.preventDefault(); void save(); }}
        >
          <input
            className="input-control"
            aria-label="Name to save the current graphic under"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" className="confirmation-dialog-confirm">Save current graphic</button>
        </form>
        {status && (
          <p role="status" className={`graphic-library-status is-${status.tone}`} data-testid="graphic-library-status">{status.text}</p>
        )}
        <div className="graphic-library-body">
          {entries === null ? (
            <p className="graphic-library-empty">Reading the library…</p>
          ) : entries.length === 0 ? (
            <p className="graphic-library-empty">Nothing saved yet. Save the current graphic to start the library.</p>
          ) : (
            <ul aria-label="Saved graphics">
              {entries.map((entry) => (
                <li key={entry.id} className="graphic-library-row" data-library-id={entry.id}>
                  <div className="graphic-library-meta">
                    <span className="graphic-library-name">{entry.name}</span>
                    <span className="graphic-library-detail">{entry.layerCount} layer{entry.layerCount === 1 ? '' : 's'} · {formatDate(entry.updatedAt)}</span>
                  </div>
                  {pendingDelete === entry.id ? (
                    <div className="graphic-library-actions">
                      <span className="graphic-library-ask">Delete for good?</span>
                      <button type="button" className="btn-secondary is-danger" onClick={() => { setPendingDelete(null); void run(() => library.remove(entry.id), `Deleted “${entry.name}”.`); }}>Delete</button>
                      <button type="button" className="btn-secondary" onClick={() => setPendingDelete(null)}>Keep</button>
                    </div>
                  ) : (
                    <div className="graphic-library-actions">
                      <button type="button" className="btn-secondary" aria-label={`Open ${entry.name}`} onClick={() => { void open(entry); }}>Open</button>
                      <button type="button" className="btn-secondary" aria-label={`Duplicate ${entry.name}`} onClick={() => { void run(() => library.duplicate(entry.id), `Duplicated “${entry.name}”.`); }}>Duplicate</button>
                      <button type="button" className="btn-secondary" aria-label={`Delete ${entry.name}`} onClick={() => setPendingDelete(entry.id)}>Delete</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="confirmation-dialog-actions">
          <button type="button" className="confirmation-dialog-cancel" ref={closeRef} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
