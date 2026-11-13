import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { useAnimatorSlice } from '../../context/useAnimator';
import { downloadBlob } from '../../utils/persistence/fileDownload';
import { sanitizeFilenameComponent } from '../../utils/persistence/pathSafety';
import '../Modal/ConfirmationDialog.css';

/**
 * The editor's last line of defence. A render error anywhere in the shell
 * used to unmount the whole app: a blank page, and the changes made since the
 * last autosave were gone. This boundary sits INSIDE `AnimatorProvider`, so
 * the document stays in memory (and autosave keeps running) while a recovery
 * card offers to save or export it before reloading.
 *
 * Lazily loaded panels have their own `ChunkLoadBoundary`; this one only sees
 * what nothing below it caught.
 */
interface EditorCrashBoundaryProps {
  children: ReactNode;
  /** Test seam for the reload; production reloads the document. */
  reloadApp?: () => void;
}

export class EditorCrashBoundary extends Component<EditorCrashBoundaryProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: unknown): { error: Error } {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[EditorCrashBoundary] The editor stopped with an error.', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return <CrashRecovery message={this.state.error.message} reloadApp={this.props.reloadApp} />;
  }
}

const CrashRecovery = ({ message, reloadApp }: { message: string; reloadApp?: () => void }) => {
  const { exportProject, forceSaveNow, sceneTitle } = useAnimatorSlice('exportProject', 'forceSaveNow', 'sceneTitle');
  const [status, setStatus] = useState<string | null>(null);

  const save = async () => {
    setStatus('Saving…');
    let saved = false;
    try {
      saved = await forceSaveNow();
    } catch {
      saved = false;
    }
    setStatus(saved ? 'Saved to this browser.' : 'Could not save to this browser. Export the project to keep your work.');
  };

  const exportFile = () => {
    try {
      const json = exportProject();
      downloadBlob(new TextEncoder().encode(json), `${sanitizeFilenameComponent(sceneTitle || 'Template', 'Template')}.json`, 'application/json');
      setStatus('Exported.');
    } catch {
      setStatus('Could not export the project.');
    }
  };

  return (
    <div className="confirmation-dialog-backdrop">
      <div className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="editor-crash-title" aria-describedby="editor-crash-summary">
        <h2 id="editor-crash-title">The editor stopped with an error</h2>
        <p id="editor-crash-summary">
          Your work is still in this tab. Save or export it, then reload the editor.
        </p>
        <p className="editor-crash-detail"><code>{message}</code></p>
        {status && <p role="status">{status}</p>}
        <div className="confirmation-dialog-actions">
          <button type="button" className="confirmation-dialog-cancel" onClick={() => { void save(); }}>Save now</button>
          <button type="button" className="confirmation-dialog-cancel" onClick={exportFile}>Export project</button>
          <button type="button" className="confirmation-dialog-confirm" onClick={() => (reloadApp ?? (() => window.location.reload()))()}>Reload editor</button>
        </div>
      </div>
    </div>
  );
};
