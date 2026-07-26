import React, { useRef, useState, useEffect } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import {
  Download,
  Upload,
  RotateCcw,
  Film,
  CheckCircle2,
  Globe,
} from 'lucide-react';
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
  } = useAnimator();

  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [editingTitleVal, setEditingTitleVal] = useState<string>(sceneTitle);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [timeAgoStr, setTimeAgoStr] = useState<string>('Not saved yet');

  // Format time ago for auto-save status badge
  useEffect(() => {
    const updateLabel = () => {
      if (!lastSavedAt) {
        setTimeAgoStr('Auto-save pending');
        return;
      }
      const seconds = Math.floor((new Date().getTime() - lastSavedAt.getTime()) / 1000);
      if (seconds < 5) {
        setTimeAgoStr('Saved just now');
      } else {
        setTimeAgoStr(`Saved ${seconds}s ago`);
      }
    };

    updateLabel();
    const timer = setInterval(updateLabel, 2000);
    return () => clearInterval(timer);
  }, [lastSavedAt]);

  const handleExport = () => {
    const json = exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sequencer-project.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Project sequence exported successfully!', 'success');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importProject(content);
        if (success) {
          showToast('Animation sequence loaded successfully!', 'success');
        } else {
          showToast('Failed to read JSON file or format error!', 'error');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="header-bar">
      {/* Brand & Project Workspace Title */}
      <div className="header-brand">
        <div className="brand-logo">
          <Film className="logo-icon" size={18} />
        </div>
        <div className="brand-title">
          <span className="title-primary">KEYFRAME STUDIO</span>
        </div>

        {/* Unreal / Reality 5 Motion Design Project Template Title Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 12, borderLeft: '1px solid var(--border-color)', paddingLeft: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#161a24', padding: '3px 9px', borderRadius: 4, border: '1px solid #282d3c' }}>
            <Globe size={13} className="text-teal" />
            {isEditingTitle ? (
              <input
                type="text"
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
                style={{
                  background: '#0f1117',
                  border: '1px solid #38bdf8',
                  borderRadius: 3,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '0 4px',
                  outline: 'none',
                  width: 110,
                  height: 18,
                }}
              />
            ) : (
              <span
                onClick={() => {
                  setEditingTitleVal(sceneTitle);
                  setIsEditingTitle(true);
                }}
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  borderBottom: '1px dashed rgba(255, 255, 255, 0.3)',
                }}
                title="Click to edit Motion Design Template Asset Name (e.g. News_LT_Main)"
              >
                {sceneTitle}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mode Toggle - Centered */}
      <div className="header-center-controls">

        {/* Mode Toggle */}
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

        {/* Fixed 60 FPS Badge */}
        <div className="fps-selector" style={{ flexShrink: 0, padding: '4px 8px', background: 'var(--bg-input)', borderRadius: 6, fontSize: 11, fontWeight: 700, color: 'var(--accent-cyan)' }}>
          <span>60 FPS</span>
        </div>

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
  );
};
