/**
 * The stage's pointer gestures: which ones exist, and — for those that are
 * pure geometry — what a pointer position makes of them.
 *
 * `StageCanvas` owns the gesture's lifecycle (press, capture, release, history
 * batch, camera, selection, snapping). What a move MEANS for a crop region or a
 * transform is answered here, without React, so each gesture can be tested on
 * its own and the stage's move handler only dispatches.
 */
import type { Transform } from '../../types/animator';
import type { WorldTransform } from '../../types/composition';
import { applyAffine, composeWorldTransform, type WorldAffine } from '../../utils/geometry/containerMath';
import { resolveCornerResize, resolveEdgeResize, type CornerBounds, type CornerId, type EdgeId } from '../../utils/geometry/cornerResize';
import { EDITOR_CAMERA_CENTER } from '../../utils/geometry/projectCoordinates';
import { resizeStageCropRect, stageCropRectFromDrag, translateStageCropRect, type StageCropHandle, type StageCropRect } from '../../utils/geometry/stageCrop';
import { getLocalDelta } from '../../utils/geometry/viewportMath';

export type CornerScaleMode = 'scale_corner_tl' | 'scale_corner_tr' | 'scale_corner_bl' | 'scale_corner_br';
export type EdgeScaleMode = 'scale_left' | 'scale_right' | 'scale_top' | 'scale_bottom';
export type CropGestureMode = 'crop_new' | 'crop_move' | 'crop_resize';

/** Every gesture a press on the stage can start. */
export type StageGestureMode =
  | 'translate'
  | 'rotate'
  | CornerScaleMode
  | 'scale_x'
  | 'scale_y'
  | EdgeScaleMode
  | 'pan'
  | 'marquee'
  | 'shape_create'
  | 'child_frame_scale'
  | 'child_frame_rotate'
  | CropGestureMode;

/**
 * The four corner handles of the transform gizmo, keyed by the scale mode they
 * report. Edge and single-axis modes intentionally have no corner identity.
 */
export const CORNER_BY_SCALE_MODE: Record<string, CornerId | undefined> = {
  scale_corner_tl: 'tl',
  scale_corner_tr: 'tr',
  scale_corner_bl: 'bl',
  scale_corner_br: 'br',
};

/**
 * The four edge handles, keyed by the scale mode they report. A corner and an
 * edge solve share one authority (`resolveCornerResize` / `resolveEdgeResize`):
 * both anchor the handle opposite to the one the pointer grabbed.
 */
export const EDGE_BY_SCALE_MODE: Record<string, EdgeId | undefined> = {
  scale_left: 'left',
  scale_right: 'right',
  scale_top: 'top',
  scale_bottom: 'bottom',
};

/**
 * The frame a resize gesture solves in.
 *
 * A layer whose world map IS a TRS is solved in world space, exactly as every
 * drag has always been. A layer whose world map is NOT a TRS (a rotated child of
 * an anisotropically scaled container — the nesting is sheared) has no world TRS
 * to solve against, so the gesture is solved in that layer's CONTAINER frame,
 * where the authored TRS model holds exactly: the solver's anchor keeps the
 * opposite corner of the authored box fixed, which the container's linear map
 * carries to the very same world point, and the dragged corner lands on the
 * pointer in container space — its exact image in world space.
 */
export interface ResizeSolveFrame {
  /** The TRS the solver models: the layer's world pose, or its container-local pose. */
  transform: WorldTransform | Transform;
  /** The container's world pose, when the solve happens in the container frame. */
  containerWorld?: Transform;
  /** World → container-local, already inverted for the gesture. */
  containerInverse?: WorldAffine;
}

/** What the stage captured when the gesture began. */
export interface GestureStart {
  x: number;
  y: number;
  initialTransform: Transform;
  mediaCenter?: { x: number; y: number };
  partId?: string;
  initialChildScaleX?: number;
  initialChildScaleY?: number;
  initialChildRot?: number;
  corner?: CornerId;
  localBounds?: CornerBounds;
  cropAnchor?: { x: number; y: number };
  cropInitial?: StageCropRect;
  cropHandle?: StageCropHandle;
  solveFrame?: ResizeSolveFrame;
}

