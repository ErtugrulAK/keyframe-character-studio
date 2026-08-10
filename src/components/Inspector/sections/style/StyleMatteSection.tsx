import React from 'react';
import { Scissors, X } from 'lucide-react';
import type { CharacterPart, PartMatte } from '../../../../types/animator';
import { getShapeGeometry } from '../../../../utils/shapeGeometry';
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

  const eligibleSources = characterParts.filter(
    (p) => p.id !== selectedPart.id && getShapeGeometry(p.type) !== null,
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
    setMatte({ sourcePartId, mode: 'clip', enabled: true });
  };

  const onToggleEnabled = () => {
    if (!matte) return;
    setMatte({ ...matte, enabled: matte.enabled === false ? true : false });
  };

  const onRemove = () => setMatte(undefined);

  const selectValue = matte && !sourceMissing ? matte.sourcePartId : '';

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
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: '#cbd5e1', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={matte.enabled !== false}
              onChange={onToggleEnabled}
              style={{ accentColor: '#00d2ff' }}
            />
            Enabled
          </label>
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
