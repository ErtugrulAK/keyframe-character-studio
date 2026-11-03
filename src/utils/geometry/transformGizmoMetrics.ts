interface TransformGizmoMetrics {
  cornerSize: number;
  edgeRadius: number;
  rotationRadius: number;
  rotationOffset: number;
  hitRadius: number;
}

const RESIZE_CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'] as const;

/**
 * The double-arrow cursor nearest a handle's outward direction ON SCREEN
 * (y grows downward). A rotated frame passes its rotated direction, so the
 * arrow follows the frame instead of staying axis-aligned.
 */
export const resizeCursorFor = (dx: number, dy: number): string => {
  if (dx === 0 && dy === 0) return RESIZE_CURSORS[0];
  const degrees = (((Math.atan2(dy, dx) * 180) / Math.PI) % 180 + 180) % 180;
  return RESIZE_CURSORS[Math.round(degrees / 45) % 4];
};

const clampGizmoValue =(value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const getTransformGizmoMetrics = (boundsWidth: number, boundsHeight: number, zScale: number): TransformGizmoMetrics => {
  const safeZScale = clampGizmoValue(Number.isFinite(zScale) && zScale > 0 ? zScale : 1, 0.25, 4);
  const visibleObjectSize = Math.max(0, Math.min(Math.abs(boundsWidth), Math.abs(boundsHeight))) / safeZScale;
  const visualScreenSize = clampGizmoValue(visibleObjectSize * 0.12, 3, 9);
  const visualUnit = visualScreenSize * safeZScale;

  return {
    cornerSize: visualUnit,
    edgeRadius: clampGizmoValue(visualScreenSize * 0.42, 2.2, 3.8) * safeZScale,
    rotationRadius: clampGizmoValue(visualScreenSize * 0.65, 3.2, 5.5) * safeZScale,
    rotationOffset: clampGizmoValue(Math.max(visualScreenSize * 2.2, visibleObjectSize * 0.16), 8, 28) * safeZScale,
    hitRadius: 8 * safeZScale,
  };
};
