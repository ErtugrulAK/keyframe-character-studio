/**
 * C2-E — commands another surface (the context menu) sends to the layer tree.
 * The tree owns its transient UI state (which row is being renamed); a request
 * is a window event, the same pattern as the stage's viewport commands, so no
 * UI-only state leaks into the scene context.
 */
export const OUTLINER_COMMAND_EVENT = 'kcs-outliner-command';

export type OutlinerCommand = { type: 'rename'; partId: string };

export const requestOutlinerCommand = (command: OutlinerCommand): void => {
  window.dispatchEvent(new CustomEvent<OutlinerCommand>(OUTLINER_COMMAND_EVENT, { detail: command }));
};
