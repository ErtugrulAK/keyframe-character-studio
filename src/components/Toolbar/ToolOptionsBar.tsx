import React from 'react';
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import { useAnimatorSlice } from '../../context/useAnimator';
import { usePartPropertyAuthoring } from '../../hooks/usePartPropertyAuthoring';
import { SmartNumberInput } from '../Inspector/inputs/SmartNumberInput';
import { ColorPickerPopover } from '../Inspector/inputs/ColorPickerPopover';
import { KCS_TEXT_FONT_FAMILIES } from '../../utils/layers/textFonts';
import { defaultStrokeWidth } from '../../utils/layers/shapeAppearance';
import { TEXT_PRESETS } from '../../utils/editor/textPresets';
import type { HorizontalAlign } from '../../utils/layers/layoutModifiers';
import './ToolOptionsBar.css';

/** A family without its CSS quotes: older layers stored multi-word families bare. */
const bareFamily = (family: string | undefined) => (family ?? '').replace(/['"]/gu, '');

const ALIGNS: Array<{ id: HorizontalAlign; label: string; icon: React.ReactNode }> = [
  { id: 'left', label: 'Align text left', icon: <AlignLeft /> },
  { id: 'center', label: 'Align text centre', icon: <AlignCenter /> },
  { id: 'right', label: 'Align text right', icon: <AlignRight /> },
];

/**
 * The options bar under the toolbar (as in Photoshop and Illustrator): the
 * settings of what is selected, in one row. For a text layer it holds what
 * the Inspector's TEXT card held: a text style, the text itself, font, size,
 * colour, outline and alignment. It writes through the Inspector's own
 * property authority, so an edit here is the same edit (and undo step).
 */
export const ToolOptionsBar: React.FC = () => {
  const { selectedPartId, selectedPartIds, characterParts, startBatchInteraction, endBatchInteraction } = useAnimatorSlice(
    'selectedPartId', 'selectedPartIds', 'characterParts', 'startBatchInteraction', 'endBatchInteraction',
  );
  const { handlePartPropChange, handlePartColorChange } = usePartPropertyAuthoring();
  const part = selectedPartIds.length <= 1 ? characterParts.find((candidate) => candidate.id === selectedPartId) : undefined;
  if (!part || part.type !== 'custom_text') return null;

  const align = part.textFit?.align ?? 'center';
  const family = bareFamily(part.fontFamily || 'Outfit');
  const preset = TEXT_PRESETS.find((candidate) => bareFamily(candidate.fontFamily) === family && candidate.fontSize === part.fontSize);
  // The font list's own entry for the layer's family, quoted or not.
  const fontOption = KCS_TEXT_FONT_FAMILIES.find((candidate) => bareFamily(candidate) === family) ?? part.fontFamily ?? 'Outfit';

  return (
    <div className="tool-options-bar" role="toolbar" aria-label="Text options">
      <span className="tool-options-title">Text</span>
      <select
        className="select-control tool-options-style"
        aria-label="Text style"
        value={preset?.label ?? ''}
        onChange={(event) => {
          const picked = TEXT_PRESETS.find((candidate) => candidate.label === event.target.value);
          if (!picked) return;
          startBatchInteraction();
          handlePartPropChange('fontFamily', picked.fontFamily);
          handlePartPropChange('fontSize', picked.fontSize);
          endBatchInteraction();
        }}
      >
        <option value="" disabled>Style…</option>
        {TEXT_PRESETS.map((candidate) => (
          <option key={candidate.label} value={candidate.label}>{candidate.label}</option>
        ))}
      </select>
      <input
        className="input-control text-content-control tool-options-text"
        type="text"
        aria-label="Text content"
        value={part.textValue || ''}
        placeholder="Enter text..."
        maxLength={part.textFit?.maxLength}
        onFocus={(event) => event.target.select()}
        onChange={(event) => handlePartPropChange('textValue', event.target.value)}
      />
      <select
        className="select-control text-font-family-control tool-options-font"
        aria-label="Font family"
        value={fontOption}
        onChange={(event) => handlePartPropChange('fontFamily', event.target.value)}
      >
        {KCS_TEXT_FONT_FAMILIES.map((family) => (
          <option key={family} value={family}>{family.replace(/['"]/gu, '')}</option>
        ))}
      </select>
      <div className="tool-options-field tool-options-size">
        <SmartNumberInput ariaLabel="Font size" value={part.fontSize ?? 20} min={8} max={400} onChange={(value) => handlePartPropChange('fontSize', value)} />
      </div>
      <div className="tool-options-color" title="Text colour">
        <ColorPickerPopover
          label="COLOR"
          color={part.fillColor || '#00d2ff'}
          alpha={part.fillOpacity ?? 1}
          fallback="#00d2ff"
          onColorChange={(value) => handlePartColorChange('fillColor', value)}
          onAlphaChange={(value) => handlePartPropChange('fillOpacity', value)}
          onInteractionStart={startBatchInteraction}
          onInteractionEnd={endBatchInteraction}
        />
      </div>
      <span className="tool-options-divider" aria-hidden="true" />
      <label className="tool-options-check" title="Outline the letters">
        <input
          type="checkbox"
          aria-label="Text Stroke Enabled"
          checked={part.strokeEnabled ?? true}
          onChange={(event) => handlePartPropChange('strokeEnabled', event.target.checked)}
        />
        Stroke
      </label>
      <div className={`tool-options-color${part.strokeEnabled === false ? ' is-muted' : ''}`} title="Outline colour">
        <ColorPickerPopover
          label="TEXT STROKE"
          color={part.strokeColor || '#101218'}
          alpha={part.strokeOpacity ?? 1}
          fallback="#101218"
          onColorChange={(value) => handlePartColorChange('strokeColor', value)}
          onAlphaChange={(value) => handlePartPropChange('strokeOpacity', value)}
          onInteractionStart={startBatchInteraction}
          onInteractionEnd={endBatchInteraction}
        />
      </div>
      <div className="tool-options-field tool-options-stroke-width">
        <SmartNumberInput
          ariaLabel="Text Stroke Width"
          value={part.strokeWidth ?? defaultStrokeWidth(part.type)}
          min={0}
          max={100}
          step={0.5}
          precision={2}
          onChange={(value) => handlePartPropChange('strokeWidth', value)}
        />
      </div>
      <span className="tool-options-divider" aria-hidden="true" />
      <div className="tool-options-group" role="group" aria-label="Text alignment">
        {ALIGNS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`authoring-toolbar-button${align === option.id ? ' active' : ''}`}
            aria-label={option.label}
            aria-pressed={align === option.id}
            title={option.label}
            onClick={() => handlePartPropChange('textFit', { ...(part.textFit ?? {}), align: option.id })}
          >
            {option.icon}
          </button>
        ))}
      </div>
    </div>
  );
};
