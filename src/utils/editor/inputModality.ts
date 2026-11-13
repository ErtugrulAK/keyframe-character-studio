/**
 * How the user is driving the editor right now: by keyboard (Tab through the
 * controls) or by pointer. The root element carries it as
 * `data-input-modality`, and the stylesheet draws focus rings only for the
 * keyboard: a click, a double-click to rename or a right-click menu never
 * leaves a blue box behind, while Tab navigation still shows where focus is.
 */
export const installInputModality = (root: HTMLElement = document.documentElement): (() => void) => {
  root.dataset.inputModality = 'pointer';
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Tab') root.dataset.inputModality = 'keyboard';
  };
  const onPointerDown = () => {
    root.dataset.inputModality = 'pointer';
  };
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('pointerdown', onPointerDown, true);
  return () => {
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('pointerdown', onPointerDown, true);
  };
};
