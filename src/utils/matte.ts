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
import type { BodyPartType, CharacterPart, MatteMode } from '../types/animator';
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
 * - static shapes → shapeGeometry (single source)
 * - custom_freeform → CharacterPart.points (the SAME source the freeform
 *   renderer draws via buildFreeformPath — no second geometry system)
 * Returns null when the source has no usable geometry (text, image, video,
 * degenerate freeform points — DEFERRED for the MVP).
 */
export function buildMattePath(
  sourcePart: CharacterPart,
  world: WorldTransform,
): string | null {
  if (sourcePart.type === 'custom_freeform') {
    return freeformWorldPathD(sourcePart.points, world);
  }
  const geo = getShapeGeometry(sourcePart.type);
  if (!geo) return null;
  return geometryToWorldPathD(geo, world);
}

/** M15 — world-space polygon path from LOCAL freeform points. Identical math
 *  to the static polygon branch (applyWorld per point), fed by
 *  `CharacterPart.points` — the renderer's buildFreeformPath source. */
function freeformWorldPathD(
  points: { x: number; y: number }[] | undefined,
  w: WorldTransform,
): string | null {
  if (!Array.isArray(points) || points.length < 2) return null;
  const pts = points.map((p) => applyWorld(p, w));
  return `M ${fmtPt(pts[0])}` + pts.slice(1).map((p) => ` L ${fmtPt(p)}`).join('') + ' Z';
}

/** M15 — whether a part can be a matte source: static shape geometry OR a
 *  freeform polygon (custom_freeform → CharacterPart.points). Text/image/
 *  video and other non-geometric types are not eligible. */
export function isMatteEligible(part: { type: string } | undefined): boolean {
  if (!part) return false;
  if (part.type === 'custom_freeform') return true;
  return getShapeGeometry(part.type as BodyPartType) !== null;
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
  /** M14: optional soft-edge feather (world-space px, raw value — the
   *  renderer normalizes via normalizeFeather). Absent/0 → sharp edge. */
  feather?: number;
  /** M16: optional matte strength (raw value — renderer normalizes via
   *  normalizeStrength). Absent = full strength (legacy). Render only —
   *  geometry is NEVER affected. */
  strength?: number;
  /** M17: optional world-space <linearGradient> def id referenced by the
   *  mask content fill (url(#id)). Absent = legacy solid fill. Render only —
   *  NEVER geometry. */
  gradientId?: string;
}

/**
 * M14 — Normalize a feather value to a safe non-negative number.
 * undefined/0 → 0 (sharp M13 edge); negative/NaN/±Infinity → 0.
 * Pure; NEVER touches geometry (feather is a render parameter only).
 */
