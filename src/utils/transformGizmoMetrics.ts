export interface TransformGizmoMetrics {
  cornerSize: number;
  centerRadius: number;
  edgeRadius: number;
  rotationRadius: number;
  rotationOffset: number;
  hitRadius: number;
}

const clampGizmoValue = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const getTransformGizmoMetrics = (boundsWidth: number, boundsHeight: number, zScale: number): TransformGizmoMetrics => {
  const safeZScale = clampGizmoValue(Number.isFinite(zScale) && zScale > 0 ? zScale : 1, 0.25, 4);
  const visibleObjectSize = Math.max(0, Math.min(Math.abs(boundsWidth), Math.abs(boundsHeight))) / safeZScale;
  const visualScreenSize = clampGizmoValue(visibleObjectSize * 0.12, 3, 9);
  const visualUnit = visualScreenSize * safeZScale;

  return {
    cornerSize: visualUnit,
    centerRadius: clampGizmoValue(visualScreenSize * 0.34, 2.2, 3.5) * safeZScale,
    edgeRadius: clampGizmoValue(visualScreenSize * 0.42, 2.2, 3.8) * safeZScale,
    rotationRadius: clampGizmoValue(visualScreenSize * 0.65, 3.2, 5.5) * safeZScale,
    rotationOffset: clampGizmoValue(Math.max(visualScreenSize * 2.2, visibleObjectSize * 0.16), 8, 28) * safeZScale,
    hitRadius: 8 * safeZScale,
  };
};
