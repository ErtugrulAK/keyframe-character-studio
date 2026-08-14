import React, { useState } from 'react';
import type { CharacterPart, CustomMotionPreset } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { builtinPresetToCustomKeyframes } from '../../../../utils/presetConversion';
import type { SavePresetInput } from '../../../../hooks/usePresets';
import { DEFAULT_INITIAL_PRESETS } from '../../../../context/initialStateData';

interface TransformInOutPresetCardProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: any) => void;
  // M25 — user-saved custom preset library (25A data layer + 25C UI)
  customPresets: CustomMotionPreset[];
  onSavePreset: (input: SavePresetInput) => CustomMotionPreset | null;
  onDeletePreset: (id: string) => void;
}

/**
 * M23 — IN / OUT animation presets.
 *
 * Exposes the EXISTING procedural animation engine (computeProceduralDelta /
 * applyEditPreset in proceduralAnimation.ts) through the Inspector. Setting
 * inAnimPreset/outAnimPreset/inAnimDuration/outAnimDuration is a plain
 * onPartPropChange → atomic history entry; the timeline beginning/end preview
 * and the broadcast state machine consume the SAME fields automatically.
 *
 * M25 — adds the "Custom" optgroup (user-saved presets from the existing
 * custom preset library). Saving converts the CURRENT selected animation
 * behavior into a standalone CustomMotionPreset (independent of the builtin
 * id); deleting only ever removes custom presets, never builtins.
 *
 * `custom_timeline` is intentionally NOT exposed (internal/advanced semantics);
 * a part that already carries it keeps its value untouched — the select just
 * displays the closest safe option until the user changes it.
 */

const BASIC_PRESETS: { value: string; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'slide-down', label: 'Slide Down' },
  { value: 'pop', label: 'Pop' },
  { value: 'spin', label: 'Spin' },
];

// M24 — builtin COMBINATION presets (Option A IDs from proceduralAnimation).
// Only genuinely NEW behavior: fade+slide ≡ slide and fade+scale ≡ pop
// (every builtin already carries opacity=eased), so those are NOT offered.
const COMBO_PRESETS: { value: string; label: string }[] = [
  { value: 'slide-scale-left', label: 'Slide + Scale Left' },
  { value: 'slide-scale-right', label: 'Slide + Scale Right' },
  { value: 'soft-pop', label: 'Soft Pop' },
];

const ALL_PRESETS = [...BASIC_PRESETS, ...COMBO_PRESETS];

const MAX_DURATION = 1000;

const rowStyle: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border-color)',
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm)',
  justifyContent: 'space-between',
  margin: 0,
};

const labelStyle: React.CSSProperties = { fontSize: 9 };

