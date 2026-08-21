import React from 'react';
import { Crop } from 'lucide-react';
import type { CharacterPart } from '../../../../types/animator';
import { StyleCard } from './StyleCard';

interface StyleGeometrySectionProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: any) => void;
}

export const StyleGeometrySection: React.FC<StyleGeometrySectionProps> = ({ selectedPart, onPartPropChange }) => {
  const hasCornerRadiusControl =
    selectedPart.type === 'custom_rect' ||
    selectedPart.type === 'custom_box' ||
    selectedPart.type === 'custom_card' ||
    selectedPart.type === 'custom_banner';
  if (!hasCornerRadiusControl) return null;

  return (
    <StyleCard title="GEOMETRY" icon={<Crop size={13} />} color="#14b8a6">
      {/* CORNER RADIUS CONTROL */}
      {(selectedPart.type === 'custom_rect' ||
        selectedPart.type === 'custom_box' ||
        selectedPart.type === 'custom_card' ||
        selectedPart.type === 'custom_banner') && (
        <div className="form-field-group">
          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>CORNER RADIUS</span>
            <span style={{ color: 'var(--accent-teal)', fontWeight: 800 }}>{selectedPart.borderRadius ?? 0}px</span>
          </label>
          <input
            type="range"
            min={0}
            max={40}
            value={selectedPart.borderRadius ?? 0}
            onChange={(e) => onPartPropChange('borderRadius', parseInt(e.target.value, 10))}
            style={{ width: '100%', cursor: 'pointer' }}
          />
        </div>
      )}

    </StyleCard>
  );
};
