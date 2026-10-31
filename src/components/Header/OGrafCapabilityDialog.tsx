import React, { useRef } from 'react';
import ReactDOM from 'react-dom';
import { useDialogFocusRestoration, useDialogFocusTrap } from '../../hooks/useDialogFocusRestoration';
import type { OGrafCapabilityReport, OGrafLayerCapability } from '../../ograf/capabilityReport';
import '../Modal/ConfirmationDialog.css';
import './OGrafCapabilityDialog.css';

interface OGrafCapabilityDialogProps {
  isOpen: boolean;
  /** Null while the export pipeline is still compiling the check. */
  report: OGrafCapabilityReport | null;
  onClose: () => void;
  onExport: () => void;
}

const STATUS_LABEL: Record<OGrafLayerCapability, string> = {
  supported: 'Supported',
  conditional: 'Exports with warnings',
  blocked: 'Blocks export',
};

/**
 * "what will an OGraf export do with each layer?", shown before the
 * export. Every row comes from the real export diagnostics; nothing is
 * flattened or dropped silently. Status is text + colour, never colour alone.
 */
export const OGrafCapabilityDialog: React.FC<OGrafCapabilityDialogProps> = ({ isOpen, report, onClose, onExport }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocusRestoration(isOpen, closeRef);
  useDialogFocusTrap(isOpen, dialogRef, onClose);
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="confirmation-dialog-backdrop" onMouseDown={onClose}>
      <div
        className="confirmation-dialog ograf-capability-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ograf-capability-title"
        aria-describedby="ograf-capability-summary"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="ograf-capability-title">OGraf export check</h2>
        {!report ? (
          <p id="ograf-capability-summary" role="status">Checking the scene with the OGraf exporter…</p>
        ) : (
          <>
            <p id="ograf-capability-summary" role="status" data-testid="ograf-capability-summary">
              {report.canExport
                ? `The package can be exported: ${report.counts.supported} supported, ${report.counts.conditional} with warnings.`
                : `Export is blocked: ${report.counts.blocked} layer${report.counts.blocked === 1 ? '' : 's'}${report.sceneIssues.some((issue) => issue.severity === 'ERROR') ? ' and project issues' : ''} must be changed first.`}
              {' '}This reflects what this exporter supports; behaviour in a specific OGraf host is not verified here.
            </p>
            <div className="ograf-capability-body">
              {report.sceneIssues.length > 0 && (
                <section aria-label="Project issues" className="ograf-capability-section">
                  <h3>Project</h3>
                  <ul>
                    {report.sceneIssues.map((issue, index) => (
                      <li key={`scene-${index}`} className={`ograf-capability-issue is-${issue.severity.toLowerCase()}`}>
                        <strong>{issue.severity === 'ERROR' ? 'Blocks export' : 'Warning'}:</strong> {issue.message}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <ul className="ograf-capability-layers" aria-label="Layers">
                {report.layers.map((layer) => (
                  <li key={layer.id} className={`ograf-capability-layer is-${layer.status}`} data-layer-id={layer.id} data-capability={layer.status}>
                    <div className="ograf-capability-layer-head">
                      <span className="ograf-capability-name">{layer.name}</span>
                      <span className="ograf-capability-status">{STATUS_LABEL[layer.status]}</span>
                    </div>
                    {layer.issues.length > 0 && (
                      <ul>
                        {layer.issues.map((issue, index) => (
                          <li key={`${layer.id}-${index}`} className={`ograf-capability-issue is-${issue.severity.toLowerCase()}`}>
                            {issue.feature ? <span className="ograf-capability-feature">{issue.feature}</span> : null}
                            {issue.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        <div className="confirmation-dialog-actions">
          <button type="button" className="confirmation-dialog-cancel" ref={closeRef} onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="confirmation-dialog-confirm ograf-capability-export"
            disabled={!report || !report.canExport}
            title={report && !report.canExport ? 'Resolve the blocking issues listed above first' : undefined}
            onClick={onExport}
          >
            Export OGraf Package
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
