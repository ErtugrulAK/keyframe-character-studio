import React, { useEffect, useRef, useState } from 'react';
import { Diamond } from 'lucide-react';
import type { PartMatte } from '../../../../types/animator';
import { NumberField } from '../../inputs/NumberField';
import { normalizeFeather, normalizeStrength, normalizeGradientAngle, normalizeGradientStops, normalizeGradientType } from '../../../../utils/layers/matte';
import type { MatteGradientStop } from '../../../../utils/layers/matte';

/**
 * One keyframe button: 'off' (not animated), 'animated' (keys elsewhere) or
 * 'key' (a key at the playhead). The caller adds or removes the key.
 */
export interface MatteChannelKey {
  state: 'off' | 'animated' | 'key';
  onToggle: () => void;
}
export interface MatteChannelKeys {
  feather: MatteChannelKey;
  strength: MatteChannelKey;
  /** The linear gradient's angle; absent while there is no gradient. */
  angle?: MatteChannelKey;
}

const KEY_TITLES: Record<MatteChannelKey['state'], string> = {
  off: 'Animate: add a keyframe here',
  animated: 'Add a keyframe here',
  key: 'Remove the keyframe here',
};

/** The keyframe button beside a keyable field (After Effects' keyframe navigator). */
const KeyButton: React.FC<{ name: string; control: MatteChannelKey; disabled: boolean }> = ({ name, control, disabled }) => (
  <button
    type="button"
    className={`matte-key-button is-${control.state}`}
    aria-label={`${name} keyframe`}
    aria-pressed={control.state === 'key'}
    title={KEY_TITLES[control.state]}
    disabled={disabled}
    onClick={control.onToggle}
  >
    <Diamond size={11} aria-hidden="true" fill={control.state === 'key' ? 'currentColor' : 'none'} />
  </button>
);

/** The render parameters the Track Matte and the legacy matte share. */
export type MatteRenderParams = Pick<PartMatte, 'feather' | 'strength' | 'gradient'>;

interface MatteRenderControlsProps {
  /** The layer the controls edit: a different layer drops the transient angle display. */
  partId: string;
  value: MatteRenderParams;
  /** Selects the default stop ramp; 'clip' disables every control. */
  mode: 'clip' | 'alpha' | 'luminance';
  /** Writes a patch over the matte record; every other field is preserved by the caller. */
  onChange: (patch: MatteRenderParams) => void;
  rangeGesture: Pick<React.InputHTMLAttributes<HTMLInputElement>, 'onPointerDown' | 'onPointerUp' | 'onPointerCancel' | 'onBlur'>;
  compactSelectStyle: React.CSSProperties;
  /** FEATHER and STRENGTH keyframe buttons (Track Matte only); absent = not keyable. */
  channelKeys?: MatteChannelKeys;
}

/**
 * FEATHER, STRENGTH and GRADIENT (type, angle, stops) of a matte. The record's
 * own fields stay the only persisted authority; the one local state is the
 * transient angle display that keeps 360° at the slider's right edge while the
 * stored value normalizes to 0.
 */
