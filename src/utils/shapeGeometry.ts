/**
 * Shape Geometry — single source of truth for LOCAL-space shape geometry.
 *
 * Extracted from ShapePartRenderers (M11 Step 2A) so that any consumer that
 * needs the same local-space geometry (e.g. the track-matte world-path
 * helper) reads it from ONE place instead of duplicating hardcoded values.
 *
 * Semantics:
 * - All values are LOCAL coordinates (center-relative, Y-down) — exactly the
 *   numbers the renderer used before this extraction.
 * - The renderer applies the world transform (translate/rotate/scale) itself;
 *   this module knows nothing about transforms or SVG.
 * - `custom_freeform` is NOT included here: its path comes from
 *   `buildFreeformPath` (freeform.ts) which is already a single source.
 *
 * Pure, React-free, deterministic.
 */
import type { BodyPartType } from '../types/animator';

export type ShapeGeometry =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx: number }
  | { kind: 'circle'; r: number }
  | { kind: 'polygon'; points: { x: number; y: number }[] };

const STAR_POINTS: { x: number; y: number }[] = [
  { x: 0, y: -35 },
  { x: 10, y: -10 },
  { x: 35, y: -10 },
  { x: 15, y: 5 },
  { x: 23, y: 30 },
  { x: 0, y: 15 },
  { x: -23, y: 30 },
  { x: -15, y: 5 },
  { x: -35, y: -10 },
  { x: -10, y: -10 },
];

const TRIANGLE_POINTS: { x: number; y: number }[] = [
  { x: 0, y: -35 },
  { x: 35, y: 25 },
  { x: -35, y: 25 },
];

const PARALLELOGRAM_POINTS: { x: number; y: number }[] = [
  { x: -35, y: -30 },
  { x: 85, y: -30 },
  { x: 35, y: 30 },
  { x: -85, y: 30 },
];

const DIAMOND_POINTS: { x: number; y: number }[] = [
  { x: 0, y: -35 },
  { x: 35, y: 0 },
  { x: 0, y: 35 },
  { x: -35, y: 0 },
];

/** Local-space geometry for a shape type, or null when the type has no
 *  static geometry (freeform uses buildFreeformPath; text/image/video/cloner
 *  are not shapes). */
export function getShapeGeometry(type: BodyPartType): ShapeGeometry | null {
  switch (type) {
    case 'custom_star':
      return { kind: 'polygon', points: STAR_POINTS };
    case 'custom_circle':
      return { kind: 'circle', r: 30 };
    case 'custom_box':
      return { kind: 'rect', x: -30, y: -30, width: 60, height: 60, rx: 0 };
    case 'custom_rect':
      return { kind: 'rect', x: -60, y: -30, width: 120, height: 60, rx: 0 };
    case 'custom_triangle':
      return { kind: 'polygon', points: TRIANGLE_POINTS };
    case 'custom_parallelogram':
      return { kind: 'polygon', points: PARALLELOGRAM_POINTS };
    case 'custom_banner':
      return { kind: 'rect', x: -80, y: -25, width: 160, height: 50, rx: 10 };
    case 'custom_capsule':
      return { kind: 'rect', x: -50, y: -20, width: 100, height: 40, rx: 20 };
    case 'custom_diamond':
      return { kind: 'polygon', points: DIAMOND_POINTS };
    case 'custom_card':
      return { kind: 'rect', x: -90, y: -50, width: 180, height: 100, rx: 12 };
    default:
      return null;
  }
}

/** Serialize polygon points into the space-separated "x,y" string the SVG
 *  polygon element expects (exactly the format the renderer used). */
export function polygonPointsToString(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}
