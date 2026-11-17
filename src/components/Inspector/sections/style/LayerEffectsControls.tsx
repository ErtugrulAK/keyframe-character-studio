import React, { useId, useState } from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { LAYER_BLEND_MODES, type LayerBlendMode } from '../../../../utils/layers/layerEffects';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { CompactColorControl } from './CompactColorControl';

interface LayerEffectsControlsProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: unknown) => void;
  onColorInteractionStart?: () => void;
  onColorInteractionEnd?: () => void;
}

const DEFAULT_GLOW_COLOR = '#ffd166';
const BLEND_LABELS: Record<LayerBlendMode, string> = {
  normal: 'Normal', multiply: 'Multiply', screen: 'Screen', overlay: 'Overlay', darken: 'Darken', lighten: 'Lighten', add: 'Add',
};

/**
 * Glow, blur and blend mode, under the shadow and laid out like it. A glow is
 * "on" while the layer has a glow colour; turning it off clears the colour and
 * turning it back on restores the last one. Drawn the same way on the stage and
 * in every export (`utils/layers/layerEffects`).
 */
export const LayerEffectsControls: React.FC<LayerEffectsControlsProps> = ({ selectedPart, onPartPropChange, onColorInteractionStart, onColorInteractionEnd }) => {
  const glowId = useId();
  const blendId = useId();
  const glowOn = Boolean(selectedPart.glowColor);
  const [lastGlow, setLastGlow] = useState<string>(selectedPart.glowColor || DEFAULT_GLOW_COLOR);
  if (selectedPart.glowColor && selectedPart.glowColor !== lastGlow) setLastGlow(selectedPart.glowColor);

  return (
    <>
      <div className={`appearance-group appearance-group-glow${glowOn ? '' : ' is-muted'}`}>
        <div className="appearance-group-header">
          <label htmlFor={glowId}>GLOW</label>
          <input
            id={glowId}
            type="checkbox"
            aria-label="Glow Enabled"
            checked={glowOn}
            onChange={(event) => onPartPropChange('glowColor', event.target.checked ? lastGlow : undefined)}
          />
        </div>
        <CompactColorControl
          label="GLOW COLOR"
          value={selectedPart.glowColor || lastGlow}
          fallback={DEFAULT_GLOW_COLOR}
          onColorChange={(value) => onPartPropChange('glowColor', value)}
          onInteractionStart={onColorInteractionStart}
          onInteractionEnd={onColorInteractionEnd}
        />
        {glowOn && (
          <div className="effects-property-grid">
            <div className="effects-property-field"><span className="param-label">SIZE</span><SmartNumberInput ariaLabel="Glow size" value={selectedPart.glowSize ?? 12} min={0} max={100} onChange={(value) => onPartPropChange('glowSize', value)} /></div>
            <div className="effects-property-field"><span className="param-label">STRENGTH %</span><SmartNumberInput ariaLabel="Glow strength" value={Math.round((selectedPart.glowStrength ?? 0.8) * 100)} min={0} max={100} onChange={(value) => onPartPropChange('glowStrength', Math.min(1, Math.max(0, value / 100)))} /></div>
          </div>
        )}
      </div>
      <div className="effects-property-grid layer-effects-row">
        <div className="effects-property-field"><span className="param-label">BLUR</span><SmartNumberInput ariaLabel="Layer blur" value={selectedPart.layerBlur ?? 0} min={0} max={100} onChange={(value) => onPartPropChange('layerBlur', value > 0 ? value : undefined)} /></div>
        <div className="effects-property-field">
          <label className="param-label" htmlFor={blendId}>BLEND</label>
          <select
            id={blendId}
            className="select-control"
            aria-label="Blend mode"
            value={selectedPart.blendMode ?? 'normal'}
            onChange={(event) => onPartPropChange('blendMode', event.target.value === 'normal' ? undefined : event.target.value)}
          >
            {LAYER_BLEND_MODES.map((mode) => <option key={mode} value={mode}>{BLEND_LABELS[mode]}</option>)}
          </select>
        </div>
      </div>
    </>
  );
};
