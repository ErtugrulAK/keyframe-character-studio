/**
 * Blocking-dialog boundary for global editor commands.
 *
 * A dialog that takes the editor over declares `aria-modal="true"` on its
 * container (`ImportReportDialog`, `ConfirmationDialog`, `NewItemModal`, the
 * cubic-bezier editor). That attribute is the only contract read here: while
 * such a dialog is on screen the editor is not the active surface, so a global
 * command must not reach project state.
 *
 * Reading the rendered contract keeps one authority — the dialog itself — and
 * covers dialogs added later without a second registry that could drift from
 * what is actually on screen. Popovers that leave the editor active (the
 * Inspector's in/out preset popovers) declare `role="dialog"` without
 * `aria-modal`, so they are deliberately not matched.
 */
export const BLOCKING_MODAL_SELECTOR = '[aria-modal="true"]';

/** True while a blocking dialog is rendered. React-free and DOM-environment safe. */
export const isBlockingModalOpen = (): boolean =>
  typeof document !== 'undefined' && document.querySelector(BLOCKING_MODAL_SELECTOR) !== null;
