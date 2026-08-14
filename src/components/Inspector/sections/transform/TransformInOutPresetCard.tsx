import React from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TransformInOutPresetCardProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: any) => void;
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
 * No keyframes are created, no channels are added, no engine changes.
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
}) => {
  // derive directly from the selected part — no local state mirror
  const inPreset = selectedPart.inAnimPreset ?? 'none';
  const outPreset = selectedPart.outAnimPreset ?? 'none';
  const inDur = selectedPart.inAnimDuration ?? 30;
  const outDur = selectedPart.outAnimDuration ?? 30;

  // internal values (custom_timeline) are not in the option list — display the
  // safe fallback without mutating the part
  const inDisplay = ALL_PRESETS.some((p) => p.value === inPreset) ? inPreset : 'none';
  const outDisplay = ALL_PRESETS.some((p) => p.value === outPreset) ? outPreset : 'none';

  const presetOptions = (
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
    </>
  );

  return (
    <div className="panel-card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: '0.6px', marginBottom: 2 }}>
          ANIMATION IN / OUT
        </div>

        {/* IN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="form-field-group" style={rowStyle}>
            <span className="form-label text-gold" style={labelStyle}>IN PRESET</span>
            <select
              className="select-control"
              aria-label="Animation In Preset"
              value={inDisplay}
              onChange={(e) => onPartPropChange('inAnimPreset', e.target.value)}
              style={{ maxWidth: 150 }}
            >
              {presetOptions}
            </select>
          </div>
          <div className="form-field-group" style={rowStyle}>
            <span className="form-label text-gold" style={labelStyle}>IN DURATION (FRAMES)</span>
            <div style={{ flex: 1, minWidth: 0, maxWidth: 110 }}>
              <SmartNumberInput
                ariaLabel="Animation In Duration"
                value={inDur}
                min={0}
                max={MAX_DURATION}
                step={1}
                precision={0}
                deferCommit
                onChange={(val) => onPartPropChange('inAnimDuration', val)}
              />
            </div>
          </div>
        </div>

        {/* OUT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="form-field-group" style={rowStyle}>
            <span className="form-label text-gold" style={labelStyle}>OUT PRESET</span>
            <select
              className="select-control"
              aria-label="Animation Out Preset"
              value={outDisplay}
              onChange={(e) => onPartPropChange('outAnimPreset', e.target.value)}
              style={{ maxWidth: 150 }}
            >
              {presetOptions}
            </select>
          </div>
          <div className="form-field-group" style={rowStyle}>
            <span className="form-label text-gold" style={labelStyle}>OUT DURATION (FRAMES)</span>
            <div style={{ flex: 1, minWidth: 0, maxWidth: 110 }}>
              <SmartNumberInput
                ariaLabel="Animation Out Duration"
                value={outDur}
                min={0}
                max={MAX_DURATION}
                step={1}
                precision={0}
                deferCommit
                onChange={(val) => onPartPropChange('outAnimDuration', val)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
