import type { CharacterPart, MaskPoint } from '../types/animator';
import { getPartBounds } from './bounds';

/**
 * Default vector-mask points for a part, following the SHAPE'S OWN OUTLINE
 * instead of a generic bounding box. Mirrors the geometry in
 * ShapePartRenderers / containerOutline so the mask gizmo hugs the shape the
 * user sees (a rhombus gets a rhombus mask, a triangle gets a triangle mask).
 *
 * Fallbacks:
 * - custom_freeform  -> its own vertices (same as before).
 * - unknown types    -> bounding-box rectangle (legacy behavior).
 */
const SHAPE_VERTEX_OFFSETS: Record<string, Array<[number, number]>> = {
  custom_box: [
    [-30, -30],
    [30, -30],
    [30, 30],
    [-30, 30],
  ],
  custom_rect: [
    [-60, -30],
    [60, -30],
    [60, 30],
    [-60, 30],
  ],
  custom_triangle: [
    [0, -35],
    [35, 25],
    [-35, 25],
  ],
  custom_banner: [
    [-80, -25],
    [80, -25],
    [80, 25],
    [-80, 25],
  ],
  custom_capsule: [
    [-50, -20],
    [50, -20],
    [50, 20],
    [-50, 20],
  ],
  custom_diamond: [
    [0, -35],
    [35, 0],
    [0, 35],
    [-35, 0],
  ],
  custom_parallelogram: [
    [-35, -30],
    [85, -30],
    [35, 30],
    [-85, 30],
  ],
  custom_star: [
    [0, -35],
    [10, -10],
    [35, -10],
    [15, 5],
    [23, 30],
    [0, 15],
    [-23, 30],
    [-15, 5],
    [-35, -10],
    [-10, -10],
  ],
  custom_card: [
    [-90, -50],
    [90, -50],
    [90, 50],
    [-90, 50],
  ],
};

/** Sample points on a circle of radius `r` so the mask follows the curve. */
const circlePoints = (r: number, count: number = 16): Array<[number, number]> => {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
};

export const getDefaultMaskPoints = (part: CharacterPart): MaskPoint[] => {
  if (part.type === 'custom_freeform' && part.points && part.points.length >= 3) {
    return part.points.map((p) => ({ x: p.x, y: p.y }));
  }
  if (part.type === 'custom_circle') {
    return circlePoints(30).map(([x, y]) => ({ x, y }));
  }
  const offsets = SHAPE_VERTEX_OFFSETS[part.type];
  if (offsets) {
    return offsets.map(([x, y]) => ({ x, y }));
  }
  // Fallback: bounding-box rectangle (legacy default).
  const bounds = getPartBounds(part);
  const w = bounds.halfW * 2;
  const h = bounds.halfH * 2;
  return [
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 },
  ];
};
