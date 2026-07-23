import React, { useRef, useState, useEffect } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import {
  Download,
  Upload,
  RotateCcw,
  Sparkles,
  Save,
  CheckCircle2,
} from 'lucide-react';
import './HeaderBar.css';

export const HeaderBar: React.FC = () => {
  const {
    fps,
    setFps,
    exportProject,
    importProject,
    resetProject,
    lastSavedAt,
    triggerManualSave,
    showToast,
    appMode,
    setAppMode,
  } = useAnimator();

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
          <Sparkles className="logo-icon" size={18} />
        </div>
        <div className="brand-title">
          <div className="brand-title-top">
            <span className="title-primary">KEYFRAME STUDIO</span>
            <span className="pro-badge">PRO v3.0</span>
          </div>
          <span className="title-sub">Pro Workspace // 2D Motion Sequencer</span>
        </div>
      </div>

      {/* Auto-Save & FPS Status Controls */}
      <div className="header-center-controls">
        <div className="autosave-status-badge" onClick={triggerManualSave} title="Auto-saved every 10 seconds. Click to save manually.">
          <div className="pulse-green-dot" />
          <CheckCircle2 size={13} className="text-green" />
          <span className="autosave-text">{timeAgoStr}</span>
        </div>

        {/* Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-dark)', borderRadius: 6, padding: '2px', gap: 2 }}>
          <button
            className="btn-icon"
            style={{
              padding: '6px 16px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 700,
              color: appMode === 'edit' ? '#fff' : 'var(--text-muted)',
              background: appMode === 'edit' ? 'var(--accent-teal)' : 'transparent',
              transition: 'all 0.2s',
            }}
            onClick={() => setAppMode('edit')}
          >
            EDIT MODE
          </button>
          <button
            className="btn-icon"
            style={{
              padding: '6px 16px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 700,
              color: appMode === 'broadcast' ? '#fff' : 'var(--text-muted)',
              background: appMode === 'broadcast' ? 'var(--accent-gold)' : 'transparent',
              transition: 'all 0.2s',
            }}
            onClick={() => setAppMode('broadcast')}
          >
            BROADCAST
          </button>
        </div>

        <div className="fps-selector">
          <span>FPS</span>
          <select value={fps} onChange={(e) => setFps(parseInt(e.target.value))}>
            <option value={12}>12 FPS</option>
            <option value={24}>24 FPS</option>
            <option value={30}>30 FPS</option>
            <option value={60}>60 FPS</option>
          </select>
        </div>
      </div>

      {/* Keyframe & Export Action Controls */}
      <div className="header-actions">
        <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} title="Import JSON Animation File">
          <Upload size={14} />
          <span>Import</span>
        </button>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />

        <button className="btn-secondary" onClick={triggerManualSave} title="Save Project Now">
          <Save size={14} className="text-teal" />
          <span>Save</span>
        </button>

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
