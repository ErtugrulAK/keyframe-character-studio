import type { BezierPath, CharacterPart, Track } from '../../types/animator';

type Contour = { x: number; y: number }[];

/** Twice the signed area of a ring (its sign is the ring's winding). */
const signedArea = (ring: Contour): number => {
  let sum = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const a = ring[index];
    const b = ring[(index + 1) % ring.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
};

const insideRing = (point: { x: number; y: number }, ring: Contour): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

/**
 * Boolean result contours (outer rings and holes, flattened) back into
 * polygons: a ring winding like the largest ring is an outer boundary, and a
 * ring winding the other way is the hole of the outer ring that contains it.
 */
export const contoursToPolygons = (contours: Contour[]): Array<Array<Array<[number, number]>>> => {
  const rings = contours.filter((ring) => ring.length >= 3);
  if (rings.length === 0) return [];
  const largest = rings.reduce((best, ring) => (Math.abs(signedArea(ring)) > Math.abs(signedArea(best)) ? ring : best));
  const outerSign = Math.sign(signedArea(largest)) || 1;
  const outers = rings.filter((ring) => Math.sign(signedArea(ring)) === outerSign);
  const holes = rings.filter((ring) => Math.sign(signedArea(ring)) !== outerSign);
  const polygons = outers.map((ring) => [ring]);
  for (const hole of holes) {
    const owner = polygons.find((polygon) => insideRing(hole[0], polygon[0]));
    if (owner) owner.push(hole);
    else polygons.push([hole]);
  }
  return polygons.map((polygon) => polygon.map((ring) => ring.map((point): [number, number] => [point.x, point.y])));
};

/**
 * A Boolean result turned into an ordinary shape (Shape to Path, or before it
 * joins another Boolean): the group keeps its id, name, look, transform,
 * animation and place in the stack, takes the result as its own geometry and
 * forgets its operands, which are removed with their tracks. One region
 * becomes an editable path; several (islands or holes) stay a compound shape.
 * `localContours` is the result at the current frame, in the group's own space.
 */
export const flattenBooleanGroup = (
  parts: CharacterPart[],
  tracks: Track[],
  groupId: string,
  localContours: Contour[],
): { parts: CharacterPart[]; tracks: Track[] } | null => {
  const group = parts.find((part) => part.id === groupId);
  if (!group?.booleanOperandIds?.length || localContours.length === 0) return null;
  const operands = new Set(group.booleanOperandIds);
  const single = localContours.length === 1;
  const path: BezierPath | undefined = single
    ? {
        version: 1,
        coordinateSpace: 'local',
        closed: true,
        points: localContours[0].map((point, index) => ({ id: `vertex-${index}`, x: point.x, y: point.y, kind: 'corner' as const })),
      }
    : undefined;
  const flattened: CharacterPart = {
    ...group,
    type: 'custom_freeform',
    booleanOperandIds: undefined,
    booleanOperation: undefined,
    booleanContours: single ? undefined : localContours.map((ring) => ring.map(({ x, y }) => ({ x, y }))),
    path,
    points: localContours[0].map(({ x, y }) => ({ x, y })),
  };
  return {
    parts: parts.filter((part) => !operands.has(part.id)).map((part) => (part.id === groupId ? flattened : part)),
    tracks: tracks.filter((track) => !operands.has(track.partId)),
  };
};
