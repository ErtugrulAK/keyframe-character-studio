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
import { EDITOR_CAMERA_CENTER, type CoordinatePoint } from './projectCoordinates';

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
  outputOrigin: CoordinatePoint = EDITOR_CAMERA_CENTER,
): string | null {
  if (sourcePart.type === 'custom_freeform') {
    return freeformWorldPathD(sourcePart.points, world, outputOrigin);
  }
  const geo = getShapeGeometry(sourcePart.type);
  if (!geo) return null;
  return geometryToWorldPathD(geo, world, outputOrigin);
}

/** M15 — world-space polygon path from LOCAL freeform points. Identical math
 *  to the static polygon branch (applyWorld per point), fed by
 *  `CharacterPart.points` — the renderer's buildFreeformPath source. */
function freeformWorldPathD(
  points: { x: number; y: number }[] | undefined,
  w: WorldTransform,
  outputOrigin: CoordinatePoint,
): string | null {
  if (!Array.isArray(points) || points.length < 2) return null;
  const pts = points.map((p) => applyWorld(p, w, outputOrigin));
  return `M ${fmtPt(pts[0])}` + pts.slice(1).map((p) => ` L ${fmtPt(p)}`).join('') + ' Z';
}

/** M15 — whether a part can be a matte source: static shape geometry OR a
 *  freeform polygon (custom_freeform → CharacterPart.points) OR a text part
 *  (M18 — the glyphs become the mask CONTENT element, no path geometry) OR an
 *  image part (M21 — the <image> becomes the mask CONTENT element, no path
 *  geometry — 7A pixel-verified). Video/cloner/particle stay ineligible. */
