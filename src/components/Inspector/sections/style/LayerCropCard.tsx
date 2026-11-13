import React, { useId } from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { getPartLocalBounds } from '../../../../utils/geometry/bounds';
import { isLayerCrop, type LayerCrop } from '../../../../utils/layers/layerCrop';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { StyleCard } from './StyleCard';

interface LayerCropCardProps {
  part: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: unknown) => void;
  readOnlyReason?: string;
}

const MIN_VISIBLE = 1;

/**
 * Crop: trim what a layer shows from each side, in its own units, without
 * moving or scaling it. The trims are measured from the layer's own bounds and
 * stored as the visible rectangle (`utils/layers/layerCrop`), which the stage
 * and every export clip with. One undo step per change.
 */
export const LayerCropCard: React.FC<LayerCropCardProps> = ({ part, onPartPropChange, readOnlyReason }) => {
  const toggleId = useId();
  const bounds = getPartLocalBounds(part);
  const crop = isLayerCrop(part.crop) ? part.crop : null;
  const full: LayerCrop = { x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY };
  const current = crop ?? full;
  const trims = {
    left: current.x - full.x,
    top: current.y - full.y,
    right: full.x + full.width - (current.x + current.width),
    bottom: full.y + full.height - (current.y + current.height),
  };
  const round = (value: number) => Math.round(value * 10) / 10;

  const setTrim = (side: keyof typeof trims, value: number) => {
    const next = { ...trims, [side]: Math.max(0, value) };
    const width = Math.max(MIN_VISIBLE, full.width - next.left - next.right);
    const height = Math.max(MIN_VISIBLE, full.height - next.top - next.bottom);
    onPartPropChange('crop', { x: full.x + Math.min(next.left, full.width - MIN_VISIBLE), y: full.y + Math.min(next.top, full.height - MIN_VISIBLE), width, height });
  };

  return (
    <StyleCard title="CROP" collapsible retainKey="layer-crop" badge={crop ? 'On' : undefined}>
      <div className="appearance-group-header">
        <label htmlFor={toggleId}>CROP LAYER</label>
        <input
          id={toggleId}
          type="checkbox"
          aria-label="Crop Enabled"
          checked={Boolean(crop)}
          disabled={Boolean(readOnlyReason)}
          title={readOnlyReason ?? 'Trim what this layer shows, without moving or scaling it'}
          onChange={(event) => onPartPropChange('crop', event.target.checked ? full : undefined)}
        />
      </div>
      {crop && (
        <div className="effects-property-grid layer-crop-grid">
          {(['left', 'right', 'top', 'bottom'] as const).map((side) => (
            <div key={side} className="effects-property-field">
              <span className="param-label">{side.toUpperCase()}</span>
              <SmartNumberInput ariaLabel={`Crop ${side}`} value={round(trims[side])} min={0} step={1} onChange={(value) => setTrim(side, value)} />
            </div>
          ))}
        </div>
      )}
    </StyleCard>
  );
};
