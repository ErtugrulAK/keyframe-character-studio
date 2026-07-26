import React, { useRef, useState, useEffect } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import {
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  Globe,
  Plus,
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
    setSceneTitle,
    projectTemplates,
    activeProjectTemplateId,
    setActiveProjectTemplateId,
    addProjectTemplate,
    fps,
    setFps,
  } = useAnimator();

  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [editingTitleVal, setEditingTitleVal] = useState<string>(sceneTitle);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

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
    a.download = `${sceneTitle || 'project'}_animation.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Project exported successfully!', 'success');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        try {
          const success = importProject(text);
          if (success) showToast('Project imported successfully!', 'success');
          else showToast('Invalid project file format!', 'error');
        } catch {
          showToast('Failed to read JSON file or format error!', 'error');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <>
      <header className="header-bar">
        {/* Template Title Pill (Editable Project Name) */}
        <div className="header-brand">
          <div className="header-template-pill">
            <Globe size={14} style={{ color: '#38bdf8', flexShrink: 0 }} />
            {isEditingTitle ? (
              <input
                type="text"
                className="header-title-input"
                value={editingTitleVal}
                autoFocus
                onChange={(e) => setEditingTitleVal(e.target.value)}
                onBlur={() => {
                  if (editingTitleVal.trim()) setSceneTitle(editingTitleVal.trim());
                  setIsEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (editingTitleVal.trim()) setSceneTitle(editingTitleVal.trim());
                    setIsEditingTitle(false);
                  }
                }}
              />
            ) : (
              <span
                className="header-title-text"
                onClick={() => {
                  setEditingTitleVal(sceneTitle);
                  setIsEditingTitle(true);
                }}
                title="Click to edit template name"
              >
                {sceneTitle}
              </span>
            )}
          </div>

          {/* Browser-Tab Style Project Template Tabs */}
          <div className="header-template-tabs">
            {projectTemplates.map((tmpl) => (
              <button
                key={tmpl.id}
                className={`header-tab ${activeProjectTemplateId === tmpl.id ? 'active' : ''}`}
                onClick={() => setActiveProjectTemplateId(tmpl.id)}
                title={`Şablon: ${tmpl.name}`}
              >
                {tmpl.name}
              </button>
            ))}
            <button
              className="header-tab add-tab"
              onClick={() => setIsAddModalOpen(true)}
              title="Yeni Şablon Oluştur"
            >
              <Plus size={13} />
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
          <select
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              color: 'var(--accent-cyan)',
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 6px',
              height: 26,
              cursor: 'pointer',
            }}
            title="Animasyon FPS ayarı"
          >
            <option value={24}>24 FPS</option>
            <option value={30}>30 FPS</option>
            <option value={60}>60 FPS</option>
            <option value={120}>120 FPS</option>
          </select>

          <div className="divider-v" />

          <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} title="Import JSON Animation File">
            <Upload size={14} />
            <span>Import</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />

          <button className="btn-primary export-main-btn" onClick={handleExport} title="Export Video / Animation Sequence">
            <Download size={15} />
            <span>Export Video</span>
          </button>

          <button className="btn-icon reset-btn" onClick={resetProject} title="Reset Canvas Project">
            <RotateCcw size={15} />
          </button>
        </div>
      </header>

      {/* New Project Template Modal */}
      <NewItemModal
        isOpen={isAddModalOpen}
        title="Yeni Şablon (Template) Oluştur"
        subtitle="Grafik ve animasyon paketiniz için yeni bir şablon sekmesi ekleyin."
        placeholder="Şablon adı (ör: LowerThird_v2, News_ST_01)..."
        defaultValue={`Template ${projectTemplates.length + 1}`}
        confirmLabel="Şablon Oluştur"
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={(val) => addProjectTemplate(val)}
      />
    </>
  );
};
