import React, { useState } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import { TransformTab } from './sections/TransformTab';
import { StyleTab } from './sections/StyleTab';
import { KeyframesTab } from './sections/KeyframesTab';
import { MaskTab } from './sections/MaskTab';
import { DuplicateTab } from './sections/DuplicateTab';
import {
  Sliders,
  Copy,
  Trash2,
  Activity,
  Palette,
  Diamond,
  Scissors,
  CopyPlus,
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

  const [activeTabSection, setActiveTabSection] = useState<'transform' | 'style' | 'keyframes' | 'mask' | 'duplicate'>('transform');

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
        <div className="details-actor-header">
          <div className="actor-title-box">
            <span className="actor-main-name">{selectedPart.name}</span>
          </div>

          <div className="actor-quick-actions">
            <button
              className="btn-icon-small"
              onClick={duplicateSelectedPart}
              title="Duplicate Actor Instance"
            >
              <Copy size={12} />
            </button>
            <button
              className="btn-icon-small danger"
              onClick={() => deletePart(selectedPart.id)}
              title="Delete Actor Instance"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ) : (
        <div className="details-empty-state">
          <span>Select an element on Canvas or Outliner to view details</span>
        </div>
      )}

      {/* 3. Section Navigation Tabs */}
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
            className={`tab-btn ${activeTabSection === 'keyframes' ? 'active' : ''}`}
            onClick={() => setActiveTabSection('keyframes')}
          >
            <Diamond size={12} className="text-teal" />
            <span>Keyframes</span>
          </button>
          <button
            className={`tab-btn ${activeTabSection === 'mask' ? 'active' : ''}`}
            onClick={() => setActiveTabSection('mask')}
          >
            <Scissors size={12} className="text-cyan" />
            <span>Mask</span>
          </button>
          <button
            className={`tab-btn ${activeTabSection === 'duplicate' ? 'active' : ''}`}
            onClick={() => setActiveTabSection('duplicate')}
          >
            <CopyPlus size={12} className="text-teal" />
            <span>Duplicate</span>
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
              handleZIndexChange={handleZIndexChange}
              containerTransform={selectedPart.parentId ? getComputedTransform(selectedPart.parentId, currentFrame) : null}
            />
          )}

          {activeTabSection === 'style' && (
            <StyleTab
              selectedPart={selectedPart}
              transform={transform}
              handlePartPropChange={handlePartPropChange}
              handlePartColorChange={handlePartColorChange}
              handleZIndexChange={handleZIndexChange}
            />
          )}

          {activeTabSection === 'keyframes' && (
            <KeyframesTab
              selectedPart={selectedPart}
            />
          )}

          {activeTabSection === 'mask' && (
            <MaskTab
              selectedPart={selectedPart}
              transform={transform}
              updateCurrentTransform={updateCurrentTransform}
              handlePartPropChange={handlePartPropChange}
            />
          )}

          {activeTabSection === 'duplicate' && (
            <DuplicateTab />
          )}
        </div>
      )}
    </div>
  );
};
