import React, { lazy, Suspense, useRef, useState, useEffect } from 'react';
import { sanitizeFilenameComponent } from '../../utils/pathSafety';
import { packageFileAdmissionProblem, projectFileAdmissionProblem } from '../../utils/fileAdmission';
import { downloadBlob } from '../../utils/fileDownload';
// The GIF export pipeline (panel + encoder + OGraf svg/validation chain) is
// only reachable when the panel is open, so it ships as a lazy chunk instead
// of weighing down the editor's initial bundle.
const GifExportPanel = lazy(() => import('./GifExportPanel').then((m) => ({ default: m.GifExportPanel })));
import type { SceneData as ExportableSceneData } from '../../types/composition';
import { useAnimator } from '../../context/useAnimator';
import {
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ChevronDown,
  Keyboard,
  HardDriveDownload,
} from 'lucide-react';
import { NewItemModal } from '../Modal/NewItemModal';
import { ConfirmationDialog } from '../Modal/ConfirmationDialog';
import { InlineRename } from '../Shared/InlineRename';
// The OGraf compile/package chain (validation, compiler, runtime template,
// legacy preparation, ZIP writer) is only reachable through an actual export,
// so it is imported lazily inside `compileOGrafPlan`/`handleOGrafExport`
// instead of weighing down the editor's initial chunk.
import {
  describeOGrafPackageWriteFailure,
  getOGrafExportRemediationReport,
  sanitizeOGrafDiagnosticText,
  type OGrafDiagnosticRemediation,
} from '../../ograf/diagnostics';
import type { OGrafExportDiagnostic } from '../../ograf/types';
import type { ToastOptions } from '../../hooks/useToast';
import { ImportReportDialog } from '../Modal/ImportReportDialog';
import { classifyImport } from '../../utils/importDispatch';
import { readOGrafPackage, type OGrafPackageReadResult } from '../../ograf/packageImport';
import { importLottieDocument, type LottieImportResult } from '../../interop/lottie/mapDocument';
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
    restoredFromLocalStorage,
    autosaveConflict,
    manualSaveRejectedAt,
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
    openShortcutReference,
    characterParts,
    tracks,
    coordinateSystem,
    currentFrame,
    isPlaying,
  } = useAnimator();

  const [editingTmplId, setEditingTmplId] = useState<string | null>(null);
  const [editingTmplName, setEditingTmplName] = useState<string>('');
  const [pendingDeleteTemplate, setPendingDeleteTemplate] = useState<{ id: string; name: string } | null>(null);
  const [isOGrafExporting, setIsOGrafExporting] = useState<boolean>(false);
  // Honest export stages: each transition is a real await boundary in
  // `handleOGrafExport`, never an invented percentage.
  const [ografStage, setOgrafStage] = useState<'compile' | 'package' | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  /** SAFE-03-A: reset waits for an explicit confirmation whenever the document has content. */
  const [pendingResetConfirmation, setPendingResetConfirmation] = useState<boolean>(false);
  /** The scene snapshot the GIF panel summarises and exports, taken when it opens. */
  const [gifExportScene, setGifExportScene] = useState<ExportableSceneData | null>(null);

  /**
   * SAFE-03-A (review repair): "meaningful" is decided over exactly the set
   * of fields `resetProject` replaces — parts, tracks, coordinate system,
   * frame cursor and playback. Anything else (title, fps, template tabs) is
   * preserved by reset and cannot be destroyed by it, so it must not
   * fabricate a destructive prompt either. A legacy coordinate system, an
   * off-zero cursor or running transport is authentic authored state even
   * with empty parts/tracks, so the no-op path stays provably inert.
   */
  const requestResetProject = () => {
    // Evaluated at click time over exactly the replacement set.
    const carriesResettableState =
      characterParts.length > 0 ||
      tracks.length > 0 ||
      coordinateSystem !== 'project-unit-center-v1' ||
      currentFrame !== 0 ||
      isPlaying;
    if (!carriesResettableState) {
      resetProject();
      return;
    }
    setPendingResetConfirmation(true);
  };

  /**
   * The one OGraf compile path: the package export compiles the current scene
   * through it, so the export always reads the same diagnostics authority for
   * whatever the scene is at the moment it runs.
   */
  const compileOGrafPlan = async () => {
    const sceneData = JSON.parse(exportProject()) as SceneData;
    const [{ prepareLegacyOGrafExport }, { compileOGrafPackage }] = await Promise.all([
      import('../../ograf/legacyCompatibility'),
      import('../../ograf/packageCompiler'),
    ]);
    const preparation = prepareLegacyOGrafExport(sceneData);
    const prepared = preparation instanceof Promise ? await preparation : preparation;
    return compileOGrafPackage(prepared.sceneData, prepared.options);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  /**
   * A parsed Lottie document waiting for the user to accept its report. It is
   * the only thing selecting a file changes: the project is untouched until
   * `confirmLottieImport` runs.
   */
  const [pendingLottieImport, setPendingLottieImport] = useState<{ fileName: string; result: LottieImportResult } | null>(null);
  /** Reads the counts a report shows; an unreadable scene simply reports none. */
  const sceneCounts = (sceneText: string | undefined): { layerCount?: number; frameCount?: number } => {
    if (!sceneText) return {};
    try {
      const parsed = JSON.parse(sceneText) as { layers?: unknown; totalFrames?: unknown };
      const layers = Array.isArray(parsed.layers) ? parsed.layers.length : undefined;
      const frames = typeof parsed.totalFrames === 'number' ? parsed.totalFrames : undefined;
      return { ...(layers !== undefined ? { layerCount: layers } : {}), ...(frames !== undefined ? { frameCount: frames } : {}) };
    } catch {
      return {};
    }
  };

  /**
   * An OGraf package waiting for the same decision: its scene text plus the
   * report the reader produced. Selecting a package changes nothing on its own.
   */
  const [pendingPackageImport, setPendingPackageImport] = useState<{ fileName: string; result: OGrafPackageReadResult } | null>(null);
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

  /**
   * SAFE-01: a conflict pause must be noticed, not discovered. One toast per
   * session (the badge stays visible afterwards); the current in-memory edits
   * are never replaced — the user reloads to adopt the external document or
   * exports this tab's work.
   */
  const conflictAnnouncedRef = useRef(false);
  useEffect(() => {
    if (autosaveConflict && !conflictAnnouncedRef.current) {
      conflictAnnouncedRef.current = true;
      showToast('Autosave paused: another tab changed the shared project. Reload to adopt it, or export this tab’s work — nothing here will be overwritten.', 'error', { title: 'Autosave paused' });
    }
  }, [autosaveConflict, showToast]);
  /**   * SAFE-02: a manual save that never got the shared lock within its bounded   * wait is reported once per event. The edits stay in memory, autosave is   * NOT paused, and the next interval tick retries the write — so this is an   * info notice, deliberately not the conflict error.   */  const manualSaveRejectedAnnouncedRef = useRef<number | null>(null);  useEffect(() => {    if (typeof manualSaveRejectedAt === 'number' && manualSaveRejectedAnnouncedRef.current !== manualSaveRejectedAt) {      manualSaveRejectedAnnouncedRef.current = manualSaveRejectedAt;      showToast('Save not completed: another tab is writing the shared project. Your changes are kept; the next autosave tick will retry.', 'info', { title: 'Save deferred' });    }  }, [manualSaveRejectedAt, showToast]);

  const handleExport = () => {
    const json = exportProject();
    const cleanFileName = `${sanitizeFilenameComponent(sceneTitle || 'Template', 'Template')}.json`;
    downloadBlob(new TextEncoder().encode(json), cleanFileName, 'application/json');
    showToast(`Exported "${cleanFileName}"`, 'success');
  };

  /**
   * Opens the GIF panel on a SNAPSHOT of the current scene: the summary the user
   * reads and the frames that are written come from the same document, so an edit
   * made afterwards can never make the panel lie.
   */
  const handleOpenGifPanel = () => {
    setIsExportMenuOpen(false);
    try {
      setGifExportScene(JSON.parse(exportProject()) as ExportableSceneData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected failure.';
      showToast(`Could not read the current scene for a GIF export: ${message}`, 'error');
    }
  };

  const handleOGrafExport = async () => {
    if (isOGrafExporting) return;
    setIsOGrafExporting(true);
    setOgrafStage('compile');
    try {
      const plan = await compileOGrafPlan();
      if (notifyOGrafDiagnostics(showToast, plan.diagnostics)) return;

      setOgrafStage('package');
      const { createOGrafBrowserZip } = await import('../../ograf/browserZip');
      const archive = await createOGrafBrowserZip(plan);
      downloadBlob(archive.bytes, archive.fileName, 'application/zip');
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
      setOgrafStage(null);
    }
  };
  /**
   * The one import entry: it decides what the file is from its **content** and
   * routes it to the importer that owns that kind. Only a Lottie document opens
   * the report dialog before it touches the project; the KCS and legacy paths
   * keep their existing validated behaviour.
   */
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    const looksLikePackage = lowerName.endsWith('.zip') || lowerName.endsWith('.ograf');
    if (looksLikePackage) {
      // N3 PR-2c1: a package over the importer's own ceiling is refused on its
      // declared size, before any bytes are allocated for it.
      const packageRefusal = packageFileAdmissionProblem(file);
      if (packageRefusal) {
        showToast(packageRefusal.message, 'error');
        return;
      }
      // A package is an archive: read it as bytes and let the package reader
      // decode it under its own guards. Nothing is applied until the report is
      // accepted, exactly like the Lottie import.
      const packageReader = new FileReader();
      packageReader.onload = (packageEvent) => {
        const buffer = packageEvent.target?.result;
        if (!(buffer instanceof ArrayBuffer)) {
          showToast('The selected package could not be read.', 'error');
          return;
        }
        setPendingPackageImport({ fileName: file.name, result: readOGrafPackage(new Uint8Array(buffer)) });
      };
      packageReader.onerror = () => showToast('The selected package could not be read.', 'error');
      packageReader.readAsArrayBuffer(file);
      return;
    }
    // N3 PR-2c1: oversized text imports are refused on declared size before
    // FileReader allocates them; the post-read validators stay the authority.
    const projectRefusal = projectFileAdmissionProblem(file);
    if (projectRefusal) {
      showToast(projectRefusal.message, 'error');
      return;
    }
    const fileNameWithoutExt = file.name.replace(/\.(?:lottie\.)?(?:json|kcs)$/i, '').trim();
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (typeof text !== 'string') {
        showToast('The selected file could not be read as text.', 'error');
        return;
      }
      switch (classifyImport(file.name, text)) {
        case 'ograf-package':
        case 'ograf-manifest':
          showToast('This is an OGraf graphic manifest. Import the .zip/.ograf package it belongs to, or export the KCS project again.', 'error');
          return;
        case 'lottie':
          // Parsing only: nothing in the project changes until the report is accepted.
          setPendingLottieImport({ fileName: file.name, result: importLottieDocument(text) });
          return;
        default: {
          const result = importProject(text, fileNameWithoutExt);
          if (result.ok) {
            // A successful import can still carry warnings (for example the legacy
            // migration notice): show them instead of reporting a silent success.
            const [notice] = result.diagnostics;
            showToast(`Imported "${fileNameWithoutExt}" as a new Template tab!`, 'success');
            if (notice) showToast(notice.message, 'info', { title: notice.code, action: notice.action });
            return;
          }
          const [refusal] = result.diagnostics;
          showToast(refusal ? `${refusal.message} ${refusal.action}` : 'Invalid project file format!', 'error');
        }
      }
    };
    reader.onerror = () => showToast('The selected file could not be read.', 'error');
    reader.readAsText(file);
  };


  /** Applies the pending import through the project authority the .kcs import uses. */
  const confirmLottieImport = () => {
    if (!pendingLottieImport) return;
    const { fileName, result } = pendingLottieImport;
    setPendingLottieImport(null);
    if (!result.ok || !result.scene) {
      showToast('The Lottie document was refused; your project is unchanged.', 'error', {
        title: 'Lottie import refused',
        action: result.diagnostics[0]?.action ?? 'Export the animation again and retry.',
      });
      return;
    }
    const name = fileName.replace(/\.lottie\.json$/i, '').replace(/\.json$/i, '').trim();
    const applied = importProject(JSON.stringify(result.scene), name);
    if (!applied.ok) {
      const [refusal] = applied.diagnostics;
      showToast(refusal ? sanitizeOGrafDiagnosticText(refusal.message) : 'The imported scene was refused.', 'error', {
        title: refusal ? refusal.code : 'Lottie import refused',
        action: refusal?.action ?? 'Export the animation again and retry.',
      });
      return;
    }
    const warningCount = result.diagnostics.filter((entry) => entry.severity === 'warning').length;
    showToast(`Imported "${name}" from Lottie.`, 'success');
    if (warningCount > 0) {
      const [firstWarning] = result.diagnostics.filter((entry) => entry.severity === 'warning');
      showToast(`${warningCount} report entr${warningCount === 1 ? 'y' : 'ies'} from the import.`, 'info', {
        title: firstWarning?.code,
        action: firstWarning?.action,
      });
    }
  };

  /** Applies the pending package scene through the project authority. */
  const confirmPackageImport = () => {
    if (!pendingPackageImport) return;
    const { fileName, result } = pendingPackageImport;
    setPendingPackageImport(null);
    if (!result.ok || !result.sceneText) return;
    const name = result.name || fileName.replace(/\.(?:zip|ograf)$/i, '').trim();
    const applied = importProject(result.sceneText, name);
    if (!applied.ok) {
      const [refusal] = applied.diagnostics;
      showToast(refusal ? sanitizeOGrafDiagnosticText(refusal.message) : 'The imported scene was refused.', 'error', {
        title: refusal ? refusal.code : 'OGraf package import refused',
        action: refusal?.action ?? 'Export the graphic again and retry.',
      });
      return;
    }
    const warningCount = result.diagnostics.filter((entry) => entry.severity === 'warning').length;
    showToast(`Imported "${name}" from an OGraf package.`, 'success');
    if (warningCount > 0) {
      const [firstWarning] = result.diagnostics.filter((entry) => entry.severity === 'warning');
      showToast(`${warningCount} report entr${warningCount === 1 ? 'y' : 'ies'} from the import.`, 'info', {
        title: firstWarning?.code,
        action: firstWarning?.action,
      });
    }
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
                    <button
                      type="button"
                      className="tab-close-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDeleteTemplate({ id: tmpl.id, name: tmpl.name });
                      }}
                      title="Delete template"
                      aria-label={`Delete template ${tmpl.name}`}
                    >
                      ✕
                    </button>
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

        {/*
          The editor-mode segment. Paint lives entirely in HeaderBar.css — the
          inline styles that used to sit here could not be overridden by the
          theme and made the two halves render inconsistently (different
          backgrounds, no shared chrome). One control, one pressed state per
          half, announced with `aria-pressed`.
        */}
        <div className="header-center-controls">
          <div
            className={`header-mode-switch ${appMode === 'broadcast' ? 'is-broadcast' : 'is-edit'}`}
            role="group"
            aria-label="Editor mode"
          >
            <span className="header-mode-indicator" aria-hidden="true" />
            <button
              type="button"
              className={`header-mode-button edit${appMode === 'edit' ? ' active' : ''}`}
              aria-pressed={appMode === 'edit'}
              onClick={() => setAppMode('edit')}
            >
              EDIT MODE
            </button>
            <button
              type="button"
              className={`header-mode-button broadcast${appMode === 'broadcast' ? ' active' : ''}`}
              aria-pressed={appMode === 'broadcast'}
              onClick={() => setAppMode('broadcast')}
            >
              BROADCAST
            </button>
          </div>
        </div>

        {/* Action Controls & Status (Right aligned) */}
        <div className="header-actions">
          {/* Auto-Save */}
          <div
            className={`autosave-status-badge${autosaveConflict ? ' autosave-status-badge--paused' : ''}`}
            onClick={triggerManualSave}
            data-last-saved-at={lastSavedAt ? String(lastSavedAt.getTime()) : ''}
            title={autosaveConflict
              ? 'Autosave paused: another tab changed the shared project. Reload to adopt it, or export this tab\u2019s work — nothing here will be overwritten.'
              : 'Auto-saved every 10 seconds. Click to save manually.'}
          >
            <div className={autosaveConflict ? 'pulse-amber-dot' : 'pulse-green-dot'} />
            {autosaveConflict ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} className="text-green" />}
            <span className="autosave-text">{timeAgoStr}</span>
          </div>

          {/*
            Restore provenance. The same browser profile serves localhost and
            the LAN address, and autosave is keyed per origin — a machine that
            reaches the editor over the LAN can therefore open with a DIFFERENT
            (or empty) project than the machine that authored it, silently.
            This chip states where the document currently on screen came from,
            and it disappears the moment an import or a reset replaces it.
          */}
          {restoredFromLocalStorage && (
            <div
              className="restored-from-local-badge"
              role="status"
              title="This project was restored from this browser's autosave, not from a shared project file. Use Import project to open the other machine's document."
            >
              <HardDriveDownload size={13} aria-hidden="true" />
              <span>Restored from this browser&#39;s autosave</span>
            </div>
          )}

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

          <button className="header-action-btn import-btn" onClick={() => fileInputRef.current?.click()} title="Import a KCS project, a legacy project, a Lottie animation, or an OGraf manifest/package">
            <Upload size={14} />
            <span>Import</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".json,.kcs,.lottie.json,.ograf.json,.zip,.ograf" aria-label="Choose a KCS project, legacy project, Lottie file, or OGraf manifest/package to import" style={{ display: 'none' }} onChange={handleImportFile} />

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
                  {isOGrafExporting ? (ografStage === 'package' ? 'Packaging OGraf…' : 'Compiling OGraf…') : 'OGraf Package'}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="header-action-btn"
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={handleOpenGifPanel}
                >
                  Animated GIF
                </button>
              </div>
            )}
            {gifExportScene && (
              <Suspense fallback={null}>
                <GifExportPanel
                  scene={gifExportScene}
                  sceneTitle={sceneTitle}
                  onClose={() => setGifExportScene(null)}
                  onBlocked={(diagnostics) => { notifyOGrafDiagnostics(showToast, diagnostics); }}
                  showToast={showToast}
                />
              </Suspense>
            )}
          </div>

          <button className="btn-icon reset-btn" onClick={requestResetProject} title="Reset Canvas Project">
            <RotateCcw size={15} />
          </button>
          <button
            className="btn-icon"
            onClick={openShortcutReference}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
          >
            <Keyboard size={15} />
          </button>
        </div>
      </header>
      <ImportReportDialog
        isOpen={pendingLottieImport !== null}
        title="Lottie import report"
        fileName={pendingLottieImport?.fileName ?? ''}
        layerCount={pendingLottieImport?.result.scene?.layers.length}
        frameCount={pendingLottieImport?.result.scene?.totalFrames}
        diagnostics={pendingLottieImport?.result.diagnostics ?? []}
        refused={pendingLottieImport !== null && !pendingLottieImport.result.ok}
        onCancel={() => setPendingLottieImport(null)}
        onConfirm={confirmLottieImport}
      />
      <ImportReportDialog
        isOpen={pendingPackageImport !== null}
        title="OGraf package import report"
        fileName={pendingPackageImport?.fileName ?? ''}
        {...sceneCounts(pendingPackageImport?.result.sceneText)}
        diagnostics={pendingPackageImport?.result.diagnostics ?? []}
        refused={pendingPackageImport !== null && !pendingPackageImport.result.ok}
        onCancel={() => setPendingPackageImport(null)}
        onConfirm={confirmPackageImport}
      />

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
        isOpen={pendingResetConfirmation}
        title="Reset the project?"
        description="Your current project content will be replaced with the default document. This is not recoverable if the page closes first."
        confirmLabel="Reset"
        onCancel={() => setPendingResetConfirmation(false)}
        onConfirm={() => {
          setPendingResetConfirmation(false);
          resetProject();
        }}
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
