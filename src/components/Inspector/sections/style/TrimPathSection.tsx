import React from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { normalizeTrimPathOffset } from '../../../../utils/trimPath';
import { StyleCard } from './StyleCard';

interface TrimPathSectionProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: any) => void;
}

export const TrimPathSection: React.FC<TrimPathSectionProps> = ({ selectedPart, onPartPropChange }) => (
  <StyleCard title="TRIM PATH" collapsible defaultOpen={false}>
    <label className="appearance-group-header">
      <span>ENABLE TRIM PATH</span>
      <input
        type="checkbox"
        aria-label="Trim Path Enabled"
        checked={selectedPart.trimPathEnabled === true}
        onChange={(event) => onPartPropChange('trimPathEnabled', event.target.checked)}
      />
    </label>

    <div className="trim-path-fields">
      <div className="appearance-field">
        <label className="appearance-field-label" htmlFor="trim-path-start-input">START</label>
        <SmartNumberInput
          ariaLabel="Trim Path Start"
          value={selectedPart.trimPathStart ?? 0}
          min={0}
          max={1}
          step={0.01}
          displayScale={100}
          precision={0}
          onChange={(value) => onPartPropChange('trimPathStart', value)}
        />
      </div>
      <div className="appearance-field">
        <label className="appearance-field-label" htmlFor="trim-path-end-input">END</label>
        <SmartNumberInput
          ariaLabel="Trim Path End"
          value={selectedPart.trimPathEnd ?? 1}
          min={0}
          max={1}
          step={0.01}
          displayScale={100}
          precision={0}
          onChange={(value) => onPartPropChange('trimPathEnd', value)}
        />
      </div>
      <div className="appearance-field">
        <label className="appearance-field-label" htmlFor="trim-path-offset-input">OFFSET (DEGREES)</label>
        <SmartNumberInput
          ariaLabel="Trim Path Offset"
          value={selectedPart.trimPathOffset ?? 0}
          min={-720}
          max={720}
          step={1}
          precision={0}
          onChange={(value) => onPartPropChange('trimPathOffset', normalizeTrimPathOffset(value))}
        />
      </div>
    </div>
  </StyleCard>
);
