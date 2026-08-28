import React from 'react';
import type { CharacterPart } from '../../../types/animator';
import { StyleColorSection } from './style/StyleColorSection';
import { StyleAppearanceSection } from './style/StyleAppearanceSection';
import { isShapeAppearanceEligible } from '../../../utils/shapeAppearance';
import { StyleTextFields } from './style/StyleTextFields';
import { StyleGeometrySection } from './style/StyleGeometrySection';
import { StyleClonerSection } from './style/StyleClonerSection';
import { StyleParticleSection } from './style/StyleParticleSection';
import { StyleEffectsSection } from './style/StyleEffectsSection';
import { StyleMatteSection } from './style/StyleMatteSection';
import { TrimPathSection } from './style/TrimPathSection';
import { isTrimPathEligible } from '../../../utils/trimPath';

interface StyleTabProps {
  selectedPart: CharacterPart;
  characterParts: CharacterPart[];
  handlePartPropChange: (key: keyof CharacterPart, value: unknown) => void;
  handlePartColorChange: (key: 'fillColor' | 'strokeColor', color: string) => void;
  handleZIndexChange?: (zIndex: number) => void;
}

export const StyleTab: React.FC<StyleTabProps> = ({
  selectedPart,
  characterParts,
  handlePartPropChange,
  handlePartColorChange,
}) => (
  <div className="inspector-section" style={{ paddingTop: 8 }}>
    <StyleGeometrySection selectedPart={selectedPart} onPartPropChange={handlePartPropChange} />
    {isTrimPathEligible(selectedPart.type) && <TrimPathSection selectedPart={selectedPart} onPartPropChange={handlePartPropChange} />}
    {isShapeAppearanceEligible(selectedPart.type) && <StyleAppearanceSection selectedPart={selectedPart} onPartPropChange={handlePartPropChange} />}
    <StyleColorSection selectedPart={selectedPart} onPartColorChange={handlePartColorChange} onPartPropChange={handlePartPropChange} />
    <StyleTextFields selectedPart={selectedPart} onPartPropChange={handlePartPropChange} />
    <StyleEffectsSection selectedPart={selectedPart} onPartPropChange={handlePartPropChange} />
    <StyleMatteSection selectedPart={selectedPart} characterParts={characterParts} onPartPropChange={handlePartPropChange} />
    <StyleClonerSection selectedPart={selectedPart} onPartPropChange={handlePartPropChange} />
    <StyleParticleSection selectedPart={selectedPart} onPartPropChange={handlePartPropChange} />
  </div>
);
