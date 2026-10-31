import React, { useRef } from 'react';
import ReactDOM from 'react-dom';
import { useDialogFocusRestoration, useDialogFocusTrap } from '../../hooks/useDialogFocusRestoration';
import type { BakedChild, DeletionDependent } from '../../utils/layers/partDeletion';
import './ConfirmationDialog.css';

interface DeleteDependentsDialogProps {
  /** The layers the delete removes (names), or null when nothing is pending. */
  deletedNames: string[] | null;
  dependents: DeletionDependent[];
  /** Child layers whose transform keyframes the delete adds to. */
  bakedChildren?: BakedChild[];
  /** Layers deleted WITH a deleted group (its contents). */
  ownedNames?: string[];
  /** Children of a deleted plain parent: kept, moved up one level. */
  keptChildNames?: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Shown ONLY when a delete removes a layer that another surviving layer
 * uses as its matte source. It names those layers before anything changes; the
 * delete itself is the ordinary one (one undo step), and the dependent layers
 * keep their relationship, which then reports a missing source until Undo
 * restores the source or the user picks another one.
 *
 * Also shown when deleting a parent ADDS keyframes to its children (its
 * motion is baked into them so they keep their place): it names each child and
 * the keyframe count before/after, and says when the result is one key per
 * frame. Cancel changes nothing. A delete with neither consequence never opens
 * this dialog.
 *
 * And when the delete removes a GROUP with layers in it: a group is a
 * container, so its layers go with it, and the dialog lists them. Whenever it
 * opens it also states which children are KEPT (a plain parent is a transform
 * relationship: its children stay, one level up, in place), so the difference
 * between the two is visible before confirming.
 */
export const DeleteDependentsDialog: React.FC<DeleteDependentsDialogProps> = ({ deletedNames, dependents, bakedChildren = [], ownedNames = [], keptChildNames = [], onConfirm, onCancel }) => {
  const isOpen = deletedNames !== null;
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocusRestoration(isOpen, cancelRef);
  useDialogFocusTrap(isOpen, dialogRef, onCancel);
  if (!isOpen) return null;
  const subject = deletedNames.length === 1 ? `“${deletedNames[0]}”` : `${deletedNames.length} layers`;

  return ReactDOM.createPortal(
    <div className="confirmation-dialog-backdrop" onMouseDown={onCancel}>
      <div
        className="confirmation-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dependents-title"
        aria-describedby="delete-dependents-description"
        data-testid="delete-dependents-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="delete-dependents-title">Delete {subject}?</h2>
        <div id="delete-dependents-description">
          {ownedNames.length > 0 && (
            <>
              <p>
                {deletedNames.length === 1 ? 'It is a group: its' : 'The selection includes a group: its'} {ownedNames.length === 1 ? 'layer is' : `${ownedNames.length} layers are`} deleted with it:
              </p>
              <ul className="delete-dependents-list" aria-label="Layers deleted with the group" data-testid="delete-owned-list">
                {ownedNames.map((name, index) => <li key={`${name}-${index}`}><strong>{name}</strong></li>)}
              </ul>
            </>
          )}
          {keptChildNames.length > 0 && (
            <p data-testid="delete-kept-children">
              Kept: {keptChildNames.map((name) => `“${name}”`).join(', ')} — {keptChildNames.length === 1 ? 'a child layer moves' : 'child layers move'} up one level and {keptChildNames.length === 1 ? 'keeps its' : 'keep their'} place on screen.
            </p>
          )}
          {dependents.length > 0 && (
            <>
              <p>
                {dependents.length === 1 ? 'This layer uses' : 'These layers use'} {deletedNames.length === 1 ? 'it' : 'a deleted layer'} as a matte source:
              </p>
              <ul className="delete-dependents-list" aria-label="Layers that use it as a matte source">
                {dependents.map((dependent) => (
                  <li key={dependent.target.id} data-dependent-id={dependent.target.id}>
                    <strong>{dependent.target.name || dependent.target.id}</strong>
                    {' — '}
                    {dependent.kind === 'track' ? 'Track Matte' : 'Legacy clip matte'}
                  </li>
                ))}
              </ul>
              <p>
                They are not deleted and their matte setting is kept. After the delete they show a missing matte source
                and render without the matte; Undo brings the source and the effect back.
              </p>
            </>
          )}
          {bakedChildren.length > 0 && (
            <>
              <p>
                {bakedChildren.length === 1 ? 'Its child layer keeps' : 'Its child layers keep'} their place on screen. The parent&rsquo;s
                motion is written into {bakedChildren.length === 1 ? 'its' : 'their'} transform keyframes:
              </p>
              <ul className="delete-dependents-list" aria-label="Child layers that receive keyframes">
                {bakedChildren.map((child) => (
                  <li key={child.id} data-baked-child-id={child.id}>
                    <strong>{child.name}</strong>
                    {` — ${child.keyframesBefore} → ${child.keyframesAfter} keyframes`}
                    {child.perFrame ? ' (one per frame where the motion has no simpler equivalent)' : ''}
                  </li>
                ))}
              </ul>
              <p>Undo restores the parent and the original keyframes in one step.</p>
            </>
          )}
        </div>
        <div className="confirmation-dialog-actions">
          <button type="button" className="confirmation-dialog-cancel" ref={cancelRef} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="confirmation-dialog-confirm" onClick={onConfirm}>
            {ownedNames.length > 0 ? `Delete ${deletedNames.length + ownedNames.length} layers` : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
