import React, { useState } from 'react';
import { Palette } from 'lucide-react';
import type { CharacterPart } from '../../../../types/animator';
import { ColorPickerPopover } from '../../inputs/ColorPickerPopover';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { StyleCard } from './StyleCard';

interface StyleAppearanceSectionProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: any) => void;
}

const ColorControl: React.FC<{
  label: string;
  value: string;
  alpha: number;
  fallback: string;
  pickerId: string;
  activePickerId: string | null;
  onActivePickerChange: (pickerId: string | null) => void;
  onColorChange: (value: string) => void;
  onAlphaChange: (value: number) => void;
}> = ({ label, value, alpha, fallback, pickerId, activePickerId, onActivePickerChange, onColorChange, onAlphaChange }) => (
  <div className="appearance-color-field">
    <label className="color-card-label">{label}</label>
    <ColorPickerPopover
      label={label}
      color={value || fallback}
      alpha={alpha}
      fallback={fallback}
      pickerId={pickerId}
      activePickerId={activePickerId}
      onActivePickerChange={onActivePickerChange}
      onColorChange={onColorChange}
      onAlphaChange={onAlphaChange}
    />
  </div>
);

export const StyleAppearanceSection: React.FC<StyleAppearanceSectionProps> = ({ selectedPart, onPartPropChange }) => {
  const [activePickerId, setActivePickerId] = useState<string | null>(null);

  return (
    <StyleCard title="APPEARANCE" icon={<Palette size={13} />}>
      <div className="appearance-group">
        <label className="appearance-group-header">
          <span>FILL</span>
          <input type="checkbox" aria-label="Fill Enabled" checked={selectedPart.fillEnabled ?? true} onChange={(e) => onPartPropChange('fillEnabled', e.target.checked)} />
        </label>
        <ColorControl
          label="FILL COLOR"
          value={selectedPart.fillColor}
          alpha={selectedPart.fillOpacity ?? 1}
          fallback="#00d2ff"
          pickerId="fill"
          activePickerId={activePickerId}
          onActivePickerChange={setActivePickerId}
          onColorChange={(value) => onPartPropChange('fillColor', value)}
          onAlphaChange={(value) => onPartPropChange('fillOpacity', value)}
        />
      </div>

      <div className="appearance-group appearance-group-stroke">
        <label className="appearance-group-header">
          <span>STROKE</span>
          <input type="checkbox" aria-label="Stroke Enabled" checked={selectedPart.strokeEnabled ?? true} onChange={(e) => onPartPropChange('strokeEnabled', e.target.checked)} />
        </label>
        <ColorControl
          label="STROKE COLOR"
          value={selectedPart.strokeColor}
          alpha={selectedPart.strokeOpacity ?? 1}
          fallback="#101218"
          pickerId="stroke"
          activePickerId={activePickerId}
          onActivePickerChange={setActivePickerId}
          onColorChange={(value) => onPartPropChange('strokeColor', value)}
          onAlphaChange={(value) => onPartPropChange('strokeOpacity', value)}
        />
        <div className="appearance-inline-fields">
          <div className="appearance-field">
            <label className="appearance-field-label" htmlFor="stroke-width-input">WIDTH</label>
            <SmartNumberInput ariaLabel="Stroke Width" value={selectedPart.strokeWidth ?? 1.5} min={0} max={100} step={0.5} precision={2} onChange={(value) => onPartPropChange('strokeWidth', value)} />
          </div>
        </div>
        <div className="appearance-field" style={{ marginTop: 8 }}>
          <label className="appearance-field-label" htmlFor="stroke-alignment-select">ALIGN</label>
          <select id="stroke-alignment-select" aria-label="Stroke Alignment" value={selectedPart.strokeAlignment ?? 'center'} onChange={(event) => onPartPropChange('strokeAlignment', event.target.value as 'center' | 'inside' | 'outside')} style={{ width: '100%' }}>
            <option value="center">CENTER</option>
            <option value="inside">INSIDE</option>
            <option value="outside">OUTSIDE</option>
          </select>
        </div>
      </div>
    </StyleCard>
  );
};
