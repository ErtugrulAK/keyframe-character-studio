import React, { useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { sanitizeOGrafDiagnosticText } from '../../ograf/diagnostics';
import type { LottieImportDiagnostic } from '../../interop/lottie/diagnostics';
import './LottieImportReportDialog.css';

/** How many diagnostics are rendered before the list is cut with a count. */
const VISIBLE_DIAGNOSTIC_LIMIT = 40;

export interface LottieImportReportDialogProps {
  isOpen: boolean;
  fileName: string;
  /** Layers the parsed scene would add, or `undefined` when the import was refused. */
  layerCount?: number;
  frameCount?: number;
  diagnostics: LottieImportDiagnostic[];
  /** A refusal (the document could not be read) rather than a report of losses. */
  refused?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const severityRank = (entry: LottieImportDiagnostic): number => (entry.severity === 'error' ? 0 : 1);

/**
 * Shows what a Lottie import would do **before** it touches the project: the
 * blockers first, then the losses, each with its source path and the concrete
 * next step. The dialog owns no state and applies nothing — the caller decides
 * what "Import" means, which is what keeps Cancel a no-op.
 */
export const LottieImportReportDialog: React.FC<LottieImportReportDialogProps> = ({
  isOpen,
  fileName,
  layerCount,
  frameCount,
  diagnostics,
  refused = false,
  onCancel,
  onConfirm,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const { blockers, warnings, hidden, visible } = useMemo(() => {
    const ordered = [...diagnostics].sort((left, right) => severityRank(left) - severityRank(right));
    const errors = ordered.filter((entry) => entry.severity === 'error').length;
    return {
      blockers: errors,
      warnings: ordered.length - errors,
      visible: ordered.slice(0, VISIBLE_DIAGNOSTIC_LIMIT),
      hidden: Math.max(0, ordered.length - VISIBLE_DIAGNOSTIC_LIMIT),
    };
  }, [diagnostics]);

  useEffect(() => {
    if (!isOpen) return;
    cancelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key === 'Tab') {
        const active = document.activeElement;
        // When confirming is not possible, Cancel is the only stop in the dialog:
        // Tab and Shift+Tab must stay on it instead of walking out of the modal.
        if (confirmRef.current?.disabled) {
          event.preventDefault();
          cancelRef.current?.focus();
        } else if (event.shiftKey && active === cancelRef.current) {
          event.preventDefault();
          confirmRef.current?.focus();
        } else if (!event.shiftKey && active === confirmRef.current) {
          event.preventDefault();
          cancelRef.current?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const summary = refused
    ? 'Nothing was imported. Your current project is unchanged.'
    : `${layerCount ?? 0} layer(s) and ${frameCount ?? 0} frame(s) would replace the current project.`;

  return ReactDOM.createPortal(
    <div className="lottie-report-backdrop" onMouseDown={onCancel}>
      <div
        className="lottie-report-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lottie-report-title"
        aria-describedby="lottie-report-summary"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="lottie-report-title">Lottie import report</h2>
        <p id="lottie-report-summary" className="lottie-report-source">
          {sanitizeOGrafDiagnosticText(fileName)} — {summary}
        </p>

        <p className="lottie-report-counts">
          <span className={blockers > 0 ? 'lottie-report-count blocking' : 'lottie-report-count'}>
            {blockers} blocker(s)
          </span>
          <span className={warnings > 0 ? 'lottie-report-count warning' : 'lottie-report-count'}>
            {warnings} warning(s)
          </span>
        </p>

        {visible.length > 0 && (
          <ul className="lottie-report-list" aria-label="Import diagnostics">
            {visible.map((entry, index) => (
              <li
                key={`${entry.code}-${index}`}
                className={entry.severity === 'error' ? 'lottie-report-entry blocking' : 'lottie-report-entry warning'}
              >
                <span className="lottie-report-code">{sanitizeOGrafDiagnosticText(entry.code)}</span>
                <span className="lottie-report-message">{sanitizeOGrafDiagnosticText(entry.message)}</span>
                <span className="lottie-report-path">{sanitizeOGrafDiagnosticText(entry.path)}</span>
                <span className="lottie-report-action">{sanitizeOGrafDiagnosticText(entry.action)}</span>
              </li>
            ))}
          </ul>
        )}
        {hidden > 0 && <p className="lottie-report-hidden">And {hidden} more diagnostic(s).</p>}

        <div className="lottie-report-actions">
          <button type="button" className="lottie-report-cancel" ref={cancelRef} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="lottie-report-confirm"
            ref={confirmRef}
            onClick={onConfirm}
            disabled={refused || blockers > 0}
          >
            Import and replace project
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
