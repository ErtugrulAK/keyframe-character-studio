import React from 'react';
import { Scissors, X } from 'lucide-react';
import type { CharacterPart, MatteMode, PartMatte } from '../../../../types/animator';
import { resolveMatteMode, normalizeFeather, isMatteEligible, normalizeStrength, normalizeGradientAngle } from '../../../../utils/matte';
import { StyleCard } from './StyleCard';

interface StyleMatteSectionProps {
  selectedPart: CharacterPart;
  characterParts: CharacterPart[];
  onPartPropChange: (key: keyof CharacterPart, value: any) => void;
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  height: 28,
  background: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  borderRadius: 4,
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  padding: '0 6px',
};

/**
 * M11 Step 3 — Track Matte editor UI.
 *
 * Lets the user assign another SHAPE part as this part's clip source.
 * Only parts with static shape geometry (shapeGeometry single source) are
 * eligible; the part itself is never listed; freeform/text/image/video
 * sources are excluded for the MVP.
 *
 * Updates go through the generic part-prop channel (handlePartPropChange)
 * so undo/redo is captured automatically by the existing history system.
 */
export const StyleMatteSection: React.FC<StyleMatteSectionProps> = ({
  selectedPart,
  characterParts,
  onPartPropChange,
}) => {
  const matte = selectedPart.matte;

  // M15 3D: eligible = static shape geometry OR custom_freeform (points-based).
  // Self-reference still excluded. Text/image/video stay ineligible.
  const eligibleSources = characterParts.filter(
    (p) => p.id !== selectedPart.id && isMatteEligible(p),
  );

  const sourceMissing = !!matte && !characterParts.some((p) => p.id === matte.sourcePartId);

  const setMatte = (next: PartMatte | undefined) => {
    onPartPropChange('matte', next);
  };

  const onSelectSource = (sourcePartId: string) => {
    if (!sourcePartId) {
      // "None" → remove the matte entirely (no half/empty matte object)
      setMatte(undefined);
      return;
    }
    if (matte) {
      // M15 3D — field preservation: only sourcePartId changes; mode /
      // inverted / enabled / feather are kept (source swap must not reset).
      setMatte({ ...matte, sourcePartId });
    } else {
      setMatte({ sourcePartId, mode: 'clip', enabled: true });
    }
  };

  const onToggleEnabled = () => {
    if (!matte) return;
    setMatte({ ...matte, enabled: matte.enabled === false ? true : false });
  };

  const onChangeMode = (mode: MatteMode) => {
    if (!matte) return;
    // Preserve sourcePartId / enabled / inverted — only mode changes
    setMatte({ ...matte, mode });
  };

  const onToggleInverted = () => {
    if (!matte) return;
    setMatte({ ...matte, inverted: matte.inverted === true ? false : true });
  };

  const onChangeFeather = (value: number) => {
    if (!matte) return;
    // Preserve sourcePartId / mode / inverted / enabled — only feather changes
    setMatte({ ...matte, feather: value });
  };

  const onChangeStrength = (value: number) => {
    if (!matte) return;
    // Preserve sourcePartId / mode / inverted / enabled / feather — only strength changes
    setMatte({ ...matte, strength: value });
  };

  // M17 gradient: matte.gradient is the ONLY source of truth (no local state).
  // Toggle OFF → gradient: undefined; ON → fresh { angle: 0 } (the angle is
  // stored ON the gradient object, so re-enabling starts at 0 — no local
  // memory by design).
  const onToggleGradient = () => {
    if (!matte) return;
    if (matte.gradient) {
      setMatte({ ...matte, gradient: undefined });
    } else {
      setMatte({ ...matte, gradient: { angle: 0 } });
    }
  };

  const onChangeGradientAngle = (value: number) => {
    if (!matte) return;
    // Preserve every other matte field — only the angle changes; the slider
    // writes the NORMALIZED angle (360 ≡ 0) via the shared pure helper.
    setMatte({ ...matte, gradient: { ...matte.gradient, angle: normalizeGradientAngle(value) ?? 0 } });
  };

  const onRemove = () => setMatte(undefined);

  const selectValue = matte && !sourceMissing ? matte.sourcePartId : '';
  // Runtime-resolved values — legacy data without mode/inverted shows Clip / OFF
  const modeValue = matte ? resolveMatteMode(matte) ?? 'clip' : 'clip';
  const invertedValue = matte?.inverted === true;
  // Feather: normalized for display — negative/NaN/Infinity/undefined → 0.
  // The raw value is written back only when the user moves the slider (no
  // automatic serialization migration of legacy data).
  const featherValue = normalizeFeather(matte?.feather);
  // M14 renderer applies feather ONLY on the alpha/luminance <mask> pipeline
  // (StagePartLayers: clip mode is a pure clipPath — feGaussianBlur cannot
  // blur a clip). The control stays visible but disabled in Clip mode so the
  // user's value is preserved for when they switch to Alpha/Luminance.
  const featherDisabled = modeValue === 'clip';
  // M16 strength: 0-1 → 0-100% display. undefined/legacy → 100% (full
  // strength); 0 is VALID (matte disabled) — never collapse with `||`.
  // Same clip-mode rule: clipPath cannot express opacity → disabled in Clip.
  const strengthValue = Math.round(normalizeStrength(matte?.strength) * 100);
  const strengthDisabled = modeValue === 'clip';
  // M17 gradient: matte.gradient is the ONLY source of truth. Displayed angle
  // is the normalized value (undefined/absent → 0 for the control readout).
  const gradientEnabled = matte?.gradient !== undefined;
  const gradientDisabled = modeValue === 'clip';
  const angleValue = Math.round(normalizeGradientAngle(matte?.gradient?.angle) ?? 0);

  return (
    <StyleCard title="TRACK MATTE" icon={<Scissors size={13} />} color="#00d2ff">
      <div className="form-field-group">
        <label className="form-label">MATTE SOURCE</label>
        <select className="select-control" style={selectStyle} value={selectValue} onChange={(e) => onSelectSource(e.target.value)}>
          <option value="">None</option>
          {eligibleSources.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {sourceMissing && (
          <div style={{ marginTop: 6, fontSize: 11, color: '#f59e0b' }}>
            Missing source ({matte!.sourcePartId}) — clip not applied
          </div>
        )}

        {matte && !sourceMissing && (
          <>
            <div style={{ marginTop: 10 }}>
              <label className="form-label">MODE</label>
              <select
                className="select-control"
                style={selectStyle}
                value={modeValue}
                onChange={(e) => onChangeMode(e.target.value as MatteMode)}
              >
                <option value="clip">Clip</option>
                <option value="alpha">Alpha</option>
                <option value="luminance">Luminance</option>
              </select>
            </div>

            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>INVERTED</label>
              <input
                type="checkbox"
                aria-label="Inverted"
                checked={invertedValue}
                onChange={onToggleInverted}
                style={{ accentColor: '#00d2ff' }}
              />
            </div>

            <div className="form-field-group" style={{ marginTop: 8 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>FEATHER</span>
                <span style={{ color: '#00d2ff', fontWeight: 800, opacity: featherDisabled ? 0.45 : 1 }}>{featherValue}px</span>
              </label>
              <input
                type="range"
                aria-label="Feather"
                min={0}
                max={100}
                step={1}
                value={featherValue}
                disabled={featherDisabled}
                onChange={(e) => onChangeFeather(parseInt(e.target.value, 10))}
                style={{ width: '100%', cursor: featherDisabled ? 'not-allowed' : 'pointer', opacity: featherDisabled ? 0.45 : 1 }}
              />
            </div>

            <div className="form-field-group" style={{ marginTop: 8 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>STRENGTH</span>
                <span style={{ color: '#00d2ff', fontWeight: 800, opacity: strengthDisabled ? 0.45 : 1 }}>{strengthValue}%</span>
              </label>
              <input
                type="range"
                aria-label="Strength"
                min={0}
                max={100}
                step={1}
                value={strengthValue}
                disabled={strengthDisabled}
                onChange={(e) => onChangeStrength(parseInt(e.target.value, 10) / 100)}
                style={{ width: '100%', cursor: strengthDisabled ? 'not-allowed' : 'pointer', opacity: strengthDisabled ? 0.45 : 1 }}
              />
            </div>

            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>GRADIENT</label>
              <input
                type="checkbox"
                aria-label="Gradient"
                checked={gradientEnabled}
                disabled={gradientDisabled}
                onChange={onToggleGradient}
                style={{ accentColor: '#00d2ff' }}
              />
            </div>

            {gradientEnabled && (
              <div className="form-field-group" style={{ marginTop: 8 }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>ANGLE</span>
                  <span style={{ color: '#00d2ff', fontWeight: 800, opacity: gradientDisabled ? 0.45 : 1 }}>{angleValue}°</span>
                </label>
                <input
                  type="range"
                  aria-label="Gradient angle"
                  min={0}
                  max={360}
                  step={1}
                  value={angleValue}
                  disabled={gradientDisabled}
                  onChange={(e) => onChangeGradientAngle(parseInt(e.target.value, 10))}
                  style={{ width: '100%', cursor: gradientDisabled ? 'not-allowed' : 'pointer', opacity: gradientDisabled ? 0.45 : 1 }}
                />
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: '#cbd5e1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                aria-label="Enabled"
                checked={matte.enabled !== false}
                onChange={onToggleEnabled}
                style={{ accentColor: '#00d2ff' }}
              />
              Enabled
            </label>
          </>
        )}
      </div>

      {matte && (
        <div style={{ marginTop: 8 }}>
          <button
            className="btn-icon-small danger"
            onClick={onRemove}
            title="Remove Track Matte"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}
          >
            <X size={12} />
            Remove
          </button>
        </div>
      )}
    </StyleCard>
  );
};
