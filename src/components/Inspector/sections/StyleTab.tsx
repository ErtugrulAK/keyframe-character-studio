import React from 'react';
import type { CharacterPart } from '../../../types/animator';
import { StyleColorSection } from './style/StyleColorSection';
import { StyleTextFields } from './style/StyleTextFields';
import { StyleGeometrySection } from './style/StyleGeometrySection';
import { StyleClonerSection } from './style/StyleClonerSection';
import { StyleParticleSection } from './style/StyleParticleSection';
import { StyleEffectsSection } from './style/StyleEffectsSection';
import { StyleMatteSection } from './style/StyleMatteSection';

interface StyleTabProps {
  selectedPart: CharacterPart;
  characterParts: CharacterPart[];
  handlePartPropChange: (key: keyof CharacterPart, value: any) => void;
  handlePartColorChange: (key: 'fillColor' | 'strokeColor', color: string) => void;
  handleZIndexChange?: (zIndex: number) => void;
}

export const StyleTab: React.FC<StyleTabProps> = ({
  selectedPart,
  characterParts,
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

      <StyleEffectsSection
        selectedPart={selectedPart}
        onPartPropChange={handlePartPropChange}
      />

      <StyleMatteSection
        selectedPart={selectedPart}
        characterParts={characterParts}
        onPartPropChange={handlePartPropChange}
      />
    </div>
  );
};
