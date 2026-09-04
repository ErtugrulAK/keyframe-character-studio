import React from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { ColorPickerPopover } from '../../inputs/ColorPickerPopover';
import { StyleCard } from './StyleCard';
import { isShapeAppearanceEligible } from '../../../../utils/shapeAppearance';

interface StyleColorSectionProps {
  selectedPart: CharacterPart;
  onPartColorChange: (key: 'fillColor' | 'strokeColor', color: string) => void;
  onPartPropChange: (key: 'fillOpacity' | 'strokeOpacity', value: number) => void;
}

/**
 * Legacy color-bearing parts use the same inline RGBA editor as modern
 * Appearance. The mapping keeps Text/Banner authored callbacks unchanged.
 */
export const StyleColorSection: React.FC<StyleColorSectionProps> = ({ selectedPart, onPartColorChange, onPartPropChange }) => {
  if (isShapeAppearanceEligible(selectedPart.type)) return null;

  return (
    <StyleCard title="APPEARANCE" collapsible defaultOpen={false}>
      <div className="appearance-group">
        <div className="appearance-group-header">
          <span>FILL</span>
        </div>
        <div className="appearance-color-field">
          <ColorPickerPopover
            label="FILL COLOR"
            color={selectedPart.fillColor || '#00d2ff'}
            alpha={selectedPart.fillOpacity ?? 1}
            fallback="#00d2ff"
            onColorChange={(color) => onPartColorChange('fillColor', color)}
            onAlphaChange={(alpha) => onPartPropChange('fillOpacity', alpha)}
          />
        </div>
      </div>

      <div className="appearance-group appearance-group-stroke">
        <div className="appearance-group-header">
          <span>STROKE</span>
        </div>
        <div className="appearance-color-field">
          <ColorPickerPopover
            label="STROKE COLOR"
            color={selectedPart.strokeColor || '#1e293b'}
            alpha={selectedPart.strokeOpacity ?? 1}
            fallback="#1e293b"
            onColorChange={(color) => onPartColorChange('strokeColor', color)}
            onAlphaChange={(alpha) => onPartPropChange('strokeOpacity', alpha)}
          />
        </div>
      </div>
    </StyleCard>
  );
};
