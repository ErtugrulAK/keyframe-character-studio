/**
 * Where the pointer last was over the stage, in WORLD units (the units of a
 * layer's x/y). Paste places the copies there, so Ctrl+V drops them under the
 * mouse. Editor-only and transient: never part of the scene.
 */
let lastStagePointer: { x: number; y: number } | null = null;

export const rememberStagePointer = (point: { x: number; y: number } | null): void => {
  lastStagePointer = point && Number.isFinite(point.x) && Number.isFinite(point.y) ? { x: point.x, y: point.y } : null;
};

export const stagePointer = (): { x: number; y: number } | null => lastStagePointer;
