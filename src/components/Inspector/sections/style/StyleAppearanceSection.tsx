import React from 'react';
import type { CharacterPart } from '../../../../types/animator';
import {
  toAuthoringStrokeAlignment,
  toStrokeAlignmentControlValue,
} from '../../../../utils/shapeAppearance';
import type { StrokeAlignmentControlValue } from '../../../../utils/shapeAppearance';
import { ColorPickerPopover } from '../../inputs/ColorPickerPopover';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { StyleCard } from './StyleCard';

interface StyleAppearanceSectionProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: unknown) => void;
}

const ColorControl: React.FC<{
  label: string;
  value: string;
  alpha: number;
  fallback: string;
  onColorChange: (value: string) => void;
  onAlphaChange: (value: number) => void;
}> = ({ label, value, alpha, fallback, onColorChange, onAlphaChange }) => (
  <div className="appearance-color-field">
    <ColorPickerPopover
      label={label}
      color={value || fallback}
      alpha={alpha}
      fallback={fallback}
      onColorChange={onColorChange}
      onAlphaChange={onAlphaChange}
    />
  </div>
);

export const StyleAppearanceSection: React.FC<StyleAppearanceSectionProps> = ({ selectedPart, onPartPropChange }) => {
  const strokeAlignment = toStrokeAlignmentControlValue(selectedPart.strokeAlignment);

  return (
    <StyleCard title="APPEARANCE" collapsible defaultOpen={false}>
      <div className="appearance-group">
        <div className="appearance-group-header">
          <label htmlFor="appearance-fill-enabled">FILL</label>
          <input id="appearance-fill-enabled" type="checkbox" aria-label="Fill Enabled" checked={selectedPart.fillEnabled ?? true} onChange={(e) => onPartPropChange('fillEnabled', e.target.checked)} />
        </div>
        <ColorControl
          label="FILL COLOR"
          value={selectedPart.fillColor}
          alpha={selectedPart.fillOpacity ?? 1}
          fallback="#00d2ff"
          onColorChange={(value) => onPartPropChange('fillColor', value)}
          onAlphaChange={(value) => onPartPropChange('fillOpacity', value)}
        />
      </div>

      <div className="appearance-group appearance-group-stroke">
        <div className="appearance-group-header">
          <label htmlFor="appearance-stroke-enabled">STROKE</label>
          <input id="appearance-stroke-enabled" type="checkbox" aria-label="Stroke Enabled" checked={selectedPart.strokeEnabled ?? true} onChange={(e) => onPartPropChange('strokeEnabled', e.target.checked)} />
        </div>
        <ColorControl
          label="STROKE COLOR"
          value={selectedPart.strokeColor}
          alpha={selectedPart.strokeOpacity ?? 1}
          fallback="#101218"
          onColorChange={(value) => onPartPropChange('strokeColor', value)}
          onAlphaChange={(value) => onPartPropChange('strokeOpacity', value)}
        />
        <div className="stroke-inline-fields">
          <div className="appearance-field">
            <label className="appearance-field-label" htmlFor="stroke-width-input">WIDTH</label>
            <SmartNumberInput ariaLabel="Stroke Width" value={selectedPart.strokeWidth ?? 1.5} min={0} max={100} step={0.5} precision={2} onChange={(value) => onPartPropChange('strokeWidth', value)} />
          </div>
          <div className="appearance-field">
            <label className="appearance-field-label" htmlFor="stroke-alignment-select">ALIGN</label>
            <select id="stroke-alignment-select" aria-label="Stroke Alignment" value={strokeAlignment} onChange={(event) => onPartPropChange('strokeAlignment', toAuthoringStrokeAlignment(event.target.value as StrokeAlignmentControlValue))} style={{ width: '100%' }}>
              <option value="inside">INSIDE</option>
              <option value="outside">OUTSIDE</option>
            </select>
          </div>
        </div>
      </div>
    </StyleCard>
  );
};