export const TransformInOutPresetCard: React.FC<TransformInOutPresetCardProps> = ({
  selectedPart,
  onPartPropChange,
  customPresets,
  onSavePreset,
  onDeletePreset,
}) => {
  // derive directly from the selected part — no local state mirror
  const inPreset = selectedPart.inAnimPreset ?? 'none';
  const outPreset = selectedPart.outAnimPreset ?? 'none';
  const inDur = selectedPart.inAnimDuration ?? 30;
  const outDur = selectedPart.outAnimDuration ?? 30;

  // M25 — transient UI state for the compact save dialog (name input only;
  // the preset collection itself stays in usePresets — no second state)
  const [saveTarget, setSaveTarget] = useState<'in' | 'out' | null>(null);
  const [saveName, setSaveName] = useState('');

  // M25 — the Custom optgroup lists ONLY user-saved presets. The collection
  // is seeded with DEFAULT_INITIAL_PRESETS (builtin custom presets used by
  // the runtime/broadcast) — those are NOT user-owned and must not appear as
  // "Custom" (nor get the Delete control). 25A's collision guard guarantees
  // user ids never equal default ids, so id-based exclusion is safe and the
  // default list stays the single authority.
  const isUserPreset = (p: CustomMotionPreset) =>
    !DEFAULT_INITIAL_PRESETS.some((d) => d.id === p.id);
  const customIn = customPresets.filter((p) => p.type === 'in' && isUserPreset(p));
  const customOut = customPresets.filter((p) => p.type === 'out' && isUserPreset(p));

  // internal values (custom_timeline) / deleted custom ids are not in the
  // option list — display the safe fallback without mutating the part
  const isKnownValue = (id: string, customs: CustomMotionPreset[]) =>
    ALL_PRESETS.some((p) => p.value === id) || customs.some((p) => p.id === id);
  const inDisplay = isKnownValue(inPreset, customIn) ? inPreset : 'none';
  const outDisplay = isKnownValue(outPreset, customOut) ? outPreset : 'none';

  const isCustom = (id: string, customs: CustomMotionPreset[]) =>
    customs.some((p) => p.id === id);
  const inIsCustom = isCustom(inPreset, customIn);
  const outIsCustom = isCustom(outPreset, customOut);

  const customOptions = (customs: CustomMotionPreset[]) =>
    customs.length > 0 ? (
      <optgroup label="Custom">
        {customs.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </optgroup>
    ) : null;

  const presetOptionsFor = (customs: CustomMotionPreset[]) => (
    <>
      <optgroup label="Basic">
        {BASIC_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </optgroup>
      <optgroup label="Combinations">
        {COMBO_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </optgroup>
      {customOptions(customs)}
    </>
  );

  // Save the CURRENT selected animation behavior as a standalone custom
  // preset: builtin ids are sampled into keyframes via the existing runtime
  // (independent of the builtin code); already-custom ids are cloned as-is.
  const handleSave = () => {
    if (!saveTarget) return;
    const isIn = saveTarget === 'in';
    const currentId = isIn ? inPreset : outPreset;
    const duration = isIn ? inDur : outDur;
    const existing = customPresets.find((p) => p.id === currentId);
    const keyframes = existing
      ? structuredClone(existing.keyframes)
      : builtinPresetToCustomKeyframes(currentId, duration, saveTarget);
    onSavePreset({
      name: saveName.trim(),
      type: saveTarget,
      durationFrames: duration,
      keyframes,
    });
    setSaveTarget(null);
    setSaveName('');
  };

  const renderPresetRow = (which: 'in' | 'out') => {
    const isIn = which === 'in';
    const preset = isIn ? inPreset : outPreset;
    const duration = isIn ? inDur : outDur;
    const customs = isIn ? customIn : customOut;
    const isCustomSelected = isIn ? inIsCustom : outIsCustom;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="form-field-group" style={rowStyle}>
          <span className="form-label text-gold" style={labelStyle}>{isIn ? 'IN' : 'OUT'} PRESET</span>
          <select
            className="select-control"
            aria-label={isIn ? 'Animation In Preset' : 'Animation Out Preset'}
            value={isIn ? inDisplay : outDisplay}
            onChange={(e) => onPartPropChange(isIn ? 'inAnimPreset' : 'outAnimPreset', e.target.value)}
            style={{ maxWidth: 150 }}
          >
            {presetOptionsFor(customs)}
          </select>
        </div>
        <div className="form-field-group" style={rowStyle}>
          <span className="form-label text-gold" style={labelStyle}>{isIn ? 'IN' : 'OUT'} DURATION (FRAMES)</span>
          <div style={{ flex: 1, minWidth: 0, maxWidth: 110 }}>
            <SmartNumberInput
              ariaLabel={isIn ? 'Animation In Duration' : 'Animation Out Duration'}
              value={duration}
              min={0}
              max={MAX_DURATION}
              step={1}
              precision={0}
              deferCommit
              onChange={(val) => onPartPropChange(isIn ? 'inAnimDuration' : 'outAnimDuration', val)}
            />
          </div>
        </div>
        {/* M25 — compact save / delete controls for this IN/OUT slot */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ height: 24, fontSize: 10, fontWeight: 700, padding: '0 8px', borderRadius: 4 }}
            title="Save current animation as a custom preset"
            onClick={() => { setSaveTarget(which); setSaveName(''); }}
          >
            Save Current as Preset
          </button>
          {isCustomSelected && (
            <button
              type="button"
              className="btn-secondary"
              style={{ height: 24, fontSize: 10, fontWeight: 700, padding: '0 8px', borderRadius: 4, color: '#f87171' }}
              title="Delete this custom animation preset"
              aria-label="Delete Animation Preset"
              onClick={() => onDeletePreset(preset)}
            >
              Delete Preset
            </button>
          )}
        </div>
        {/* M25 — compact save dialog (transient UI state only) */}
        {saveTarget === which && (
          <div
            className="form-field-group"
            style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}
            role="dialog"
            aria-label="Save Animation Preset"
          >
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-primary)' }}>
              Save Animation Preset ({isIn ? 'IN' : 'OUT'})
            </span>
            <input
              className="input-control"
              style={{ width: '100%', height: 24, fontSize: 11 }}
              placeholder="Preset name"
              aria-label="Preset Name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ height: 22, fontSize: 10, fontWeight: 700, padding: '0 8px', borderRadius: 4 }}
                onClick={() => setSaveTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ height: 22, fontSize: 10, fontWeight: 700, padding: '0 8px', borderRadius: 4 }}
                disabled={saveName.trim().length === 0}
                onClick={handleSave}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="panel-card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: '0.6px', marginBottom: 2 }}>
          ANIMATION IN / OUT
        </div>

        {renderPresetRow('in')}
        {renderPresetRow('out')}
      </div>
    </div>
  );
};
