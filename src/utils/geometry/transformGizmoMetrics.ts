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

/**
 * The handle sizes, in screen pixels: constant at every zoom and for every
 * object size, like the handles of a vector editor. (They used to grow with the
 * object's on-screen size up to 9 px; a fixed small handle reads cleaner.) The
 * grab area (`hitRadius`) stays larger than the drawn handle.
 */
const CORNER_PX = 4.5;
const EDGE_RADIUS_PX = 2.25;
const ROTATION_RADIUS_PX = 3.5;
const ROTATION_OFFSET_PX = 18;
const HIT_RADIUS_PX = 8;

/** Sizes in stage units: screen pixels times `zScale` (stage units per pixel). */
export const getTransformGizmoMetrics = (_boundsWidth: number, _boundsHeight: number, zScale: number): TransformGizmoMetrics => {
  const safeZScale = clampGizmoValue(Number.isFinite(zScale) && zScale > 0 ? zScale : 1, 0.01, 10);
  return {
    cornerSize: CORNER_PX * safeZScale,
    edgeRadius: EDGE_RADIUS_PX * safeZScale,
    rotationRadius: ROTATION_RADIUS_PX * safeZScale,
    rotationOffset: ROTATION_OFFSET_PX * safeZScale,
    hitRadius: HIT_RADIUS_PX * safeZScale,
  };
};
