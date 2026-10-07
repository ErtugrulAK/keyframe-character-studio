import { difference, intersection, union, xor, type MultiPolygon, type Polygon, type Ring } from 'polygon-clipping';
import type { CharacterPart, FreeformPoint, Track, Transform } from '../types/animator';
import { getShapeGeometry } from './shapeGeometry';
import { normalizeClosedPoints, resolveFreeformPath } from './freeform';
import { sampleBezierPath } from './bezierPath';
import { getTextOutlinePolygons, type OutlinePolygon } from './textOutline';

export type BooleanOperation = 'union' | 'subtract' | 'intersect' | 'exclude';
export type BooleanContours = FreeformPoint[][];

const CLOSED_VECTOR_TYPES = new Set<CharacterPart['type']>([
  'custom_star', 'custom_circle', 'custom_box', 'custom_rect', 'custom_triangle',
  'custom_banner', 'custom_capsule', 'custom_diamond', 'custom_parallelogram', 'custom_card',
]);

/** A freeform layer contributes its canonical path when it has a drawable one. */
const hasPathGeometry = (part: CharacterPart): boolean => (
  sampleBezierPath(resolveFreeformPath(part), 4).length >= 3
);

/**
 * A text layer contributes real letterform geometry (traced from its rendered
 * mask, holes included). Only the text the renderer draws as one static string
 * qualifies: a staggered text animates per character and per frame, so its
 * outline is not a single fixed shape, and an empty value draws nothing.
 */
const hasStaticTextGeometry = (part: CharacterPart): boolean => (
  Boolean(part.textValue?.trim()) && (!part.textAnimMode || part.textAnimMode === 'none')
);

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

