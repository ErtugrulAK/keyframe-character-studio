/**
 * The header's file commands, reachable from the menu bar: one window event
 * (like `canvas-viewport-command`), handled by the header, so Import and
 * Export keep one implementation.
 */
export const HEADER_COMMAND_EVENT = 'kcs-header-command';

export type HeaderCommand = 'new-template' | 'import' | 'export-json' | 'export-ograf' | 'export-gif' | 'check-ograf' | 'reset-project';

export const dispatchHeaderCommand = (command: HeaderCommand): void => {
  window.dispatchEvent(new CustomEvent(HEADER_COMMAND_EVENT, { detail: { command } }));
};