export function normalizeFeather(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

/**
 * M16 — Normalize a matte strength value to a safe 0-1 number.
 * undefined/NaN/±Infinity/negative/>1 → 1 (full strength = legacy behavior).
 * 0 is a VALID value (matte disabled) — never collapse it with `|| 1`.
 * Pure; NEVER touches geometry (strength is a render parameter only).
 */
export function normalizeStrength(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  if (value < 0 || value > 1) return 1;
  return value;
}

/** M17 — one default gradient stop. */
export interface MatteGradientStop {
  offset: number;   // 0..1
  color: string;
  opacity: number;  // 0..1
}

/**
 * M17 — Normalize a source-local gradient angle (degrees) into [0, 360).
 * undefined → undefined (SEMANTIC: gradient absent — never coerce to 0);
 * NaN/±Infinity (malformed numeric) → 0; finite → ((v % 360) + 360) % 360.
 * Pure; NEVER touches geometry (a paint parameter only).
 */
export function normalizeGradientAngle(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return ((value % 360) + 360) % 360;
}

/**
 * M17 — Deterministic <linearGradient> id for a matte source.
 * kcs-mg-{sourcePartId}-{normalizedAngle} (360 ≡ 0, -315 ≡ 45 — the id uses
 * the NORMALIZED angle, so equivalent angles share the def). Absent gradient
 * → undefined (no gradient def requested). Pure, no cache.
 */
export function gradientId(sourcePartId: string, gradient: { angle: number } | undefined): string | undefined {
  if (!gradient) return undefined;
  const angle = normalizeGradientAngle(gradient.angle) ?? 0;
  return `kcs-mg-${sourcePartId}-${angle}`;
}

/**
 * M17 — Normalize a gradient object: undefined stays undefined (legacy
 * projects remain gradient-free); a present object gets a safe angle
 * (NaN/±Infinity/undefined angle → 0). No defaults create a gradient where
 * none existed.
 */
export function normalizeGradient(gradient: { angle: number } | undefined): { angle: number } | undefined {
  if (!gradient || typeof gradient !== 'object') return undefined;
  return { angle: normalizeGradientAngle(gradient.angle) ?? 0 };
}

/**
 * M17 — Default two-stop gradient paint for the MVP (no user stops yet).
 * ALPHA: white opaque → white transparent (spatial alpha fade).
 * LUMINANCE: white → black (spatial luminance fade, grayscale rule).
 * Pure + deterministic — repeated calls return identical data.
 */
export function getDefaultGradientStops(mode: Exclude<MatteMode, 'clip'>): MatteGradientStop[] {
  if (mode === 'luminance') {
    return [
      { offset: 0, color: 'white', opacity: 1 },
      { offset: 1, color: 'black', opacity: 1 },
    ];
  }
  return [
    { offset: 0, color: 'white', opacity: 1 },
    { offset: 1, color: 'white', opacity: 0 },
  ];
}

/** M17 — world-space gradient endpoints (linearGradient x1/y1/x2/y2). */
export interface MatteGradientEndpoints {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * M17 — World-space endpoints for the source-local gradient angle.
 *
 * 1. The source's LOCAL bbox is derived from the SAME points buildMattePath
 *    uses (shapeGeometry for static shapes, CharacterPart.points for
 *    freeform) — never a second geometry system.
 * 2. The four bbox corners are projected onto the angle direction
 *    (dx=cos θ, dy=sin θ); the min/max projection defines the extent.
 * 3. Two LOCAL points are reconstructed through the bbox center along the
 *    direction, then transformed with applyWorld — the EXACT world transform
 *    math the matte path uses — so the gradient moves/rotates/scales/flips
 *    WITH the source (rotation 0 = left→right, 90 = top→bottom).
 *
 * Only TWO points are ever transformed. Pure; no cache.
 */
export function gradientEndpoints(
  sourcePart: Pick<CharacterPart, 'type' | 'points'>,
  world: WorldTransform,
  angle: number,
): MatteGradientEndpoints | undefined {
  // Local bounds from the SAME geometry the matte path uses — shapeGeometry
  // for static shapes, CharacterPart.points for freeform. Never a second
  // geometry system: only the bbox (2 endpoint points) is derived.
  const geo = sourcePart.type === 'custom_freeform' ? undefined : getShapeGeometry(sourcePart.type as BodyPartType);
  const pts = sourcePart.type === 'custom_freeform'
    ? sourcePart.points
    : geo
      ? geo.kind === 'polygon'
        ? geo.points
        : geo.kind === 'rect'
          ? [
              { x: geo.x, y: geo.y },
              { x: geo.x + geo.width, y: geo.y },
              { x: geo.x, y: geo.y + geo.height },
              { x: geo.x + geo.width, y: geo.y + geo.height },
            ]
          : // circle — local center (0,0), radius r
            [
              { x: -geo.r, y: -geo.r },
              { x: geo.r, y: -geo.r },
              { x: -geo.r, y: geo.r },
              { x: geo.r, y: geo.r },
            ]
      : undefined;
  if (!pts || pts.length === 0) return undefined;
  const a = (normalizeGradientAngle(angle) ?? 0) * (Math.PI / 180);
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  // Project the four corners onto the direction; the min/max projection is
  // the extent of the bbox along the angle (unit direction → t in px).
  let minP = Infinity, maxP = -Infinity;
  for (const [x, y] of [[minX, minY], [maxX, minY], [minX, maxY], [maxX, maxY]] as const) {
    const p = x * dx + y * dy;
    minP = Math.min(minP, p);
    maxP = Math.max(maxP, p);
  }
  const half = (maxP - minP) / 2;
  const p1 = { x: cx - dx * half, y: cy - dy * half };
  const p2 = { x: cx + dx * half, y: cy + dy * half };
  const w1 = applyWorld(p1, world);
  const w2 = applyWorld(p2, world);
  return { x1: w1.x, y1: w1.y, x2: w2.x, y2: w2.y };
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

/**
 * M13 Step 2C — build a MatteMask from an ALREADY computed world-space pathD.
 * Used by the renderer so the same source's geometry is computed ONCE even
 * when it is consumed by several mask modes (alpha + luminance + inverted
 * on the same source share one buildMattePath call). Matches buildMatteMask
 * field-for-field for the same inputs.
 */
export function buildMatteMaskFromPath(
  sourcePartId: string,
  pathD: string,
  mode: Exclude<MatteMode, 'clip'>,
  inverted: boolean,
  fillColor: string,
  feather?: number,
  strength?: number,
): MatteMask {
  return {
    id: matteMaskId(sourcePartId, mode, inverted),
    mode,
    inverted,
    pathD,
    fill: mode === 'alpha' ? 'white' : fillColor,
    ...(feather !== undefined ? { feather } : {}),
    ...(strength !== undefined ? { strength } : {}),
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
