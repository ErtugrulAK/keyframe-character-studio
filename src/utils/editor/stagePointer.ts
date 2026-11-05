/**
 * Where the pointer last was over the stage, in WORLD units (the units of a
 * layer's x/y). Paste places the copies there, so Ctrl+V drops them under the
 * mouse, and the stage-edge markers follow it while the pointer is over the
 * stage. Editor-only and transient: never part of the scene.
 */
let lastStagePointer: { x: number; y: number } | null = null;
/** The pointer while it is over the stage; null once it leaves. */
let hoverPointer: { x: number; y: number } | null = null;
const listeners = new Set<() => void>();

export const rememberStagePointer = (point: { x: number; y: number } | null): void => {
  const valid = point && Number.isFinite(point.x) && Number.isFinite(point.y) ? { x: point.x, y: point.y } : null;
  if (valid) lastStagePointer = valid;
  hoverPointer = valid;
  listeners.forEach((listener) => listener());
};

/** The pointer left the stage: Paste keeps the last place, the markers go back to the axes. */
export const leaveStage = (): void => {
  hoverPointer = null;
  listeners.forEach((listener) => listener());
};

export const stagePointer = (): { x: number; y: number } | null => lastStagePointer;

/** For `useSyncExternalStore`: the pointer over the stage, or null. */
export const subscribeStageHover = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const stageHoverPointer = (): { x: number; y: number } | null => hoverPointer;
