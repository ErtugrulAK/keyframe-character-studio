import React, { useState } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import { PRESET_POSES } from '../../utils/defaults';
import type { EasingType } from '../../types/animator';
import { Sliders, Sparkles, Layers, Activity, Palette, Zap } from 'lucide-react';
import './PropertyInspector.css';

type TabType = 'transform' | 'style' | 'easing' | 'presets';

export const PropertyInspector: React.FC = () => {
  const {
    selectedPartId,
    characterParts,
    setCharacterParts,
    getComputedTransform,
    updateCurrentTransform,
    currentFrame,
    tracks,
    updateKeyframeEasing,
    applyPresetPose,
    selectedKeyframeId,
  } = useAnimator();

  const [activeTab, setActiveTab] = useState<TabType>('transform');

  const selectedPart = characterParts.find((p) => p.id === selectedPartId);
  const transform = selectedPartId ? getComputedTransform(selectedPartId, currentFrame) : null;
  const currentTrack = selectedPartId ? tracks.find((t) => t.partId === selectedPartId) : null;
  const currentKf = currentTrack?.keyframes.find((k) => k.frame === currentFrame || k.id === selectedKeyframeId);

  const handlePartColorChange = (key: 'fillColor' | 'strokeColor', color: string) => {
    if (!selectedPartId) return;
    setCharacterParts((prev) =>
      prev.map((p) => (p.id === selectedPartId ? { ...p, [key]: color } : p))
    );
  };

  const handleZIndexChange = (zIndex: number) => {
    if (!selectedPartId) return;
    setCharacterParts((prev) =>
      prev.map((p) => (p.id === selectedPartId ? { ...p, zIndex } : p))
    );
  };

  const renderEasingCurvePreview = (easing: EasingType) => {
    let pathD = 'M 0 40 L 60 0';
    if (easing === 'easeIn') pathD = 'M 0 40 Q 40 40 60 0';
    if (easing === 'easeOut') pathD = 'M 0 40 Q 20 0 60 0';
    if (easing === 'easeInOut') pathD = 'M 0 40 C 30 40 30 0 60 0';
    if (easing === 'bounce') pathD = 'M 0 40 L 30 10 L 40 25 L 50 5 L 60 0';

    return (
      <svg className="easing-curve-svg" width="60" height="40" viewBox="0 0 60 40">
        <path d={pathD} fill="none" stroke="#00d2ff" strokeWidth="2.5" />
      </svg>
    );
  };

  return (
    <aside className="property-inspector">
      <div className="inspector-header">
        <Sliders size={15} className="text-cyan" />
        <span>PROPERTY INSPECTOR</span>
      </div>

      {/* Inspector Navigation Tabs */}
      <div className="inspector-tabs">
        <button
          className={`tab-btn ${activeTab === 'transform' ? 'active' : ''}`}
          onClick={() => setActiveTab('transform')}
          title="Transform Değerleri"
        >
          <Activity size={14} />
          <span>Transform</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'style' ? 'active' : ''}`}
          onClick={() => setActiveTab('style')}
          title="Renk ve Görünüm"
        >
          <Palette size={14} />
          <span>Stil</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'easing' ? 'active' : ''}`}
          onClick={() => setActiveTab('easing')}
          title="Keyframe Eğrileri"
        >
          <Zap size={14} />
          <span>Eğriler</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'presets' ? 'active' : ''}`}
          onClick={() => setActiveTab('presets')}
          title="Hazır Duruşlar"
        >
          <Sparkles size={14} />
          <span>Duruşlar</span>
        </button>
      </div>

      <div className="inspector-body">
        {selectedPart && transform ? (
          <>
            {/* Header Selected Part Badge */}
            <div className="part-info-card">
              <div className="part-name-group">
                <span className="part-name">{selectedPart.name}</span>
                <span className="part-id-tag">ID: {selectedPart.id}</span>
              </div>
              <div className="part-type-badge">{selectedPart.type.toUpperCase()}</div>
            </div>

            {/* TAB 1: TRANSFORM */}
            {activeTab === 'transform' && (
              <div className="inspector-section">
                <div className="section-title">
                  <Activity size={13} />
                  <span>POZİSYON & DÖNDÜRME (FRAME {currentFrame})</span>
                </div>

                <div className="input-grid">
                  <div className="input-field">
                    <label>POZİSYON X</label>
                    <input
                      type="number"
                      value={Math.round(transform.x)}
                      onChange={(e) => updateCurrentTransform({ x: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="input-field">
                    <label>POZİSYON Y</label>
                    <input
                      type="number"
                      value={Math.round(transform.y)}
                      onChange={(e) => updateCurrentTransform({ y: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="input-field">
                    <label>AÇI (°)</label>
                    <input
                      type="number"
                      value={Math.round(transform.rotation)}
                      onChange={(e) => updateCurrentTransform({ rotation: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="input-field">
                    <label>SAYDAMLIK (0-1)</label>
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      max={1}
                      value={transform.opacity}
                      onChange={(e) => updateCurrentTransform({ opacity: parseFloat(e.target.value) || 1 })}
                    />
                  </div>

                  <div className="input-field">
                    <label>ÖLÇEK X (SCALE)</label>
                    <input
                      type="number"
                      step={0.1}
                      value={transform.scaleX}
                      onChange={(e) => updateCurrentTransform({ scaleX: parseFloat(e.target.value) || 1 })}
                    />
                  </div>

                  <div className="input-field">
                    <label>ÖLÇEK Y (SCALE)</label>
                    <input
                      type="number"
                      step={0.1}
                      value={transform.scaleY}
                      onChange={(e) => updateCurrentTransform({ scaleY: parseFloat(e.target.value) || 1 })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: STYLE */}
            {activeTab === 'style' && (
              <div className="inspector-section">
                <div className="section-title">
                  <Palette size={13} />
                  <span>RENK PALETİ & KATMAN DÜZENİ</span>
                </div>

                <div className="style-controls-list">
                  <div className="color-picker-row">
                    <label>Gövde Dolgu Rengi</label>
                    <div className="picker-wrapper">
                      <input
                        type="color"
                        value={selectedPart.fillColor}
                        onChange={(e) => handlePartColorChange('fillColor', e.target.value)}
                      />
                      <span className="color-hex">{selectedPart.fillColor}</span>
                    </div>
                  </div>

                  <div className="color-picker-row">
                    <label>Çizgi Kenarlık Rengi</label>
                    <div className="picker-wrapper">
                      <input
                        type="color"
                        value={selectedPart.strokeColor}
                        onChange={(e) => handlePartColorChange('strokeColor', e.target.value)}
                      />
                      <span className="color-hex">{selectedPart.strokeColor}</span>
                    </div>
                  </div>

                  <div className="input-field zindex-full">
                    <label>Z-INDEX KATMAN ÖNCELİĞİ</label>
                    <input
                      type="number"
                      value={selectedPart.zIndex}
                      onChange={(e) => handleZIndexChange(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: EASING */}
            {activeTab === 'easing' && (
              <div className="inspector-section">
                <div className="section-title">
                  <Zap size={13} className="text-gold" />
                  <span>İNTERPOLASYON EĞRİSİ</span>
                </div>

                {currentKf && currentTrack ? (
                  <div className="easing-editor">
                    <div className="curve-preview-container">
                      {renderEasingCurvePreview(currentKf.easing)}
                      <span className="curve-name">{currentKf.easing.toUpperCase()}</span>
                    </div>

                    <div className="easing-field">
                      <label>Seçili Keyframe Easing Türü</label>
                      <select
                        value={currentKf.easing}
                        onChange={(e) =>
                          updateKeyframeEasing(currentTrack.id, currentKf.id, e.target.value as EasingType)
                        }
                      >
                        <option value="linear">Linear (Doğrusal)</option>
                        <option value="easeIn">Ease In (Hızlanan)</option>
                        <option value="easeOut">Ease Out (Yavaşlayan)</option>
                        <option value="easeInOut">Ease In Out (Yumuşak Geçiş)</option>
                        <option value="bounce">Bounce (Sıçrama)</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="no-kf-warning">
                    <span>Frame {currentFrame}'de keyframe bulunmuyor. Üst menüden "Keyframe Ekle"ye basın.</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="no-selection">
            <Layers size={36} className="text-muted" />
            <p>Sahneden bir 2D karakter parçası seçin</p>
          </div>
        )}

        {/* TAB 4: PRESETS (Or always visible at bottom when Presets tab active) */}
        {activeTab === 'presets' && (
          <div className="inspector-section presets-section">
            <div className="section-title">
              <Sparkles size={13} className="text-gold" />
              <span>HAZIR DURUŞ KÜTÜPHANESİ</span>
            </div>

            <div className="preset-grid">
              {PRESET_POSES.map((pose) => (
                <button
                  key={pose.id}
                  className="btn-secondary preset-btn"
                  onClick={() => applyPresetPose(pose.id)}
                  title={`Karaktere ${pose.name} duruşunu uygula`}
                >
                  {pose.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
