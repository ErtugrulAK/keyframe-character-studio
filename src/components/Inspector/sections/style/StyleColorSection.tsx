import React, { useState } from 'react';
import { Palette } from 'lucide-react';
import type { CharacterPart } from '../../../../types/animator';
import { ColorPickerPopover } from '../../inputs/ColorPickerPopover';
import { StyleCard } from './StyleCard';
import { isShapeAppearanceEligible } from '../../../../utils/shapeAppearance';
const COLOR_SWATCHES = [
  '#00d2ff', '#38bdf8', '#6366f1', '#a855f7', '#ec4899', '#f43f5e',
  '#ffb700', '#f59e0b', '#10b981', '#14b8a6', '#0f172a', '#ffffff',
];

interface StyleColorSectionProps {
  selectedPart: CharacterPart;
  onPartColorChange: (key: 'fillColor' | 'strokeColor', color: string) => void;
  onPartPropChange: (key: 'fillOpacity' | 'strokeOpacity', value: number) => void;
}

export const StyleColorSection: React.FC<StyleColorSectionProps> = ({ selectedPart, onPartColorChange, onPartPropChange }) => {
  const [activePickerId, setActivePickerId] = useState<string | null>(null);
  if (isShapeAppearanceEligible(selectedPart.type)) return null;
  return (
    <StyleCard title="COLOR" icon={<Palette size={13} />}>
      {/* FILL & STROKE COLOR GRID */}
      <div className="color-grid-two-col">
        <div className="color-picker-card">
          <label className="color-card-label">FILL COLOR</label>
          <ColorPickerPopover
            label="FILL COLOR"
            color={selectedPart.fillColor || '#00d2ff'}
            alpha={selectedPart.fillOpacity ?? 1}
            fallback="#00d2ff"
            pickerId="fill"
            activePickerId={activePickerId}
            onActivePickerChange={setActivePickerId}
            onColorChange={(color) => onPartColorChange('fillColor', color)}
            onAlphaChange={(alpha) => onPartPropChange('fillOpacity', alpha)}
          />
        </div>

        <div className="color-picker-card">
          <label className="color-card-label">STROKE COLOR</label>
          <ColorPickerPopover
            label="STROKE COLOR"
            color={selectedPart.strokeColor || '#1e293b'}
            alpha={selectedPart.strokeOpacity ?? 1}
            fallback="#1e293b"
            pickerId="stroke"
            activePickerId={activePickerId}
            onActivePickerChange={setActivePickerId}
            onColorChange={(color) => onPartColorChange('strokeColor', color)}
            onAlphaChange={(alpha) => onPartPropChange('strokeOpacity', alpha)}
          />
        </div>
      </div>

      {/* PALETTE SWATCHES */}
      <div className="form-field-group">
        <label className="form-label">QUICK PALETTE SWATCHES</label>
        <div className="swatches-grid">
          {COLOR_SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              className="color-swatch-btn"
              style={{ backgroundColor: color }}
              onClick={() => onPartColorChange('fillColor', color)}
              title={`Set Fill to ${color}`}
            />
          ))}
        </div>
      </div>
    </StyleCard>
  );
};
