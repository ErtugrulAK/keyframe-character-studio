/**
 * C4 — mask editing entered from the KEYBOARD (Enter/Space on "Edit on Canvas")
 * takes focus straight into the canvas point list, which sits before the
 * Inspector in the tab order; a pointer entry leaves focus where it is. The
 * request is a one-shot hand-over from the Inspector button to the overlay that
 * mounts next (transient UI state, never scene data).
 */
let pointFocusRequested = false;

export const requestMaskPointsFocus = (): void => {
  pointFocusRequested = true;
};

/** True once after a request; the overlay that mounts consumes it. */
export const consumeMaskPointsFocusRequest = (): boolean => {
  const requested = pointFocusRequested;
  pointFocusRequested = false;
  return requested;
};
