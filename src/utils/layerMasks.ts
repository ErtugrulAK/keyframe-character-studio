import type { BezierPath, CharacterPart, LayerMask, LayerMaskMode } from '../types/animator';
import type { WorldTransform } from '../types/composition';
import { buildBezierPathD } from './bezierPath';
import { getPartBounds } from './bounds';
import { applyAffine, worldAffineOf } from './containerMath';
import { EDITOR_CAMERA_CENTER, type CoordinatePoint } from './projectCoordinates';

export type LayerMaskCompositeMode = 'add' | 'subtract' | 'intersect' | 'difference';

export interface LayerMaskSvgDefinition {
  id: string;
  pathD: string;
  mode: LayerMaskMode;
  inverted: boolean;
  opacity: number;
  feather: number;
  expansion: number;
  /** Previous accumulated stack and the ordered operation for this step. */
  previousId?: string;
  compositeMode?: LayerMaskCompositeMode;
}

export const layerMaskId = (partId: string, maskId: string): string => `kcs-layer-mask-${partId}-${maskId}`;
export const layerMaskFilterId = (maskId: string): string => `kcs-layer-mask-filter-${maskId}`;

const normalizeOpacity = (value: number | undefined): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value!)) : 1;
const normalizeNonNegative = (value: number | undefined): number =>
  Number.isFinite(value) ? Math.max(0, value!) : 0;

/**
 * World-space mask contour. The localized mask point is mapped through the
 * layer's DERIVED world affine (`worldAffineOf`) — never a hand-rolled
 * `origin + R(rotation)·(local ⊙ scale)` — so a sheared nesting (a rotated child
 * of an anisotropically scaled container) clips exactly where the layer is
 * drawn, while a shear-free pose keeps its historical numbers.
 */
export const buildLayerMaskPathD = (
  maskPath: BezierPath | undefined,
  part: CharacterPart,
  world: WorldTransform,
  outputOrigin: CoordinatePoint = EDITOR_CAMERA_CENTER,
): string => {
  if (!maskPath) return '';
  const bounds = getPartBounds(part);
  const width = Number.isFinite(part.width) ? part.width! : bounds.halfW * 2;
  const height = Number.isFinite(part.height) ? part.height! : bounds.halfH * 2;
  const worldMap = worldAffineOf(world);
  return buildBezierPathD(maskPath, (point) => {
    const local = maskPath.coordinateSpace === 'normalized'
      ? { x: (point.x - 0.5) * width, y: (point.y - 0.5) * height }
      : point;
    const mapped = applyAffine(worldMap, local);
    return { x: outputOrigin.x + mapped.x, y: outputOrigin.y + mapped.y };
  });
};

export const buildLayerMaskDefinition = (
  part: CharacterPart,
  mask: LayerMask,
  world: WorldTransform,
  outputOrigin: CoordinatePoint = EDITOR_CAMERA_CENTER,
): LayerMaskSvgDefinition | undefined => {
  if (mask.enabled === false) return undefined;
  const pathD = buildLayerMaskPathD(mask.path, part, world, outputOrigin);
  if (!pathD) return undefined;
  return {
    id: layerMaskId(part.id, mask.id),
    pathD,
    mode: mask.mode,
    inverted: mask.inverted === true,
    opacity: normalizeOpacity(mask.opacity),
    feather: normalizeNonNegative(mask.feather),
    expansion: Number.isFinite(mask.expansion) ? mask.expansion! : 0,
  };
};
