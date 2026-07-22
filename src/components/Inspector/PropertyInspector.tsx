import React, { useState } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import type { CharacterPart } from '../../types/animator';
import { InteractiveCubicBezierEditor } from './InteractiveCubicBezierEditor';
import { TransformTab } from './sections/TransformTab';
import { StyleTab } from './sections/StyleTab';
import { MotionTab } from './sections/MotionTab';
import { PresetsTab } from './sections/PresetsTab';
import { Sliders, Sparkles, Activity, Palette, Zap, Trash2 } from 'lucide-react';
import './PropertyInspector.css';

type TabType = 'transform' | 'style' | 'easing' | 'motion' | 'presets';

export const PropertyInspector: React.FC = () => {
  const {
    currentFrame,
    selectedPartId,
    characterParts,
    setCharacterParts,
    tracks,
    getComputedTransform,
    addKeyframeForSelected,
    updateCurrentTransform,
    updateKeyframeBezierPoints,
    applyPresetPose,
    deletePart,
    applyMotionTransition,
  } = useAnimator();

  const [activeTab, setActiveTab] = useState<TabType>('transform');

  const selectedPart = characterParts.find((p) => p.id === selectedPartId);
  const transform = selectedPartId ? getComputedTransform(selectedPartId, currentFrame) : null;

  const currentTrack = selectedPartId ? tracks.find((t) => t.partId === selectedPartId) : null;
  const currentKf = currentTrack ? currentTrack.keyframes.find((k) => k.frame === currentFrame) : null;

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
              <TransformTab
                selectedPart={selectedPart}
                transform={transform}
                currentFrame={currentFrame}
                addKeyframeForSelected={addKeyframeForSelected}
                updateCurrentTransform={updateCurrentTransform}
                handlePartPropChange={handlePartPropChange}
              />
            )}

            {/* TAB 2: STYLE, COLOR, TEXT, CLONER & PARTICLES */}
            {activeTab === 'style' && (
              <StyleTab
                selectedPart={selectedPart}
                handlePartPropChange={handlePartPropChange}
                handlePartColorChange={handlePartColorChange}
                handleZIndexChange={handleZIndexChange}
              />
            )}

            {/* TAB 3: MOTION TRANSITIONS */}
            {activeTab === 'motion' && (
              <MotionTab
                selectedPartId={selectedPartId}
                applyMotionTransition={applyMotionTransition}
              />
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
          <PresetsTab applyPresetPose={applyPresetPose} />
        )}
      </div>
    </aside>
  );
};
