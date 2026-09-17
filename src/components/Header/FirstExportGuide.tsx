import React from 'react';

/**
 * Compact first-export guidance for new users.
 *
 * Presentational only: it explains the existing OGraf Package export path and
 * offers the readiness check, which reuses the Task 105 diagnostics authority.
 * It is never a wizard, it blocks nothing, and it never claims that a package
 * was written — only the export action can do that.
 */

export interface FirstExportGuideProps {
  /** Runs the existing OGraf pipeline as a pre-flight check. */
  onCheckReadiness: () => void;
  /** True while the readiness check is running. */
  isChecking: boolean;
}

export const FirstExportGuide: React.FC<FirstExportGuideProps> = ({ onCheckReadiness, isChecking }) => (
  <div
    className="first-export-guide"
    role="group"
    aria-label="First export help"
    style={{
      position: 'absolute',
      top: 'calc(100% + 6px)',
      right: 0,
      zIndex: 1000,
      width: 292,
      padding: '10px 12px',
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-light)',
      borderRadius: 6,
      boxShadow: '0 12px 28px rgba(0,0,0,0.4)',
      fontSize: 11,
      lineHeight: 1.45,
      color: 'var(--text-muted)',
    }}
  >
    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.6px', color: 'var(--accent-cyan)', marginBottom: 6 }}>
      FIRST OGRAF EXPORT
    </div>
    <ol style={{ margin: '0 0 8px 16px', padding: 0 }}>
      <li>Keep at least one visible layer in the scene.</li>
      <li>Run the readiness check below to see what would block an export.</li>
      <li>Choose &quot;OGraf Package&quot; in the Export menu to write the -ograf.zip archive for this scene.</li>
    </ol>
    <p style={{ margin: '0 0 8px' }}>
      Nothing is written until you export, and the check reads the same diagnostics the export reads. A scene you change afterwards is checked again when you export.
    </p>
    <button
      type="button"
      className="header-action-btn"
      onClick={onCheckReadiness}
      disabled={isChecking}
      aria-label="Check export readiness"
      style={{ width: '100%', justifyContent: 'center' }}
    >
      {isChecking ? 'Checking export…' : 'Check export readiness'}
    </button>
  </div>
);
