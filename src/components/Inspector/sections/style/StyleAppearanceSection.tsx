import React from 'react';
import { Palette } from 'lucide-react';
import type { CharacterPart } from '../../../../types/animator';
import { SmartHexInput } from '../../inputs/SmartHexInput';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { StyleCard } from './StyleCard';

interface StyleAppearanceSectionProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: any) => void;
}

const ColorControl: React.FC<{
  label: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}> = ({ label, value, fallback, onChange }) => (
  <div className="appearance-color-field">
    <label className="color-card-label">{label}</label>
    <div className="color-picker-compact">
      <input type="color" className="color-swatch-input" value={value || fallback} onChange={(e) => onChange(e.target.value)} />
      <SmartHexInput value={value || ''} fallback={fallback} onChange={onChange} />
    </div>
  </div>
);

export const StyleAppearanceSection: React.FC<StyleAppearanceSectionProps> = ({ selectedPart, onPartPropChange }) => (
  <StyleCard title="APPEARANCE" icon={<Palette size={13} />}>
    <div className="appearance-group">
      <label className="appearance-group-header">
        <span>FILL</span>
        <input
          type="checkbox"
          aria-label="Fill Enabled"
          checked={selectedPart.fillEnabled ?? true}
          onChange={(e) => onPartPropChange('fillEnabled', e.target.checked)}
        />
      </label>
      <ColorControl label="COLOR" value={selectedPart.fillColor} fallback="#00d2ff" onChange={(value) => onPartPropChange('fillColor', value)} />
      <div className="appearance-field">
        <label className="appearance-field-label" htmlFor="fill-opacity-input">OPACITY</label>
        <SmartNumberInput ariaLabel="Fill Opacity" value={selectedPart.fillOpacity ?? 1} min={0} max={1} step={0.01} displayScale={100} precision={0} onChange={(value) => onPartPropChange('fillOpacity', value)} />
      </div>
    </div>

    <div className="appearance-group appearance-group-stroke">
      <label className="appearance-group-header">
        <span>STROKE</span>
        <input
          type="checkbox"
          aria-label="Stroke Enabled"
          checked={selectedPart.strokeEnabled ?? true}
          onChange={(e) => onPartPropChange('strokeEnabled', e.target.checked)}
        />
      </label>
      <ColorControl label="COLOR" value={selectedPart.strokeColor} fallback="#101218" onChange={(value) => onPartPropChange('strokeColor', value)} />
      <div className="appearance-inline-fields">
        <div className="appearance-field">
          <label className="appearance-field-label" htmlFor="stroke-width-input">WIDTH</label>
          <SmartNumberInput ariaLabel="Stroke Width" value={selectedPart.strokeWidth ?? 1.5} min={0} max={100} step={0.5} precision={2} onChange={(value) => onPartPropChange('strokeWidth', value)} />
        </div>
        <div className="appearance-field">
          <label className="appearance-field-label" htmlFor="stroke-opacity-input">OPACITY</label>
          <SmartNumberInput ariaLabel="Stroke Opacity" value={selectedPart.strokeOpacity ?? 1} min={0} max={1} step={0.01} displayScale={100} precision={0} onChange={(value) => onPartPropChange('strokeOpacity', value)} />
        </div>
      </div>
      <div className="appearance-field" style={{ marginTop: 8 }}>
        <label className="appearance-field-label" htmlFor="stroke-alignment-select">ALIGN</label>
        <select
          id="stroke-alignment-select"
          aria-label="Stroke Alignment"
          value={selectedPart.strokeAlignment ?? 'center'}
          onChange={(event) => onPartPropChange('strokeAlignment', event.target.value as 'center' | 'outside')}
          style={{ width: '100%' }}
        >
          <option value="center">CENTER</option>
          <option value="outside">OUTSIDE</option>
        </select>
      </div>
    </div>
  </StyleCard>
);
