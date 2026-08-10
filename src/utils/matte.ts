/**
 * M11 Step 2B — Track Matte world-space geometry.
 *
 * Pure, React-free, deterministic. Produces an SVG clipPath <path d="...">
 * for a matte SOURCE part in SCENE/WORLD coordinates.
 *
 * Coordinate system matches PartRenderer EXACTLY:
 *   <g transform="translate(CX + x, CY + y) rotate(r) scale(sx, sy)">
 * i.e. local geometry → scale → rotate → translate (+ stage center offset).
 * Viewport pan/zoom is NOT part of scene coordinates and is never included.
 *
 * Geometry comes exclusively from `shapeGeometry.ts` — nothing is hardcoded
 * here. `custom_freeform` (and non-shape types) return null → no clip.
 */
import type { CharacterPart, MatteMode } from '../types/animator';
import type { WorldTransform } from '../types/composition';
import { getShapeGeometry, type ShapeGeometry } from './shapeGeometry';
import { CANVAS_CENTER } from './constants';

export interface MatteClipPath {
  id: string;
  pathD: string;
}

/** Deterministic SVG id for a matte source — stable across evaluations. */
export function matteClipPathId(sourcePartId: string): string {
  return `kcs-clip-${sourcePartId}`;
}

/**
 * M13 — Deterministic SVG id for a matte <mask> def. Encodes source + mode +
 * inverted so the same source used with different modes/inversions never
 * collides (each (source, mode, inverted) combo gets its own definition).
 */
export function matteMaskId(sourcePartId: string, mode: MatteMode, inverted: boolean): string {
  return `kcs-mask-${sourcePartId}-${mode}${inverted ? '-inv' : ''}`;
}

/**
 * M13 — Resolve a matte's effective mode at runtime.
 * Legacy project data may omit `mode` → treated as 'clip'.
 * An absent/empty matte resolves to `undefined` (no matte).
 */
export function resolveMatteMode(matte: { mode?: MatteMode } | undefined): MatteMode | undefined {
  if (!matte) return undefined;
  return matte.mode ?? 'clip';
}

/** Whether a part's matte is active (`enabled !== false` — absent data is
 *  treated as active so partial/legacy data never hides content). */
export function isMatteActive(matte: { enabled?: boolean } | undefined): boolean {
  return !!matte && matte.enabled !== false;
}

/**
 * Shared world-space geometry for a matte source — the SINGLE geometry
 * computation used by both the clipPath and the <mask> pipelines, so the
 * same source is never computed twice with different math.
 * Returns null when the source has no static shape geometry (freeform,
 * text, image, video — all DEFERRED for the MVP).
 */
export function buildMattePath(
  sourcePart: CharacterPart,
  world: WorldTransform,
): string | null {
  const geo = getShapeGeometry(sourcePart.type);
  if (!geo) return null;
  return geometryToWorldPathD(geo, world);
}

/**
 * Build the world-space clip path for a matte source part (mode 'clip').
 * Thin wrapper over `buildMattePath` — identical geometry, plus the
 * deterministic clip id.
 */
export function buildMatteClipPath(
  sourcePart: CharacterPart,
  world: WorldTransform,
): MatteClipPath | null {
  const pathD = buildMattePath(sourcePart, world);
  if (!pathD) return null;
  return { id: matteClipPathId(sourcePart.id), pathD };
}

/** M13 — pure data for an SVG <mask> def (alpha/luminance/inverted).
 *  The mask wraps the SAME world-space pathD the clipPath uses (no second
 *  geometry computation). Renderer (StagePartLayers) composes the actual
 *  <mask> element — for inverted it adds a full-region background:
 *  - luminance inverted: white region rect + BLACK geometry path
 *  - alpha inverted: the compositing semantics (black path vs evenodd hole)
 *    are confirmed in the browser (Step 2E Playwright) — the flag is exposed
 *    here so the renderer can branch without guessing. */
export interface MatteMask {
  id: string;
  mode: Exclude<MatteMode, 'clip'>;
  inverted: boolean;
  pathD: string;
  /** Fill for the geometry path: 'white' for alpha masks, the source's
   *  evaluated fillColor for luminance masks. */
  fill: string;
}

