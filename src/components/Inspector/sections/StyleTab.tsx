import React from 'react';
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

const sectionLabel: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: '#64748b',
  letterSpacing: '0.6px',
  marginBottom: 4,
  marginTop: 12,
};

/**
 * Style inspector tab. Thin composition of focused section components, grouped
 * under muted section labels (same visual language as the Transform tab).
 */
export const StyleTab: React.FC<StyleTabProps> = ({
  selectedPart,
  handlePartPropChange,
  handlePartColorChange,
}) => {
  return (
    <div className="inspector-section" style={{ paddingTop: 8 }}>
      <div style={{ ...sectionLabel, marginTop: 0 }}>COLOR</div>
      <StyleColorSection
        selectedPart={selectedPart}
        onPartColorChange={handlePartColorChange}
      />

      <div style={sectionLabel}>TEXT</div>
      <StyleTextFields
        selectedPart={selectedPart}
        onPartPropChange={handlePartPropChange}
      />

      <div style={sectionLabel}>GEOMETRY</div>
      <StyleGeometrySection
        selectedPart={selectedPart}
        onPartPropChange={handlePartPropChange}
      />

      <div style={sectionLabel}>CLONER</div>
      <StyleClonerSection
        selectedPart={selectedPart}
        onPartPropChange={handlePartPropChange}
      />

      <div style={sectionLabel}>PARTICLES</div>
      <StyleParticleSection
        selectedPart={selectedPart}
        onPartPropChange={handlePartPropChange}
      />

      <div style={sectionLabel}>MEDIA & MASKING</div>
      <StyleMediaSection
        selectedPart={selectedPart}
        onPartPropChange={handlePartPropChange}
      />

      <div style={sectionLabel}>EFFECTS</div>
      <StyleEffectsSection
        selectedPart={selectedPart}
        onPartPropChange={handlePartPropChange}
      />
    </div>
  );
};
