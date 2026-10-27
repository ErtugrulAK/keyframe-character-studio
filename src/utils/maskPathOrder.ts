import type { BezierPath } from '../types/animator';
import { areBezierPathsTopologyCompatible } from './bezierPath';
import { MIN_CLOSED_MASK_POINTS } from './maskPathCreation';

/**
 * C4 — the structure commands of a mask path, each with ONE meaning:
 *
 * - `close` / `open` — whether the path joins its last point back to its first.
 *   Points, handles and the owner layer's transform are untouched. An OPEN mask
 *   still masks (the SVG contract KCS has always rendered: the fill joins the
 *   two ends with a straight line); the canvas draws that implied edge dashed.
 * - `reverse` — the same shape traced the other way round: the order of the
 *   points is reversed and each point's in/out handles swap. A closed path
 *   keeps its first point (as After Effects' Reverse Path Direction does).
 * - `first` — makes the selected point the path's first point. A closed path
 *   keeps its shape; an open path has two ends only, so this is refused there.
 * - `earlier` / `later` — moves the selected point one place in the path's
 *   ORDER (swaps it with its neighbour): the outline changes, because the path
 *   now visits the points in another order. This is not the layer stack order.
 *
 * Every command is an id-level `PathOrderEdit`, so the SAME edit applies to the
 * static path and to every keyframe of an animated path: their points keep
 * one identity order and keep interpolating key to key. Adding or removing
 * points is not one of these and stays refused on an animated path.
 */
export type PathOrderCommand = 'close' | 'open' | 'reverse' | 'first' | 'earlier' | 'later';

export interface PathOrderEdit {
  /** Point ids in their new order. */
  order: string[];
  /** Swap every point's in/out handles (a reversed direction). */
  swapHandles: boolean;
  closed: boolean;
}

export type PathOrderPlan =
  | { ok: true; edit: PathOrderEdit; /** Where the selected point ends up. */ selectedIndex: number | null }
  | { ok: false; reason: string };

const refuse = (reason: string): PathOrderPlan => ({ ok: false, reason });

/** Plans a structure command on a path (by ids), or explains why it cannot run. */
export const planPathOrderEdit = (path: BezierPath, command: PathOrderCommand, selectedIndex: number | null): PathOrderPlan => {
  const ids = path.points.map((point) => point.id);
  if (new Set(ids).size !== ids.length) return refuse('This path has points without their own identity; it cannot be reordered safely.');
  const selectedId = selectedIndex !== null ? ids[selectedIndex] : undefined;
  const at = (order: string[], swapHandles: boolean, closed: boolean): PathOrderPlan => ({
    ok: true,
    edit: { order, swapHandles, closed },
    selectedIndex: selectedId ? order.indexOf(selectedId) : null,
  });
  switch (command) {
    case 'close':
      if (path.closed) return refuse('The path is already closed.');
      if (ids.length < MIN_CLOSED_MASK_POINTS) return refuse(`A closed path needs at least ${MIN_CLOSED_MASK_POINTS} points.`);
      return at(ids, false, true);
    case 'open':
      if (!path.closed) return refuse('The path is already open.');
      return at(ids, false, false);
    case 'reverse': {
      const order = path.closed ? [ids[0], ...ids.slice(1).reverse()] : [...ids].reverse();
      return at(order, true, path.closed);
    }
    case 'first': {
      if (selectedIndex === null || !selectedId) return refuse('Select a point first.');
      if (!path.closed) return refuse('An open path starts at one of its two ends: reverse its direction to start at the other end.');
      if (selectedIndex === 0) return refuse('This point is already the first point.');
      return at([...ids.slice(selectedIndex), ...ids.slice(0, selectedIndex)], false, true);
    }
    case 'earlier':
    case 'later': {
      if (selectedIndex === null || !selectedId) return refuse('Select a point first.');
      const target = selectedIndex + (command === 'earlier' ? -1 : 1);
      if (target < 0 || target >= ids.length) return refuse(command === 'earlier' ? 'This is already the first point in the path order.' : 'This is already the last point in the path order.');
      const order = [...ids];
      [order[selectedIndex], order[target]] = [order[target], order[selectedIndex]];
      return at(order, false, path.closed);
    }
    default:
      return refuse('Unknown path command.');
  }
};

/**
 * Applies a planned edit to a path with the same points (by id). Returns null
 * when the path does not have exactly those points — the caller refuses the
 * whole command then, so no keyframe is ever left with another topology.
 */
export const applyPathOrderEdit = (path: BezierPath, edit: PathOrderEdit): BezierPath | null => {
  if (path.points.length !== edit.order.length) return null;
  const byId = new Map(path.points.map((point) => [point.id, point]));
  if (byId.size !== edit.order.length || edit.order.some((id) => !byId.has(id))) return null;
  return {
    ...path,
    closed: edit.closed,
    points: edit.order.map((id) => {
      const point = byId.get(id)!;
      if (!edit.swapHandles) return point;
      const { handleIn, handleOut, ...rest } = point;
      return { ...rest, ...(handleOut ? { handleIn: handleOut } : {}), ...(handleIn ? { handleOut: handleIn } : {}) };
    }),
  };
};

/**
 * Applies one edit to the static path and every keyframe path of the mask, all
 * or nothing: the reason when any keyframe does not share the static path's
 * points, else the new paths (keyframes in the same order as given).
 */
export const applyPathOrderEditEverywhere = (
  base: BezierPath,
  keyframePaths: readonly BezierPath[],
  edit: PathOrderEdit,
): { ok: true; base: BezierPath; keyframePaths: BezierPath[] } | { ok: false; reason: string } => {
  if (keyframePaths.some((path) => !areBezierPathsTopologyCompatible(base, path))) {
    return { ok: false, reason: 'The keyframes of this mask path do not all share the same points, so its point order cannot change without breaking the animation.' };
  }
  const nextBase = applyPathOrderEdit(base, edit);
  const nextKeys = keyframePaths.map((path) => applyPathOrderEdit(path, edit));
  if (!nextBase || nextKeys.some((path) => path === null)) {
    return { ok: false, reason: 'The keyframes of this mask path do not all share the same points, so its point order cannot change without breaking the animation.' };
  }
  return { ok: true, base: nextBase, keyframePaths: nextKeys as BezierPath[] };
};

