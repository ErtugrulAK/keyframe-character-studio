import React, { useState } from 'react';
import { Unlink } from 'lucide-react';
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
 *
 * C6 — one labelled row (label · choice · remove) and one sentence that says
 * WHICH relation it is: membership of a GROUP (a container: the layer moves,
 * hides and is deleted with it) or a transform PARENT (the layer follows it;
 * deleting the parent keeps the layer). Track Matte is not a parent and is not
 * shown here — it has its own section.
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
  const groups = candidates.filter((candidate) => candidate.isGroup);
  const layers = candidates.filter((candidate) => !candidate.isGroup);
  const parent = part.parentId ? characterParts.find((candidate) => candidate.id === part.parentId) : undefined;
  const current = parent ? parent.id : '';
  const parentName = parent ? parent.name || parent.id : '';
  const fieldId = `layer-parent-${part.id}`;
  const shownRefusal = refusal?.partId === part.id ? refusal.reason : '';

  const apply = (next: string | null) => {
    const reason = reparentBlockReason(characterParts, tracks, part.id, next);
    const ok = setLayerParent(part.id, next);
    setRefusal(ok ? null : { partId: part.id, reason: reason ?? 'The parent was not changed.' });
  };

  const relation = !parent
    ? 'No parent: the layer sits directly in the composition.'
    : parent.isGroup
      ? `In group “${parentName}”: moves, hides and is deleted with the group.`
      : `Child of “${parentName}”: follows its position, rotation and scale. Deleting “${parentName}” keeps this layer.`;

  return (
    <section className="layer-parent-field" aria-label="Layer hierarchy" data-relation={!parent ? 'none' : parent.isGroup ? 'group' : 'parent'}>
      <div className="layer-parent-row">
        <label htmlFor={fieldId} className="layer-parent-label">Parent</label>
        <select
          id={fieldId}
          value={current}
          aria-describedby={`${fieldId}-relation${shownRefusal ? ` ${fieldId}-reason` : ''}`}
          title={parent ? parentName : 'No parent'}
          onChange={(event) => apply(event.target.value || null)}
        >
          <option value="">None</option>
          {groups.length > 0 && (
            <optgroup label="Groups">
              {groups.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name || candidate.id}</option>)}
            </optgroup>
          )}
          {layers.length > 0 && (
            <optgroup label="Layers">
              {layers.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name || candidate.id}</option>)}
            </optgroup>
          )}
        </select>
        <button
          type="button"
          className="btn-secondary layer-parent-clear"
          disabled={!parent}
          aria-label={parent?.isGroup ? 'Leave group' : 'Remove parent'}
          title={!parent ? 'This layer has no parent' : parent.isGroup ? `Take the layer out of “${parentName}” (it stays where it is on screen)` : `Unparent from “${parentName}” (the layer stays where it is on screen)`}
          onClick={() => apply(null)}
        >
          <Unlink size={12} aria-hidden="true" />
        </button>
      </div>
      <p id={`${fieldId}-relation`} className="layer-parent-relation" data-testid="layer-parent-relation">{relation}</p>
      {shownRefusal && (
        <span id={`${fieldId}-reason`} className="layer-parent-reason" role="status">{shownRefusal}</span>
      )}
    </section>
  );
};
