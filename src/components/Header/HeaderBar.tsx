import React, { useRef, useState, useEffect } from 'react';
import { sanitizeFilenameComponent } from '../../utils/pathSafety';
import { useAnimator } from '../../context/AnimatorContext';
import {
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  Plus,
  ChevronDown,
  HelpCircle,
} from 'lucide-react';
import { NewItemModal } from '../Modal/NewItemModal';
import { ConfirmationDialog } from '../Modal/ConfirmationDialog';
import { InlineRename } from '../Shared/InlineRename';
import { compileOGrafPackage } from '../../ograf/packageCompiler';
import { createOGrafBrowserZip, sanitizeOGrafDownloadName } from '../../ograf/browserZip';
import { prepareLegacyOGrafExport } from '../../ograf/legacyCompatibility';
import {
  describeOGrafPackageWriteFailure,
  getOGrafExportRemediationReport,
  sanitizeOGrafDiagnosticText,
  summarizeOGrafExportReadiness,
  type OGrafDiagnosticRemediation,
} from '../../ograf/diagnostics';
import type { OGrafExportDiagnostic } from '../../ograf/types';
import type { ToastOptions } from '../../hooks/useToast';
import { FirstExportGuide } from './FirstExportGuide';
import type { SceneData } from '../../types/composition';
import './HeaderBar.css';

type ShowToast = (message: string, type?: 'success' | 'error' | 'info', options?: ToastOptions) => void;

/** Diagnostics that carry a next step stay visible longer than plain notifications. */
const OGRAF_BLOCKING_TOAST_DURATION_MS = 9000;
const OGRAF_WARNING_TOAST_DURATION_MS = 7000;
const OGRAF_WARNING_SUMMARY_LIMIT = 2;
const OGRAF_UNCLASSIFIED_FAILURE_ACTION = 'Verify the output location is writable and every referenced asset still exists, then export again.';

function remediationLabel(remediation: OGrafDiagnosticRemediation): string {
  return remediation.context ? `${remediation.title} [${remediation.context}]` : remediation.title;
}

/**
 * Reports export diagnostics to the user and tells the caller whether export must
 * stop. Blocking diagnostics never reach the success path; warnings never block.
 */
function notifyOGrafDiagnostics(showToast: ShowToast, diagnostics: OGrafExportDiagnostic[]): boolean {
  const report = getOGrafExportRemediationReport(diagnostics);

  if (report.hasBlocking) {
    report.blocking.forEach((remediation) => {
      showToast(remediation.message, 'error', {
        title: remediationLabel(remediation),
        action: remediation.action,
        durationMs: OGRAF_BLOCKING_TOAST_DURATION_MS,
      });
    });
    return true;
  }

  if (report.warnings.length > 0) {
    const listed = report.warnings.slice(0, OGRAF_WARNING_SUMMARY_LIMIT);
    const hiddenCount = report.warnings.length - listed.length;
    showToast(
      listed.map((remediation) => `${remediationLabel(remediation)} — ${remediation.message}`).join(' '),
      'info',
      {
        title: `Export warnings (${report.warnings.length})`,
        action: `Export continued; warnings do not block the package${hiddenCount > 0 ? ` (${hiddenCount} more not listed)` : ''}.`,
        durationMs: OGRAF_WARNING_TOAST_DURATION_MS,
      },
    );
  }

  return false;
}

