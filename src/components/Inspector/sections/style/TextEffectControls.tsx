import React from 'react';
import type { CharacterPart } from '../../../../types/animator';
import type { TextEffect } from '../../../../utils/animation/textEffects';
import { useAnimatorSlice } from '../../../../context/useAnimator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TextEffectControlsProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: unknown) => void;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * A text layer's animation over time: none, a typewriter, or a count of its
 * number. Start and length are shown in seconds and stored in frames; each
 * change is one undo step (the part-property path). The OGraf export plays it
 * the same way.
 */
export const TextEffectControls: React.FC<TextEffectControlsProps> = ({ selectedPart, onPartPropChange }) => {
  const { fps } = useAnimatorSlice('fps');
  const effect = selectedPart.textEffect;
  const seconds = (frames: number) => round2(frames / fps);
  const frames = (value: number) => Math.max(0, Math.round(value * fps));
  const update = (patch: Partial<TextEffect>) => {
    if (effect) onPartPropChange('textEffect', { ...effect, ...patch });
  };

  return (
    <div className="text-effect-controls" data-testid="text-effect-controls">
      <div className="form-field-group">
        <label className="form-label" htmlFor={`text-effect-${selectedPart.id}`}>ANIMATE TEXT</label>
        <select
          id={`text-effect-${selectedPart.id}`}
          className="select-control"
          value={effect?.kind ?? 'none'}
          onChange={(event) => {
            const kind = event.target.value;
            if (kind === 'none') onPartPropChange('textEffect', undefined);
            else onPartPropChange('textEffect', { kind, startFrame: effect?.startFrame ?? 0, durationFrames: effect?.durationFrames ?? Math.round(fps), ...(kind === 'count' ? { from: 0 } : {}) } as TextEffect);
          }}
        >
          <option value="none">None</option>
          <option value="typewriter">Typewriter</option>
          <option value="count">Count (the text's number)</option>
        </select>
      </div>
      {effect && (
        <div className="text-effect-fields">
          <div className="form-field-group">
            <label className="form-label">START (S)</label>
            <SmartNumberInput ariaLabel="Text effect start in seconds" value={seconds(effect.startFrame)} min={0} step={0.1} onChange={(value) => update({ startFrame: frames(value) })} />
          </div>
          <div className="form-field-group">
            <label className="form-label">LENGTH (S)</label>
            <SmartNumberInput ariaLabel="Text effect length in seconds" value={seconds(effect.durationFrames)} min={0} step={0.1} onChange={(value) => update({ durationFrames: frames(value) })} />
          </div>
          {effect.kind === 'count' && (
            <div className="form-field-group">
              <label className="form-label">FROM</label>
              <SmartNumberInput ariaLabel="Count from" value={effect.from ?? 0} onChange={(value) => update({ from: value })} />
            </div>
          )}
        </div>
      )}
      {effect?.kind === 'count' && (
        <p className="matte-section-intro">Counts from FROM to the number written in the text (one number; its decimals and separators are kept).</p>
      )}
    </div>
  );
};