/** Where the pointer sits in the frame the gesture solves in. */
export const pointInSolveFrame = (
  point: { x: number; y: number },
  frame: ResizeSolveFrame,
): { x: number; y: number } => (frame.containerInverse ? applyAffine(frame.containerInverse, point) : point);

/**
 * Stage pointers arrive in SVG coordinates; every transform value is world
 * coordinates (no output origin). A delta is origin-independent, but a pivot or
 * a centre is not — so gestures that need an absolute point convert here first.
 */
export const svgPointToWorld = (point: { x: number; y: number }): { x: number; y: number } => ({
  x: point.x - EDITOR_CAMERA_CENTER.x,
  y: point.y - EDITOR_CAMERA_CENTER.y,
});

/**
 * A solve answer expressed in the frame's own terms → the WORLD patch the write
 * authority expects (it converts every patch into the target's container-local
 * space itself). Composing through the container is the exact inverse of that
 * conversion for a direct child, so the authored local values are recovered
 * unchanged — including their scale signs.
 */
export const solveFramePatchToWorld = (
  patch: { x?: number; y?: number; rotation?: number; scaleX?: number; scaleY?: number },
  frame: ResizeSolveFrame,
): Partial<Transform> => {
  if (!frame.containerWorld) return patch;
  const composed = composeWorldTransform(frame.containerWorld, { ...frame.transform, ...patch } as Transform);
  const worldPatch: Partial<Transform> = {};
  if (patch.x !== undefined) worldPatch.x = composed.x;
  if (patch.y !== undefined) worldPatch.y = composed.y;
  if (patch.rotation !== undefined) worldPatch.rotation = composed.rotation;
  if (patch.scaleX !== undefined) worldPatch.scaleX = composed.scaleX;
  if (patch.scaleY !== undefined) worldPatch.scaleY = composed.scaleY;
  return worldPatch;
};

export const isCropGesture = (mode: StageGestureMode): mode is CropGestureMode =>
  mode === 'crop_new' || mode === 'crop_move' || mode === 'crop_resize';

/**
 * The crop region a crop gesture makes of the pointer (stage coordinates), or
 * null when the gesture has nothing to change. Crop authoring rewrites only the
 * region, never the document.
 */
export const resolveCropGesture = (
  mode: CropGestureMode,
  start: GestureStart,
  point: { x: number; y: number },
  resolution: { width: number; height: number },
): StageCropRect | null => {
  if (mode === 'crop_new') return stageCropRectFromDrag(start.cropAnchor ?? point, point, resolution);
  const initial = start.cropInitial;
  if (!initial) return null;
  if (mode === 'crop_move') {
    const anchor = start.cropAnchor ?? point;
    return translateStageCropRect(initial, { x: point.x - anchor.x, y: point.y - anchor.y }, resolution);
  }
  return start.cropHandle ? resizeStageCropRect(initial, start.cropHandle, point, resolution) : null;
};

export interface TransformGestureInput {
  start: GestureStart;
  /** The pointer, in SVG coordinates. */
  pointer: { x: number; y: number };
  /** The pointer's angle around the pivot when a rotate began, in radians. */
  initialAngle: number;
  /** The pointer's local distance from the pivot when an axis scale began. */
  initialLocalX: number;
  initialLocalY: number;
  /** The Inspector's aspect lock, toggled for one drag by Shift. */
  scaleLocked: boolean;
  shiftKey: boolean;
}

/** A transform patch (WORLD values) and, for a child-frame gesture, the layer it targets. */
export interface TransformGestureResult {
  patch: Partial<Transform>;
  targetId?: string;
}

/**
 * What a transform gesture makes of the pointer: the patch the write authority
 * applies, or null when the gesture cannot solve (no bounds captured) or is not
 * a transform gesture. Translate stays with the stage: it also drives snapping
 * and the click-versus-drag decision.
 */
