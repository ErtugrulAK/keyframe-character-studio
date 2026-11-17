import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Eye, Plus, Trash2, X } from 'lucide-react';
import { useAnimatorSlice } from '../../context/useAnimator';
import {
  addPreset,
  applyPresetTexts,
  cleanPresetName,
  deletePreset,
  presetLayers,
  presetNames,
  presetSlotsOf,
  renamePreset,
  setPresetValue,
} from '../../utils/layers/operatorPresets';

interface PlayoutPresetsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/** A text field that writes once, on Enter or when it loses focus (one undo step per change). */
const CommitField: React.FC<{ value: string; label: string; onCommit: (value: string) => void; className?: string }> = ({ value, label, onCommit, className }) => (
  <input
    key={value}
    type="text"
    className={className ?? 'playout-presets-input'}
    aria-label={label}
    defaultValue={value}
    onBlur={(event) => { if (event.target.value !== value) onCommit(event.target.value); }}
    onKeyDown={(event) => {
      if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
      if (event.key === 'Escape') {
        (event.target as HTMLInputElement).value = value;
        (event.target as HTMLInputElement).blur();
      }
    }}
  />
);

/**
 * Playout presets (File > Playout Presets…): named sets of values the
 * operator picks with one choice in the exported OGraf graphic. A row is a
 * layer a preset can set (a text, a counter, a show/hide switch), a column a
 * preset. Each layer keeps its own values (`utils/layers/operatorPresets`), so
 * every change is an ordinary, undoable layer edit. The panel floats beside
 * the work like History: no backdrop, Escape or its close button closes it.
 */
export const PlayoutPresetsPanel: React.FC<PlayoutPresetsPanelProps> = ({ isOpen, onClose }) => {
  const { characterParts, setCharacterParts, showToast } = useAnimatorSlice('characterParts', 'setCharacterParts', 'showToast');
  const [draftName, setDraftName] = useState('');
  if (!isOpen) return null;

  const layers = presetLayers(characterParts);
  const names = presetNames(characterParts);
  const nextDefaultName = () => {
    for (let index = names.length + 1; ; index += 1) {
      const candidate = `Preset ${index}`;
      if (!names.includes(candidate)) return candidate;
    }
  };

  const add = () => {
    const name = cleanPresetName(draftName) ?? nextDefaultName();
    if (names.includes(name)) {
      showToast(`A preset named "${name}" already exists.`, 'error');
      return;
    }
    setCharacterParts((parts) => addPreset(parts, name));
    setDraftName('');
  };
  const rename = (from: string, to: string) => {
    const name = cleanPresetName(to);
    if (!name || (name !== from && names.includes(name))) {
      showToast(name ? `A preset named "${name}" already exists.` : 'A preset needs a name.', 'error');
      return;
    }
    setCharacterParts((parts) => renamePreset(parts, from, name));
  };

  return ReactDOM.createPortal(
    <section
      className="history-panel playout-presets-panel"
      role="dialog"
      aria-label="Playout presets"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !(event.target instanceof HTMLInputElement)) {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="history-panel-header">
        <h2>Playout presets</h2>
        <button type="button" className="btn-icon" aria-label="Close playout presets" onClick={onClose}>
          <X size={14} />
        </button>
      </header>
      <p className="playout-presets-note">
        In the exported OGraf graphic the operator picks one preset and every value in its column is set at once.
      </p>
      {layers.length === 0 ? (
        <p className="playout-presets-note" role="note">Add a text layer, or mark a layer in Inspector › PLAYOUT, to give a preset something to set.</p>
      ) : (
        <div className="playout-presets-table-wrap">
          <table className="playout-presets-table">
            <thead>
              <tr>
                <th scope="col">Layer</th>
                {names.map((name) => (
                  <th key={name} scope="col">
                    <div className="playout-presets-head">
                      <CommitField value={name} label={`Preset name ${name}`} className="playout-presets-input playout-presets-name" onCommit={(value) => rename(name, value)} />
                      <button type="button" className="btn-icon" aria-label={`Show ${name} in the editor`} title="Show this preset's texts in the editor" onClick={() => setCharacterParts((parts) => applyPresetTexts(parts, name))}>
                        <Eye size={13} />
                      </button>
                      <button type="button" className="btn-icon" aria-label={`Delete preset ${name}`} title="Delete this preset" onClick={() => setCharacterParts((parts) => deletePreset(parts, name))}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {layers.map((layer) => {
                const slots = presetSlotsOf(layer);
                return (
                  <tr key={layer.id}>
                    <th scope="row" title={layer.name}>{layer.name || layer.id}</th>
                    {names.map((name) => {
                      const entry = layer.operatorPresets?.find((candidate) => candidate.name === name);
                      return (
                        <td key={name}>
                          <div className="playout-presets-cell">
                            {slots.text && (
                              <CommitField
                                value={entry?.text ?? ''}
                                label={`${layer.name} in ${name}`}
                                onCommit={(text) => setCharacterParts((parts) => setPresetValue(parts, layer.id, name, { text }))}
                              />
                            )}
                            {slots.show && (
                              <label className="playout-presets-show">
                                <input
                                  type="checkbox"
                                  aria-label={`Show ${layer.name} in ${name}`}
                                  checked={entry?.show !== false}
                                  onChange={(event) => setCharacterParts((parts) => setPresetValue(parts, layer.id, name, { show: event.target.checked }))}
                                />
                                Show
                              </label>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {layers.length > 0 && (
        <form className="playout-presets-add" onSubmit={(event) => { event.preventDefault(); add(); }}>
          <input
            type="text"
            className="playout-presets-input"
            aria-label="New preset name"
            placeholder={nextDefaultName()}
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
          />
          <button type="submit" className="btn-secondary playout-presets-add-button">
            <Plus size={13} /> Add preset from current values
          </button>
        </form>
      )}
    </section>,
    document.body,
  );
};
