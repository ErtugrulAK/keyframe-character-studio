import React, { Component, Suspense, lazy, useState } from 'react';
import type { ComponentType } from 'react';
import type { SceneData } from '../../types/composition';
import type { OGrafExportDiagnostic } from '../../ograf/types';
import type { PersistenceSafety } from '../../hooks/useSerialization';
import type { ToastOptions } from '../../hooks/useToast';

type ShowToast = (message: string, type?: 'success' | 'error' | 'info', options?: ToastOptions) => void;

export interface GifPanelGateProps {
  scene: SceneData;
  sceneTitle: string;
  onClose: () => void;
  onBlocked: (diagnostics: OGrafExportDiagnostic[]) => void;
  showToast: ShowToast;
  /** Test seam for the lazy chunk; production leaves this undefined. */
  loadPanel?: () => Promise<{ GifExportPanel: ComponentType<GifPanelGateProps> }>;
  /** Test seam for the hard recovery action; production reloads the document. */
  reloadApp?: () => void;
  /**
   * Point-in-time persistence verdict consulted before ANY reload. An
   * absent probe fails closed — reload is never assumed safe.
   */
  persistenceStatus?: () => PersistenceSafety;
  /** Forced durable write; the reload proceeds on its true resolution only. */
  saveBeforeReload?: () => Promise<boolean>;
}

const defaultLoadPanel = () => import('./GifExportPanel');

/**
 * A fresh lazy wrapper per retry. React caches the settled (or rejected)
 * promise inside one `lazy()` instance, so recovery requires a new instance.
 * Note the platform limit: when the FIRST fetch of the chunk URL itself failed,
 * the browser's module map keeps that failure for the lifetime of the document,
 * so an in-page retry can only recover failures that happened after the module
 * was already fetched (or failures injected below the import level, as in the
 * test seam). A chunk that never loaded needs a full reload — the card offers
 * `Reload editor` once an in-page retry has already failed, and that reload is
 * guarded against unsaved work (A1).
 */
const makeLazyPanel = (loadPanel: GifPanelGateProps['loadPanel']) =>
  lazy(() => (loadPanel ?? defaultLoadPanel)().then((m) => ({ default: m.GifExportPanel })));

interface GifPanelBoundaryProps {
  children: React.ReactNode;
  onRetry: () => void;
  onClose: () => void;
  showReload: boolean;
  onReload: () => void;
  reloadControl?: React.ReactNode;
}

/**
 * Localized error boundary for the GIF panel only: a failed lazy chunk shows
 * an actionable card in the panel's own footprint instead of unmounting the
 * editor, and project state is untouched because nothing above this
 * boundary re-renders.
 */
class GifPanelBoundary extends Component<GifPanelBoundaryProps, { failed: true | null }> {
  state: { failed: true | null } = { failed: null };

  static getDerivedStateFromError(): { failed: true | null } {
    return { failed: true };
  }

  handleRetry = () => {
    this.setState({ failed: null });
    this.props.onRetry();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="gif-export-panel" role="alertdialog" aria-label="GIF export unavailable">
        <header className="gif-export-header">
          <h2>Export as GIF</h2>
          <button type="button" className="gif-export-close" onClick={this.props.onClose} aria-label="Close GIF export panel">
            ✕
          </button>
        </header>
        <p className="gif-export-blocked">
          The GIF export module could not be loaded. Check your network connection and retry; if it keeps
          failing, reload the editor — a freshly published app is fetched on a full reload.
        </p>
        <div className="gif-export-controls">
          <button type="button" onClick={this.handleRetry}>
            Retry
          </button>
          {this.props.showReload && (
            <button type="button" onClick={this.props.onReload}>
              Reload editor
            </button>
          )}
        </div>
        {this.props.showReload && this.props.reloadControl}
      </div>
    );
  }
}

interface PendingReload {
  reason: 'unsaved-changes' | 'save-in-flight' | 'write-failed' | 'conflict-paused' | 'unknown';
  saveFailed: boolean;
}

