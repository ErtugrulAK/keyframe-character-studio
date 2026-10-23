import React, { useState } from 'react';
import type { CharacterPart } from '../../types/animator';
import { useLayerParenting } from '../../hooks/useLayerParenting';
import { relationshipDescendantIds, reparentBlockReason } from '../../utils/layerParenting';
import type { Track } from '../../types/animator';

interface LayerParentFieldProps {
  part: CharacterPart;
  characterParts: CharacterPart[];
  tracks: Track[];
}

/**
 * C2-E — the keyboard- and screen-reader-friendly way to set a layer's parent
 * (the layer tree's drag and drop is the pointer way). It lists every layer the
 * part could be parented to — never itself, nothing inside it, no Boolean
 * structure — and writes through the one parenting authority, which keeps the
 * layer where it is on screen. A refusal is shown here, with its reason.
 */
export const LayerParentField: React.FC<LayerParentFieldProps> = ({ part, characterParts, tracks }) => {
  const { setLayerParent } = useLayerParenting();
  const [refusal, setRefusal] = useState<{ partId: string; reason: string } | null>(null);
  if (part.booleanGroupId) return null;
  const inside = new Set(relationshipDescendantIds(characterParts, part.id));
  const candidates = characterParts.filter((candidate) => (
    candidate.id !== part.id
    && !inside.has(candidate.id)
    && !candidate.booleanGroupId
    && !candidate.booleanOperandIds?.length
  ));
  const current = part.parentId && characterParts.some((candidate) => candidate.id === part.parentId) ? part.parentId : '';
  const fieldId = `layer-parent-${part.id}`;
  const shownRefusal = refusal?.partId === part.id ? refusal.reason : '';

  return (
    <div className="layer-parent-field">
      <label htmlFor={fieldId}>Parent</label>
      <select
        id={fieldId}
        value={current}
        aria-describedby={shownRefusal ? `${fieldId}-reason` : undefined}
        onChange={(event) => {
          const next = event.target.value || null;
          const reason = reparentBlockReason(characterParts, tracks, part.id, next);
          const ok = setLayerParent(part.id, next);
          setRefusal(ok ? null : { partId: part.id, reason: reason ?? 'The parent was not changed.' });
        }}
      >
        <option value="">None</option>
        {candidates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name || candidate.id}{candidate.isGroup ? ' (group)' : ''}
          </option>
        ))}
      </select>
      {shownRefusal && (
        <span id={`${fieldId}-reason`} className="layer-parent-reason" role="status">{shownRefusal}</span>
      )}
    </div>
  );
};
