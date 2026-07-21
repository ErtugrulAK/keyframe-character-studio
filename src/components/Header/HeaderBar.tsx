import React, { useRef, useState, useEffect } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import {
  Play,
  Pause,
  Square,
  Repeat,
  PlusCircle,
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
    currentFrame,
    setCurrentFrame,
    isPlaying,
    setIsPlaying,
    fps,
    setFps,
    totalFrames,
    isLooping,
    setIsLooping,
    addKeyframeForSelected,
    exportProject,
    importProject,
    resetProject,
    lastSavedAt,
    triggerManualSave,
  } = useAnimator();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [timeAgoStr, setTimeAgoStr] = useState<string>('Henüz kaydedilmedi');

  // Format time ago for auto-save status badge
  useEffect(() => {
    const updateLabel = () => {
      if (!lastSavedAt) {
        setTimeAgoStr('Otomatik Kayıt Bekliyor');
        return;
      }
      const seconds = Math.floor((new Date().getTime() - lastSavedAt.getTime()) / 1000);
      if (seconds < 5) {
        setTimeAgoStr('Az önce kaydedildi');
      } else {
        setTimeAgoStr(`${seconds}sn önce kaydedildi`);
      }
    };

    updateLabel();
    const timer = setInterval(updateLabel, 2000);
    return () => clearInterval(timer);
  }, [lastSavedAt]);

  const formatTimecode = (frame: number, currentFps: number) => {
    const totalSeconds = Math.floor(frame / currentFps);
    const subFrames = frame % currentFps;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(subFrames).padStart(2, '0')}`;
  };

  const handleExport = () => {
    const json = exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sequencer-2d-animation-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
          alert('Animasyon dizisi başarıyla yüklendi!');
        } else {
          alert('JSON dosyası okunamadı veya biçimi hatalı!');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="header-bar">
      {/* Brand & Project Title */}
      <div className="header-brand">
        <div className="brand-logo">
          <Sparkles className="logo-icon" size={18} />
        </div>
        <div className="brand-title">
          <div className="brand-title-top">
            <span className="title-primary">SEQUENCER 2D</span>
            <span className="pro-badge">PRO v2.0</span>
          </div>
          <span className="title-sub">UNREAL ENGINE STYLE ANIMATOR</span>
        </div>
      </div>

      {/* Auto-Save Status Badge */}
      <div className="autosave-status-badge" onClick={triggerManualSave} title="10 saniyede bir otomatik kaydedilir. Manuel kaydetmek için tıklayın.">
        <div className="pulse-green-dot" />
        <CheckCircle2 size={13} className="text-green" />
        <span className="autosave-text">{timeAgoStr}</span>
      </div>

      {/* Playback Controls */}
      <div className="header-playback">
        <button
          className="btn-icon"
          title="Başa Dön (Frame 0)"
          onClick={() => setCurrentFrame(0)}
        >
          <RotateCcw size={16} />
        </button>

        <button
          className={`btn-icon play-btn ${isPlaying ? 'playing' : ''}`}
          title={isPlaying ? 'Duraklat (Space)' : 'Oynat (Space)'}
          onClick={() => setIsPlaying((prev) => !prev)}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>

        <button
          className="btn-icon"
          title="Durdur"
          onClick={() => {
            setIsPlaying(false);
            setCurrentFrame(0);
          }}
        >
          <Square size={16} />
        </button>

        <button
          className={`btn-icon ${isLooping ? 'active' : ''}`}
          title="Döngü (Loop)"
          onClick={() => setIsLooping(!isLooping)}
        >
          <Repeat size={16} />
        </button>

        <div className="timecode-display" title="Zaman Kodu (Dakika:Saniye:Frame)">
          {formatTimecode(currentFrame, fps)}
        </div>

        <div className="frame-counter">
          <span>FRAME</span>
          <input
            type="number"
            min={0}
            max={totalFrames}
            value={currentFrame}
            onChange={(e) => setCurrentFrame(Math.max(0, Math.min(totalFrames, parseInt(e.target.value) || 0)))}
          />
          <span className="total-frames">/ {totalFrames}</span>
        </div>

        <div className="fps-selector">
          <span>FPS</span>
          <select value={fps} onChange={(e) => setFps(parseInt(e.target.value))}>
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={30}>30</option>
            <option value={60}>60</option>
          </select>
        </div>
      </div>

      {/* Keyframe & Action Controls */}
      <div className="header-actions">
        <button className="btn-secondary add-kf-btn" onClick={addKeyframeForSelected} title="Seçili parçaya bulunduğun frame'de keyframe ekle">
          <PlusCircle size={15} className="text-gold" />
          <span>Keyframe Ekle</span>
        </button>

        <div className="divider-v" />

        <button className="btn-secondary" onClick={triggerManualSave} title="Projeyi Anında Kaydet">
          <Save size={15} className="text-green" />
          <span>Kaydet</span>
        </button>

        <button className="btn-secondary" onClick={handleExport} title="Animasyonu JSON Olarak İndir">
          <Download size={15} />
          <span>Dışa Aktar</span>
        </button>

        <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} title="JSON Animasyon Dosyası Yükle">
          <Upload size={15} />
          <span>İçe Aktar</span>
        </button>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />

        <button className="btn-icon" onClick={resetProject} title="Varsayılana Sıfırla">
          <RotateCcw size={16} />
        </button>
      </div>
    </header>
  );
};
