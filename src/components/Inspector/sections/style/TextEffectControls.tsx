import React from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { CLOCK_FORMATS, formatClock, type ClockFormat, type TextEffect } from '../../../../utils/animation/textEffects';
import { useAnimatorSlice } from '../../../../context/useAnimator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TextEffectControlsProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: unknown) => void;
}

type Choice = 'none' | 'typewriter' | 'count' | 'stopwatch' | 'countdown';

const round2 = (value: number) => Math.round(value * 100) / 100;

const choiceOf = (effect: TextEffect | undefined): Choice => (!effect ? 'none' : effect.kind === 'clock' ? effect.mode : effect.kind);

/**
 * A text layer's animation over time: a typewriter, a count of its number, a
 * stopwatch or a countdown. Times are shown in seconds and stored in frames
 * (a countdown's length in seconds); each change is one undo step. A clock
 * also writes its starting reading into the text, so the layer is measured
 * and laid out at the size it shows. The OGraf export plays the same way.
 */
export const TextEffectControls: React.FC<TextEffectControlsProps> = ({ selectedPart, onPartPropChange }) => {
  const { fps, startBatchInteraction, endBatchInteraction } = useAnimatorSlice('fps', 'startBatchInteraction', 'endBatchInteraction');
  const effect = selectedPart.textEffect;
  const choice = choiceOf(effect);
  const seconds = (frames: number) => round2(frames / fps);
  const frames = (value: number) => Math.max(0, Math.round(value * fps));

  /** A clock's effect and the reading it starts on, written as one undo step. */
  const setClock = (next: Extract<TextEffect, { kind: 'clock' }>) => {
    const reading = formatClock(next.mode === 'countdown' ? next.seconds ?? 0 : 0, next.format, next.mode === 'countdown');
    startBatchInteraction();
    onPartPropChange('textEffect', next);
    onPartPropChange('textValue', reading);
    endBatchInteraction();
  };
  const update = (patch: Record<string, unknown>) => {
    if (!effect) return;
    const next = { ...effect, ...patch } as TextEffect;
    if (next.kind === 'clock') setClock(next);
    else onPartPropChange('textEffect', next);
  };

  const pick = (value: Choice) => {
    const startFrame = effect?.startFrame ?? 0;
    if (value === 'none') onPartPropChange('textEffect', undefined);
    else if (value === 'stopwatch' || value === 'countdown') {
      const format = effect?.kind === 'clock' ? effect.format : 'mm:ss';
      setClock({ kind: 'clock', mode: value, startFrame, format, ...(value === 'countdown' ? { seconds: effect?.kind === 'clock' && effect.seconds ? effect.seconds : 60 } : {}) });
    } else {
      const durationFrames = effect && effect.kind !== 'clock' ? effect.durationFrames : Math.round(fps);
      onPartPropChange('textEffect', { kind: value, startFrame, durationFrames, ...(value === 'count' ? { from: 0 } : {}) } as TextEffect);
    }
  };

  return (
    <div className="text-effect-controls" data-testid="text-effect-controls">
      <div className="form-field-group">
        <label className="form-label" htmlFor={`text-effect-${selectedPart.id}`}>ANIMATE TEXT</label>
        <select id={`text-effect-${selectedPart.id}`} className="select-control" value={choice} onChange={(event) => pick(event.target.value as Choice)}>
          <option value="none">None</option>
          <option value="typewriter">Typewriter</option>
          <option value="count">Count (the text's number)</option>
          <option value="stopwatch">Stopwatch</option>
          <option value="countdown">Countdown</option>
        </select>
      </div>
      {effect && (
        <div className="text-effect-fields">
          <div className="form-field-group">
            <label className="form-label">START (S)</label>
            <SmartNumberInput ariaLabel="Text effect start in seconds" value={seconds(effect.startFrame)} min={0} step={0.1} onChange={(value) => update({ startFrame: frames(value) })} />
          </div>
          {effect.kind !== 'clock' && (
            <div className="form-field-group">
              <label className="form-label">LENGTH (S)</label>
              <SmartNumberInput ariaLabel="Text effect length in seconds" value={seconds(effect.durationFrames)} min={0} step={0.1} onChange={(value) => update({ durationFrames: frames(value) })} />
            </div>
          )}
          {effect.kind === 'count' && (
            <div className="form-field-group">
              <label className="form-label">FROM</label>
              <SmartNumberInput ariaLabel="Count from" value={effect.from ?? 0} onChange={(value) => update({ from: value })} />
            </div>
          )}
          {effect.kind === 'clock' && effect.mode === 'countdown' && (
            <div className="form-field-group">
              <label className="form-label">FROM (S)</label>
              <SmartNumberInput ariaLabel="Countdown from in seconds" value={effect.seconds ?? 0} min={0} step={1} onChange={(value) => update({ seconds: Math.max(0, value) })} />
            </div>
          )}
          {effect.kind === 'clock' && (
            <div className="form-field-group">
              <label className="form-label" htmlFor={`clock-format-${selectedPart.id}`}>FORMAT</label>
              <select id={`clock-format-${selectedPart.id}`} className="select-control" value={effect.format} onChange={(event) => update({ format: event.target.value as ClockFormat })}>
                {CLOCK_FORMATS.map((format) => <option key={format} value={format}>{format}</option>)}
              </select>
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
