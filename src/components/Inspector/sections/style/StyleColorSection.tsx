import React from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { SmartHexInput } from '../../inputs/SmartHexInput';

const COLOR_SWATCHES = [
  '#00d2ff', '#38bdf8', '#6366f1', '#a855f7', '#ec4899', '#f43f5e',
  '#ffb700', '#f59e0b', '#10b981', '#14b8a6', '#0f172a', '#ffffff',
];

interface StyleColorSectionProps {
  selectedPart: CharacterPart;
  onPartColorChange: (key: 'fillColor' | 'strokeColor', color: string) => void;
}

export const StyleColorSection: React.FC<StyleColorSectionProps> = ({ selectedPart, onPartColorChange }) => {
  return (
    <>
      {/* FILL & STROKE COLOR GRID */}
      <div className="color-grid-two-col">
        <div className="color-picker-card">
          <label className="color-card-label">FILL COLOR</label>
          <div className="color-picker-compact">
            <input
              type="color"
              className="color-swatch-input"
              value={selectedPart.fillColor || '#00d2ff'}
              onChange={(e) => onPartColorChange('fillColor', e.target.value)}
            />
            <SmartHexInput
              value={selectedPart.fillColor || ''}
              fallback="#00d2ff"
              onChange={(val) => onPartColorChange('fillColor', val)}
            />
          </div>
        </div>

        <div className="color-picker-card">
          <label className="color-card-label">STROKE COLOR</label>
          <div className="color-picker-compact">
            <input
              type="color"
              className="color-swatch-input"
              value={selectedPart.strokeColor || '#1e293b'}
              onChange={(e) => onPartColorChange('strokeColor', e.target.value)}
            />
            <SmartHexInput
              value={selectedPart.strokeColor || ''}
              fallback="#1e293b"
              onChange={(val) => onPartColorChange('strokeColor', val)}
            />
          </div>
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
    </>
  );
};
