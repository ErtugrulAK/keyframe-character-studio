import React, { useId } from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { StyleCard } from './StyleCard';

interface OperatorControlCardProps {
  part: CharacterPart;
  characterParts: CharacterPart[];
  onPartPropChange: (key: keyof CharacterPart, value: unknown) => void;
}

/** True when another layer uses `part` as its active matte, as the OGraf export reads it (`ograf/publicControls`). */
const isActiveMatteSource = (part: CharacterPart, characterParts: CharacterPart[]): boolean => characterParts.some((other) => (
  (other.trackMatte?.enabled !== false && other.trackMatte?.sourceLayerId === part.id)
  || (other.matte?.enabled !== false && other.matte?.sourcePartId === part.id)
));

/**
 * Playout: what the operator may change on air in an exported OGraf graphic.
 * The show/hide switch becomes an on/off field in the playout system
 * (`gddType: boolean`); off hides this layer and its children. The editor
 * itself always draws the layer. One undo step per change.
 */
export const OperatorControlCard: React.FC<OperatorControlCardProps> = ({ part, characterParts, onPartPropChange }) => {
  const toggleId = useId();
  const matteSource = isActiveMatteSource(part, characterParts);
  const on = part.operatorToggle === true && !matteSource;
  return (
    <StyleCard title="PLAYOUT" collapsible retainKey="operator-control" badge={on ? 'Show/Hide' : undefined}>
      <div className="appearance-group-header">
        <label htmlFor={toggleId}>OPERATOR CAN SHOW / HIDE</label>
        <input
          id={toggleId}
          type="checkbox"
          aria-label="Operator can show or hide this layer"
          checked={on}
          disabled={matteSource}
          title={matteSource
            ? 'A Track Matte source is not offered: hiding it would change the layer it shapes'
            : 'Adds an on/off switch for this layer (and its children) to the exported OGraf graphic'}
          onChange={(event) => onPartPropChange('operatorToggle', event.target.checked ? true : undefined)}
        />
      </div>
      {on && <p className="operator-control-hint">Exported as "Show {part.name || 'layer'}", on by default.</p>}
      {matteSource && <p className="operator-control-hint">This layer is a Track Matte source, so it cannot be switched on air.</p>}
    </StyleCard>
  );
};
