import type { BezierPath, BezierVertex, CharacterPart, Track } from '../types/animator';
import { getShapeGeometry } from './shapeGeometry';

/**
 * "Convert to editable path": a parametric shape (Rectangle, Ellipse,
 * polygons) becomes a `custom_freeform` layer whose canonical `path` draws the
 * SAME outline in the same local space. The layer keeps its id (so its track,
 * layer order, parent, children, Track Matte and legacy matte references all
 * still point at it), its transform, appearance, masks and the `width`/`height`
 * its normalized masks are expanded over.
 *
 * Kinds of support:
 * - exact: rectangles without rounding and every polygon (straight edges are
 *   exactly straight segments);
 * - Bézier-exact for rounded corners and ellipses: the standard cubic arc
 *   approximation (κ = 0.5523), within 0.03 % of the radius;
 * - refused, with a reason: shapes whose drawing is more than an outline
 *   (banner and card text), Boolean structures, layers with an animated stroke
 *   reveal, and any type without static geometry.
 */

/** Cubic-Bézier circle constant: handle length / radius for a quarter arc. */
export const BEZIER_ARC_KAPPA = 0.5522847498307936;

type ShapeToPathResult =
  | { ok: true; part: CharacterPart; precision: 'exact' | 'bezier-arc' }
  | { ok: false; reason: string };

const SHAPE_LABEL: Partial<Record<CharacterPart['type'], string>> = {
  custom_rect: 'Rectangle',
  custom_box: 'Square',
  custom_circle: 'Ellipse',
  custom_capsule: 'Capsule',
  custom_triangle: 'Triangle',
  custom_star: 'Star',
  custom_diamond: 'Diamond',
  custom_parallelogram: 'Parallelogram',
};

/** The shape types this build converts (others are refused with a reason). */
export const isConvertibleShapeType = (type: CharacterPart['type']): boolean => SHAPE_LABEL[type] !== undefined;

const vertex = (index: number, x: number, y: number, handles?: { in?: { x: number; y: number }; out?: { x: number; y: number } }): BezierVertex => ({
  id: `vertex-${index}`,
  x,
  y,
  kind: handles ? 'smooth' : 'corner',
  ...(handles?.in ? { handleIn: handles.in } : {}),
  ...(handles?.out ? { handleOut: handles.out } : {}),
});

const closedPath = (points: BezierVertex[]): BezierPath => ({ version: 1, coordinateSpace: 'local', closed: true, points });

/** A rectangle, optionally rounded (SVG `rx` semantics: clamped to half the shorter side). */
export const rectangleToPath = (x: number, y: number, width: number, height: number, radius: number): BezierPath => {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const right = x + width;
  const bottom = y + height;
  if (r <= 0) return closedPath([vertex(0, x, y), vertex(1, right, y), vertex(2, right, bottom), vertex(3, x, bottom)]);
  const k = r * BEZIER_ARC_KAPPA;
  // Clockwise from the top edge; each corner arc is a pair of anchors whose
  // facing handles bend the corner. The anchors themselves are corners (the
  // straight edge leaves them without a handle), exactly like an SVG rounded rect.
  const points = [
    vertex(0, x + r, y, { in: { x: x + r - k, y } }),
    vertex(1, right - r, y, { out: { x: right - r + k, y } }),
    vertex(2, right, y + r, { in: { x: right, y: y + r - k } }),
    vertex(3, right, bottom - r, { out: { x: right, y: bottom - r + k } }),
    vertex(4, right - r, bottom, { in: { x: right - r + k, y: bottom } }),
    vertex(5, x + r, bottom, { out: { x: x + r - k, y: bottom } }),
    vertex(6, x, bottom - r, { in: { x, y: bottom - r + k } }),
    vertex(7, x, y + r, { out: { x, y: y + r - k } }),
  ].map((point) => ({ ...point, kind: 'corner' as const }));
  return closedPath(points);
};

