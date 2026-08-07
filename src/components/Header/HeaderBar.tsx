import React, { useRef, useState, useEffect } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import {
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  Plus,
  CopyPlus,
  FlipHorizontal2,
  FlipVertical2,
  RotateCw,
  ChevronDown,
} from 'lucide-react';
import { NewItemModal } from '../Modal/NewItemModal';
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
    selectedPartId,
    duplicateSelectedPart,
    duplicateMirrored,
  } = useAnimator();

  const [editingTmplId, setEditingTmplId] = useState<string | null>(null);
  const [editingTmplName, setEditingTmplName] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isDuplicateMenuOpen, setIsDuplicateMenuOpen] = useState<boolean>(false);
  const duplicateMenuRef = useRef<HTMLDivElement>(null);

  // Close the duplicate menu when clicking anywhere outside of it
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (duplicateMenuRef.current && !duplicateMenuRef.current.contains(e.target as Node)) {
        setIsDuplicateMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const runDuplicate = (fn: () => void) => {
    setIsDuplicateMenuOpen(false);
    fn();
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
    const a = document.createElement('a');
    a.href = url;
    const cleanFileName = `${sceneTitle || 'Template'}.json`;
    a.download = cleanFileName;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported "${cleanFileName}"`, 'success');
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
                    <input className="input-control"
                type="text"
                      value={editingTmplName}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setEditingTmplName(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          if (editingTmplName.trim()) renameProjectTemplate(tmpl.id, editingTmplName.trim());
                          setEditingTmplId(null);
                        } else if (e.key === 'Escape') {
                          setEditingTmplId(null);
                        }
                      }}
                      onBlur={() => {
                        if (editingTmplName.trim()) renameProjectTemplate(tmpl.id, editingTmplName.trim());
                        setEditingTmplId(null);
                      }}
                      style={{
                        background: '#090b10',
                        border: '1px solid #38bdf8',
                        color: '#fff',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 15,
                        fontWeight: 700,
                        outline: 'none',
                        width: 110,
                      }}
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
                        deleteProjectTemplate(tmpl.id);
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

          <button className="header-action-btn export-btn" onClick={handleExport} title="Export Video / Animation Sequence">
            <Download size={14} />
            <span>Export Video</span>
          </button>

          {/* Duplicate dropdown: normal copy + mirrored copies */}
          <div ref={duplicateMenuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button
              className="header-action-btn export-btn"
              onClick={() => {
                if (!selectedPartId) {
                  showToast('Select a part first to duplicate it', 'info');
                  return;
                }
                setIsDuplicateMenuOpen((v) => !v);
              }}
              title="Duplicate selected part (normal, or mirrored across Y axis / X axis / origin)"
            >
              <CopyPlus size={14} />
              <span>Duplicate</span>
              <ChevronDown size={12} />
            </button>

            {isDuplicateMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  zIndex: 1000,
                  minWidth: 190,
                  background: '#10141d',
                  border: '1px solid #283044',
                  borderRadius: 8,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
                  padding: 4,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <button
                  className="btn-secondary"
                  style={{ justifyContent: 'flex-start', gap: 8, padding: '7px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6 }}
                  onClick={() => runDuplicate(duplicateSelectedPart)}
                  title="Same shape copy, offset by 20px (Ctrl+D)"
                >
                  <CopyPlus size={14} className="text-cyan" />
                  <span>Duplicate (Ctrl+D)</span>
                </button>
                <button
                  className="btn-secondary"
                  style={{ justifyContent: 'flex-start', gap: 8, padding: '7px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6 }}
                  onClick={() => runDuplicate(() => duplicateMirrored('y'))}
                  title="Mirror copy across the Y axis (horizontal flip)"
                >
                  <FlipHorizontal2 size={14} className="text-cyan" />
                  <span>Mirror Y (Horizontal Flip)</span>
                </button>
                <button
                  className="btn-secondary"
                  style={{ justifyContent: 'flex-start', gap: 8, padding: '7px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6 }}
                  onClick={() => runDuplicate(() => duplicateMirrored('x'))}
                  title="Mirror copy across the X axis (vertical flip)"
                >
                  <FlipVertical2 size={14} className="text-cyan" />
                  <span>Mirror X (Vertical Flip)</span>
                </button>
                <button
                  className="btn-secondary"
                  style={{ justifyContent: 'flex-start', gap: 8, padding: '7px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6 }}
                  onClick={() => runDuplicate(() => duplicateMirrored('origin'))}
                  title="Mirror copy through the origin (180° point reflection)"
                >
                  <RotateCw size={14} className="text-cyan" />
                  <span>Mirror Origin (180°)</span>
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
    </>
  );
};
