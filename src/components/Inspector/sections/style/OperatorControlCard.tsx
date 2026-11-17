import React, { useId } from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { StyleCard } from './StyleCard';
import { counterUnavailableReason } from '../../../../utils/layers/operatorCounter';

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
 * itself always draws the layer. A text that is a whole number can instead be
 * a counter: a number field with +1 / -1 buttons in the playout. One undo step
 * per change.
 */
export const OperatorControlCard: React.FC<OperatorControlCardProps> = ({ part, characterParts, onPartPropChange }) => {
  const toggleId = useId();
  const counterId = useId();
  const imageId = useId();
  const isImage = part.type === 'custom_image';
  const imageAnyOn = isImage && part.operatorImageAny === true;
  const isText = part.type === 'custom_text';
  const counterBlocked = isText ? counterUnavailableReason(part) : undefined;
  const counterOn = part.operatorCounter === true && !counterBlocked;
  const matteSource = isActiveMatteSource(part, characterParts);
  const on = part.operatorToggle === true && !matteSource;
  return (
    <StyleCard title="PLAYOUT" collapsible retainKey="operator-control" badge={[on ? 'Show/Hide' : '', counterOn ? '+1/-1' : '', imageAnyOn ? 'Any image' : ''].filter(Boolean).join(' · ') || undefined}>
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
      {isText && (
        <>
          <div className="appearance-group-header">
            <label htmlFor={counterId}>NUMBER WITH +1 / -1 BUTTONS</label>
            <input
              id={counterId}
              type="checkbox"
              aria-label="Operator can count this number"
              checked={counterOn}
              disabled={Boolean(counterBlocked) && part.operatorCounter !== true}
              title={counterBlocked ?? 'The exported graphic gets a number field for this text and +1 / -1 buttons'}
              onChange={(event) => onPartPropChange('operatorCounter', event.target.checked && !counterBlocked ? true : undefined)}
            />
          </div>
          {counterOn && <p className="operator-control-hint">Exported as the number "{part.name || 'Number'}" with "+1" and "-1" buttons.</p>}
          {counterBlocked && <p className="operator-control-hint">{counterBlocked}.</p>}
        </>
      )}
      {isImage && (
        <>
          <div className="appearance-group-header">
            <label htmlFor={imageId}>OPERATOR CAN PICK ANY IMAGE</label>
            <input
              id={imageId}
              type="checkbox"
              aria-label="Operator can pick any image"
              checked={imageAnyOn}
              title="The exported graphic accepts any picture for this layer (a web or file address), not only the packaged images"
              onChange={(event) => onPartPropChange('operatorImageAny', event.target.checked ? true : undefined)}
            />
          </div>
          <p className="operator-control-hint">
            {imageAnyOn
              ? 'The operator can give this layer any picture. It is not in the package, so it must be reachable where the graphic plays.'
              : 'Off: the operator can only choose among the images packaged with the graphic.'}
          </p>
        </>
      )}
    </StyleCard>
  );
};
