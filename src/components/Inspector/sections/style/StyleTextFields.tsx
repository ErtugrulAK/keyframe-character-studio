import React from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { ColorPickerPopover } from '../../inputs/ColorPickerPopover';
import { StyleCard } from './StyleCard';
import { StyleEffectsSection } from './StyleEffectsSection';

interface StyleTextFieldsProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: unknown) => void;
  onPartColorChange: (key: 'fillColor' | 'strokeColor', color: string) => void;
}

export const StyleTextFields: React.FC<StyleTextFieldsProps> = ({ selectedPart, onPartPropChange, onPartColorChange }) => {
  const applies =
    selectedPart.type === 'custom_card' ||
    selectedPart.type === 'custom_text' ||
    selectedPart.type === 'custom_banner';
  if (!applies) return null;

  return (
    <StyleCard title="TEXT" collapsible defaultOpen={false}>
      {/* UI CARD CUSTOMIZATION FIELDS */}
      {selectedPart.type === 'custom_card' && (
        <>
          <div className="form-field-group">
            <label className="form-label">CARD HEADER / CATEGORY</label>
            <input className="input-control"
              type="text"
              value={selectedPart.cardCategory || selectedPart.textValue || ''}
              placeholder="e.g. STUDIO CARD"
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                onPartPropChange('cardCategory', e.target.value);
                onPartPropChange('textValue', e.target.value);
              }}
            />
          </div>

          <div className="form-field-group">
            <label className="form-label">MAIN TITLE TEXT</label>
            <input className="input-control"
              type="text"
              value={selectedPart.cardTitle || ''}
              placeholder="e.g. MOTION GRAPHIC"
              onFocus={(e) => e.target.select()}
              onChange={(e) => onPartPropChange('cardTitle', e.target.value)}
            />
          </div>

          <div className="form-field-group">
            <label className="form-label">ACTION BUTTON TEXT</label>
            <input className="input-control"
              type="text"
              value={selectedPart.cardButtonText || ''}
              placeholder="e.g. ACTIVE"
              onFocus={(e) => e.target.select()}
              onChange={(e) => onPartPropChange('cardButtonText', e.target.value)}
            />
          </div>
        </>
      )}

      {/* Standard Text Input Control if object is Text or Banner */}
      {(selectedPart.type === 'custom_text' || selectedPart.type === 'custom_banner') && (
        <div className="form-field-group text-content-field">
          <label className="form-label">TEXT CONTENT</label>
          <input className="input-control text-content-control"
            type="text"
            value={selectedPart.textValue || ''}
            placeholder="Enter text..."
            onFocus={(e) => e.target.select()}
            onChange={(e) => onPartPropChange('textValue', e.target.value)}
          />
        </div>
      )}

      {(selectedPart.type === 'custom_text' || selectedPart.type === 'custom_banner' || selectedPart.type === 'custom_card') && (
        <>
          <div className="form-field-group text-font-family-field">
            <label className="form-label">FONT FAMILY</label>
            <select className="select-control text-font-family-control"
              value={selectedPart.fontFamily || 'Outfit'}
              onChange={(e) => onPartPropChange('fontFamily', e.target.value)}
            >
              <option value="Outfit">Outfit</option>
              <option value="Inter">Inter</option>
              <option value="Roboto">Roboto</option>
              <option value="Montserrat">Montserrat</option>
              <option value="'Playfair Display'">Playfair Display</option>
              <option value="'Bebas Neue'">Bebas Neue</option>
              <option value="'JetBrains Mono'">JetBrains Mono</option>
            </select>
          </div>

          <div className="form-field-group text-font-size-field">
            <label className="form-label">FONT SIZE (PX)</label>
            <SmartNumberInput
              value={selectedPart.fontSize ?? 20}
              min={8}
              max={120}
              onChange={(val) => onPartPropChange('fontSize', val)}
            />
          </div>

          <div className="appearance-group">
            <div className="appearance-group-header"><span>COLOR</span></div>
            <div className="appearance-color-field">
              <ColorPickerPopover
                label="COLOR"
                color={selectedPart.fillColor || '#00d2ff'}
                alpha={selectedPart.fillOpacity ?? 1}
                fallback="#00d2ff"
                onColorChange={(value) => onPartColorChange('fillColor', value)}
                onAlphaChange={(value) => onPartPropChange('fillOpacity', value)}
              />
            </div>
          </div>
        <StyleEffectsSection selectedPart={selectedPart} onPartPropChange={onPartPropChange} embedded />
        {(selectedPart.type === 'custom_card' || selectedPart.type === 'custom_banner') && (
          <StyleCard title="APPEARANCE" collapsible defaultOpen={false}>
            <div className="form-field-group">
              <label className="form-label">CORNER RADIUS</label>
              <SmartNumberInput
                value={selectedPart.borderRadius ?? 0}
                min={0}
                max={100}
                onChange={(value) => onPartPropChange('borderRadius', value)}
              />
            </div>
          </StyleCard>
        )}
</>
      )}
    </StyleCard>
  );
};