export function isMatteEligible(part: { type: string } | undefined): boolean {
  if (!part) return false;
  if (part.type === 'custom_freeform') return true;
  if (part.type === 'custom_text') return true;
  if (part.type === 'custom_image') return true;
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
  outputOrigin: CoordinatePoint = EDITOR_CAMERA_CENTER,
): MatteClipPath | null {
  const pathD = buildMattePath(sourcePart, world, outputOrigin);
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
  /** World-space matte contour. NULL only for M18 text masks (text has NO
   *  path geometry — buildMattePath stays null; the glyphs are the mask
   *  content via `text`). */
  pathD: string | null;
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
  /** M18: text mask content — present ONLY for custom_text sources (pathD is
   *  then null). The glyphs are rendered as a transform-baked <text> element
   *  inside the mask (the app's text renderer semantics). Render-only data —
   *  NEVER serialized into PartMatte (content/fonts live on the source part
   *  and are read at runtime). */
  text?: MatteTextContent | null;
  /** M21: image mask content — present ONLY for custom_image sources (pathD
   *  is then null). The image is rendered as a transform-baked <image>
   *  element inside the mask (7A spike: SVG <image> works as mask content;
   *  alpha flows into alpha masks, luminance is deterministic). Render-only
   *  data — NEVER serialized into PartMatte (href/dimensions live on the
   *  source part and are read at runtime). */
  image?: MatteImageContent | null;
  /** M21: nested content-mask id for the image × gradient composition
   *  (7A pixel-verified — <image> cannot consume fill; the final mask wraps
   *  the gradient rect with a mask that carries the image alpha). Present
   *  ONLY when an image source has a gradient AND is not inverted. The
   *  content mask def (kcs-mask-{src}-img) lives in the renderer's
   *  imageContentMasks Map — same dedupe as every other def. */
  imageContentMaskId?: string;
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

/** M20 — Deterministic gradient type normalization: THE single authority.
 *  Absent/undefined/'linear' → 'linear' (legacy byte-for-byte); 'radial' →
 *  'radial'; any malformed value → 'linear'. Pure, idempotent, Node-safe. */
export function normalizeGradientType(value: unknown): 'linear' | 'radial' {
  return value === 'radial' ? 'radial' : 'linear';
}

/** M20 — Derived RADIAL gradient geometry (paint parameter — NEVER geometry,
 *  NEVER persisted). Center = source local bounds center; radius = the local
 *  bounds' bounding circle (sqrt(w²+h²)/2) — the same sourceLocalPoints used
 *  by gradientEndpoints (never a second geometry system).
 *
 *  Coordinate spaces (6A pixel-verified):
 *  - `local: false` (shape/freeform/INVERTED text) → WORLD: center through
 *    applyWorld, radius × max(|scaleX|,|scaleY|) so the world-space circle
 *    SUFFICIENTLY COVERS the transformed source (non-uniform scale stays a
 *    circle — rX/rY unnecessary; zero scale treated as 1 like worldToLocal).
 *  - `local: true` (non-inverted TEXT) → LOCAL: center/radius in the text's
 *    own space (the def is consumed by the transformed text element; 4A).
 *
 *  Pure + deterministic; no cache, no random/time. */
export interface MatteRadialGeometry {
  cx: number;
  cy: number;
  r: number;
}

export function radialGradientGeometry(
  sourcePart: Pick<CharacterPart, 'type' | 'points'>,
  world: WorldTransform,
  local: boolean,
  outputOrigin: CoordinatePoint = EDITOR_CAMERA_CENTER,
): MatteRadialGeometry | undefined {
  const pts = sourceLocalPoints(sourcePart);
  if (!pts) return undefined;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const w = maxX - minX;
  const h = maxY - minY;
  const localRadius = Math.sqrt(w * w + h * h) / 2;
  if (local) {
    return { cx, cy, r: localRadius }; // LOCAL (text element space)
  }
  const wc = applyWorld({ x: cx, y: cy }, world, outputOrigin);
  // Zero scale → 1 (mirrors worldToLocal); abs for negative (flip) scales.
  const sx = world.scaleX === 0 ? 1 : Math.abs(world.scaleX ?? 1);
  const sy = world.scaleY === 0 ? 1 : Math.abs(world.scaleY ?? 1);
  return { cx: wc.x, cy: wc.y, r: localRadius * Math.max(sx, sy) };
}

/** M20 — Deterministic <linearGradient|radialGradient> id for a matte source.
 *  kcs-mg-{sourcePartId}-{normalizedAngle} (360 ≡ 0, -315 ≡ 45 — the id uses
 *  the NORMALIZED angle, so equivalent angles share the def). Absent gradient
 *  → undefined (no gradient def requested).
 *  M19 — when `stops` is present (custom multi-stop paint), the id gains a
 *  deterministic `-s{stopsHash}` suffix so two mattes with the SAME
 *  source+angle but DIFFERENT stops never share a def (5A spike: duplicate ids
 *  make Chromium resolve url() to the FIRST def — the second matte's stops are
 *  silently ignored). LEGACY data without stops keeps the byte-for-byte id.
 *  M20 — radial gets an unambiguous `-radial` discriminator (never collides
 *  with the numeric linear angle segment); radial geometry is source-derived,
 *  so the id carries type + stops only. Pure, no cache.
 */
export function gradientId(
  sourcePartId: string,
  gradient: { type?: 'linear' | 'radial'; angle?: number; stops?: MatteGradientStop[] } | undefined,
): string | undefined {
  if (!gradient) return undefined;
  if (normalizeGradientType(gradient.type) === 'radial') {
    const base = `kcs-mg-${sourcePartId}-radial`;
    if (!Array.isArray(gradient.stops)) return base;
    // The hash is computed over the NORMALIZED stops (sorted/clamped) so
    // equal stop sets always produce the same id (same FNV-1a as M19).
    return `${base}-s${gradientStopsHash(normalizeGradientStops(gradient.stops, 'alpha'))}`;
  }
  const angle = normalizeGradientAngle(gradient.angle) ?? 0;
  const base = `kcs-mg-${sourcePartId}-${angle}`;
  if (!Array.isArray(gradient.stops)) return base; // legacy — byte-for-byte
  // The hash is computed over the NORMALIZED stops (sorted/clamped) so equal
  // stop sets always produce the same id. The fallback mode only affects
  // malformed input (which renders the mode defaults anyway) — for valid
  // arrays the normalization is mode-independent.
  const normalized = normalizeGradientStops(gradient.stops, 'alpha');
  return `${base}-s${gradientStopsHash(normalized)}`;
}

/**
 * M19 — Deterministic normalization of user gradient stops (paint data only,
 * NEVER geometry, NEVER a channel — M8 untouched). Pure + Node-compatible.
 *
 * Policy (documented contract):
 * - `stops` absent / not an array / empty / fewer than 2 VALID stops →
 *   `getDefaultGradientStops(mode)` (legacy 2-stop behavior, byte-for-byte).
 * - Per-stop field salvage: offset → finite number clamped to [0,1]
 *   (malformed → 0); opacity → finite number clamped to [0,1] (missing /
 *   malformed → 1); color → non-empty string (malformed → 'white'). No color
 *   parsing is performed (no case folding / rgb() normalization — colors are
 *   opaque strings, matching the existing paint model).
 * - Non-object entries are DROPPED (e.g. numbers).
 * - Result is sorted by offset ASCENDING with a STABLE sort — equal offsets
 *   keep their input order (5A spike: Chromium processes stops in document
 *   order, so the later stop at a duplicated offset wins — stable order makes
 *   that deterministic).
 * - The returned array is the canonical form: identical normalized stop sets
 *   produce identical arrays (used by the id hash).
 */
export function normalizeGradientStops(
  stops: MatteGradientStop[] | undefined,
  mode: Exclude<MatteMode, 'clip'>,
): MatteGradientStop[] {
  if (!Array.isArray(stops) || stops.length === 0) return getDefaultGradientStops(mode);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const out: MatteGradientStop[] = [];
  for (const raw of stops) {
    if (typeof raw !== 'object' || raw === null) continue;
    const offset = typeof raw.offset === 'number' && Number.isFinite(raw.offset)
      ? clamp(raw.offset, 0, 1)
      : 0;
    const opacity = typeof raw.opacity === 'number' && Number.isFinite(raw.opacity)
      ? clamp(raw.opacity, 0, 1)
      : 1;
    const color = typeof raw.color === 'string' && raw.color.length > 0
      ? raw.color
      : 'white';
    out.push({ offset, color, opacity });
  }
  if (out.length < 2) return getDefaultGradientStops(mode);
  // Stable sort by offset — equal offsets keep input (document) order.
  return out
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.offset - b.s.offset || a.i - b.i)
    .map((x) => x.s);
}

