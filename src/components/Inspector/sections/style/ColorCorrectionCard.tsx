import React from 'react';
import type { CharacterPart, ColorCorrectionEffect, LayerMask } from '../../../../types/animator';
import type { MaskDrawShape } from '../../../../hooks/useMaskEditing';
import { StyleCard } from './StyleCard';
import {
  COLOR_CORRECTION_RANGES,
  colorCorrectionOf,
  createColorCorrection,
  isEffectOnlyMask,
  resetColorCorrection,
  resolveColorCorrection,
  resolvedParameters,
  type ColorCorrectionField,
} from '../../../../utils/colorCorrection';

interface ColorCorrectionCardProps {
  part: CharacterPart;
  /** The layer's masks as evaluated now (what the renderer resolves the scope against). */
  evaluatedMasks?: LayerMask[];
  onChangeEffects: (effects: ColorCorrectionEffect[] | undefined) => void;
  /** Draws an effect-only mask on the canvas that becomes the correction's scope. */
  onDrawEffectMask: (shape: MaskDrawShape) => void;
  /** The effect-mask shape being drawn right now, if any. */
  drawingEffectMask: MaskDrawShape | null;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  readOnlyReason?: string | null;
}

const SLIDERS: { field: ColorCorrectionField; label: string; scale: number; unit: string }[] = [
  { field: 'brightness', label: 'Brightness', scale: 100, unit: '' },
  { field: 'contrast', label: 'Contrast', scale: 100, unit: '%' },
  { field: 'saturation', label: 'Saturation', scale: 100, unit: '%' },
  { field: 'amount', label: 'Amount', scale: 100, unit: '%' },
];

const DRAW_SHAPES: { shape: MaskDrawShape; label: string }[] = [
  { shape: 'rectangle', label: 'Rectangle' },
  { shape: 'ellipse', label: 'Ellipse' },
  { shape: 'pen', label: 'Pen' },
];

/**
 * Inspector › Color Correction (first slice: images). One correction
 * per layer: enable/bypass, reset to neutral, the scope (whole layer or one of
 * this layer's masks — an effect-only mask can be drawn for it), brightness,
 * contrast, saturation and amount. A slider drag is ONE undo step (the
 * caller's batch). The status line says when a mask scope cannot apply.
 */
