import React from 'react';
import type { EditTarget } from '../../../utils/editTarget';

interface EditTargetStripProps {
  target: EditTarget;
  testId: string;
  /** How-to text: visible when there is room, always in the strip's tooltip. */
  hint?: string;
  hintTestId?: string;
  /** A refusal reason (locked, preset motion, playback …): always visible. */
  blocked?: boolean;
  /** The mode's own controls (Finish, Cancel, Back to …). */
  children?: React.ReactNode;
  /** The controls only, without the mode and path caption. */
  bare?: boolean;
}

/**
 * The compact "what am I editing" strip at the top-left of the stage.
 *
 * One component for every mode (layer, matte source, new shape, drawing a
 * shape or a mask, editing a mask path), fed by `resolveEditTarget` — the
 * description the Inspector header reads too. It is chrome that never takes a
 * stage gesture: the text lets presses through to the drawing tool or the pan,
 * and only its buttons take the pointer.
 */
export const EditTargetStrip: React.FC<EditTargetStripProps> = ({ target, testId, hint, hintTestId, blocked = false, children, bare = false }) => (
  <div
    className="mask-edit-banner edit-target-strip"
    data-testid={testId}
    data-edit-target={target.kind}
    data-stage-chrome=""
    title={hint}
  >
    {!bare && <span className="edit-target-mode">{target.mode}</span>}
    {!bare && (
    <span className="mask-edit-banner-path" role="status" aria-live="polite">
      {target.path.map((segment, index) => (
        <React.Fragment key={`${segment}-${index}`}>
          {index > 0 && <span className="edit-target-sep" aria-hidden="true"> / </span>}
          <strong>{segment}</strong>
        </React.Fragment>
      ))}
      {target.detail && <span className="edit-target-detail"> · {target.detail}</span>}
    </span>
    )}
    {hint && (
      <span className={`mask-edit-banner-hint${blocked ? ' is-blocked' : ''}`} data-testid={hintTestId}>
        {blocked && <span aria-hidden="true">⚠ </span>}
        {hint}
      </span>
    )}
    {children}
  </div>
);