/** M19 — canonical serialization of NORMALIZED stops: a deterministic string
 *  where equal stop sets (after normalization) produce equal keys, independent
 *  of the original insertion order. Colors are NOT parsed (opaque strings). */
export function canonicalStopsKey(stops: MatteGradientStop[]): string {
  return stops.map((s) => `${s.offset};${s.color};${s.opacity}`).join('|');
}

/** M19 — deterministic 32-bit FNV-1a hash (hex) over the canonical stops key.
 *  Stable across runs, serialization and JS object insertion order (the key
 *  is built from the sorted normalized array). Collision space 2^32 — ample
 *  for the local SVG def namespace. No crypto, no randomness. */
export function gradientStopsHash(stops: MatteGradientStop[]): string {
  const key = canonicalStopsKey(stops);
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** M19 — deterministic MASK-id suffix for a gradient: `-g{angle}` (legacy,
 *  byte-for-byte) or `-g{angle}-s{stopsHash}` when custom stops are present.
 *  The stops identity MUST survive the mask id: two targets with the same
 *  source+mode+inverted+feather+strength+angle but DIFFERENT stops would
 *  otherwise share one mask (the dedupe Map key) and silently overwrite each
 *  other's paint (5A spike). The hash matches the def-id hash (same normalized
 *  stops → same suffix).
 *  M20 — radial masks get an unambiguous `-radial[-s{hash}]` discriminator so
 *  linear and radial variants of the same source never collide. Pure. */
export function matteMaskGradientSuffix(
  gradient: { type?: 'linear' | 'radial'; angle?: number; stops?: MatteGradientStop[] } | undefined,
): string {
  if (!gradient) return '';
  if (normalizeGradientType(gradient.type) === 'radial') {
    const base = '-radial';
    if (!Array.isArray(gradient.stops)) return base; // radial default stops
    return `${base}-s${gradientStopsHash(normalizeGradientStops(gradient.stops, 'alpha'))}`;
  }
  const angle = normalizeGradientAngle(gradient.angle) ?? 0;
  const base = `-g${angle}`;
  if (!Array.isArray(gradient.stops)) return base; // legacy — byte-for-byte
  return `${base}-s${gradientStopsHash(normalizeGradientStops(gradient.stops, 'alpha'))}`;
}

// ─── M18: text matte — pure data (mask content element, NOT geometry) ──────

/** M18 — render-only text mask content, mapped from the SOURCE part's runtime
 *  fields (mirrors TextAndClonerRenderers exactly: `textValue || 'TEXT'`,
 *  `fontSize || 24`, hardcoded bold, `fontFamily || 'Outfit'`, centered at the
 *  local origin with middle/middle anchor). No new persistent fields — the
 *  source part stays the single source of truth. */