export const ColorCorrectionCard: React.FC<ColorCorrectionCardProps> = ({
  part,
  evaluatedMasks,
  onChangeEffects,
  onDrawEffectMask,
  drawingEffectMask,
  onInteractionStart,
  onInteractionEnd,
  readOnlyReason = null,
}) => {
  const effect = colorCorrectionOf(part);
  const status = resolveColorCorrection(part, evaluatedMasks ?? part.masks);
  const readOnly = Boolean(readOnlyReason);
  const masks = part.masks ?? [];
  const replace = (next: ColorCorrectionEffect | undefined) => {
    const others = (part.effects ?? []).filter((candidate) => candidate.type !== 'colorCorrection');
    const effects = next ? [...others, next] : others;
    onChangeEffects(effects.length > 0 ? effects : undefined);
  };
  const sliderGesture = { onPointerDown: onInteractionStart, onPointerUp: onInteractionEnd, onPointerCancel: onInteractionEnd, onBlur: onInteractionEnd };
  const badge = !effect ? undefined
    : status.kind === 'applied' ? 'On'
      : status.kind === 'off' ? 'Off'
        : status.kind === 'neutral' ? 'Neutral'
          : 'Not applied';

  return (
    <StyleCard title="COLOR CORRECTION" collapsible retainKey="color-correction" badge={badge}>
      {!effect ? (
        <>
          <p className="matte-section-intro">Brightness, contrast and saturation for this image, on the whole image or only inside a mask. The image itself is not changed.</p>
          <button
            type="button"
            className="btn-secondary"
            disabled={readOnly}
            title={readOnlyReason ?? 'Add a neutral colour correction to this image'}
            onClick={() => replace(createColorCorrection('cc1'))}
          >
            Add color correction
          </button>
        </>
      ) : (
        <div className="color-correction" data-testid="color-correction" data-status={status.kind}>
          <div className="color-correction-row">
            <label className="matte-toggle-field">
              <input
                type="checkbox"
                aria-label="Color correction enabled"
                checked={effect.enabled !== false}
                disabled={readOnly}
                onChange={(event) => replace({ ...effect, enabled: event.target.checked })}
              />
              Enabled
            </label>
            <button type="button" className="btn-secondary" disabled={readOnly} title={readOnlyReason ?? 'Set brightness, contrast, saturation and amount back to neutral'} onClick={() => replace(resetColorCorrection(effect))}>
              Reset
            </button>
            <button type="button" className="btn-secondary" disabled={readOnly} title={readOnlyReason ?? 'Remove the colour correction (its mask stays)'} onClick={() => replace(undefined)}>
              Remove
            </button>
          </div>

          <div className="color-correction-scope">
            <label className="form-label" htmlFor={`cc-scope-${part.id}`}>APPLIES TO</label>
            <select
              id={`cc-scope-${part.id}`}
              className="select-control"
              aria-label="Color correction applies to"
              disabled={readOnly}
              value={effect.scope === 'mask' ? effect.maskId ?? '' : '__layer__'}
              onChange={(event) => {
                const value = event.target.value;
                replace(value === '__layer__' ? { ...effect, scope: 'layer', maskId: undefined } : { ...effect, scope: 'mask', maskId: value });
              }}
            >
              <option value="__layer__">Whole layer</option>
              {masks.map((mask) => (
                <option key={mask.id} value={mask.id}>
                  {`Inside ${mask.name}${isEffectOnlyMask(mask) ? ' (effect only)' : ' (also cuts the layer)'}`}
                </option>
              ))}
              {effect.scope === 'mask' && !masks.some((mask) => mask.id === effect.maskId) && (
                <option value={effect.maskId ?? ''}>Missing mask</option>
              )}
            </select>
          </div>
          <div className="color-correction-draw" role="group" aria-label="Draw an effect mask">
            <span className="form-label">EFFECT MASK</span>
            {DRAW_SHAPES.map(({ shape, label }) => (
              <button
                key={shape}
                type="button"
                className={drawingEffectMask === shape ? 'btn-primary' : 'btn-secondary'}
                aria-pressed={drawingEffectMask === shape}
                aria-label={`Draw ${label.toLowerCase()} effect mask`}
                disabled={readOnly}
                title={readOnlyReason ?? `Draw a ${label.toLowerCase()} on the canvas that limits the correction; it does not cut the image`}
                onClick={() => onDrawEffectMask(shape)}
              >
                {label}
              </button>
            ))}
          </div>
          {(status.kind === 'missing-mask' || status.kind === 'disabled-mask') && (
            <p className="color-correction-status" role="status" data-testid="color-correction-status">{status.message}</p>
          )}

          {SLIDERS.map(({ field, label, scale, unit }) => {
            const range = COLOR_CORRECTION_RANGES[field];
            const value = resolvedParameters(effect)[field];
            const shown = Math.round(value * scale);
            return (
              <div key={field} className="matte-field color-correction-slider">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{label.toUpperCase()}</span>
                  <span className="color-correction-value">{field === 'brightness' && shown > 0 ? '+' : ''}{shown}{unit}</span>
                </label>
                <input
                  {...sliderGesture}
                  type="range"
                  aria-label={label}
                  min={range.min * scale}
                  max={range.max * scale}
                  step={1}
                  value={shown}
                  disabled={readOnly}
                  onChange={(event) => replace({ ...effect, [field]: Number(event.target.value) / scale })}
                  style={{ width: '100%' }}
                />
              </div>
            );
          })}
        </div>
      )}
    </StyleCard>
  );
};