export const HeaderBar: React.FC = () => {
  const {
    exportProject,
    importProject,
    resetProject,
    lastSavedAt,
    triggerManualSave,
    showToast,
    appMode,
    setAppMode,
    sceneTitle,
    projectTemplates,
    activeProjectTemplateId,
    setActiveProjectTemplateId,
    addProjectTemplate,
    renameProjectTemplate,
    deleteProjectTemplate,
    fps,
    setFps,
  } = useAnimator();

  const [editingTmplId, setEditingTmplId] = useState<string | null>(null);
  const [editingTmplName, setEditingTmplName] = useState<string>('');
  const [pendingDeleteTemplate, setPendingDeleteTemplate] = useState<{ id: string; name: string } | null>(null);
  const [isOGrafExporting, setIsOGrafExporting] = useState<boolean>(false);
  const [isFirstExportGuideOpen, setIsFirstExportGuideOpen] = useState<boolean>(false);
  const [isCheckingOGrafReadiness, setIsCheckingOGrafReadiness] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);

  /**
   * The one OGraf compile path: the package export, the legacy single-file
   * export, and the first-export readiness check all compile the current scene
   * through it, so the check can never disagree with the export.
   */
  const compileOGrafPlan = async () => {
    const sceneData = JSON.parse(exportProject()) as SceneData;
    const preparation = prepareLegacyOGrafExport(sceneData);
    const prepared = preparation instanceof Promise ? await preparation : preparation;
    return compileOGrafPackage(prepared.sceneData, prepared.options);
  };

  const handleCheckOGrafReadiness = async () => {
    if (isCheckingOGrafReadiness) return;
    setIsCheckingOGrafReadiness(true);
    try {
      const plan = await compileOGrafPlan();
      const readiness = summarizeOGrafExportReadiness(plan.diagnostics, sanitizeOGrafDownloadName(plan.manifest.name));
      showToast(readiness.message, readiness.status === 'blocked' ? 'error' : readiness.status === 'warnings' ? 'info' : 'success', {
        title: readiness.title,
        action: readiness.action,
        durationMs: readiness.status === 'blocked' ? OGRAF_BLOCKING_TOAST_DURATION_MS : OGRAF_WARNING_TOAST_DURATION_MS,
      });
    } catch (error) {
      const remediation = describeOGrafPackageWriteFailure(error);
      if (remediation) {
        showToast(remediation.message, 'error', {
          title: remediationLabel(remediation),
          action: remediation.action,
          durationMs: OGRAF_BLOCKING_TOAST_DURATION_MS,
        });
      } else {
        const message = error instanceof Error ? error.message : 'Unexpected OGraf export failure.';
        showToast(`Could not check OGraf export: ${sanitizeOGrafDiagnosticText(message)}`, 'error', {
          action: OGRAF_UNCLASSIFIED_FAILURE_ACTION,
          durationMs: OGRAF_BLOCKING_TOAST_DURATION_MS,
        });
      }
    } finally {
      setIsCheckingOGrafReadiness(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [timeAgoStr, setTimeAgoStr] = useState<string>('Not saved yet');

  useEffect(() => {
    const updateLabel = () => {
      if (!lastSavedAt) {
        setTimeAgoStr('Not saved yet');
        return;
      }
      const seconds = Math.floor((Date.now() - lastSavedAt.getTime()) / 1000);
      if (seconds < 5) setTimeAgoStr('Just saved');
      else if (seconds < 60) setTimeAgoStr(`${seconds}s ago`);
      else setTimeAgoStr(`${Math.floor(seconds / 60)}m ago`);
    };
    updateLabel();
    const interval = setInterval(updateLabel, 5000);
    return () => clearInterval(interval);
  }, [lastSavedAt]);

  const handleExport = () => {
    const json = exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const cleanFileName = `${sanitizeFilenameComponent(sceneTitle || 'Template', 'Template')}.json`;
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanFileName;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported "${cleanFileName}"`, 'success');
  };

  const handleOGrafExport = async () => {
    if (isOGrafExporting) return;
    setIsOGrafExporting(true);
    try {
      const plan = await compileOGrafPlan();
      if (notifyOGrafDiagnostics(showToast, plan.diagnostics)) return;

      const archive = await createOGrafBrowserZip(plan);
      const blob = new Blob([new Uint8Array(archive.bytes).buffer as ArrayBuffer], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = archive.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showToast(`Exported "${archive.fileName}"`, 'success');
    } catch (error) {
      const remediation = describeOGrafPackageWriteFailure(error);
      if (remediation) {
        showToast(remediation.message, 'error', {
          title: remediationLabel(remediation),
          action: remediation.action,
          durationMs: OGRAF_BLOCKING_TOAST_DURATION_MS,
        });
      } else {
        const message = error instanceof Error ? error.message : 'Unexpected OGraf export failure.';
        showToast(`Could not export OGraf: ${sanitizeOGrafDiagnosticText(message)}`, 'error', {
          action: OGRAF_UNCLASSIFIED_FAILURE_ACTION,
          durationMs: OGRAF_BLOCKING_TOAST_DURATION_MS,
        });
      }
    } finally {
      setIsOGrafExporting(false);
    }
  };
  const handleOGrafLegacyExport = async () => {
    if (isOGrafExporting) return;
    setIsOGrafExporting(true);
    try {
      const plan = await compileOGrafPlan();
      if (notifyOGrafDiagnostics(showToast, plan.diagnostics)) return;
      const runtime = plan.files.find((file) => file.kind === 'runtime' && file.content !== undefined);
      if (!runtime?.content) throw new Error('Generated OGraf runtime is unavailable.');
      const fileName = `${sanitizeOGrafDownloadName(plan.manifest.name)}.mjs`;
      const url = URL.createObjectURL(new Blob([runtime.content], { type: 'text/javascript' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showToast(`Exported "${fileName}"`, 'success');
    } catch (error) {
      const remediation = describeOGrafPackageWriteFailure(error);
      if (remediation) {
        showToast(remediation.message, 'error', {
          title: remediationLabel(remediation),
          action: remediation.action,
          durationMs: OGRAF_BLOCKING_TOAST_DURATION_MS,
        });
      } else {
        const message = error instanceof Error ? error.message : 'Unexpected OGraf legacy export failure.';
        showToast(`Could not export OGraf legacy file: ${sanitizeOGrafDiagnosticText(message)}`, 'error', {
          action: OGRAF_UNCLASSIFIED_FAILURE_ACTION,
          durationMs: OGRAF_BLOCKING_TOAST_DURATION_MS,
        });
      }
    } finally {
      setIsOGrafExporting(false);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    const isOGrafManifest = lowerName.endsWith('.ograf.json');
    const isOGrafPackage = lowerName.endsWith('.zip') || lowerName.endsWith('.ograf');
    if (isOGrafManifest || isOGrafPackage) {
      showToast('This is an OGraf graphic manifest/package. KCS project import expects a .kcs project file. Use Export/OGraf tools or add Import OGraf Package support.', 'error');
      e.target.value = '';
      return;
    }
    const fileNameWithoutExt = file.name.replace(/\.(?:json|kcs)$/i, '').trim();
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = undefined;
        }
        if (parsed && typeof parsed === 'object' && '$schema' in parsed && String(parsed.$schema).includes('/ograf/')) {
          showToast('This is an OGraf graphic manifest/package. KCS project import expects a .kcs project file. Use Export/OGraf tools or add Import OGraf Package support.', 'error');
          return;
        }
        const success = importProject(text, fileNameWithoutExt);
        if (success) showToast(`Imported "${fileNameWithoutExt}" as a new Template tab!`, 'success');
        else showToast('Invalid project file format!', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <>
      <header className="header-bar">
        <div className="header-brand">
          {/* Browser-Tab Style Project Template Tabs */}
          <div className="header-template-tabs">
            {projectTemplates.map((tmpl) => {
              const isActive = activeProjectTemplateId === tmpl.id;
              const isEditing = editingTmplId === tmpl.id;

              return (
                <div
                  key={tmpl.id}
                  className={`header-tab ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveProjectTemplateId(tmpl.id)}
                  title={`Template: ${tmpl.name}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {isEditing ? (
                    <InlineRename
                      value={editingTmplName}
                      ariaLabel={`Rename template ${tmpl.name}`}
                      onCommit={(next) => {
                        renameProjectTemplate(tmpl.id, next);
                        setEditingTmplId(null);
                      }}
                      onCancel={() => setEditingTmplId(null)}
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingTmplId(tmpl.id);
                        setEditingTmplName(tmpl.name);
                      }}
                      title="Double-click to rename template"
                    >
                      {tmpl.name}
                    </span>
                  )}

                  {projectTemplates.length > 1 && (
                    <span
                      className="tab-close-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDeleteTemplate({ id: tmpl.id, name: tmpl.name });
                      }}
                      title="Delete template"
                    >
                      ✕
                    </span>
                  )}
                </div>
              );
            })}
            <button
              className="header-tab add-tab"
              onClick={() => setIsAddModalOpen(true)}
              title="Create New Template"
            >
              <Plus size={17} />
            </button>
          </div>
        </div>

        {/* Mode Toggle - Centered */}
        <div className="header-center-controls">
          <div className={`header-mode-switch ${appMode === 'broadcast' ? 'is-broadcast' : 'is-edit'}`} style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-dark)', borderRadius: 6, padding: '4px', gap: 4, flexShrink: 0 }}>
            <span className="header-mode-indicator" aria-hidden="true" />
            <button
              className={`header-mode-button edit ${appMode === 'edit' ? 'active' : ''}`}
              aria-pressed={appMode === 'edit'}
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
              onClick={() => setAppMode('edit')}
            >
              EDIT MODE
            </button>
            <button
              className={`header-mode-button broadcast ${appMode === 'broadcast' ? 'active' : ''}`}
              aria-pressed={appMode === 'broadcast'}
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
              onClick={() => setAppMode('broadcast')}
            >
              BROADCAST
            </button>
          </div>
        </div>

        {/* Action Controls & Status (Right aligned) */}
        <div className="header-actions">
          {/* Auto-Save */}
          <div className="autosave-status-badge" onClick={triggerManualSave} title="Auto-saved every 10 seconds. Click to save manually.">
            <div className="pulse-green-dot" />
            <CheckCircle2 size={13} className="text-green" />
            <span className="autosave-text">{timeAgoStr}</span>
          </div>

          {/* FPS Control */}
          <select className="select-control"
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            style={{
              width: '82px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              color: 'var(--accent-cyan)',
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 4px',
              height: 26,
              cursor: 'pointer',
            }}
            title="Animation Frame Rate (FPS)"
          >
            <option value={24}>24 FPS</option>
            <option value={30}>30 FPS</option>
            <option value={60}>60 FPS</option>
            <option value={120}>120 FPS</option>
          </select>
          <div className="divider-v" />

          <button className="header-action-btn import-btn" onClick={() => fileInputRef.current?.click()} title="Import KCS Project or OGraf Manifest">
            <Upload size={14} />
            <span>Import</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".json,.kcs,.ograf.json,.zip" style={{ display: 'none' }} onChange={handleImportFile} />

          <div style={{ position: 'relative' }}>
            <button
              className="header-action-btn export-btn"
              onClick={() => setIsExportMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={isExportMenuOpen}
              title="Export project"
            >
              <Download size={14} />
              <span>Export</span>
              <ChevronDown size={13} />
            </button>
            {isExportMenuOpen && (
              <div
                role="menu"
                aria-label="Export options"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  zIndex: 1000,
                  minWidth: 150,
                  padding: 4,
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 6,
                  boxShadow: '0 12px 28px rgba(0,0,0,0.4)',
                }}
              >
                <button
                  type="button"
                  role="menuitem"
                  className="header-action-btn"
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleExport();
                  }}
                >
                  JSON
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="header-action-btn"
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  disabled={isOGrafExporting}
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    void handleOGrafExport();
                  }}
                >
                  {isOGrafExporting ? 'Exporting OGraf…' : 'OGraf Package'}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="header-action-btn"
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  disabled={isOGrafExporting}
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    void handleOGrafLegacyExport();
                  }}
                >
                  OGraf Single File (Legacy)
                </button>
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button
              className="header-action-btn"
              onClick={() => setIsFirstExportGuideOpen((open) => !open)}
              aria-expanded={isFirstExportGuideOpen}
              aria-controls="first-export-guide"
              aria-label="First export help"
              title="First export help"
            >
              <HelpCircle size={14} />
            </button>
            {isFirstExportGuideOpen && (
              <div id="first-export-guide">
                <FirstExportGuide
                  onCheckReadiness={() => { void handleCheckOGrafReadiness(); }}
                  isChecking={isCheckingOGrafReadiness}
                />
              </div>
            )}
          </div>

          <button className="btn-icon reset-btn" onClick={resetProject} title="Reset Canvas Project">
            <RotateCcw size={15} />
          </button>
        </div>
      </header>

      {/* New Project Template Modal */}
      <NewItemModal
        isOpen={isAddModalOpen}
        title="Create New Template"
        subtitle="Add a new graphic template tab to your project workspace."
        placeholder="Template name (e.g. LowerThird_v2)..."
        defaultValue="New Template"
        confirmLabel="Create Template"
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={(val) => addProjectTemplate(val)}
      />
      <ConfirmationDialog
        isOpen={pendingDeleteTemplate !== null}
        title="Delete template?"
        description={pendingDeleteTemplate ? `Deleting “${pendingDeleteTemplate.name}” removes its authored scene and animation data.` : ''}
        onCancel={() => setPendingDeleteTemplate(null)}
        onConfirm={() => {
          if (pendingDeleteTemplate) deleteProjectTemplate(pendingDeleteTemplate.id);
          setPendingDeleteTemplate(null);
        }}
      />
    </>
  );
};