export const resolveTransformGesture = (mode: StageGestureMode, input: TransformGestureInput): TransformGestureResult | null => {
  const { start, pointer } = input;
  const frame = start.solveFrame ?? { transform: start.initialTransform };

  if (mode === 'child_frame_scale') {
    // Uniform scale of a shape child around its center (world space); the write
    // authority converts the world scale into container-local space.
    const center = start.mediaCenter!;
    const initialDistance = Math.hypot(start.x - center.x, start.y - center.y);
    const distance = Math.hypot(pointer.x - center.x, pointer.y - center.y);
    const factor = initialDistance > 0.001 ? distance / initialDistance : 1;
    const scale = Math.max(0.05, Math.round((start.initialChildScaleX || 1) * factor * 100) / 100);
    return { patch: { scaleX: scale, scaleY: scale }, targetId: start.partId };
  }

  if (mode === 'child_frame_rotate') {
    // Rotate a shape child around its center (world space).
    const center = start.mediaCenter!;
    const initialAngle = (Math.atan2(start.y - center.y, start.x - center.x) * 180) / Math.PI;
    const angle = (Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180) / Math.PI;
    const delta = ((angle - initialAngle + 540) % 360) - 180;
    return { patch: { rotation: Math.round(((start.initialChildRot || 0) + delta) * 100) / 100 }, targetId: start.partId };
  }

  if (mode === 'rotate') {
    // Only the rotation changes: the layer turns about its own origin, so its
    // position stays put. A sheared nesting turns in its container frame.
    const local = pointInSolveFrame(svgPointToWorld(pointer), frame);
    const angle = Math.atan2(local.y - frame.transform.y, local.x - frame.transform.x);
    const rotation = Math.round(frame.transform.rotation + ((angle - input.initialAngle) * 180) / Math.PI);
    return { patch: solveFramePatchToWorld({ x: frame.transform.x, y: frame.transform.y, rotation }, frame) };
  }

  const corner = CORNER_BY_SCALE_MODE[mode];
  if (corner) {
    // The diagonally opposite corner stays fixed and the dragged one follows
    // the pointer: free non-uniform scaling, made uniform by the aspect lock
    // (Shift toggles it for one drag).
    if (!start.localBounds) return null;
    return {
      patch: solveFramePatchToWorld(resolveCornerResize({
        transform: frame.transform,
        bounds: start.localBounds,
        corner,
        startPointer: pointInSolveFrame(svgPointToWorld({ x: start.x, y: start.y }), frame),
        pointer: pointInSolveFrame(svgPointToWorld(pointer), frame),
        uniform: input.scaleLocked !== input.shiftKey,
      }), frame),
    };
  }

  const edge = EDGE_BY_SCALE_MODE[mode];
  if (edge) {
    // The same authority restricted to one axis: the opposite edge is fixed.
    if (!start.localBounds) return null;
    return {
      patch: solveFramePatchToWorld(resolveEdgeResize({
        transform: frame.transform,
        bounds: start.localBounds,
        edge,
        startPointer: pointInSolveFrame({ x: start.x, y: start.y }, frame),
        pointer: pointInSolveFrame(pointer, frame),
      }), frame),
    };
  }

  if (mode === 'scale_x' || mode === 'scale_y') {
    const local = pointInSolveFrame(svgPointToWorld(pointer), frame);
    const { dxLocal, dyLocal } = getLocalDelta(local.x - frame.transform.x, local.y - frame.transform.y, frame.transform.rotation);
    if (mode === 'scale_x') {
      const ratio = Math.abs(dxLocal) / Math.max(0.001, input.initialLocalX);
      return { patch: solveFramePatchToWorld({ scaleX: parseFloat(Math.max(0.05, frame.transform.scaleX * ratio).toFixed(2)) }, frame) };
    }
    const ratio = Math.abs(dyLocal) / Math.max(0.001, input.initialLocalY);
    return { patch: solveFramePatchToWorld({ scaleY: parseFloat(Math.max(0.05, frame.transform.scaleY * ratio).toFixed(2)) }, frame) };
  }

  return null;
};
