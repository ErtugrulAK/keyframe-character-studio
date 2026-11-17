/**
 * The Polygon shape: a regular polygon, or a star when its inner radius is
 * below 100 %, with any number of corners.
 *
 * Whatever its corners, the outline fills the same 70 x 70 local box as the
 * fixed Star, Triangle and Diamond: the corner count and the inner radius
 * change the outline, never the layer's size. Every place that reads a shape's
 * extent from its type alone (bounds tables, the matte box, the creation drag)
 * therefore stays exact without knowing the settings; only the places that
 * DRAW the outline read them.
 *
 * `createPolygonShape` is self-contained (no module-scope references): the
 * OGraf runtime embeds its source (`ograf/runtimeSnippets`), so the package
 * draws the outline the editor draws.
 */

export interface PolygonShape {
  /** Corners (points of a star). Whole number, 3 to 24. */
  sides: number;
  /** The inner corners' distance as a share of the outer one: 1 (absent) = a polygon, below 1 = a star. 0.1 to 1. */
  innerRatio?: number;
}

export const POLYGON_MIN_SIDES = 3;
export const POLYGON_MAX_SIDES = 24;
export const POLYGON_MIN_INNER_RATIO = 0.1;
/** A new Polygon: a pentagon. */
export const DEFAULT_POLYGON_SHAPE: PolygonShape = { sides: 5 };

export const createPolygonShape = () => {
  const HALF_SIZE = 35;
  const MIN_SIDES = 3;
  const MAX_SIDES = 24;
  const MIN_RATIO = 0.1;
  const round = (value: number) => Math.round(value * 1000) / 1000;

  /** The settings a stored value stands for: whole corners in range, a ratio in range (1 = polygon). */
  const normalize = (shape: { sides?: unknown; innerRatio?: unknown } | undefined): { sides: number; innerRatio: number } => {
    const sides = typeof shape?.sides === 'number' && Number.isFinite(shape.sides)
      ? Math.min(MAX_SIDES, Math.max(MIN_SIDES, Math.round(shape.sides)))
      : 5;
    const innerRatio = typeof shape?.innerRatio === 'number' && Number.isFinite(shape.innerRatio)
      ? Math.min(1, Math.max(MIN_RATIO, shape.innerRatio))
      : 1;
    return { sides, innerRatio };
  };

  /** The outline's corners, the first at the top, clockwise, fitted to the 70 x 70 box. */
  const points = (shape: { sides?: unknown; innerRatio?: unknown } | undefined): Array<{ x: number; y: number }> => {
    const { sides, innerRatio } = normalize(shape);
    const star = innerRatio < 1;
    const count = star ? sides * 2 : sides;
    const raw: Array<{ x: number; y: number }> = [];
    for (let index = 0; index < count; index += 1) {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
      const radius = star && index % 2 === 1 ? innerRatio : 1;
      raw.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of raw) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    const width = Math.max(1e-9, maxX - minX);
    const height = Math.max(1e-9, maxY - minY);
    return raw.map((point) => ({
      x: round(-HALF_SIZE + ((point.x - minX) / width) * HALF_SIZE * 2),
      y: round(-HALF_SIZE + ((point.y - minY) / height) * HALF_SIZE * 2),
    }));
  };

  /** The outline as an SVG `points` attribute ("x,y x,y …"). */
  const pointsAttribute = (shape: { sides?: unknown; innerRatio?: unknown } | undefined): string =>
    points(shape).map((point) => `${point.x},${point.y}`).join(' ');

  return { normalize, points, pointsAttribute };
};

const polygonShape = createPolygonShape();
export const normalizePolygonShape = polygonShape.normalize;
export const polygonShapePoints = polygonShape.points;

/** A stored `polygon` value is an object with numeric settings in range (absent fields take their defaults). */
export const isPolygonShape = (value: unknown): value is PolygonShape => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const { sides, innerRatio } = value as { sides?: unknown; innerRatio?: unknown };
  if (typeof sides !== 'number' || !Number.isFinite(sides) || sides < POLYGON_MIN_SIDES || sides > POLYGON_MAX_SIDES) return false;
  if (innerRatio !== undefined && (typeof innerRatio !== 'number' || !Number.isFinite(innerRatio) || innerRatio < POLYGON_MIN_INNER_RATIO || innerRatio > 1)) return false;
  return true;
};
