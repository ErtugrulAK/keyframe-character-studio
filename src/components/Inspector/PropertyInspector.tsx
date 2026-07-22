import React, { useState } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import { PRESET_POSES, applyEasing } from '../../utils/defaults';
import type { EasingType, CharacterPart } from '../../types/animator';
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
} from 'lucide-react';
import './PropertyInspector.css';

type TabType = 'transform' | 'style' | 'easing' | 'motion' | 'presets';

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
    updateKeyframeEasing,
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

  // Plot Mathematical Curve Points for Graph Curve Editor
  const renderEasingCurvePreview = (easing: EasingType) => {
    const width = 280;
    const height = 150;
    const padding = 20;
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;

    const points: string[] = [];
    const steps = 40;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const easedT = applyEasing(t, easing);
      const x = padding + t * innerW;
      const y = height - padding - easedT * innerH;
      points.push(`${x},${y}`);
    }

    const pathD = `M ${points.join(' L ')}`;

    return (
      <svg width={width} height={height} className="curve-svg">
        {/* Background Grid */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.15)" />

        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgba(255,255,255,0.15)" />
        <line x1={width / 2} y1={padding} x2={width / 2} y2={height - padding} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
        <line x1={width - padding} y1={padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />

        {/* Acceleration Bezier Curve Path */}
        <path d={pathD} fill="none" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />

        {/* Start / End Curve Handles */}
        <circle cx={padding} cy={height - padding} r={4} fill="#6366f1" />
        <circle cx={width - padding} cy={padding} r={4} fill="#38bdf8" />
      </svg>
    );
  };

  return (
    <aside className="property-inspector">
      <div className="inspector-header">
        <Sliders size={16} className="text-cyan" />
        <span>PROPERTIES INSPECTOR</span>
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
          title="Curve Editor"
        >
          <Zap size={13} />
          <span>Curve Graph</span>
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
                    <input
                      type="number"
                      value={transform.x === 0 ? '0' : transform.x}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateCurrentTransform({ x: val === '' ? 0 : parseFloat(val) || 0 });
                      }}
                    />
                  </div>

                  <div className="input-field">
                    <label>POSITION Y</label>
                    <input
                      type="number"
                      value={transform.y === 0 ? '0' : transform.y}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateCurrentTransform({ y: val === '' ? 0 : parseFloat(val) || 0 });
                      }}
                    />
                  </div>

                  <div className="input-field">
                    <label>ROTATION (°)</label>
                    <input
                      type="number"
                      value={transform.rotation === 0 ? '0' : transform.rotation}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateCurrentTransform({ rotation: val === '' ? 0 : parseFloat(val) || 0 });
                      }}
                    />
                  </div>

                  <div className="input-field">
                    <label>OPACITY (0-1)</label>
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      max={1}
                      value={transform.opacity}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateCurrentTransform({ opacity: val === '' ? 1 : parseFloat(val) || 1 });
                      }}
                    />
                  </div>

                  <div className="input-field">
                    <label>SCALE X</label>
                    <input
                      type="number"
                      step={0.1}
                      value={transform.scaleX}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateCurrentTransform({ scaleX: val === '' ? 1 : parseFloat(val) || 1 });
                      }}
                    />
                  </div>

                  <div className="input-field">
                    <label>SCALE Y</label>
                    <input
                      type="number"
                      step={0.1}
                      value={transform.scaleY}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateCurrentTransform({ scaleY: val === '' ? 1 : parseFloat(val) || 1 });
                      }}
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
                      <input
                        type="number"
                        min={8}
                        max={120}
                        value={selectedPart.fontSize ?? 20}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const val = e.target.value;
                          handlePartPropChange('fontSize', val === '' ? 20 : parseInt(val) || 20);
                        }}
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
                  </div>

                  <div className="input-field zindex-full">
                    <label>Z-INDEX LAYER PRIORITY</label>
                    <input
                      type="number"
                      value={selectedPart.zIndex ?? 1}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleZIndexChange(val === '' ? 1 : parseInt(val) || 1);
                      }}
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
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={selectedPart.shadowBlur ?? 0}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const val = e.target.value;
                          handlePartPropChange('shadowBlur', val === '' ? 0 : parseInt(val) || 0);
                        }}
                      />
                    </div>

                    <div className="input-field">
                      <label>OFFSET X (PX)</label>
                      <input
                        type="number"
                        min={-50}
                        max={50}
                        value={selectedPart.shadowOffsetX ?? 0}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const val = e.target.value;
                          handlePartPropChange('shadowOffsetX', val === '' ? 0 : parseInt(val) || 0);
                        }}
                      />
                    </div>

                    <div className="input-field">
                      <label>OFFSET Y (PX)</label>
                      <input
                        type="number"
                        min={-50}
                        max={50}
                        value={selectedPart.shadowOffsetY ?? 0}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const val = e.target.value;
                          handlePartPropChange('shadowOffsetY', val === '' ? 0 : parseInt(val) || 0);
                        }}
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

            {/* TAB 4: CURVE EDITOR (GRAPH VIEW) */}
            {activeTab === 'easing' && (
              <div className="inspector-section">
                <div className="section-title">
                  <Zap size={13} className="text-gold" />
                  <span>CURVE GRAPH EDITOR</span>
                </div>

                {currentKf && currentTrack ? (
                  <div className="easing-editor">
                    <div className="curve-graph-box">
                      <span className="graph-label">ACCELERATION CURVE GRAPH</span>
                      {renderEasingCurvePreview(currentKf.easing)}
                      <span className="curve-name-badge">{currentKf.easing.toUpperCase()}</span>
                    </div>

                    <div className="easing-field">
                      <label>Acceleration Curve Type</label>
                      <select
                        value={currentKf.easing}
                        onChange={(e) =>
                          updateKeyframeEasing(currentTrack.id, currentKf.id, e.target.value as EasingType)
                        }
                      >
                        <option value="linear">Linear - Constant Speed</option>
                        <option value="easeIn">Ease In - Slow Start Acceleration</option>
                        <option value="easeOut">Ease Out - Fast Start Deceleration</option>
                        <option value="easeInOut">Ease In Out - Smooth Both Sides</option>
                        <option value="bounce">Bounce - Acceleration Spring</option>
                        <option value="elastic">Elastic - Oscillation & Vibration</option>
                        <option value="anticipate">Anticipate - Pull Back & Shoot</option>
                        <option value="overshoot">Overshoot - Exceed & Settle</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="no-kf-warning">
                    <span>No keyframe at Frame {currentFrame}. Click "Add Keyframe" to create one.</span>
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

