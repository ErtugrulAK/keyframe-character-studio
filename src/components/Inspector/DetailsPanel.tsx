import React, { useState } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import { TransformTab } from './sections/TransformTab';
import { StyleTab } from './sections/StyleTab';
import { MotionTab } from './sections/MotionTab';
import { PresetsTab } from './sections/PresetsTab';
import {
  Sliders,
  Copy,
  Trash2,
  Activity,
  Palette,
  Zap,
  Sparkles,
} from 'lucide-react';

export const DetailsPanel: React.FC = () => {
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

  const [activeTabSection, setActiveTabSection] = useState<'transform' | 'style' | 'motion' | 'presets'>('transform');

  const selectedPart = characterParts.find((p) => p.id === selectedPartId);
  const transform = selectedPartId ? getComputedTransform(selectedPartId, currentFrame) : null;

  const handlePartPropChange = (key: any, value: any) => {
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
    <div className="details-container">
      {/* 1. Header Bar */}
      <div className="details-header">
        <div className="details-title-group">
          <Sliders size={14} className="text-cyan" />
          <span className="details-title">Details</span>
        </div>
      </div>

      {/* 2. Selected Actor Instance Header */}
      {selectedPart ? (
        <div className="details-actor-card">
          <div className="actor-title-line">
            <span className="actor-main-name">{selectedPart.name}</span>
            <span className="actor-instance-tag">({selectedPart.type})</span>
          </div>

          <div className="actor-quick-actions">
            <button
              className="btn-icon-sm"
              onClick={duplicateSelectedPart}
              title="Duplicate Actor"
            >
              <Copy size={12} className="text-cyan" />
            </button>
            <button
              className="btn-icon-sm"
              onClick={() => deletePart(selectedPart.id)}
              title="Delete Actor"
            >
              <Trash2 size={12} className="text-red" />
            </button>
          </div>
        </div>
      ) : (
        <div className="details-empty-state">Select an actor in Outliner or Stage Canvas</div>
      )}

      {/* 3. Tab Sub-Navigation */}
      {selectedPart && (
        <div className="details-tabs-bar">
          <button
            className={`tab-btn ${activeTabSection === 'transform' ? 'active' : ''}`}
            onClick={() => setActiveTabSection('transform')}
          >
            <Activity size={12} />
            <span>Transform</span>
          </button>
          <button
            className={`tab-btn ${activeTabSection === 'style' ? 'active' : ''}`}
            onClick={() => setActiveTabSection('style')}
          >
            <Palette size={12} />
            <span>Style</span>
          </button>
          <button
            className={`tab-btn ${activeTabSection === 'motion' ? 'active' : ''}`}
            onClick={() => setActiveTabSection('motion')}
          >
            <Zap size={12} className="text-cyan" />
            <span>Motion</span>
          </button>
          <button
            className={`tab-btn ${activeTabSection === 'presets' ? 'active' : ''}`}
            onClick={() => setActiveTabSection('presets')}
          >
            <Sparkles size={12} className="text-gold" />
            <span>Presets</span>
          </button>
        </div>
      )}

      {/* 4. Property Section Body */}
      {selectedPart && transform && (
        <div className="details-body">
          {activeTabSection === 'transform' && (
            <TransformTab
              selectedPart={selectedPart}
              transform={transform}
              currentFrame={currentFrame}
              addKeyframeForSelected={addKeyframeForSelected}
              updateCurrentTransform={updateCurrentTransform}
              handlePartPropChange={handlePartPropChange}
            />
          )}

          {activeTabSection === 'style' && (
            <StyleTab
              selectedPart={selectedPart}
              handlePartPropChange={handlePartPropChange}
              handlePartColorChange={handlePartColorChange}
              handleZIndexChange={handleZIndexChange}
            />
          )}

          {activeTabSection === 'motion' && (
            <MotionTab
              selectedPart={selectedPart}
              handlePartPropChange={handlePartPropChange}
            />
          )}

          {activeTabSection === 'presets' && <PresetsTab />}
        </div>
      )}
    </div>
  );
};
