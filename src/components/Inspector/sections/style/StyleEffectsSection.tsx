import React, { useId, useState } from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { CompactColorControl } from './CompactColorControl';
import { StyleCard } from './StyleCard';

interface StyleEffectsSectionProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: unknown) => void;
  onColorInteractionStart?: () => void;
  onColorInteractionEnd?: () => void;
  embedded?: boolean;
}

const DEFAULT_SHADOW_COLOR = '#000000';

/**
 * The shadow, laid out like Fill and Stroke: a header with an on/off box, a
 * swatch with its hex, and its blur and offsets while it is on. A shadow is
 * "on" when the layer has a shadow colour, as the renderer reads it; turning
 * it off clears the colour and turning it back on restores the last one.
 */
export const StyleEffectsSection: React.FC<StyleEffectsSectionProps> = ({
  selectedPart,
  onPartPropChange,
  onColorInteractionStart,
  onColorInteractionEnd,
  embedded = false,
}) => {
  const checkboxId = useId();
  const enabled = Boolean(selectedPart.shadowColor);
  // The colour the box brings back: the layer's own while it has one (kept in
  // step during render, React's pattern for state derived from a prop).
  const [lastColor, setLastColor] = useState<string>(selectedPart.shadowColor || DEFAULT_SHADOW_COLOR);
  if (selectedPart.shadowColor && selectedPart.shadowColor !== lastColor) setLastColor(selectedPart.shadowColor);

  const controls = (
    <div className={`appearance-group appearance-group-shadow${enabled ? '' : ' is-muted'}`}>
      <div className="appearance-group-header">
        <label htmlFor={checkboxId}>SHADOW</label>
        <input
          id={checkboxId}
          type="checkbox"
          aria-label="Shadow Enabled"
          checked={enabled}
          onChange={(event) => onPartPropChange('shadowColor', event.target.checked ? lastColor : undefined)}
        />
      </div>
      {/* The shadow colour carries no alpha channel, so the picker omits the
          alpha controls rather than exposing a dead slider. */}
      <CompactColorControl
        label="SHADOW / GLOW COLOR"
        value={selectedPart.shadowColor || lastColor}
        fallback={DEFAULT_SHADOW_COLOR}
        onColorChange={(value) => onPartPropChange('shadowColor', value)}
        onInteractionStart={onColorInteractionStart}
        onInteractionEnd={onColorInteractionEnd}
      />
      {enabled && (
        <div className="effects-property-grid">
          <div className="effects-property-field"><span className="param-label">BLUR RADIUS</span><SmartNumberInput value={selectedPart.shadowBlur ?? 8} min={0} max={50} onChange={(value) => onPartPropChange('shadowBlur', value)} /></div>
          <div className="effects-property-field"><span className="param-label">OFFSET X</span><SmartNumberInput value={selectedPart.shadowOffsetX ?? 0} min={-50} max={50} onChange={(value) => onPartPropChange('shadowOffsetX', value)} /></div>
          <div className="effects-property-field"><span className="param-label">OFFSET Y</span><SmartNumberInput value={selectedPart.shadowOffsetY ?? 4} min={-50} max={50} onChange={(value) => onPartPropChange('shadowOffsetY', value)} /></div>
        </div>
      )}
    </div>
  );
  return embedded ? controls : <StyleCard title="EFFECTS" collapsible retainKey="effects">{controls}</StyleCard>;
};
