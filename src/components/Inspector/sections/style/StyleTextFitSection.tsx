import React from 'react';
import type { CharacterPart } from '../../../../types/animator';
import type { FitToTextSettings, TextFitSettings } from '../../../../utils/layers/textFit';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { StyleCard } from './StyleCard';

/** The local width of each shape that can follow a text (`utils/layers/textFit`). */
const FOLLOWER_WIDTHS: Partial<Record<CharacterPart['type'], number>> = {
  custom_box: 60, custom_rect: 120, custom_banner: 160, custom_capsule: 100, custom_card: 180,
};
const DEFAULT_PADDING = 24;

/** 0 in a limit field means "no limit": the setting is removed. */
const limitOrUndefined = (value: number): number | undefined => (Number.isFinite(value) && value > 0 ? value : undefined);

/** Writes a settings object without its absent fields (an empty one is removed). */
const compact = <T extends object>(settings: T): T | undefined => {
  const entries = Object.entries(settings).filter(([, value]) => value !== undefined);
  return entries.length > 0 ? Object.fromEntries(entries) as T : undefined;
};

interface TextBoxCardProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: unknown) => void;
}

/** TEXT BOX: the width a text keeps to, how far it may shrink, and its character limit. */
export const TextBoxCard: React.FC<TextBoxCardProps> = ({ selectedPart, onPartPropChange }) => {
  if (selectedPart.type !== 'custom_text') return null;
  const fit = selectedPart.textFit ?? {};
  const write = (patch: Partial<TextFitSettings>) => onPartPropChange('textFit', compact({ ...fit, ...patch }));
  const active = fit.maxWidth !== undefined || fit.maxLength !== undefined;
  return (
    <StyleCard title="TEXT BOX" collapsible retainKey="text-box" badge={active ? 'On' : undefined}>
      <p className="matte-section-intro" data-testid="text-box-intro">
        Past the max width the text gets smaller (down to the min size) instead of growing; it never leaves the box.
        0 means no limit.
      </p>
      <div className="form-field-group">
        <label className="form-label">MAX WIDTH (PX)</label>
        <SmartNumberInput ariaLabel="Text max width" value={fit.maxWidth ?? 0} min={0} max={10000} deferCommit onChange={(value) => write({ maxWidth: limitOrUndefined(value) })} />
      </div>
      <div className="form-field-group">
        <label className="form-label">MIN SIZE (%)</label>
        <SmartNumberInput ariaLabel="Text min size percent" value={Math.round((fit.minScale ?? 0.5) * 100)} min={5} max={100} deferCommit onChange={(value) => write({ minScale: value / 100 === 0.5 ? undefined : value / 100 })} />
      </div>
      <div className="form-field-group">
        <label className="form-label">MAX CHARACTERS</label>
        <SmartNumberInput ariaLabel="Text max characters" value={fit.maxLength ?? 0} min={0} max={1000} deferCommit onChange={(value) => write({ maxLength: limitOrUndefined(Math.round(value)) })} />
      </div>
    </StyleCard>
  );
};

interface FitToTextCardProps {
  selectedPart: CharacterPart;
  characterParts: CharacterPart[];
  onPartPropChange: (key: keyof CharacterPart, value: unknown) => void;
}

/** FIT TO TEXT: a box-like shape that takes its width from a text layer. */
export const FitToTextCard: React.FC<FitToTextCardProps> = ({ selectedPart, characterParts, onPartPropChange }) => {
  const localWidth = FOLLOWER_WIDTHS[selectedPart.type];
  if (localWidth === undefined) return null;
  const fit = selectedPart.fitToText;
  const texts = characterParts.filter((part) => part.type === 'custom_text' && part.id !== selectedPart.id);
  const currentWidth = Math.round(localWidth * Math.abs(selectedPart.baseTransform.scaleX || 1));
  const write = (patch: Partial<FitToTextSettings>) => {
    if (!fit) return;
    onPartPropChange('fitToText', compact({ ...fit, ...patch }));
  };
  return (
    <StyleCard title="FIT TO TEXT" collapsible retainKey="fit-to-text" badge={fit ? 'On' : undefined}>
      <p className="matte-section-intro" data-testid="fit-to-text-intro">
        The width follows the text plus the padding, up to the max width; past it the text gets smaller. Height and
        position stay as they are.
      </p>
      <div className="form-field-group">
        <label className="form-label">TEXT LAYER</label>
        <select
          className="select-control"
          aria-label="Fit to text layer"
          value={fit?.textLayerId ?? ''}
          onChange={(event) => {
            const textLayerId = event.target.value;
            if (!textLayerId) {
              onPartPropChange('fitToText', undefined);
              return;
            }
            // A new link starts at today's width as its maximum: nothing grows past what was drawn.
            onPartPropChange('fitToText', fit ? { ...fit, textLayerId } : { textLayerId, padding: DEFAULT_PADDING, maxWidth: currentWidth });
          }}
        >
          <option value="">None</option>
          {texts.map((part) => <option key={part.id} value={part.id}>{part.name || part.id}</option>)}
        </select>
      </div>
      {fit && (
        <>
          <div className="form-field-group">
            <label className="form-label">PADDING (PX)</label>
            <SmartNumberInput ariaLabel="Fit padding" value={fit.padding ?? DEFAULT_PADDING} min={0} max={1000} deferCommit onChange={(value) => write({ padding: value })} />
          </div>
          <div className="form-field-group">
            <label className="form-label">MIN WIDTH (PX)</label>
            <SmartNumberInput ariaLabel="Fit min width" value={fit.minWidth ?? 0} min={0} max={10000} deferCommit onChange={(value) => write({ minWidth: limitOrUndefined(value) })} />
          </div>
          <div className="form-field-group">
            <label className="form-label">MAX WIDTH (PX)</label>
            <SmartNumberInput ariaLabel="Fit max width" value={fit.maxWidth ?? 0} min={0} max={10000} deferCommit onChange={(value) => write({ maxWidth: limitOrUndefined(value) })} />
          </div>
        </>
      )}
    </StyleCard>
  );
};
