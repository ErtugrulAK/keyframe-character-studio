import type { AnimationTrackData, BezierPath, CharacterPart, LayerMask, LayerMaskMode } from '../types/animator';
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

const fnv1a = (text: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
};

/**
 * C12 — React keys for one layer's ordered mask stack. Each step after the
 * first draws the previous step through `mask="url(#previous)"`, and Chromium
 * does not repaint a layer when only such a NESTED mask changes: editing the
 * first of two masks kept painting its old shape until the editor re-mounted.
 * A step's key therefore carries every earlier step (and its own
 * feather/expansion filter), so a change there re-mounts the steps after it
 * and the layer resolves its mask afresh. The element IDs never change.
 */
export const layerMaskRenderKeys = (stack: readonly LayerMaskSvgDefinition[]): string[] => {
  let upstream = '';
  return stack.map((definition) => {
    const key = `${definition.id}@${fnv1a(`${upstream}#${definition.feather}|${definition.expansion}`)}`;
    upstream += `${definition.id}|${definition.pathD}|${definition.compositeMode ?? definition.mode}|${definition.opacity}|${definition.feather}|${definition.expansion};`;
    return key;
  });
};

const layerMaskId = (partId: string, maskId: string): string => `kcs-layer-mask-${partId}-${maskId}`;
export const layerMaskFilterId = (maskId: string): string => `kcs-layer-mask-filter-${maskId}`;

/**
 * WP-01: the mask IDs a track still animates. Channel keys are
 * `${maskId}:${property}`, so the ID is everything before the LAST colon —
 * an imported ID that itself contains a colon stays intact.
 */
export const layerMaskIdsReferencedByTrack = (
  track: Pick<AnimationTrackData, 'maskChannels' | 'maskPathChannels'> | undefined,
): string[] => {
  const channelKeys = [...Object.keys(track?.maskChannels ?? {}), ...Object.keys(track?.maskPathChannels ?? {})];
  return [...new Set(channelKeys.map((channel) => channel.slice(0, channel.lastIndexOf(':'))))];
};

/**
 * WP-01: a fresh `mask-N` ID for a new mask on one layer. It never repeats an
 * ID the layer's masks hold (an imported `mask-2` stays unique) nor one its
 * track still animates (a deleted mask's channels are not inherited). Existing
 * IDs are never renamed.
 */
export const nextLayerMaskId = (masks: readonly Pick<LayerMask, 'id'>[], reservedIds: readonly string[]): string => {
  const taken = new Set([...masks.map((mask) => mask.id), ...reservedIds]);
  let index = masks.length + 1;
  while (taken.has(`mask-${index}`)) index += 1;
  return `mask-${index}`;
};

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
/**
 * The layer-local size a NORMALIZED mask path is expanded over:
 * local = ((u - 0.5) · width, (v - 0.5) · height). The renderer and the canvas
 * mask editor both read it here, so an outline can never drift from the clip.
 */
export const maskPathNormalizationSize = (part: CharacterPart): { width: number; height: number } => {
  const bounds = getPartBounds(part);
  return {
    width: Number.isFinite(part.width) ? part.width! : bounds.halfW * 2,
    height: Number.isFinite(part.height) ? part.height! : bounds.halfH * 2,
  };
};

export const buildLayerMaskPathD = (
  maskPath: BezierPath | undefined,
  part: CharacterPart,
  world: WorldTransform,
  outputOrigin: CoordinatePoint = EDITOR_CAMERA_CENTER,
): string => {
  if (!maskPath) return '';
  const { width, height } = maskPathNormalizationSize(part);
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
