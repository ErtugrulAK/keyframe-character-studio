import React from 'react';
import { Type } from 'lucide-react';
import type { CharacterPart } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { StyleCard } from './StyleCard';

interface StyleTextFieldsProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: any) => void;
}

export const StyleTextFields: React.FC<StyleTextFieldsProps> = ({ selectedPart, onPartPropChange }) => {
  const applies =
    selectedPart.type === 'custom_card' ||
    selectedPart.type === 'custom_text' ||
    selectedPart.type === 'custom_banner';
  if (!applies) return null;

  return (
    <StyleCard title="TEXT" icon={<Type size={13} />}>
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
        <div className="form-field-group">
          <label className="form-label">TEXT CONTENT</label>
          <input className="input-control"
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
          <div className="form-field-group">
            <label className="form-label">FONT FAMILY</label>
            <select className="select-control"
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

          <div className="form-field-group">
            <label className="form-label">FONT SIZE (PX)</label>
            <SmartNumberInput
              value={selectedPart.fontSize ?? 20}
              min={8}
              max={120}
              onChange={(val) => onPartPropChange('fontSize', val)}
            />
          </div>

          {/* STAGGERED TEXT ANIMATION */}
          <div className="form-field-group">
            <label className="form-label">STAGGERED TEXT ANIMATION</label>
            <select className="select-control"
              value={selectedPart.textAnimMode || 'none'}
              onChange={(e) => onPartPropChange('textAnimMode', e.target.value)}
            >
              <option value="none">None (Standard Static Text)</option>
              <option value="chars">Character by Character (Stagger Chars)</option>
              <option value="words">Word by Word (Stagger Words)</option>
            </select>
          </div>

          {selectedPart.textAnimMode && selectedPart.textAnimMode !== 'none' && (
            <div className="form-field-group">
              <label className="form-label">STAGGER DELAY (MS)</label>
              <SmartNumberInput
                value={selectedPart.textStaggerDelay || 60}
                min={10}
                max={500}
                step={10}
                onChange={(val) => onPartPropChange('textStaggerDelay', val)}
              />
            </div>
          )}
        </>
      )}
    </StyleCard>
  );
};
