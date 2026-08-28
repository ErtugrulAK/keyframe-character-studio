import React, { useRef, useState, useEffect } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import {
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { NewItemModal } from '../Modal/NewItemModal';
import { ConfirmationDialog } from '../Modal/ConfirmationDialog';
import { InlineRename } from '../Shared/InlineRename';
import { compileOGrafPackage } from '../../ograf/packageCompiler';
import { createOGrafBrowserZip } from '../../ograf/browserZip';
import type { SceneData } from '../../types/composition';
import './HeaderBar.css';

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
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);

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
    const a = document.createElement('a');
    a.href = url;
    const cleanFileName = `${sceneTitle || 'Template'}.json`;
    a.download = cleanFileName;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported "${cleanFileName}"`, 'success');
  };

  const handleOGrafExport = async () => {
    if (isOGrafExporting) return;
    setIsOGrafExporting(true);
    try {
      const sceneData = JSON.parse(exportProject()) as SceneData;
      const plan = compileOGrafPackage(sceneData);
      const errors = plan.diagnostics.filter((diagnostic) => diagnostic.severity === 'ERROR');
      if (errors.length > 0) {
        errors.forEach((diagnostic) => {
          const location = diagnostic.layerName ? ` [${diagnostic.layerName}]` : '';
          showToast(`${diagnostic.message}${location}`, 'error');
        });
        return;
      }

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
      const message = error instanceof Error ? error.message : 'Unexpected OGraf export failure.';
      showToast(`Could not export OGraf: ${message}`, 'error');
    } finally {
      setIsOGrafExporting(false);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileNameWithoutExt = file.name.replace(/\.json$/i, '').trim();
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
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
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-dark)', borderRadius: 6, padding: '4px', gap: 4, flexShrink: 0 }}>
            <button
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                color: appMode === 'edit' ? '#fff' : 'var(--text-muted)',
                background: appMode === 'edit' ? 'var(--accent-teal)' : 'transparent',
                transition: 'all 0.2s',
              }}
              onClick={() => setAppMode('edit')}
            >
              EDIT MODE
            </button>
            <button
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                color: appMode === 'broadcast' ? '#fff' : 'var(--text-muted)',
                background: appMode === 'broadcast' ? 'var(--accent-gold)' : 'transparent',
                transition: 'all 0.2s',
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

          <button className="header-action-btn import-btn" onClick={() => fileInputRef.current?.click()} title="Import JSON Animation File">
            <Upload size={14} />
            <span>Import</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />

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
                  {isOGrafExporting ? 'Exporting OGraf…' : 'OGraf'}
                </button>
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
