import React from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { SmartHexInput } from '../../inputs/SmartHexInput';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { StyleCard } from './StyleCard';

interface StyleEffectsSectionProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: any) => void;
}

export const StyleEffectsSection: React.FC<StyleEffectsSectionProps> = ({ selectedPart, onPartPropChange }) => {
  return (
    <StyleCard title="EFFECTS" collapsible defaultOpen={false}>
      <div className="effects-color-field">
        <div className="form-field-group effects-color-row">
          <label className="form-label">SHADOW / GLOW COLOR</label>
          <div className="color-picker-compact effects-color-controls">
            <input
              type="color"
              className="color-swatch-input"
              value={selectedPart.shadowColor || '#000000'}
              onChange={(e) => onPartPropChange('shadowColor', e.target.value)}
            />
            <SmartHexInput
              value={selectedPart.shadowColor || ''}
              fallback="#000000"
              placeholder="NONE"
              onChange={(val) => onPartPropChange('shadowColor', val)}
            />
            <button
              type="button"
              className="btn-secondary effects-clear-button"
              onClick={() => onPartPropChange('shadowColor', undefined)}
            >
              Clear Shadow
            </button>
          </div>
        </div>
      </div>

      {selectedPart.shadowColor && (
        <div className="effects-property-grid">
          <div className="effects-property-field">
            <span className="param-label">BLUR RADIUS</span>
            <SmartNumberInput
              value={selectedPart.shadowBlur ?? 8}
              min={0}
              max={50}
              onChange={(val) => onPartPropChange('shadowBlur', val)}
            />
          </div>
          <div className="effects-property-field">
            <span className="param-label">OFFSET X</span>
            <SmartNumberInput
              value={selectedPart.shadowOffsetX ?? 0}
              min={-50}
              max={50}
              onChange={(val) => onPartPropChange('shadowOffsetX', val)}
            />
          </div>
          <div className="effects-property-field">
            <span className="param-label">OFFSET Y</span>
            <SmartNumberInput
              value={selectedPart.shadowOffsetY ?? 4}
              min={-50}
              max={50}
              onChange={(val) => onPartPropChange('shadowOffsetY', val)}
            />
          </div>
        </div>
      )}
    </StyleCard>
  );
};