/** An ellipse centred on (cx, cy): four smooth anchors with κ handles. */
export const ellipseToPath = (cx: number, cy: number, rx: number, ry: number): BezierPath => {
  const kx = rx * BEZIER_ARC_KAPPA;
  const ky = ry * BEZIER_ARC_KAPPA;
  return closedPath([
    vertex(0, cx, cy - ry, { in: { x: cx - kx, y: cy - ry }, out: { x: cx + kx, y: cy - ry } }),
    vertex(1, cx + rx, cy, { in: { x: cx + rx, y: cy - ky }, out: { x: cx + rx, y: cy + ky } }),
    vertex(2, cx, cy + ry, { in: { x: cx + kx, y: cy + ry }, out: { x: cx - kx, y: cy + ry } }),
    vertex(3, cx - rx, cy, { in: { x: cx - rx, y: cy + ky }, out: { x: cx - rx, y: cy - ky } }),
  ]);
};

/** The reason a layer cannot be converted right now, or null. */
export const shapeToPathBlockReason = (part: CharacterPart, tracks: readonly Track[] = []): string | null => {
  if (part.type === 'custom_freeform') return 'This layer is already an editable path.';
  if (part.booleanOperation || part.booleanOperandIds?.length) return 'A Boolean group is converted by its own commands, not into one path.';
  if (part.booleanGroupId) return 'A Boolean operand keeps its shape type while it belongs to a Boolean group.';
  if (part.type === 'custom_banner' || part.type === 'custom_card') return 'This shape draws text and decorations that a single path cannot keep.';
  if (!isConvertibleShapeType(part.type)) return 'Only basic shapes (rectangle, ellipse, polygons) can become editable paths.';
  if (part.strokeProgress !== undefined && part.strokeProgress < 1) {
    return 'The stroke reveal of this shape is measured on its built-in outline; set Stroke progress to 100% first.';
  }
  const track = tracks.find((candidate) => candidate.partId === part.id);
  const animatedReveal = ['trimPathStart', 'trimPathEnd', 'trimPathOffset'].some((channel) => (track?.channels as Record<string, unknown[] | undefined> | undefined)?.[channel]?.length);
  if (part.trimPathEnabled || animatedReveal) {
    return 'Trim Path follows the shape’s built-in outline; turn Trim Path off (and remove its keys) before converting.';
  }
  return null;
};

/** The editable outline of a basic shape, in its own local space. */
const shapeOutlinePath = (part: CharacterPart): { path: BezierPath; precision: 'exact' | 'bezier-arc' } | null => {
  const geometry = getShapeGeometry(part.type);
  if (!geometry) return null;
  if (geometry.kind === 'rect') {
    // The renderer's radius rule: a capsule keeps its own; rect and box take borderRadius.
    const radius = part.type === 'custom_capsule' ? geometry.rx : part.borderRadius ?? geometry.rx;
    return { path: rectangleToPath(geometry.x, geometry.y, geometry.width, geometry.height, radius), precision: radius > 0 ? 'bezier-arc' : 'exact' };
  }
  if (geometry.kind === 'circle') return { path: ellipseToPath(0, 0, geometry.r, geometry.r), precision: 'bezier-arc' };
  return { path: closedPath(geometry.points.map((point, index) => vertex(index, point.x, point.y))), precision: 'exact' };
};

/**
 * Converts `part` into an editable path layer, or refuses with the reason.
 * Pure: the caller writes the returned part in place of the old one (same id).
 */
export const convertShapeToEditablePath = (part: CharacterPart, tracks: readonly Track[] = []): ShapeToPathResult => {
  const reason = shapeToPathBlockReason(part, tracks);
  if (reason) return { ok: false, reason };
  const outline = shapeOutlinePath(part);
  if (!outline) return { ok: false, reason: 'This shape has no outline to convert.' };
  const { borderRadius: _radius, ...rest } = part;
  void _radius;
  return {
    ok: true,
    precision: outline.precision,
    part: {
      ...rest,
      type: 'custom_freeform',
      path: outline.path,
      // The legacy anchor list stays in step for readers that still use it.
      points: outline.path.points.map(({ x, y }) => ({ x, y })),
      // The built-in shapes draw sharp (mitred) corners; keep them sharp.
      strokeLinejoin: 'miter',
    },
  };
};

export const convertibleShapeLabel = (type: CharacterPart['type']): string => SHAPE_LABEL[type] ?? 'Shape';
