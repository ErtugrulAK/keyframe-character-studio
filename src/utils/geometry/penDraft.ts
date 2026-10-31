import type { BezierPath, BezierVertex, PathCoordinateSpace } from '../../types/animator';
import type { PathPoint } from './bezierPath';

/**
 * The Pen's draft model, shared by the shape Pen and the mask Pen.
 *
 * - A press places ONE anchor (a corner).
 * - Dragging that press pulls the anchor's tangent: the outgoing handle follows
 *   the pointer and the incoming handle mirrors it, so the anchor is smooth.
 *   The drag never adds anchors.
 * - The release ends that anchor; the next press is a new anchor.
 * - A press on the first anchor closes the shape; dragging that press shapes
 *   the closing tangent of the first anchor.
 *
 * Anchor + its tangent drag are ONE draft history step (the caller records the
 * draft once, at the press). Coordinates are whatever space the caller draws in;
 * screen-space thresholds are decided by the caller.
 */
export interface PenAnchor {
  x: number;
  y: number;
  /** Absolute handle positions (same space as the anchor), present once dragged. */
  handleIn?: PathPoint;
  handleOut?: PathPoint;
}

export const penAnchorIsSmooth = (anchor: PenAnchor): boolean => Boolean(anchor.handleIn || anchor.handleOut);

/** A new corner anchor at `point`. */
export const addPenAnchor = (anchors: readonly PenAnchor[], point: PathPoint): PenAnchor[] => [...anchors, { x: point.x, y: point.y }];

/**
 * Pulls the tangent of `anchors[index]` toward `pointer`: handleOut = pointer,
 * handleIn = its mirror through the anchor. A pointer back on the anchor makes
 * it a corner again (no zero-length handles are kept).
 */
export const dragPenTangent = (anchors: readonly PenAnchor[], index: number, pointer: PathPoint): PenAnchor[] => {
  const anchor = anchors[index];
  if (!anchor || !Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return [...anchors];
  const dx = pointer.x - anchor.x;
  const dy = pointer.y - anchor.y;
  const next: PenAnchor = Math.hypot(dx, dy) < 1e-9
    ? { x: anchor.x, y: anchor.y }
    : { x: anchor.x, y: anchor.y, handleOut: { x: pointer.x, y: pointer.y }, handleIn: { x: anchor.x - dx, y: anchor.y - dy } };
  return anchors.map((candidate, candidateIndex) => (candidateIndex === index ? next : candidate));
};

/** The draft as a canonical BezierPath (vertex ids are stable by index). */
export const penAnchorsToPath = (anchors: readonly PenAnchor[], coordinateSpace: PathCoordinateSpace, closed: boolean): BezierPath => ({
  version: 1,
  coordinateSpace,
  closed,
  points: anchors.map((anchor, index): BezierVertex => ({
    id: `vertex-${index}`,
    x: anchor.x,
    y: anchor.y,
    kind: penAnchorIsSmooth(anchor) ? 'smooth' : 'corner',
    ...(anchor.handleIn ? { handleIn: { ...anchor.handleIn } } : {}),
    ...(anchor.handleOut ? { handleOut: { ...anchor.handleOut } } : {}),
  })),
});

/** Moves every anchor and handle by (-cx, -cy): the draft re-expressed around a centre. */
export const offsetPenAnchors = (anchors: readonly PenAnchor[], cx: number, cy: number): PenAnchor[] => anchors.map((anchor) => ({
  x: anchor.x - cx,
  y: anchor.y - cy,
  ...(anchor.handleIn ? { handleIn: { x: anchor.handleIn.x - cx, y: anchor.handleIn.y - cy } } : {}),
  ...(anchor.handleOut ? { handleOut: { x: anchor.handleOut.x - cx, y: anchor.handleOut.y - cy } } : {}),
}));

/**
 * Drops an anchor that repeats its predecessor (a double-click lands twice) —
 * the only clean-up a Pen drawing gets. Anchors are never simplified away:
 * every one of them is a point the user placed on purpose.
 */
export const dedupePenAnchors = (anchors: readonly PenAnchor[], epsilon = 1e-6): PenAnchor[] => anchors.filter((anchor, index) => {
  if (index === 0) return true;
  const previous = anchors[index - 1];
  return Math.hypot(anchor.x - previous.x, anchor.y - previous.y) > epsilon || penAnchorIsSmooth(anchor);
});
