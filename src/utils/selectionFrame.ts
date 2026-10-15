import type { CharacterPart, Transform } from '../types/animator';
import { getPartLocalBounds, type PartLocalBounds } from './bounds';
import { deriveBooleanGeometry } from './booleanGeometry';
import { getGroupAggregateBounds } from './layerGrouping';
import type { WorldAffine } from './containerMath';

/**
 * THE selection-frame geometry authority.
 *
 * Every overlay that draws or anchors on a selection frame (the transform
 * gizmo, the rotation pivot, the corner/edge solvers) asks this module for the
 * box, so the drawn frame, the handles and the gesture math can never disagree.
 *
 * The one hard rule it encodes: a geometryless container (`isGroup`) owns no
 * geometry. Its box is the live aggregate of the layers inside it, and a
 * container with nothing measurable inside has NO box at all — never the
 * synthetic placeholder square `getPartLocalBounds` falls back to. That fallback
 * is exactly what produced the stray empty selection square.
 */

/** The part as the frame must measure it: live Boolean contours, not persisted ones. */
export const withCurrentBooleanGeometry = (
  part: CharacterPart,
  characterParts: CharacterPart[],
  getComputedTransform: (partId: string, frame: number) => Transform,
  currentFrame: number,
): CharacterPart => {
  if (!part.booleanOperandIds?.length || !part.booleanOperation) return part;
  const operands = part.booleanOperandIds
    .map((operandId) => characterParts.find((candidate) => candidate.id === operandId))
    .filter((candidate): candidate is CharacterPart => Boolean(candidate));
  const operandTransforms = Object.fromEntries(
    operands.map((operand) => [operand.id, getComputedTransform(operand.id, currentFrame)]),
  );
  const groupTransform = getComputedTransform(part.id, currentFrame);
  const derived = deriveBooleanGeometry(part.booleanOperation, operands, operandTransforms, groupTransform);
  return {
    ...part,
    booleanContours: derived.localContours,
    points: derived.localContours[0] ?? [],
  };
};

export interface SelectionFrameContext {
  characterParts: CharacterPart[];
  getComputedTransform: (partId: string, frame: number) => Transform;
  currentFrame: number;
  /** The layer's evaluated world transform at `currentFrame`. */
  transform: Transform;
}

/**
 * The box a selection frame draws for `part`, in that layer's own local units,
 * or `null` when the layer has no frame to draw.
 */
export const getSelectionFrameBounds = (
  part: CharacterPart,
  { characterParts, getComputedTransform, currentFrame, transform }: SelectionFrameContext,
): PartLocalBounds | null => {
  if (part.isGroup) {
    // Children define the container's box, live, from this frame's transforms.
    return getGroupAggregateBounds(characterParts, part.id, (partId) => getComputedTransform(partId, currentFrame));
  }
  const measured = withCurrentBooleanGeometry(part, characterParts, getComputedTransform, currentFrame);
  // A Boolean group whose operands currently resolve to no contour has no
  // geometry to frame: measuring it would fall back to the placeholder square
  // instead of the (empty) truth.
  if (measured.booleanOperandIds?.length && measured.booleanContours?.length === 0) return null;
  return getPartLocalBounds(measured, transform);
};

/** A box in a layer's own local units. */
export interface SelectionFrameBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * The gizmo props one selection frame is drawn and anchored with.
 *
 * The TRS props describe a frame an authored TRS can render: the box in the
 * layer's scaled local units, drawn under the layer's rotation. They are the
 * complete description for every such layer.
 *
 * `affine` is present ONLY for a frame whose world map is not a TRS — a rotated
 * child of an anisotropically scaled container, whose exact map
 * `R(θp)·S(sp)·R(θc)·S(sc)` is a general 2×2 (a shear, or an axis swap). Such a
 * frame is the LOCAL box `affineBounds` mapped by that affine, i.e. a
 * PARALLELOGRAM, and no scaled-local box + rotation can draw it. Consumers MUST
 * prefer the affine path when it is present (the gizmo emits `matrix(...)` and
 * places every handle on the affine image of its local-box point); the TRS props
 * stay alongside it because the drag solvers keep working on the local box.
 */
export interface SelectionFrameGizmoBounds {
  overrideHalfW: number;
  overrideHalfH: number;
  overrideCenterX: number;
  overrideCenterY: number;
  overrideBounds: SelectionFrameBox;
  /** The exact world map of the frame, when a TRS cannot re-create it. */
  affine?: WorldAffine;
  /** The LOCAL box the affine maps — the rect the affine frame draws. */
  affineBounds?: SelectionFrameBox;
}

/**
 * The local box → gizmo props every caller draws and anchors on. The gizmo
 * applies the layer's scale itself (with its orientation flip), so the extents
 * are carried in the layer's scaled local units.
 */
export const selectionFrameGizmoBounds = (
  bounds: PartLocalBounds,
  transform: Transform & { affine?: WorldAffine },
): SelectionFrameGizmoBounds => {
  const scaleX = Math.abs(transform.scaleX);
  const scaleY = Math.abs(transform.scaleY);
  const box: SelectionFrameBox = { minX: bounds.minX, minY: bounds.minY, maxX: bounds.maxX, maxY: bounds.maxY };
  const trsBounds: SelectionFrameGizmoBounds = {
    overrideHalfW: ((bounds.maxX - bounds.minX) / 2) * scaleX,
    overrideHalfH: ((bounds.maxY - bounds.minY) / 2) * scaleY,
    overrideCenterX: ((bounds.minX + bounds.maxX) / 2) * scaleX,
    overrideCenterY: ((bounds.minY + bounds.maxY) / 2) * scaleY,
    overrideBounds: box,
  };
  // A derived affine is attached only when the TRS numbers cannot re-create the
  // layer's world map (see `utils/containerMath`), so its presence IS the
  // "this frame is not a scaled-local box" signal — checked, never approximated.
  return transform.affine
    ? { ...trsBounds, affine: transform.affine, affineBounds: box }
    : trsBounds;
};