export function buildMatteMask(
  sourcePart: CharacterPart,
  world: WorldTransform,
  mode: Exclude<MatteMode, 'clip'>,
  inverted: boolean,
  fillColor: string,
): MatteMask | null {
  const pathD = buildMattePath(sourcePart, world);
  if (!pathD) return null;
  return {
    id: matteMaskId(sourcePart.id, mode, inverted),
    mode,
    inverted,
    pathD,
    fill: mode === 'alpha' ? 'white' : fillColor,
  };
}

// ─── World transform (mirrors PartRenderer's SVG transform order) ────────

const deg2rad = (d: number) => (d * Math.PI) / 180;

function applyWorld(p: { x: number; y: number }, w: WorldTransform): { x: number; y: number } {
  const rad = deg2rad(w.rotation);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const sx = p.x * (w.scaleX ?? 1);
  const sy = p.y * (w.scaleY ?? 1);
  return {
    x: CANVAS_CENTER.x + (w.x ?? 0) + (sx * cos - sy * sin),
    y: CANVAS_CENTER.y + (w.y ?? 0) + (sx * sin + sy * cos),
  };
}

const fmt = (n: number) => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};

const fmtPt = (p: { x: number; y: number }) => `${fmt(p.x)} ${fmt(p.y)}`;

function geometryToWorldPathD(geo: ShapeGeometry, w: WorldTransform): string | null {
  switch (geo.kind) {
    case 'polygon': {
      if (geo.points.length < 2) return null;
      const pts = geo.points.map((p) => applyWorld(p, w));
      return `M ${fmtPt(pts[0])}` + pts.slice(1).map((p) => ` L ${fmtPt(p)}`).join('') + ' Z';
    }

    case 'circle': {
      // Local circle r → world ellipse rx = r·|sx|, ry = r·|sy|, rotated by w.rotation.
      const rx = geo.r * Math.abs(w.scaleX ?? 1);
      const ry = geo.r * Math.abs(w.scaleY ?? 1);
      if (rx <= 0 || ry <= 0) return null;
      const a = applyWorld({ x: geo.r, y: 0 }, w);
      const b = applyWorld({ x: -geo.r, y: 0 }, w);
      const rot = w.rotation ?? 0;
      return `M ${fmtPt(a)} A ${fmt(rx)} ${fmt(ry)} ${fmt(rot)} 0 1 ${fmtPt(b)} A ${fmt(rx)} ${fmt(ry)} ${fmt(rot)} 0 1 ${fmtPt(a)}`;
    }

    case 'rect': {
      if (geo.width <= 0 || geo.height <= 0) return null;
      if (geo.rx <= 0) {
        // Plain rect — 4 corners
        const tl = applyWorld({ x: geo.x, y: geo.y }, w);
        const tr = applyWorld({ x: geo.x + geo.width, y: geo.y }, w);
        const br = applyWorld({ x: geo.x + geo.width, y: geo.y + geo.height }, w);
        const bl = applyWorld({ x: geo.x, y: geo.y + geo.height }, w);
        return `M ${fmtPt(tl)} L ${fmtPt(tr)} L ${fmtPt(br)} L ${fmtPt(bl)} Z`;
      }
      // Rounded rect — 8 anchor points + 4 corner arcs. Arc radii scale with
      // the world scale; sweep=1 (Y-down clockwise), rotation goes into the
      // arc rotation parameter. Negative-scale edge case is future scope.
      const rx = geo.rx * Math.abs(w.scaleX ?? 1);
      const ry = geo.rx * Math.abs(w.scaleY ?? 1);
      const rot = w.rotation ?? 0;
      const p = (x: number, y: number) => applyWorld({ x, y }, w);
      const X1 = geo.x + geo.rx;
      const X2 = geo.x + geo.width - geo.rx;
      const Y1 = geo.y + geo.rx;
      const Y2 = geo.y + geo.height - geo.rx;
      const A = (to: { x: number; y: number }) => ` A ${fmt(rx)} ${fmt(ry)} ${fmt(rot)} 0 1 ${fmtPt(to)}`;
      return (
        `M ${fmtPt(p(X1, geo.y))}` +
        ` L ${fmtPt(p(X2, geo.y))}` + A(p(geo.x + geo.width, Y1)) +
        ` L ${fmtPt(p(geo.x + geo.width, Y2))}` + A(p(X2, geo.y + geo.height)) +
        ` L ${fmtPt(p(X1, geo.y + geo.height))}` + A(p(geo.x, Y2)) +
        ` L ${fmtPt(p(geo.x, Y1))}` + A(p(X1, geo.y)) +
        ' Z'
      );
    }

    default:
      return null;
  }
}
