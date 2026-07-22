import React, { useState, useRef, useEffect } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import { PRESET_POSES } from '../../utils/defaults';
import type { CharacterPart } from '../../types/animator';
import { InteractiveCubicBezierEditor } from './InteractiveCubicBezierEditor';
import {
  Sliders,
  Sparkles,
  Activity,
  Palette,
  Zap,
  Plus,
  Trash2,
  Sun,
  Ban,
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Layers,
  RotateCw,
  Crop,
  Type,
} from 'lucide-react';
import './PropertyInspector.css';

type TabType = 'transform' | 'style' | 'easing' | 'motion' | 'presets';

interface SmartNumberInputProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

const SmartNumberInput: React.FC<SmartNumberInputProps> = ({
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
}) => {
  const [localStr, setLocalStr] = useState<string>(String(value ?? 0));
  const isEditingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isEditingRef.current) {
      setLocalStr(String(value ?? 0));
    }
  }, [value]);

  const commit = (str: string) => {
    if (str === '' || str === '-') return;
    let parsed = parseFloat(str);
    if (isNaN(parsed)) return;
    if (min !== undefined) parsed = Math.max(min, parsed);
    if (max !== undefined) parsed = Math.min(max, parsed);
    onChange(parsed);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalStr(raw);
    commit(raw);
  };

  const handleBlur = () => {
    isEditingRef.current = false;
    if (localStr === '' || localStr === '-') {
      setLocalStr(String(value ?? 0));
      return;
    }
    let parsed = parseFloat(localStr);
    if (isNaN(parsed)) parsed = value ?? 0;
    if (min !== undefined) parsed = Math.max(min, parsed);
    if (max !== undefined) parsed = Math.min(max, parsed);
    setLocalStr(String(parsed));
    onChange(parsed);
  };

  return (
    <input
      type="text"
      value={localStr}
      step={step}
      placeholder={placeholder}
      onFocus={(e) => {
        isEditingRef.current = true;
        e.target.select();
      }}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handleBlur();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
};

const INSPECTOR_TRANSITIONS = [
  { id: 'none', label: 'None', icon: <Ban size={20} style={{ color: '#94a3b8' }} /> },
  { id: 'move_left', label: 'Move to left', icon: <ArrowLeft size={20} className="text-cyan" /> },
  { id: 'move_right', label: 'Move to right', icon: <ArrowRight size={20} className="text-teal" /> },
  { id: 'move_down', label: 'Move down', icon: <ArrowDown size={20} className="text-gold" /> },
  { id: 'move_up', label: 'Move up', icon: <ArrowUp size={20} className="text-purple" /> },
  { id: 'fade', label: 'Fade In', icon: <Layers size={20} className="text-green" /> },
  { id: 'flash', label: 'Pop Zoom', icon: <Sparkles size={20} className="text-gold" /> },
  { id: 'spin', label: 'Spin 360°', icon: <RotateCw size={20} className="text-cyan" /> },
  { id: 'bounce', label: 'Bounce In', icon: <Activity size={20} className="text-red" /> },
];

const PRESET_COLOR_SWATCHES = [
  '#00d2ff', '#ffb700', '#ff3366', '#a855f7', '#10b981',
  '#ff7b00', '#ec4899', '#3b82f6', '#06b6d4', '#14b8a6',
  '#84cc16', '#eab308', '#f97316', '#ef4444', '#6366f1',
  '#ffffff', '#94a0b8', '#334155', '#0f172a', '#000000',
];

