import React, { useState } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import type { CharacterPart } from '../../types/animator';
import { TransformTab } from './sections/TransformTab';
import { StyleTab } from './sections/StyleTab';
import { MotionTab } from './sections/MotionTab';
import { Sliders, Sparkles, Activity, Palette, Zap, Trash2, Copy } from 'lucide-react';
import './PropertyInspector.css';

type TabType = 'transform' | 'style' | 'motion';

export const PropertyInspector: React.FC = () => {
  const {
    currentFrame,
    selectedPartId,
    characterParts,
    setCharacterParts,
    getComputedTransform,
    addKeyframeForSelected,
    updateCurrentTransform,
    deletePart,
    duplicateSelectedPart,
  } = useAnimator();

  const [activeTab, setActiveTab] = useState<TabType>('transform');

  const selectedPart = characterParts.find((p) => p.id === selectedPartId);
  const transform = selectedPartId ? getComputedTransform(selectedPartId, currentFrame) : null;

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
        <span>INSPECTOR / PROPERTY PARAMS</span>
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
          title="Appearance, Colors & Materials"
        >
          <Palette size={13} />
          <span>Appearance</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'motion' ? 'active' : ''}`}
          onClick={() => setActiveTab('motion')}
          title="Motion Transitions & Custom Presets"
        >
          <Zap size={13} className="text-cyan" />
          <span>Motion</span>
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

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  className="btn-icon"
                  onClick={duplicateSelectedPart}
                  title="Duplicate Object (Ctrl+D / Ctrl+C + Ctrl+V)"
                  style={{ width: 28, height: 28 }}
                >
                  <Copy size={13} className="text-cyan" />
                </button>
                <button
                  className="btn-icon delete-part-btn"
                  onClick={() => deletePart(selectedPart.id)}
                  title="Delete Selected Object (Backspace / Delete)"
                  style={{ width: 28, height: 28 }}
                >
                  <Trash2 size={14} className="text-red" />
                </button>
              </div>
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

            {/* TAB 4: MOTION TRANSITIONS */}
            {activeTab === 'motion' && (
              <MotionTab
                selectedPart={selectedPart}
                handlePartPropChange={handlePartPropChange}
              />
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
      </div>
    </aside>
  );
};
