import React from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { ColorPickerPopover } from '../../inputs/ColorPickerPopover';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { StyleCard } from './StyleCard';

interface StyleEffectsSectionProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: unknown) => void;
  embedded?: boolean;
}

export const StyleEffectsSection: React.FC<StyleEffectsSectionProps> = ({ selectedPart, onPartPropChange, embedded = false }) => {
  const controls = (
    <>
      <div className="effects-color-field">
        <div className="form-field-group effects-color-row">
          <div className="effects-color-controls">
            <ColorPickerPopover
              label="SHADOW / GLOW COLOR"
              color={selectedPart.shadowColor || '#000000'}
              alpha={1}
              fallback="#000000"
              onColorChange={(value) => onPartPropChange('shadowColor', value)}
              onAlphaChange={() => undefined}
            />
            <button type="button" className="btn-secondary effects-clear-button" onClick={() => onPartPropChange('shadowColor', undefined)}>Clear Shadow</button>
          </div>
        </div>
      </div>
      {selectedPart.shadowColor && (
        <div className="effects-property-grid">
          <div className="effects-property-field"><span className="param-label">BLUR RADIUS</span><SmartNumberInput value={selectedPart.shadowBlur ?? 8} min={0} max={50} onChange={(value) => onPartPropChange('shadowBlur', value)} /></div>
          <div className="effects-property-field"><span className="param-label">OFFSET X</span><SmartNumberInput value={selectedPart.shadowOffsetX ?? 0} min={-50} max={50} onChange={(value) => onPartPropChange('shadowOffsetX', value)} /></div>
          <div className="effects-property-field"><span className="param-label">OFFSET Y</span><SmartNumberInput value={selectedPart.shadowOffsetY ?? 4} min={-50} max={50} onChange={(value) => onPartPropChange('shadowOffsetY', value)} /></div>
        </div>
      )}
    </>
  );
  return embedded ? controls : <StyleCard title="EFFECTS" collapsible defaultOpen={false}>{controls}</StyleCard>;
};
