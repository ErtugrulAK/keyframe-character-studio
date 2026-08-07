import React from 'react';
import type { CharacterPart, Transform } from '../../../types/animator';
import { StyleColorSection } from './style/StyleColorSection';
import { StyleTextFields } from './style/StyleTextFields';
import { StyleGeometrySection } from './style/StyleGeometrySection';
import { StyleClonerSection } from './style/StyleClonerSection';
import { StyleParticleSection } from './style/StyleParticleSection';
import { StyleMediaSection } from './style/StyleMediaSection';
import { StyleEffectsSection } from './style/StyleEffectsSection';

interface StyleTabProps {
  selectedPart: CharacterPart;
  transform: Transform;
  handlePartPropChange: (key: keyof CharacterPart, value: any) => void;
  handlePartColorChange: (key: 'fillColor' | 'strokeColor', color: string) => void;
  handleZIndexChange?: (zIndex: number) => void;
}

/**
 * Style inspector tab. Thin composition of focused section components; every
 * section renders itself as a titled rectangle card (same visual language as
 * the LAYER ORDER card) and skips itself when it does not apply to the
 * selected part type — so no empty blocks appear.
 */
export const StyleTab: React.FC<StyleTabProps> = ({
  selectedPart,
  transform,
  handlePartPropChange,
  handlePartColorChange,
}) => {
  return (
    <div className="inspector-section" style={{ paddingTop: 8 }}>
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
        transform={transform}
        onPartPropChange={handlePartPropChange}
      />

      <StyleEffectsSection
        selectedPart={selectedPart}
        onPartPropChange={handlePartPropChange}
      />
    </div>
  );
};