export interface MatteTextContent {
  content: string;
  fontSize: number;
  fontWeight: string;
  fontFamily: string;
  textAnchor: 'middle';
  dominantBaseline: 'middle';
  x: 0;
  y: 0;
}

export function textMaskContent(
  sourcePart: Pick<CharacterPart, 'textValue' | 'fontSize' | 'fontFamily'> | undefined,
): MatteTextContent | undefined {
  if (!sourcePart) return undefined;
  return {
    content: sourcePart.textValue || 'TEXT',
    fontSize: sourcePart.fontSize || 24,
    fontWeight: 'bold',
    fontFamily: sourcePart.fontFamily || 'Outfit',
    textAnchor: 'middle',
    dominantBaseline: 'middle',
    x: 0,
    y: 0,
  };
}

/** M18 — build the render-data MatteMask for a TEXT source. pathD is null
 *  (text has no path geometry — buildMattePath stays untouched); the glyphs
 *  are the mask content via `text`. `fill` carries the TEXT fill: 'white'
 *  (normal) or 'black' (inverted — 4A decision: inverted text ALWAYS uses the
 *  luminance structure: white region rect + black text, mask-type luminance). */
export function buildMatteTextMask(
  sourcePartId: string,
  content: MatteTextContent,
  mode: Exclude<MatteMode, 'clip'>,
  inverted: boolean,
  feather?: number,
  strength?: number,
): MatteMask {
  return {
    id: matteMaskId(sourcePartId, mode, inverted),
    mode,
    inverted,
    pathD: null,
    fill: inverted ? 'black' : 'white',
    text: content,
    ...(feather !== undefined ? { feather } : {}),
    ...(strength !== undefined ? { strength } : {}),
  };
}

/** M21 — deterministic media dimension normalization for image layout bounds.
 *  Positive finite number → as-is; anything else (undefined/0/negative/NaN/
 *  Infinity) → the MediaPartRenderer default (180×120). Never reads pixels. */
