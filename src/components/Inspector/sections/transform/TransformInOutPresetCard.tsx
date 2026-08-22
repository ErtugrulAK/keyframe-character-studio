import React, { useCallback, useEffect, useState, useRef } from 'react';
import type { CharacterPart, CustomMotionPreset } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { builtinPresetToCustomKeyframes } from '../../../../utils/presetConversion';
import type { SavePresetInput, UpdatePresetInput } from '../../../../hooks/usePresets';
import { buildPresetExportPayload, validatePresetImportPayload, mergeImportedPresets, isDefaultPresetId } from '../../../../utils/presetExportImport';

interface TransformInOutPresetCardProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: any) => void;
  // M25 — user-saved custom preset library (25A data layer + 25C UI)
  customPresets: CustomMotionPreset[];
  onSavePreset: (input: SavePresetInput) => CustomMotionPreset | null;
  onUpdatePreset?: (id: string, input: UpdatePresetInput) => CustomMotionPreset | null;
  onDeletePreset: (id: string) => void;
  // M26 — copy/paste/clear ANIMATION (26A data layer + 26B UI)
  onCopyAnimation?: () => void;
  onPasteAnimation?: () => void;
  onClearAnimation?: () => void;
  clipboardSourceId?: string | null;
  // M30 — custom preset library export/import (30A pure helpers + 30B UI)
  onImportPresets?: (presets: CustomMotionPreset[]) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
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
  onUpdatePreset,
  onDeletePreset,
  onCopyAnimation,
  onPasteAnimation,
  onClearAnimation,
  clipboardSourceId,
  onImportPresets,
  showToast,
}) => {
  // derive directly from the selected part — no local state mirror
  const inPreset = selectedPart.inAnimPreset ?? 'none';
  const outPreset = selectedPart.outAnimPreset ?? 'none';
  const inDur = selectedPart.inAnimDuration ?? 30;
  const outDur = selectedPart.outAnimDuration ?? 30;

  // M25 — transient UI state for the compact save dialog (name input only;
  // the preset collection itself stays in usePresets — no second state)
  const [saveContext, setSaveContext] = useState<{
    which: 'in' | 'out';
    partId: string;
    presetId: string;
    duration: number;
  } | null>(null);
  const [saveName, setSaveName] = useState('');
  const [saveCategory, setSaveCategory] = useState('');
  const [editContext, setEditContext] = useState<{
    which: 'in' | 'out';
    partId: string;
    presetId: string;
  } | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');

  // M25 — the Custom optgroup lists ONLY user-saved presets. The collection
  // is seeded with DEFAULT_INITIAL_PRESETS (builtin custom presets used by
  // the runtime/broadcast) — those are NOT user-owned and must not appear as
  // "Custom" (nor get the Delete control). 25A's collision guard guarantees
  // user ids never equal default ids, so id-based exclusion is safe and the
  // default list stays the single authority (shared isDefaultPresetId — M30).
  const isUserPreset = (p: CustomMotionPreset) => !isDefaultPresetId(p.id);
  const customIn = customPresets.filter((p) => p.type === 'in' && isUserPreset(p));
  const customOut = customPresets.filter((p) => p.type === 'out' && isUserPreset(p));

  // internal values (custom_timeline) / deleted custom ids are not in the
  // option list — display the safe fallback without mutating the part
  const isKnownValue = (id: string, customs: CustomMotionPreset[]) =>
    ALL_PRESETS.some((p) => p.value === id) || customs.some((p) => p.id === id);
  const hasPresetSource = useCallback((id: string) => (
    id === 'custom_timeline'
    || ALL_PRESETS.some((preset) => preset.value === id)
    || customPresets.some((preset) => preset?.id === id)
  ), [customPresets]);
  const inDisplay = isKnownValue(inPreset, customIn) ? inPreset : 'none';
  const outDisplay = isKnownValue(outPreset, customOut) ? outPreset : 'none';

  const isCustom = (id: string, customs: CustomMotionPreset[]) =>
    customs.some((p) => p.id === id);
  const inIsCustom = isCustom(inPreset, customIn);
  const outIsCustom = isCustom(outPreset, customOut);

  const customOptions = (customs: CustomMotionPreset[]) => {
    const groups = new Map<string, CustomMotionPreset[]>();
    for (const preset of customs) {
      const category = preset.category?.trim() ?? '';
      const group = groups.get(category);
      if (group) group.push(preset);
      else groups.set(category, [preset]);
    }
    return [...groups.entries()].map(([category, presets]) => (
      <optgroup
        key={category || '__uncategorized'}
        label={category ? `Custom · ${category}` : 'Custom'}
      >
        {presets.map((preset) => (
          <option key={preset.id} value={preset.id}>{preset.name}</option>
        ))}
      </optgroup>
    ));
  };

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

  // Save the animation behavior that opened the dialog. The identity context
  // prevents part/preset/duration changes from silently retargeting sampling.
  const closeSavePreset = useCallback(() => {
    setSaveContext(null);
    setSaveName('');
    setSaveCategory('');
  }, []);

  const openSavePreset = (which: 'in' | 'out') => {
    const presetId = which === 'in' ? inPreset : outPreset;
    const duration = which === 'in' ? inDur : outDur;
    if (!hasPresetSource(presetId)) return;
    setSaveContext({ which, partId: selectedPart.id, presetId, duration });
    setSaveName('');
    setSaveCategory('');
  };

  useEffect(() => {
    if (!saveContext) return;
    const selectedPresetId = saveContext.which === 'in' ? inPreset : outPreset;
    const selectedDuration = saveContext.which === 'in' ? inDur : outDur;
    if (
      selectedPart.id !== saveContext.partId
      || selectedPresetId !== saveContext.presetId
      || selectedDuration !== saveContext.duration
      || !hasPresetSource(saveContext.presetId)
    ) {
      closeSavePreset();
    }
  }, [closeSavePreset, hasPresetSource, inDur, inPreset, outDur, outPreset, saveContext, selectedPart.id]);

  const handleSave = () => {
    if (!saveContext) return;
    const selectedPresetId = saveContext.which === 'in' ? inPreset : outPreset;
    const selectedDuration = saveContext.which === 'in' ? inDur : outDur;
    if (
      selectedPart.id !== saveContext.partId
      || selectedPresetId !== saveContext.presetId
      || selectedDuration !== saveContext.duration
      || !hasPresetSource(saveContext.presetId)
    ) {
      closeSavePreset();
      return;
    }
    const existing = customPresets.find((preset) => preset.id === saveContext.presetId);
    const keyframes = existing
      ? structuredClone(existing.keyframes)
      : builtinPresetToCustomKeyframes(
        saveContext.presetId,
        saveContext.duration,
        saveContext.which,
      );
    onSavePreset({
      name: saveName.trim(),
      type: saveContext.which,
      category: saveCategory,
      durationFrames: saveContext.duration,
      keyframes,
    });
    closeSavePreset();
  };

  const closeEditPreset = useCallback(() => {
    setEditContext(null);
    setEditName('');
    setEditCategory('');
  }, []);

  const openEditPreset = (which: 'in' | 'out', presetId: string) => {
    const preset = customPresets.find((candidate) => candidate.id === presetId);
    if (!preset || !isUserPreset(preset)) return;
    setEditContext({ which, partId: selectedPart.id, presetId });
    setEditName(preset.name);
    setEditCategory(preset.category ?? '');
  };

  useEffect(() => {
    if (!editContext) return;
    const selectedPresetId = editContext.which === 'in' ? inPreset : outPreset;
    const targetStillExists = customPresets.some((preset) => (
      preset.id === editContext.presetId && isUserPreset(preset)
    ));
    if (
      selectedPart.id !== editContext.partId
      || selectedPresetId !== editContext.presetId
      || !targetStillExists
    ) {
      closeEditPreset();
    }
  }, [closeEditPreset, customPresets, editContext, inPreset, outPreset, selectedPart.id]);

  const handleEditPreset = () => {
    if (!editContext) return;
    const selectedPresetId = editContext.which === 'in' ? inPreset : outPreset;
    if (
      selectedPart.id !== editContext.partId
      || selectedPresetId !== editContext.presetId
    ) {
      closeEditPreset();
      return;
    }
    const updated = onUpdatePreset?.(editContext.presetId, {
      name: editName,
      category: editCategory,
    });
    if (!updated) return;
    closeEditPreset();
  };

  // M30 — export the user custom preset library as a versioned JSON file.
  // 30A pure helper owns user/default filtering; no history, no scene change.
  const handleExport = () => {
    const payload = buildPresetExportPayload(customPresets);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kcs-custom-presets.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    if (showToast) showToast(`Exported ${payload.presets.length} presets`, 'success');
  };

  // M30 — import: hidden file input → whole-file validation (30A) → merge
  // (30A) → existing usePresets persistence. Invalid → import NOTHING.
  const importFileRef = useRef<HTMLInputElement | null>(null);

  const handleImportFile = async (file: File) => {
    try {
      const raw: unknown = JSON.parse(await file.text());
      const validated = validatePresetImportPayload(raw);
      if (!validated.ok) {
        if (showToast) showToast(`Could not import presets: ${validated.error}`, 'error');
        return;
      }
      const merged = mergeImportedPresets(customPresets, validated.presets);
      if (onImportPresets) onImportPresets(merged);
      if (showToast) showToast(`Imported ${validated.presets.length} presets`, 'success');
    } catch {
      if (showToast) showToast('Could not import presets: invalid JSON file', 'error');
    }
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
            onClick={() => openSavePreset(which)}
          >
            Save Current as Preset
          </button>
          {isCustomSelected && onUpdatePreset && (
            <button
              type="button"
              className="btn-secondary"
              style={{ height: 24, fontSize: 10, fontWeight: 700, padding: '0 8px', borderRadius: 4 }}
              title="Edit this custom animation preset"
              aria-label="Edit Animation Preset"
              onClick={() => openEditPreset(which, preset)}
            >
              Edit Preset
            </button>
          )}
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
        {saveContext?.which === which && (
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
            <input
              className="input-control"
              style={{ width: '100%', height: 24, fontSize: 11 }}
              placeholder="Category (optional)"
              aria-label="Preset Category"
              value={saveCategory}
              onChange={(e) => setSaveCategory(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ height: 22, fontSize: 10, fontWeight: 700, padding: '0 8px', borderRadius: 4 }}
                onClick={closeSavePreset}
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
        {editContext?.which === which && isCustomSelected && (
          <div
            className="form-field-group"
            style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}
            role="dialog"
            aria-label="Edit Animation Preset"
          >
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-primary)' }}>
              Edit Animation Preset
            </span>
            <input
              className="input-control"
              style={{ width: '100%', height: 24, fontSize: 11 }}
              aria-label="Edit Preset Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
            />
            <input
              className="input-control"
              style={{ width: '100%', height: 24, fontSize: 11 }}
              placeholder="Category (optional)"
              aria-label="Edit Preset Category"
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={closeEditPreset}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={editName.trim().length === 0}
                onClick={handleEditPreset}
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

        {/* M30 — export / import the user custom preset library (30A pure
            helpers own filtering/validation/collision; library ops — no
            history, no scene mutation). */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ height: 24, fontSize: 10, fontWeight: 700, padding: '0 8px', borderRadius: 4 }}
            title="Export custom animation presets"
            aria-label="Export Animation Presets"
            onClick={handleExport}
          >
            Export Presets
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ height: 24, fontSize: 10, fontWeight: 700, padding: '0 8px', borderRadius: 4 }}
            title="Import custom animation presets"
            aria-label="Import Animation Presets"
            onClick={() => importFileRef.current?.click()}
          >
            Import Presets
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            aria-label="Import custom animation presets file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              // allow re-selecting the SAME file to trigger change again
              e.target.value = '';
            }}
          />
        </div>

        {/* M26 — copy / paste / clear animation (26A data layer + 26B UI).
            Paste is disabled without a clipboard payload or when the target
            IS the clipboard source (no meaningless self-paste). */}
        {onCopyAnimation && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ height: 24, fontSize: 10, fontWeight: 700, padding: '0 8px', borderRadius: 4 }}
              title="Copy animation from this element"
              aria-label="Copy Animation"
              onClick={onCopyAnimation}
            >
              Copy Animation
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ height: 24, fontSize: 10, fontWeight: 700, padding: '0 8px', borderRadius: 4 }}
              title="Paste animation onto selected element"
              aria-label="Paste Animation"
              disabled={!clipboardSourceId || clipboardSourceId === selectedPart.id}
              onClick={onPasteAnimation}
            >
              Paste Animation
            </button>
            {onClearAnimation && (
              <button
                type="button"
                className="btn-secondary"
                style={{ height: 24, fontSize: 10, fontWeight: 700, padding: '0 8px', borderRadius: 4, color: '#f87171' }}
                title="Clear animation (IN/OUT presets, durations and keyframes)"
                aria-label="Clear Animation"
                onClick={onClearAnimation}
              >
                Clear Animation
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
