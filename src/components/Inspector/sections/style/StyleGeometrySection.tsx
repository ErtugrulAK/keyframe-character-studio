import React from 'react';
import { Crop } from 'lucide-react';
import type { CharacterPart } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { StyleCard } from './StyleCard';

interface StyleGeometrySectionProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: any) => void;
}

export const StyleGeometrySection: React.FC<StyleGeometrySectionProps> = ({ selectedPart, onPartPropChange }) => {
  const applies =
    selectedPart.type === 'custom_rect' ||
    selectedPart.type === 'custom_box' ||
    selectedPart.type === 'custom_card' ||
    selectedPart.type === 'custom_banner' ||
    selectedPart.type === 'custom_triangle' ||
    selectedPart.type === 'custom_circle' ||
    selectedPart.type === 'custom_star' ||
    selectedPart.type === 'custom_diamond' ||
    selectedPart.type === 'custom_parallelogram' ||
    selectedPart.type === 'custom_freeform';
  if (!applies) return null;

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

      {/* TRIM PATH / STROKE PROGRESS ANIMATION */}
      <div className="form-field-group">
        <label className="form-label">TRIM PATH / STROKE DRAW (0-100%)</label>
        <SmartNumberInput
          value={Math.round((selectedPart.strokeProgress ?? 1) * 100)}
          min={0}
          max={100}
          step={5}
          onChange={(val) => onPartPropChange('strokeProgress', val / 100)}
        />
      </div>
    </StyleCard>
  );
};