export function normalizeMediaDimension(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

/** M21 — runtime image mask content descriptor (the <image> element data the
 *  mask content needs). href resolution follows MediaPartRenderer's SINGLE
 *  authority: `imageUrl || innerMediaUrl` — no third URL field is invented.
 *  PreserveAspectRatio matches the app image renderer ('xMidYMid slice').
 *  Pure + deterministic; NEVER persisted into PartMatte (the source part's
 *  own fields are the persistent source of truth). */
export interface MatteImageContent {
  href: string;
  width: number;
  height: number;
  preserveAspectRatio: 'xMidYMid slice';
}

export function imageMaskContent(
  sourcePart: Pick<CharacterPart, 'imageUrl' | 'innerMediaUrl' | 'width' | 'height'> | undefined,
): MatteImageContent | undefined {
  if (!sourcePart) return undefined;
  const href = sourcePart.imageUrl || sourcePart.innerMediaUrl;
  if (!href) return undefined;
  return {
    href,
    width: normalizeMediaDimension(sourcePart.width, 180),
    height: normalizeMediaDimension(sourcePart.height, 120),
    preserveAspectRatio: 'xMidYMid slice',
  };
}

/** M21 — build the render-data MatteMask for an IMAGE source. pathD is null
 *  (image has no path geometry — buildMattePath stays untouched); the <image>
 *  is the mask content via `image`.
 *  INVERTED CONTRACT (7A pixel-verified): an <image> CANNOT be repainted
 *  black like text — `fill` stays 'white' and inverted semantics come from
 *  the LUMINANCE structure: dark image pixels punch holes, bright image
 *  pixels stay visible. The renderer must use mask-type luminance for
 *  inverted image (never a black repaint).
 *  GRADIENT CONTRACT (7A): <image> cannot consume fill — when a gradient is
 *  present AND the mask is not inverted, the renderer composes image alpha ×
 *  gradient paint via a nested content mask (imageContentMaskId). */
export function buildMatteImageMask(
  sourcePartId: string,
  content: MatteImageContent,
  mode: Exclude<MatteMode, 'clip'>,
  inverted: boolean,
  feather?: number,
  strength?: number,
): MatteMask {
  return {
    id: matteMaskId(sourcePartId, mode, inverted),
    mode,
    inverted,
    pathD: null,
    fill: 'white',
    image: content,
    // Nested content mask is only meaningful for the non-inverted
    // gradient composition; the renderer uses it iff gradientId exists too.
    imageContentMaskId: `kcs-mask-${sourcePartId}-img`,
    ...(feather !== undefined ? { feather } : {}),
    ...(strength !== undefined ? { strength } : {}),
  };
}

/** M18 — inverse of the matte world transform (applyWorld). Pure point
 *  conversion for the TEXT mask branch: the gradient def endpoints are
 *  produced in world space by the M17 helper, then converted to the text
 *  source's LOCAL space because a gradient referenced from a <text> inside a
 *  transformed <g> resolves in that local space (4A pixel-verified). This is
 *  a two-point coordinate conversion — NEVER a geometry system. Zero scale
 *  (degenerate/collapsed source) → treated as 1 (deterministic, NaN-free —
 *  the source is invisible anyway). */
export function worldToLocal(
  p: { x: number; y: number },
  w: WorldTransform,
  outputOrigin: CoordinatePoint = EDITOR_CAMERA_CENTER,
): { x: number; y: number } {
  const rad = ((w.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const sx = w.scaleX === 0 ? 1 : (w.scaleX ?? 1);
  const sy = w.scaleY === 0 ? 1 : (w.scaleY ?? 1);
  const dx = p.x - (outputOrigin.x + (w.x ?? 0));
  const dy = p.y - (outputOrigin.y + (w.y ?? 0));
  return {
    x: (dx * cos + dy * sin) / sx,
    y: (-dx * sin + dy * cos) / sy,
  };
}

/** M18 — local-space gradient endpoints for a TEXT source: the M17
 *  world-space endpoints (source local bbox + angle → applyWorld) converted
 *  through the inverse transform. The renderer feeds these into the def the
 *  text branch references (the reference resolves in the text's local space). */
export function gradientEndpointsLocal(
  sourcePart: Pick<CharacterPart, 'type' | 'points'>,
  world: WorldTransform,
  angle: number,
  outputOrigin: CoordinatePoint = EDITOR_CAMERA_CENTER,
): MatteGradientEndpoints | undefined {
  const worldEps = gradientEndpoints(sourcePart, world, angle, outputOrigin);
  if (!worldEps) return undefined;
  const p1 = worldToLocal({ x: worldEps.x1, y: worldEps.y1 }, world, outputOrigin);
  const p2 = worldToLocal({ x: worldEps.x2, y: worldEps.y2 }, world, outputOrigin);
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
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
/** M18 — canonical LOCAL bounds for a text source's gradient span (a typical
 *  text line: 200×60, centered at the local origin). Text has no geometry
 *  bbox — this deterministic default keeps the M17 endpoint math uniform. */
const TEXT_GRADIENT_BOX_POINTS: { x: number; y: number }[] = [
  { x: -100, y: -30 },
  { x: 100, y: -30 },
  { x: -100, y: 30 },
  { x: 100, y: 30 },
];

/** M17/M20 — THE single local-bounds source for gradient geometry: the same
 *  points buildMattePath's shape geometry uses (shapeGeometry for static
 *  shapes, CharacterPart.points for freeform) plus the canonical M18 text box.
 *  Never a second geometry system — only the bounds/extent are derived. */
function sourceLocalPoints(sourcePart: Pick<CharacterPart, 'type' | 'points'> & Partial<Pick<CharacterPart, 'width' | 'height'>>): { x: number; y: number }[] | undefined {
  const geo = sourcePart.type === 'custom_freeform' ? undefined : getShapeGeometry(sourcePart.type as BodyPartType);
  const pts = sourcePart.type === 'custom_freeform'
    ? sourcePart.points
    : sourcePart.type === 'custom_text'
      ? TEXT_GRADIENT_BOX_POINTS
      : sourcePart.type === 'custom_image'
        ? (() => {
            // M21 — image has no geometry: the deterministic local bounds are the
            // image element's layout box (width × height, centered at the local
            // origin — the same convention MediaPartRenderer draws with). Never
            // reads image pixels; malformed dims fall back to the renderer defaults.
            const w = normalizeMediaDimension(sourcePart.width, 180);
            const h = normalizeMediaDimension(sourcePart.height, 120);
            return [
              { x: -w / 2, y: -h / 2 },
              { x: w / 2, y: -h / 2 },
              { x: -w / 2, y: h / 2 },
              { x: w / 2, y: h / 2 },
            ];
          })()
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
  return pts && pts.length > 0 ? pts : undefined;
}

export function gradientEndpoints(
  sourcePart: Pick<CharacterPart, 'type' | 'points'>,
  world: WorldTransform,
  angle: number,
  outputOrigin: CoordinatePoint = EDITOR_CAMERA_CENTER,
): MatteGradientEndpoints | undefined {
  // Local bounds from the SAME geometry the matte path uses — shapeGeometry
  // for static shapes, CharacterPart.points for freeform. Never a second
  // geometry system: only the bbox (2 endpoint points) is derived.
  // M18: custom_text has NO geometry (buildMattePath → null) — the gradient
  // span falls back to a canonical default local box (a typical text line),
  // so the paint effect is well-defined for text sources too.
  const pts = sourceLocalPoints(sourcePart);
  if (!pts) return undefined;
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
  const w1 = applyWorld(p1, world, outputOrigin);
  const w2 = applyWorld(p2, world, outputOrigin);
  return { x1: w1.x, y1: w1.y, x2: w2.x, y2: w2.y };
}

export function buildMatteMask(
  sourcePart: CharacterPart,
  world: WorldTransform,
  mode: Exclude<MatteMode, 'clip'>,
  inverted: boolean,
  fillColor: string,
  outputOrigin: CoordinatePoint = EDITOR_CAMERA_CENTER,
): MatteMask | null {
  const pathD = buildMattePath(sourcePart, world, outputOrigin);
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

function applyWorld(p: { x: number; y: number }, w: WorldTransform, outputOrigin: CoordinatePoint): { x: number; y: number } {
  const rad = deg2rad(w.rotation);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const sx = p.x * (w.scaleX ?? 1);
  const sy = p.y * (w.scaleY ?? 1);
  return {
    x: outputOrigin.x + (w.x ?? 0) + (sx * cos - sy * sin),
    y: outputOrigin.y + (w.y ?? 0) + (sx * sin + sy * cos),
  };
}

const fmt = (n: number) => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};

const fmtPt = (p: { x: number; y: number }) => `${fmt(p.x)} ${fmt(p.y)}`;

function geometryToWorldPathD(geo: ShapeGeometry, w: WorldTransform, outputOrigin: CoordinatePoint): string | null {
  switch (geo.kind) {
    case 'polygon': {
      if (geo.points.length < 2) return null;
      const pts = geo.points.map((p) => applyWorld(p, w, outputOrigin));
      return `M ${fmtPt(pts[0])}` + pts.slice(1).map((p) => ` L ${fmtPt(p)}`).join('') + ' Z';
    }

    case 'circle': {
      // Local circle r → world ellipse rx = r·|sx|, ry = r·|sy|, rotated by w.rotation.
      const rx = geo.r * Math.abs(w.scaleX ?? 1);
      const ry = geo.r * Math.abs(w.scaleY ?? 1);
      if (rx <= 0 || ry <= 0) return null;
      const a = applyWorld({ x: geo.r, y: 0 }, w, outputOrigin);
      const b = applyWorld({ x: -geo.r, y: 0 }, w, outputOrigin);
      const rot = w.rotation ?? 0;
      return `M ${fmtPt(a)} A ${fmt(rx)} ${fmt(ry)} ${fmt(rot)} 0 1 ${fmtPt(b)} A ${fmt(rx)} ${fmt(ry)} ${fmt(rot)} 0 1 ${fmtPt(a)}`;
    }

    case 'rect': {
      if (geo.width <= 0 || geo.height <= 0) return null;
      if (geo.rx <= 0) {
        // Plain rect — 4 corners
        const tl = applyWorld({ x: geo.x, y: geo.y }, w, outputOrigin);
        const tr = applyWorld({ x: geo.x + geo.width, y: geo.y }, w, outputOrigin);
        const br = applyWorld({ x: geo.x + geo.width, y: geo.y + geo.height }, w, outputOrigin);
        const bl = applyWorld({ x: geo.x, y: geo.y + geo.height }, w, outputOrigin);
        return `M ${fmtPt(tl)} L ${fmtPt(tr)} L ${fmtPt(br)} L ${fmtPt(bl)} Z`;
      }
      // Rounded rect — 8 anchor points + 4 corner arcs. Arc radii scale with
      // the world scale; sweep=1 (Y-down clockwise), rotation goes into the
      // arc rotation parameter. Negative-scale edge case is future scope.
      const rx = geo.rx * Math.abs(w.scaleX ?? 1);
      const ry = geo.rx * Math.abs(w.scaleY ?? 1);
      const rot = w.rotation ?? 0;
      const p = (x: number, y: number) => applyWorld({ x, y }, w, outputOrigin);
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