/** One region of a shape: a single exterior ring with no holes. */
const localShapeRing = (part: CharacterPart): FreeformPoint[] | null => {
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

/**
 * The operand's local geometry as regions: `[exterior, ...holes]` per region.
 *
 * A closed shape is one region with no holes, a freeform is its canonical path
 * sampled through the shared bezier sampler, and a text is traced from its own
 * rendered mask (so its counters are holes, not extra filled regions). A part
 * whose geometry cannot be produced contributes nothing.
 */
const localPolygons = (part: CharacterPart): OutlinePolygon[] | null => {
  if (part.type === 'custom_text') return getTextOutlinePolygons(part);

  if (part.type === 'custom_freeform') {
    const samples = sampleBezierPath(resolveFreeformPath(part));
    if (samples.length < 3) return null;
    return [[samples.map((point): [number, number] => [point.x, point.y])]];
  }

  const ring = localShapeRing(part);
  return ring ? [[ring.map((point): [number, number] => [point.x, point.y])]] : null;
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

const inverseTransformPoint = (point: FreeformPoint, transform: Transform): FreeformPoint => {
  const radians = (transform.rotation * Math.PI) / 180;
  const dx = point.x - transform.x;
  const dy = point.y - transform.y;
  const unrotatedX = dx * Math.cos(radians) + dy * Math.sin(radians);
  const unrotatedY = -dx * Math.sin(radians) + dy * Math.cos(radians);
  return {
    x: unrotatedX / (transform.scaleX || 1),
    y: unrotatedY / (transform.scaleY || 1),
  };
};

/** Convert world-space Boolean contours into the group's local space. */
export const inverseTransformBooleanContours = (
  contours: BooleanContours,
  transform: Transform,
): BooleanContours => contours.map((contour) => contour.map((point) => inverseTransformPoint(point, transform)));

const BOOLEAN_OPERATION_LABELS: Record<BooleanOperation, string> = {
  union: 'Union',
  subtract: 'Subtract',
  intersect: 'Intersect',
  exclude: 'Exclude',
};

const GENERATED_BOOLEAN_NAME = /^Boolean(?: (\d+))? · (Union|Subtract|Intersect|Exclude)$/u;
const DERIVED_BOOLEAN_NAME = /^.+ (?:\+|\/) .+ · (Union|Subtract|Intersect|Exclude)$/u;

export const booleanOperationLabel = (operation: BooleanOperation): string => BOOLEAN_OPERATION_LABELS[operation];

export const isGeneratedBooleanName = (name: string): boolean => (
  GENERATED_BOOLEAN_NAME.test(name) || DERIVED_BOOLEAN_NAME.test(name)
);

export const createBooleanDisplayName = (
  operation: BooleanOperation,
  existingParts: CharacterPart[],
  currentName?: string,
  operandNames: string[] = [],
): string => {
  const currentMatch = currentName?.match(GENERATED_BOOLEAN_NAME);
  const currentIsGenerated = currentName ? isGeneratedBooleanName(currentName) : false;
  const normalizedOperandNames = operandNames.map((name) => name.trim()).filter(Boolean);
  if (currentName && !currentIsGenerated) return currentName;
  if ((currentName === undefined || currentIsGenerated) && normalizedOperandNames.length > 0) {
    return `${normalizedOperandNames.join(' + ')} · ${booleanOperationLabel(operation)}`;
  }
  if (currentMatch) {
    const number = currentMatch[1] ?? '1';
    return `Boolean ${number} · ${booleanOperationLabel(operation)}`;
  }
  const usedNumbers = new Set(
    existingParts
      .map((part) => part.name.match(GENERATED_BOOLEAN_NAME))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => match[1] ?? '1'),
  );
  let number = 1;
  while (usedNumbers.has(String(number))) number += 1;
  return `Boolean ${number} · ${booleanOperationLabel(operation)}`;
};

export interface DerivedBooleanGeometry {
  worldContours: BooleanContours;
  localContours: BooleanContours;
}

/**
 * Derive the current-frame Boolean result once from evaluated operand
 * transforms. Renderers and selection consumers must use the same local/world
 * pair instead of reading persisted result contours for live editor geometry.
 */
export const deriveBooleanGeometry = (
  operation: BooleanOperation,
  operands: CharacterPart[],
  operandTransforms: Record<string, Transform>,
  groupTransform: Transform,
): DerivedBooleanGeometry => {
  const worldContours = computeBooleanContours(operation, operands, operandTransforms);
  return {
    worldContours,
    localContours: inverseTransformBooleanContours(worldContours, groupTransform),
  };
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

export const isBooleanEligible = (part: CharacterPart | undefined): boolean => {
  if (!part) return false;
  if (CLOSED_VECTOR_TYPES.has(part.type)) return true;
  if (part.type === 'custom_freeform') return hasPathGeometry(part);
  if (part.type === 'custom_text') return hasStaticTextGeometry(part);
  return false;
};

/** Every region of the operand in world space, or `null` when it has none. */
export const partToWorldPolygons = (part: CharacterPart, transform?: Transform): Polygon[] | null => {
  const polygons = localPolygons(part);
  if (!polygons) return null;
  const worldTransform = toTransform(part, transform);
  return polygons.map((polygon) => polygon.map((ring) => ring.map(
    ([x, y]) => transformPoint({ x, y }, worldTransform),
  )));
};

export interface BooleanOperandReadiness {
  /** True when every operand produced real geometry for this frame. */
  ready: boolean;
  /** Operands whose geometry could not be produced (e.g. a failed text trace). */
  unresolved: CharacterPart[];
}

/**
 * Whether every operand has real geometry right now.
 *
 * A Boolean operation is a set of ALL its operands: when one cannot be produced
 * (a text whose font cannot be traced, a freeform with no path) the operation
 * must refuse rather than silently drop it and run a different operation on the
 * remaining shapes. Callers use this to surface an actionable diagnostic.
 */
export const inspectBooleanOperands = (
  operands: CharacterPart[],
  transforms?: Record<string, Transform>,
): BooleanOperandReadiness => {
  const unresolved = operands.filter((part) => {
    const polygons = partToWorldPolygons(part, transforms?.[part.id]);
    return !polygons || polygons.length === 0;
  });
  return { ready: unresolved.length === 0, unresolved };
};

const flattenResult = (result: MultiPolygon): BooleanContours => result.flatMap((polygon) => (
  polygon.map((ring) => normalizeClosedPoints(ring.map(([x, y]) => ({ x, y }))))
));

export const computeBooleanContours = (
  operation: BooleanOperation,
  operands: CharacterPart[],
  transforms?: Record<string, Transform>,
): BooleanContours => {
  // An operand is a *set* of regions (a text is several glyphs, each with its own
  // holes), so the first operand's regions are the Boolean subject and the rest
  // are its clippers.
  //
  // Every operand must resolve: a failed trace is refused atomically (empty
  // result) instead of being filtered out, which would silently change which
  // operation runs.
  const geometries: Polygon[][] = [];
  for (const part of operands) {
    const polygons = partToWorldPolygons(part, transforms?.[part.id]);
    if (!polygons || polygons.length === 0) return [];
    geometries.push(polygons);
  }
  if (geometries.length < 2) return [];

  const [subject, ...clippers] = geometries;
  let result: MultiPolygon;
  if (operation === 'subtract') result = difference(subject, ...clippers);
  else if (operation === 'intersect') result = clippers.reduce<MultiPolygon>((current, geometry) => intersection(current, geometry), subject);
  else if (operation === 'exclude') result = xor(subject, ...clippers);
  else result = union(subject, ...clippers);
  return flattenResult(result);
};

export const booleanRingArea = (ring: Ring): number => ring.reduce((area, [x1, y1], index) => {
  const [x2, y2] = ring[(index + 1) % ring.length];
  return area + (x1 * y2 - x2 * y1);
}, 0) / 2;
