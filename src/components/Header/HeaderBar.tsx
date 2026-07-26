import React, { useRef, useState, useEffect } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import {
  Download,
  Upload,
  RotateCcw,
  Film,
  CheckCircle2,
  Globe,
  Zap,
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
    motionTemplates,
    activeTemplateId,
    setActiveTemplateId,
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
          <Film className="logo-icon" size={18} />
        </div>
        <div className="brand-title">
          <span className="title-primary">KEYFRAME STUDIO</span>
        </div>

        {/* Unreal / Reality 5 Motion Design Sequence Template Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 12, borderLeft: '1px solid var(--border-color)', paddingLeft: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#161a24', padding: '3px 8px', borderRadius: 4, border: '1px solid #282d3c' }}>
            <Globe size={13} className="text-teal" />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0' }}>News_LT_Main</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#101218', padding: '2px', borderRadius: 5, border: '1px solid #232734' }}>
            {motionTemplates.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => setActiveTemplateId(tmpl.id)}
                style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: activeTemplateId === tmpl.id ? '#fff' : '#64748b',
                  background: activeTemplateId === tmpl.id ? '#0284c7' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.15s ease',
                }}
                title={tmpl.description}
              >
                <Zap size={10} className={tmpl.type === 'in' ? 'text-teal' : tmpl.type === 'out' ? 'text-red' : 'text-gold'} />
                <span>{tmpl.name}</span>
              </button>
            ))}
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
