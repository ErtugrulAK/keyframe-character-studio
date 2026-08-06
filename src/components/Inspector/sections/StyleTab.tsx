import React from 'react';
import { Palette } from 'lucide-react';
import type { CharacterPart } from '../../../types/animator';
import { StyleColorSection } from './style/StyleColorSection';
import { StyleTextFields } from './style/StyleTextFields';
import { StyleGeometrySection } from './style/StyleGeometrySection';
import { StyleClonerSection } from './style/StyleClonerSection';
import { StyleParticleSection } from './style/StyleParticleSection';
import { StyleMediaSection } from './style/StyleMediaSection';
import { StyleEffectsSection } from './style/StyleEffectsSection';

interface StyleTabProps {
  selectedPart: CharacterPart;
  handlePartPropChange: (key: keyof CharacterPart, value: any) => void;
  handlePartColorChange: (key: 'fillColor' | 'strokeColor', color: string) => void;
  handleZIndexChange?: (zIndex: number) => void;
}

/**
 * Style inspector tab. Thin composition of focused section components:
 * colors, text fields, geometry, cloner, particles, media and effects.
 */
export const StyleTab: React.FC<StyleTabProps> = ({
  selectedPart,
  handlePartPropChange,
  handlePartColorChange,
}) => {
  return (
    <div className="inspector-section">
      <div className="section-title">
        <Palette size={13} className="text-cyan" />
        <span>SURFACE & MATERIAL DESIGN</span>
      </div>

      <div className="style-controls-list">
        <StyleColorSection
          selectedPart={selectedPart}
          onPartColorChange={handlePartColorChange}
        />

        <StyleTextFields
          selectedPart={selectedPart}
          onPartPropChange={handlePartPropChange}
        />

        <StyleGeometrySection
          selectedPart={selectedPart}
          onPartPropChange={handlePartPropChange}
        />

        <StyleClonerSection
          selectedPart={selectedPart}
          onPartPropChange={handlePartPropChange}
        />

        <StyleParticleSection
          selectedPart={selectedPart}
          onPartPropChange={handlePartPropChange}
        />

        <StyleMediaSection
          selectedPart={selectedPart}
          onPartPropChange={handlePartPropChange}
        />

        <StyleEffectsSection
          selectedPart={selectedPart}
          onPartPropChange={handlePartPropChange}
        />
      </div>
    </div>
  );
};
