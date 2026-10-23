import React from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { normalizeTrimPathOffset } from '../../../../utils/trimPath';
import { StyleCard } from './StyleCard';

/** The three keyframeable Trim Path channels. */
export type TrimPathChannel = 'trimPathStart' | 'trimPathEnd' | 'trimPathOffset';

interface TrimPathSectionProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: unknown) => void;
  /**
   * The evaluated value at the current frame (`evaluateTrimPath` authority).
   * While a channel is keyed this differs from the static field, and the field
   * must show what the stage draws — otherwise the same number appears at every
   * frame and the property reads as a global edit.
   */
  evaluatedTrim?: { start: number; end: number; offset: number };
  /**
   * Canonical channel write: static field while the channel has no keyframes,
   * the current frame's keyframe once it has one. Never rewrites another frame.
   */
  onUpdateTrimChannel?: (channel: TrimPathChannel, value: number) => void;
}

export const TrimPathSection: React.FC<TrimPathSectionProps> = ({
  selectedPart,
  onPartPropChange,
  evaluatedTrim,
  onUpdateTrimChannel,
}) => {
  // Without the channel callbacks the section keeps its original static
  // behaviour, so it stays usable on its own.
  const write = (channel: TrimPathChannel, value: number) => {
    if (onUpdateTrimChannel) onUpdateTrimChannel(channel, value);
    else onPartPropChange(channel, value);
  };

  const fields: { channel: TrimPathChannel; label: string; unit: string; ariaLabel: string; value: number; min: number; max: number; step: number; precision: number; normalize?: (value: number) => number }[] = [
    { channel: 'trimPathStart', label: 'START', unit: '%', ariaLabel: 'Trim Path Start', value: evaluatedTrim?.start ?? selectedPart.trimPathStart ?? 0, min: 0, max: 1, step: 0.01, precision: 0 },
    { channel: 'trimPathEnd', label: 'END', unit: '%', ariaLabel: 'Trim Path End', value: evaluatedTrim?.end ?? selectedPart.trimPathEnd ?? 1, min: 0, max: 1, step: 0.01, precision: 0 },
    { channel: 'trimPathOffset', label: 'OFFSET', unit: '°', ariaLabel: 'Trim Path Offset', value: evaluatedTrim?.offset ?? selectedPart.trimPathOffset ?? 0, min: -720, max: 720, step: 1, precision: 0, normalize: normalizeTrimPathOffset },
  ];

  return (
    <StyleCard title="TRIM PATH" collapsible defaultOpen={false} retainKey="trim-path">
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
        {fields.map((field) => (
          <div key={field.channel} className={`appearance-field trim-path-field${field.channel === 'trimPathOffset' ? ' trim-path-offset-field' : ''}`}>
            <label className="appearance-field-label" htmlFor={`trim-path-${field.channel}-input`}>
              <span>{field.label}</span>
              <span className="trim-path-unit">{field.unit}</span>
            </label>
            <SmartNumberInput
              ariaLabel={field.ariaLabel}
              value={field.value}
              min={field.min}
              max={field.max}
              step={field.step}
              displayScale={field.channel === 'trimPathOffset' ? undefined : 100}
              precision={field.precision}
              onChange={(value) => write(field.channel, field.normalize ? field.normalize(value) : value)}
            />
          </div>
        ))}
      </div>
    </StyleCard>
  );
};