const reloadMessage = (pending: PendingReload): string => {
  if (pending.saveFailed) {
    return 'The document could not be saved — storage may be full or unavailable. Reloading now may lose the changes that never reached disk.';
  }
  switch (pending.reason) {
    case 'unsaved-changes':
      return 'This document has unsaved changes. Saving first keeps them; reloading without saving may lose them.';
    case 'save-in-flight':
      return 'A save is still in flight. Saving first waits for it to land; reloading without saving may lose it.';
    case 'write-failed':
      return 'The last save failed, so the copy on disk is stale. Saving first retries it; reloading without saving may lose changes.';
    case 'conflict-paused':
      return 'Autosave is paused after a cross-tab conflict, so this tab cannot write. Reloading adopts the other document; reloading without saving may lose this tab\'s changes.';
    default:
      return 'Persistence status is unavailable, so a safe reload cannot be confirmed. Reloading may lose unsaved changes.';
  }
};

/**
 * Mounts the lazy GIF export panel with a visible loading state, a localized
 * error boundary and a safe retry path. HeaderBar owns this gate so the
 * loading/failure cards themselves never live in the lazy chunk.
 */
export const GifPanelGate = (props: GifPanelGateProps): React.JSX.Element => {
  const [attempt, setAttempt] = useState(0);
  const [Panel, setPanel] = useState(() => makeLazyPanel(props.loadPanel));
  const [pending, setPending] = useState<PendingReload | null>(null);
  const [saving, setSaving] = useState(false);
  const retry = () => {
    setPanel(() => makeLazyPanel(props.loadPanel));
    setAttempt((value) => value + 1);
  };
  const doReload = () => (props.reloadApp ?? (() => window.location.reload()))();
  // A reload is never silent. A clean verdict reloads at once; anything
  // else (including a missing probe) stops at an informed choice instead.
  const handleReload = () => {
    const status = props.persistenceStatus?.() ?? { safe: false as const, reason: 'unknown' as const };
    if (status.safe) {
      doReload();
      return;
    }
    setPending({ reason: status.reason, saveFailed: false });
  };
  const handleSaveThenReload = () => {
    setSaving(true);
    void (props.saveBeforeReload?.() ?? Promise.resolve(false))
      .then((ok) => {
        setSaving(false);
        if (ok) doReload();
        else setPending((current) => (current ? { ...current, saveFailed: true } : current));
      })
      .catch(() => {
        setSaving(false);
        setPending((current) => (current ? { ...current, saveFailed: true } : current));
      });
  };
  const canSaveFirst = pending !== null
    && pending.reason !== 'conflict-paused'
    && pending.reason !== 'unknown';
  const reloadControl = pending === null ? undefined : (
    <div className="gif-export-reload-confirm" role="group" aria-label="Reload confirmation">
      <p className="gif-export-blocked">{reloadMessage(pending)}</p>
      <div className="gif-export-controls">
        <button type="button" onClick={() => setPending(null)}>Cancel</button>
        {canSaveFirst && (
          <button type="button" onClick={handleSaveThenReload} disabled={saving}>
            {saving ? 'Saving…' : 'Save and reload'}
          </button>
        )}
        <button type="button" className="gif-export-danger" onClick={doReload}>
          Reload without saving
        </button>
      </div>
    </div>
  );
  return (
    <GifPanelBoundary
      key={`gif-panel-${attempt}`}
      onRetry={retry}
      onClose={props.onClose}
      showReload={attempt > 0}
      onReload={handleReload}
      reloadControl={reloadControl}
    >
      <Suspense
        fallback={(
          <div className="gif-export-panel" role="status" aria-label="Loading GIF export">
            <header className="gif-export-header">
              <h2>Export as GIF</h2>
            </header>
            <p className="gif-export-blocked">Loading GIF export…</p>
          </div>
        )}
      >
        <Panel {...props} />
      </Suspense>
    </GifPanelBoundary>
  );
};
