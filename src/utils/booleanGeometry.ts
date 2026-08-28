import { difference, intersection, union, xor, type MultiPolygon, type Polygon, type Ring } from 'polygon-clipping';
import type { CharacterPart, FreeformPoint, Track, Transform } from '../types/animator';
import { getShapeGeometry } from './shapeGeometry';

export type BooleanOperation = 'union' | 'subtract' | 'intersect' | 'exclude';
export type BooleanContours = FreeformPoint[][];

const CLOSED_VECTOR_TYPES = new Set<CharacterPart['type']>([
  'custom_star', 'custom_circle', 'custom_box', 'custom_rect', 'custom_triangle',
  'custom_banner', 'custom_capsule', 'custom_diamond', 'custom_parallelogram', 'custom_card',
]);

const toTransform = (part: CharacterPart, transform?: Transform): Transform => transform ?? part.baseTransform;

const transformPoint = (point: FreeformPoint, transform: Transform): [number, number] => {
  const radians = (transform.rotation * Math.PI) / 180;
  const scaledX = point.x * transform.scaleX;
  const scaledY = point.y * transform.scaleY;
  return [
    transform.x + scaledX * Math.cos(radians) - scaledY * Math.sin(radians),
    transform.y + scaledX * Math.sin(radians) + scaledY * Math.cos(radians),
  ];
};

const localPolygon = (part: CharacterPart): FreeformPoint[] | null => {
  const geometry = getShapeGeometry(part.type);
  if (!geometry) return null;
  if (geometry.kind === 'circle') {
    return Array.from({ length: 48 }, (_, index) => {
      const angle = (index / 48) * Math.PI * 2;
      return { x: geometry.r * Math.cos(angle), y: geometry.r * Math.sin(angle) };
    });
  }
  if (geometry.kind === 'polygon') return geometry.points;
  return [
    { x: geometry.x, y: geometry.y },
    { x: geometry.x + geometry.width, y: geometry.y },
    { x: geometry.x + geometry.width, y: geometry.y + geometry.height },
    { x: geometry.x, y: geometry.y + geometry.height },
  ];
};
export const transformBooleanContours = (
  contours: BooleanContours,
  transform: Transform,
): BooleanContours => {
  const radians = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return contours.map((contour) => contour.map((point) => {
    const x = point.x * transform.scaleX;
    const y = point.y * transform.scaleY;
    return {
      x: transform.x + x * cos - y * sin,
      y: transform.y + x * sin + y * cos,
    };
  }));
};
export const dissolveBooleanGroup = (
  parts: CharacterPart[],
  tracks: Track[],
  groupId: string,
): { parts: CharacterPart[]; tracks: Track[]; operandIds: string[] } => {
  const group = parts.find((part) => part.id === groupId);
  const operandIds = group?.booleanOperandIds ?? [];
  if (!group || operandIds.length === 0) return { parts, tracks, operandIds: [] };
  const operands = new Set(operandIds);
  return {
    parts: parts
      .filter((part) => part.id !== groupId)
      .map((part) => operands.has(part.id) ? { ...part, booleanGroupId: undefined } : part),
    tracks: tracks.filter((track) => track.partId !== groupId),
    operandIds,
  };
};

export const isBooleanEligible = (part: CharacterPart | undefined): boolean => (
  Boolean(part && CLOSED_VECTOR_TYPES.has(part.type))
);

export const partToWorldPolygon = (part: CharacterPart, transform?: Transform): Polygon | null => {
  const points = localPolygon(part);
  if (!points) return null;
  const world = points.map((point) => transformPoint(point, toTransform(part, transform)));
  return [world];
};

const flattenResult = (result: MultiPolygon): BooleanContours => result.flatMap((polygon) => (
  polygon.map((ring) => ring.map(([x, y]) => ({ x, y })))
));

export const computeBooleanContours = (
  operation: BooleanOperation,
  operands: CharacterPart[],
  transforms?: Record<string, Transform>,
): BooleanContours => {
  const polygons = operands
    .map((part) => partToWorldPolygon(part, transforms?.[part.id]))
    .filter((polygon): polygon is Polygon => polygon !== null);
  if (polygons.length < 2) return [];

  let result: MultiPolygon;
  if (operation === 'subtract') result = difference(polygons[0], ...polygons.slice(1));
  else if (operation === 'intersect') result = polygons.slice(1).reduce<MultiPolygon>((current, polygon) => intersection(current, polygon), [polygons[0]]);
  else if (operation === 'exclude') result = xor(polygons[0], ...polygons.slice(1));
  else result = union(polygons[0], ...polygons.slice(1));
  return flattenResult(result);
};

export const booleanRingArea = (ring: Ring): number => ring.reduce((area, [x1, y1], index) => {
  const [x2, y2] = ring[(index + 1) % ring.length];
  return area + (x1 * y2 - x2 * y1);
}, 0) / 2;