export const PropertyInspector: React.FC = () => {
  const {
    selectedPartId,
    characterParts,
    setCharacterParts,
    getComputedTransform,
    updateCurrentTransform,
    currentFrame,
    tracks,
    updateKeyframeBezierPoints,
    applyPresetPose,
    selectedKeyframeId,
    deletePart,
    addKeyframeForSelected,
    applyMotionTransition,
  } = useAnimator();

  const [activeTab, setActiveTab] = useState<TabType>('transform');

  const selectedPart = characterParts.find((p) => p.id === selectedPartId);
  const transform = selectedPartId ? getComputedTransform(selectedPartId, currentFrame) : null;
  const currentTrack = selectedPartId ? tracks.find((t) => t.partId === selectedPartId) : null;
  const currentKf = currentTrack?.keyframes.find((k) => k.frame === currentFrame || k.id === selectedKeyframeId);

  const handlePartPropChange = (key: keyof CharacterPart, value: any) => {
    if (!selectedPartId) return;
    setCharacterParts((prev) =>
      prev.map((p) => (p.id === selectedPartId ? { ...p, [key]: value } : p))
    );
  };

  const handlePartColorChange = (key: 'fillColor' | 'strokeColor', color: string) => {
    handlePartPropChange(key, color);
  };

  const handleZIndexChange = (zIndex: number) => {
    handlePartPropChange('zIndex', zIndex);
  };



  return (
    <aside className="property-inspector">
      <div className="inspector-header">
        <Sliders size={16} className="text-cyan" />
        <span>INSPECTOR / COMPOSITION PARAMS</span>
      </div>

      {/* Inspector Navigation Tabs */}
      <div className="inspector-tabs">
        <button
          className={`tab-btn ${activeTab === 'transform' ? 'active' : ''}`}
          onClick={() => setActiveTab('transform')}
          title="Transform Controls"
        >
          <Activity size={13} />
          <span>Transform</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'style' ? 'active' : ''}`}
          onClick={() => setActiveTab('style')}
          title="Color & Style"
        >
          <Palette size={13} />
          <span>Color</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'motion' ? 'active' : ''}`}
          onClick={() => setActiveTab('motion')}
          title="Motion Transitions"
        >
          <Zap size={13} className="text-cyan" />
          <span>Motion</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'easing' ? 'active' : ''}`}
          onClick={() => setActiveTab('easing')}
          title="Cubic Bezier Curve Editor"
        >
          <Zap size={13} />
          <span>Curve</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'presets' ? 'active' : ''}`}
          onClick={() => setActiveTab('presets')}
          title="Preset Poses"
        >
          <Sparkles size={13} />
          <span>Presets</span>
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
              
              <button
                className="btn-icon delete-part-btn"
                onClick={() => deletePart(selectedPart.id)}
                title="Delete Selected Object (Backspace / Delete)"
              >
                <Trash2 size={14} className="text-red" />
              </button>
            </div>

            {/* TAB 1: TRANSFORM */}
            {activeTab === 'transform' && (
              <div className="inspector-section">
                <div className="section-title-bar">
                  <div className="section-title">
                    <Activity size={13} />
                    <span>TRANSFORM (FRAME {currentFrame})</span>
                  </div>
                  <button
                    className="btn-secondary add-kf-prop-btn"
                    onClick={addKeyframeForSelected}
                    title="Add explicit keyframe at current frame for selected object"
                  >
                    <Plus size={12} className="text-gold" /> Keyframe
                  </button>
                </div>

                <div className="input-grid">
                  <div className="input-field">
                    <label>POSITION X</label>
                    <SmartNumberInput
                      value={transform.x}
                      onChange={(val) => updateCurrentTransform({ x: val })}
                    />
                  </div>

                  <div className="input-field">
                    <label>POSITION Y ↑+</label>
                    <SmartNumberInput
                      value={-transform.y}
                      onChange={(val) => updateCurrentTransform({ y: -val })}
                    />
                  </div>

                  <div className="input-field">
                    <label>ROTATION (°)</label>
                    <SmartNumberInput
                      value={transform.rotation}
                      onChange={(val) => updateCurrentTransform({ rotation: val })}
                    />
                  </div>

                  <div className="input-field">
                    <label>OPACITY (0-1)</label>
                    <SmartNumberInput
                      value={transform.opacity}
                      min={0}
                      max={1}
                      step={0.1}
                      onChange={(val) => updateCurrentTransform({ opacity: val })}
                    />
                  </div>

                  <div className="input-field">
                    <label>SCALE X</label>
                    <SmartNumberInput
                      value={transform.scaleX}
                      min={0.05}
                      max={50}
                      step={0.1}
                      onChange={(val) => updateCurrentTransform({ scaleX: val })}
                    />
                  </div>

                  <div className="input-field">
                    <label>SCALE Y</label>
                    <SmartNumberInput
                      value={transform.scaleY}
                      min={0.05}
                      max={50}
                      step={0.1}
                      onChange={(val) => updateCurrentTransform({ scaleY: val })}
                    />
                  </div>
                </div>

                <div className="transform-quick-actions" style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1, fontSize: 11 }}
                    onClick={() => updateCurrentTransform({ rotation: 0 })}
                  >
                    Reset Rotation (0°)
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1, fontSize: 11 }}
                    onClick={() => updateCurrentTransform({ scaleX: 1, scaleY: 1 })}
                  >
                    Reset Scale (1.0)
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: STYLE, TEXT & DROP SHADOW CONTROLS */}
            {activeTab === 'style' && (
              <div className="inspector-section">
                <div className="section-title">
                  <Palette size={13} />
                  <span>COLOR PICKER & PALETTE SWATCHES</span>
                </div>

                <div className="style-controls-list">
                  {/* UI CARD CUSTOMIZATION FIELDS */}
                  {selectedPart.type === 'custom_card' && (
                    <>
                      <div className="input-field">
                        <label>CARD HEADER / CATEGORY</label>
                        <input
                          type="text"
                          value={selectedPart.cardCategory || selectedPart.textValue || ''}
                          placeholder="e.g. STUDIO CARD"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            handlePartPropChange('cardCategory', e.target.value);
                            handlePartPropChange('textValue', e.target.value);
                          }}
                        />
                      </div>

                      <div className="input-field">
                        <label>MAIN TITLE TEXT</label>
                        <input
                          type="text"
                          value={selectedPart.cardTitle || ''}
                          placeholder="e.g. MOTION GRAPHIC"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handlePartPropChange('cardTitle', e.target.value)}
                        />
                      </div>

                      <div className="input-field">
                        <label>ACTION BUTTON TEXT</label>
                        <input
                          type="text"
                          value={selectedPart.cardButtonText || ''}
                          placeholder="e.g. ACTIVE"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handlePartPropChange('cardButtonText', e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  {/* Standard Text Input Control if object is Text or Banner */}
                  {(selectedPart.type === 'custom_text' || selectedPart.type === 'custom_banner') && (
                    <div className="input-field">
                      <label>TEXT CONTENT</label>
                      <input
                        type="text"
                        value={selectedPart.textValue || ''}
                        placeholder="Enter text..."
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handlePartPropChange('textValue', e.target.value)}
                      />
                    </div>
                  )}

                  {(selectedPart.type === 'custom_text' || selectedPart.type === 'custom_banner' || selectedPart.type === 'custom_card') && (
                    <div className="input-field">
                      <label>FONT SIZE (PX)</label>
                      <SmartNumberInput
                        value={selectedPart.fontSize ?? 20}
                        min={8}
                        max={120}
                        onChange={(val) => handlePartPropChange('fontSize', val)}
                      />
                    </div>
                  )}

                  {/* Image URL Input Control if object is Custom Image */}
                  {selectedPart.type === 'custom_image' && (
                    <div className="input-field">
                      <label>IMAGE SOURCE (URL / DATA URL)</label>
                      <input
                        type="text"
                        value={selectedPart.imageUrl || ''}
                        placeholder="Paste image URL..."
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handlePartPropChange('imageUrl', e.target.value)}
                      />
                    </div>
                  )}

                  {/* Video URL Input Control if object is Custom Video */}
                  {selectedPart.type === 'custom_video' && (
                    <div className="input-field">
                      <label>VIDEO SOURCE (URL / MP4 / WEBM)</label>
                      <input
                        type="text"
                        value={selectedPart.videoUrl || ''}
                        placeholder="Paste video URL..."
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handlePartPropChange('videoUrl', e.target.value)}
                      />
                    </div>
                  )}

                  {/* OVERLAY CAPTION TEXT BOX FOR IMAGE & VIDEO */}
                  {(selectedPart.type === 'custom_image' || selectedPart.type === 'custom_video') && (
                    <>
                      <div className="section-title" style={{ marginTop: 8 }}>
                        <Type size={13} className="text-cyan" />
                        <span>OVERLAY CAPTION TEXT</span>
                      </div>

                      <div className="input-field">
                        <label>CAPTION TEXT</label>
                        <input
                          type="text"
                          value={selectedPart.overlayText || ''}
                          placeholder="e.g. BEFORE & AFTER"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handlePartPropChange('overlayText', e.target.value)}
                        />
                      </div>

                      {selectedPart.overlayText && (
                        <div className="input-field">
                          <label>CAPTION POSITION</label>
                          <select
                            value={selectedPart.overlayTextPosition || 'bottom'}
                            onChange={(e) => handlePartPropChange('overlayTextPosition', e.target.value)}
                          >
                            <option value="bottom">Bottom Banner</option>
                            <option value="center">Center Badge</option>
                            <option value="top">Top Header</option>
                          </select>
                        </div>
                      )}

                      {/* CROP MASK & ASPECT FOCUS WINDOW */}
                      <div className="section-title" style={{ marginTop: 12 }}>
                        <Crop size={13} className="text-gold" />
                        <span>CROP & ASPECT FOCUS WINDOW</span>
                      </div>

                      <div className="crop-toggle-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 8px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Enable Crop Frame Mask</span>
                        <button
                          className={`duration-preset-pill ${selectedPart.cropEnabled ? 'active' : ''}`}
                          onClick={() => handlePartPropChange('cropEnabled', !selectedPart.cropEnabled)}
                        >
                          {selectedPart.cropEnabled ? 'ON' : 'OFF'}
                        </button>
                      </div>

                      {selectedPart.cropEnabled && (
                        <div className="crop-controls-box" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {/* Aspect Ratio Preset Pills */}
                          <div style={{ display: 'flex', gap: 4 }}>
                            {[
                              { label: '9:16', x: 25, y: 5, w: 50, h: 90 },
                              { label: '1:1', x: 20, y: 10, w: 60, h: 80 },
                              { label: '4:5', x: 15, y: 10, w: 70, h: 80 },
                              { label: '16:9', x: 5, y: 20, w: 90, h: 60 },
                            ].map((preset) => (
                              <button
                                key={preset.label}
                                className="btn-secondary"
                                style={{ flex: 1, fontSize: 10, padding: '3px 0' }}
                                onClick={() => {
                                  handlePartPropChange('cropX', preset.x);
                                  handlePartPropChange('cropY', preset.y);
                                  handlePartPropChange('cropWidth', preset.w);
                                  handlePartPropChange('cropHeight', preset.h);
                                }}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>

                          {/* Crop Frame Sliders & Inputs */}
                          <div className="input-grid">
                            <div className="input-field">
                              <label>CROP X (%)</label>
                              <SmartNumberInput
                                value={selectedPart.cropX ?? 25}
                                min={0}
                                max={90}
                                onChange={(val) => handlePartPropChange('cropX', val)}
                              />
                            </div>
                            <div className="input-field">
                              <label>CROP Y (%)</label>
                              <SmartNumberInput
                                value={selectedPart.cropY ?? 10}
                                min={0}
                                max={90}
                                onChange={(val) => handlePartPropChange('cropY', val)}
                              />
                            </div>
                            <div className="input-field">
                              <label>CROP W (%)</label>
                              <SmartNumberInput
                                value={selectedPart.cropWidth ?? 50}
                                min={10}
                                max={100}
                                onChange={(val) => handlePartPropChange('cropWidth', val)}
                              />
                            </div>
                            <div className="input-field">
                              <label>CROP H (%)</label>
                              <SmartNumberInput
                                value={selectedPart.cropHeight ?? 80}
                                min={10}
                                max={100}
                                onChange={(val) => handlePartPropChange('cropHeight', val)}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* CORNER RADIUS (KÖŞE YUVARLAMA) CONTROL */}
                  {(selectedPart.type === 'custom_rect' ||
                    selectedPart.type === 'custom_box' ||
                    selectedPart.type === 'custom_card' ||
                    selectedPart.type === 'custom_banner' ||
                    selectedPart.type === 'custom_capsule') && (
                    <div className="input-field" style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)' }}>
                          CORNER RADIUS (KÖŞE YUVARLAMA)
                        </label>
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>
                          {selectedPart.borderRadius ?? 0}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={40}
                        step={1}
                        value={selectedPart.borderRadius ?? 0}
                        onChange={(e) => handlePartPropChange('borderRadius', parseInt(e.target.value) || 0)}
                        style={{ width: '100%', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
                      />
                    </div>
                  )}

                  <div className="color-picker-row">
                    <label>Body Fill Color</label>
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
                    <label>Outline Stroke Color</label>
                    <div className="picker-wrapper">
                      <input
                        type="color"
                        value={selectedPart.strokeColor}
                        onChange={(e) => handlePartColorChange('strokeColor', e.target.value)}
                      />
                      <span className="color-hex">{selectedPart.strokeColor}</span>
                    </div>
                  </div>

                  {/* Preset Color Swatches */}
                  <div className="color-swatch-section">
                    <label className="swatch-title">STUDIO COLOR PALETTE</label>
                    <div className="color-swatch-grid">
                      {PRESET_COLOR_SWATCHES.map((hex) => (
                        <button
                          key={hex}
                          className="swatch-btn"
                          style={{ backgroundColor: hex }}
                          onClick={() => handlePartColorChange('fillColor', hex)}
                          title={`Set Fill Color to ${hex}`}
                        />
                      ))}
                    </div>
                  </div>                  <div className="input-field zindex-full">
                    <label>Z-INDEX LAYER PRIORITY</label>
                    <SmartNumberInput
                      value={selectedPart.zIndex ?? 1}
                      onChange={(val) => handleZIndexChange(val)}
                    />
                  </div>

                  {/* DROP SHADOW & GLOW SECTION */}
                  <div className="section-title" style={{ marginTop: 8 }}>
                    <Sun size={13} className="text-gold" />
                    <span>DROP SHADOW & SHADING EFFECTS</span>
                  </div>

                  <div className="color-picker-row">
                    <label>Shadow / Glow Color</label>
                    <div className="picker-wrapper">
                      <input
                        type="color"
                        value={selectedPart.shadowColor || '#000000'}
                        onChange={(e) => handlePartPropChange('shadowColor', e.target.value)}
                      />
                      <span className="color-hex">{selectedPart.shadowColor || 'None'}</span>
                    </div>
                  </div>

                  <div className="input-grid">
                    <div className="input-field">
                      <label>SHADOW BLUR (PX)</label>
                      <SmartNumberInput
                        value={selectedPart.shadowBlur ?? 0}
                        min={0}
                        max={100}
                        onChange={(val) => handlePartPropChange('shadowBlur', val)}
                      />
                    </div>

                    <div className="input-field">
                      <label>OFFSET X (PX)</label>
                      <SmartNumberInput
                        value={selectedPart.shadowOffsetX ?? 0}
                        min={-100}
                        max={100}
                        onChange={(val) => handlePartPropChange('shadowOffsetX', val)}
                      />
                    </div>

                    <div className="input-field">
                      <label>OFFSET Y (PX)</label>
                      <SmartNumberInput
                        value={selectedPart.shadowOffsetY ?? 0}
                        min={-100}
                        max={100}
                        onChange={(val) => handlePartPropChange('shadowOffsetY', val)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: MOTION TRANSITIONS */}
            {activeTab === 'motion' && (
              <div className="inspector-section">
                <div className="section-title">
                  <Zap size={13} className="text-cyan" />
                  <span>MOTION TRANSITION PRESETS</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Click a motion transition to auto-generate keyframe animations for the selected object.
                </p>

                <div className="transition-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {INSPECTOR_TRANSITIONS.map((item) => (
                    <button
                      key={item.id}
                      className="transition-card"
                      style={{
                        padding: '10px 4px',
                        background: 'var(--bg-dark)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                      }}
                      onClick={() => selectedPartId && applyMotionTransition(selectedPartId, item.id)}
                      title={`Apply ${item.label} to selected object`}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          background: 'var(--bg-input)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {item.icon}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: CURVE EDITOR (INTERACTIVE CUBIC BEZIER) */}
            {activeTab === 'easing' && (
              <div className="inspector-section">
                <div className="section-title">
                  <Zap size={13} className="text-gold" />
                  <span>INTERACTIVE CUBIC BEZIER EDITOR</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Drag Cyan P1 & Gold P2 handles to shape custom speed curves (cubic-bezier.com style).
                </p>

                {currentKf && currentTrack ? (
                  <InteractiveCubicBezierEditor
                    controlPoints={currentKf.bezierControlPoints}
                    onChange={(points) => updateKeyframeBezierPoints(currentTrack.id, currentKf.id, points)}
                  />
                ) : (
                  <div className="no-kf-warning">
                    <span>No keyframe at Frame {currentFrame}. Click "Add Keyframe" to create or edit curves.</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="no-selection">
            <Sparkles size={36} className="text-teal text-glow" />
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc', margin: '10px 0 4px' }}>NO OBJECT SELECTED</h3>
            <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', lineHeight: 1.5, maxWidth: 240 }}>
              Select an object on the canvas or pick a track from the timeline to edit transforms, colors, and motion curves.
            </p>
          </div>
        )}

        {/* TAB 5: PRESETS */}
        {activeTab === 'presets' && (
          <div className="inspector-section presets-section">
            <div className="section-title">
              <Sparkles size={13} className="text-gold" />
              <span>PRESET POSE LIBRARY</span>
            </div>

            <div className="preset-grid">
              {PRESET_POSES.map((pose) => (
                <button
                  key={pose.id}
                  className="btn-secondary preset-btn"
                  onClick={() => applyPresetPose(pose.id)}
                  title={`Apply ${pose.name} pose to character`}
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