export const MatteRenderControls: React.FC<MatteRenderControlsProps> = ({ partId, value, mode, onChange, rangeGesture, compactSelectStyle, channelKeys }) => {
  const gradient = value.gradient;
  const authoredAngle = normalizeGradientAngle(gradient?.angle) ?? 0;
  const angleSourceKey = `${partId}:${String(gradient?.angle)}`;
  const [angleDisplay, setAngleDisplay] = useState<number | null>(null);
  const pendingAngleUpdate = useRef<{ partId: string; value: number } | null>(null);
  const previousAngleSourceKey = useRef(angleSourceKey);

  // External part/project changes clear the local-only display, so the matte
  // record remains the sole persisted authority.
  useEffect(() => {
    if (angleSourceKey === previousAngleSourceKey.current) return;
    previousAngleSourceKey.current = angleSourceKey;
    if (
      pendingAngleUpdate.current
      && pendingAngleUpdate.current.partId === partId
      && pendingAngleUpdate.current.value === authoredAngle
    ) {
      pendingAngleUpdate.current = null;
      return;
    }
    pendingAngleUpdate.current = null;
    setAngleDisplay(null);
  }, [angleSourceKey, authoredAngle, partId]);

  // Clip is a pure clipPath: it cannot blur, fade or ramp. The controls stay
  // visible but disabled so the values survive a switch to Alpha/Luminance.
  const disabled = mode === 'clip';
  // Feather: negative/NaN/Infinity/undefined display as 0. Strength: 0-1 shown
  // as 0-100%; undefined is full strength and 0 is valid (never `||`).
  const featherValue = normalizeFeather(value.feather);
  const strengthValue = Math.round(normalizeStrength(value.strength) * 100);
  const gradientEnabled = gradient !== undefined;
  const gradientTypeValue = normalizeGradientType(gradient?.type);
  const angleValue = Math.round(angleDisplay ?? authoredAngle);
  // The displayed stops are always the normalized form; editing any stop
  // materializes `gradient.stops`, so an angle-only gradient stays untouched
  // until a stop is actually edited.
  const displayStops = gradient ? normalizeGradientStops(gradient.stops, mode === 'luminance' ? 'luminance' : 'alpha') : [];

  const onToggleGradient = () => {
    pendingAngleUpdate.current = null;
    setAngleDisplay(null);
    onChange({ gradient: gradient ? undefined : { angle: 0 } });
  };

  const onChangeGradientAngle = (next: number) => {
    if (!gradient) return;
    const clamped = Math.max(0, Math.min(360, next));
    const normalizedAngle = normalizeGradientAngle(clamped) ?? 0;
    pendingAngleUpdate.current = { partId, value: normalizedAngle };
    setAngleDisplay(clamped);
    onChange({ gradient: { ...gradient, angle: normalizedAngle } });
  };

  // Radial persists `type: 'radial'`; Linear is the canonical form with `type`
  // omitted (missing type ≡ linear). Stops and angle survive both ways.
  const onChangeGradientType = (next: string) => {
    if (!gradient) return;
    const type = normalizeGradientType(next);
    const { type: _oldType, ...linear } = gradient;
    onChange({ gradient: type === 'radial' ? { ...linear, type: 'radial' } : linear });
  };

  const writeStops = (stops: MatteGradientStop[]) => {
    if (!gradient) return;
    onChange({ gradient: { ...gradient, stops } });
  };

  // Add: the largest offset gap's midpoint, inheriting the left stop's paint. Max 4.
  const onAddStop = () => {
    if (!gradient || displayStops.length >= 4) return;
    let bestGap = -1, bestIdx = 0;
    for (let i = 0; i < displayStops.length - 1; i++) {
      const gap = displayStops[i + 1].offset - displayStops[i].offset;
      if (gap > bestGap) { bestGap = gap; bestIdx = i; }
    }
    const left = displayStops[bestIdx];
    const next = displayStops[bestIdx + 1];
    const offset = bestGap >= 0 ? (left.offset + next.offset) / 2 : 0.5;
    writeStops([
      ...displayStops.slice(0, bestIdx + 1),
      { offset, color: left.color, opacity: left.opacity },
      ...displayStops.slice(bestIdx + 1),
    ]);
  };

  const onRemoveStop = (index: number) => {
    if (!gradient || displayStops.length <= 2) return;
    writeStops(displayStops.filter((_, i) => i !== index));
  };

  const onChangeStop = (index: number, patch: Partial<MatteGradientStop>) => {
    if (!gradient) return;
    writeStops(displayStops.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)));
  };

  const dim = (off: boolean) => (off ? 0.45 : 1);
  const stopFieldStyle: React.CSSProperties = { width: 52, height: 22, background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: 11, padding: '0 4px' };

  return (
    <>
      <div className="matte-field">
        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="matte-key-label">FEATHER{channelKeys && <KeyButton name="Feather" control={channelKeys.feather} disabled={disabled} />}</span>
          <span style={{ color: '#4a8fe8', fontWeight: 600, opacity: dim(disabled) }}>{Math.round(featherValue)}px</span>
        </label>
        <input
          {...rangeGesture}
          type="range"
          aria-label="Feather"
          min={0}
          max={100}
          step={1}
          value={featherValue}
          disabled={disabled}
          onChange={(e) => onChange({ feather: parseInt(e.target.value, 10) })}
          style={{ width: '100%', cursor: disabled ? 'not-allowed' : 'pointer', opacity: dim(disabled) }}
        />
      </div>

      <div className="matte-field">
        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="matte-key-label">STRENGTH{channelKeys && <KeyButton name="Strength" control={channelKeys.strength} disabled={disabled} />}</span>
          <span style={{ color: '#4a8fe8', fontWeight: 600, opacity: dim(disabled) }}>{strengthValue}%</span>
        </label>
        <input
          {...rangeGesture}
          type="range"
          aria-label="Strength"
          min={0}
          max={100}
          step={1}
          value={strengthValue}
          disabled={disabled}
          onChange={(e) => onChange({ strength: parseInt(e.target.value, 10) / 100 })}
          style={{ width: '100%', cursor: disabled ? 'not-allowed' : 'pointer', opacity: dim(disabled) }}
        />
      </div>

      <div className="matte-toggle-field">
        <label className="form-label" style={{ margin: 0 }}>GRADIENT</label>
        <input
          type="checkbox"
          aria-label="Gradient"
          checked={gradientEnabled}
          disabled={disabled}
          onChange={onToggleGradient}
          style={{ accentColor: '#4a8fe8' }}
        />
      </div>

      {gradientEnabled && (
        <div className="matte-field matte-compact-field">
          <label className="form-label">TYPE</label>
          <select
            className="select-control"
            aria-label="Gradient type"
            style={compactSelectStyle}
            value={gradientTypeValue}
            disabled={disabled}
            onChange={(e) => onChangeGradientType(e.target.value)}
          >
            <option value="linear">Linear</option>
            <option value="radial">Radial</option>
          </select>
        </div>
      )}

      {gradientEnabled && gradientTypeValue === 'linear' && (
        <div className="matte-field">
          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="matte-key-label">ANGLE{channelKeys?.angle && <KeyButton name="Gradient angle" control={channelKeys.angle} disabled={disabled} />}</span>
            <span style={{ color: '#4a8fe8', fontWeight: 600, opacity: dim(disabled) }}>{angleValue}°</span>
          </label>
          <input
            {...rangeGesture}
            type="range"
            aria-label="Gradient angle"
            min={0}
            max={360}
            step={1}
            value={angleValue}
            disabled={disabled}
            onChange={(e) => onChangeGradientAngle(parseInt(e.target.value, 10))}
            style={{ width: '100%', cursor: disabled ? 'not-allowed' : 'pointer', opacity: dim(disabled) }}
          />
        </div>
      )}

      {gradientEnabled && displayStops.length > 0 && (
        <div className="matte-field matte-span-full">
          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>STOPS ({displayStops.length}/4)</span>
            <button
              className="btn-icon-small"
              aria-label="Add gradient stop"
              disabled={disabled || displayStops.length >= 4}
              onClick={onAddStop}
              style={{ fontSize: 11, padding: '1px 8px', opacity: dim(disabled || displayStops.length >= 4) }}
            >
              + Add
            </button>
          </label>
          {displayStops.map((stop, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <input
                type="color"
                aria-label={`Gradient stop ${i} color`}
                value={stop.color.startsWith('#') ? stop.color : '#ffffff'}
                disabled={disabled}
                onChange={(e) => onChangeStop(i, { color: e.target.value })}
                style={{ width: 26, height: 22, padding: 0, border: '1px solid var(--border-color)', background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer' }}
              />
              <NumberField
                aria-label={`Gradient stop ${i} offset`}
                min={0}
                max={1}
                step={0.05}
                value={Math.round(stop.offset * 100) / 100}
                disabled={disabled}
                onValue={(offset) => onChangeStop(i, { offset })}
                style={stopFieldStyle}
              />
              <NumberField
                aria-label={`Gradient stop ${i} opacity`}
                min={0}
                max={1}
                step={0.05}
                value={stop.opacity}
                disabled={disabled}
                onValue={(opacity) => onChangeStop(i, { opacity })}
                style={stopFieldStyle}
              />
              <button
                className="btn-icon-small"
                aria-label={`Remove gradient stop ${i}`}
                disabled={disabled || displayStops.length <= 2}
                onClick={() => onRemoveStop(i)}
                style={{ fontSize: 11, padding: '1px 6px', opacity: dim(disabled || displayStops.length <= 2) }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
