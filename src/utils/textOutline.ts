import type { CharacterPart } from '../types/animator';
import { getTextMetrics } from './bounds';

/**
 * Text outline tracing — the geometry a Boolean operand needs for a text layer
 * (Milestone: Boolean operands beyond closed vector shapes).
 *
 * KCS draws text with `<text>` and has no path for it: the matte authority
 * paints a text source for the same reason. There is also no platform API that
 * returns glyph outlines, so the text is rasterised once at a supersampled
 * resolution and its alpha mask is traced into rings. Holes are traced too —
 * they are what makes `o` an `o` — and the renderer already draws a multi-ring
 * result with `fill-rule="evenodd"`, so a traced hole stays a hole.
 *
 * The trace is cached per (text, family, size) because the renderer derives
 * operand geometry on every frame. Nothing here approximates silently: an
 * environment without a canvas, a font string the canvas refuses, a text the
 * renderer would draw differently (staggered animation, empty value) or a raster
 * that would exceed the allocation bound all yield **no** geometry, and the
 * Boolean workflow reports the empty result instead of inventing one.
 *
 * `traceBinaryMask` is the pure, deterministic core (no DOM): the rasterisation
 * below only produces the mask it consumes.
 */

/** One closed ring of `[x, y]` points. */
export type OutlineRing = [number, number][];
/** One region: its exterior ring first, then the rings of its holes. */
export type OutlinePolygon = OutlineRing[];

export interface BinaryMask {
  width: number;
  height: number;
  /** Row-major coverage, one entry per pixel; `>= threshold` is inside. */
  alpha: ArrayLike<number>;
}

/** A pixel counts as inside from half coverage; the map is binary by design. */
const COVERAGE_THRESHOLD = 128;
/** Raster resolution per local unit; the boundary is then accurate to ~1/4 px. */
const SUPERSAMPLE = 4;
/** Largest raster side; a bigger text is traced at a lower resolution. */
const MAX_MASK_SIDE = 4096;
/** Traces kept per session; typing a word does not grow the cache without end. */
const MAX_CACHED_OUTLINES = 24;
/** Douglas–Peucker tolerance in raster pixels (invisible after the divide). */
const SIMPLIFY_TOLERANCE = 0.75;

const pointInRing = (point: [number, number], ring: OutlineRing): boolean => {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    if ((yi > point[1]) !== (yj > point[1])
      && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

/**
 * The interior of a traced ring is always to the right of its travel direction
 * (the walk below steps clockwise), so a point half a pixel past the first edge
 * lies inside this ring and never on another ring's boundary: every lattice
 * vertex is integral and every offset lands on a half-unit.
 */
const interiorSample = (ring: OutlineRing): [number, number] => {
  const [start, next] = ring;
  const stepX = next[0] - start[0];
  const stepY = next[1] - start[1];
  const length = Math.hypot(stepX, stepY) || 1;
  return [
    (start[0] + next[0]) / 2 + (-stepY / length) * 0.5,
    (start[1] + next[1]) / 2 + (stepX / length) * 0.5,
  ];
};

/** Douglas–Peucker over an open polyline. */
const simplifyOpen = (points: OutlineRing, tolerance: number): OutlineRing => {
  if (points.length <= 2) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  const spanX = bx - ax;
  const spanY = by - ay;
  const spanLength = Math.hypot(spanX, spanY);
  let farthest = -1;
  let farthestDistance = tolerance;
  for (let index = 1; index < points.length - 1; index += 1) {
    const [px, py] = points[index];
    const distance = spanLength === 0
      ? Math.hypot(px - ax, py - ay)
      : Math.abs(spanY * px - spanX * py + bx * ay - by * ax) / spanLength;
    if (distance > farthestDistance) {
      farthest = index;
      farthestDistance = distance;
    }
  }
  if (farthest < 0) return [points[0], points[points.length - 1]];
  const head = simplifyOpen(points.slice(0, farthest + 1), tolerance);
  const tail = simplifyOpen(points.slice(farthest), tolerance);
  return [...head.slice(0, -1), ...tail];
};

/**
 * Simplify a closed ring without changing which region it bounds: the ring is
 * split at the vertex farthest from its first vertex, and each half is an open
 * polyline that may be reduced on its own. The split keeps the halves far apart,
 * so a simplification can never fold one half onto the other.
 */
const simplifyRing = (ring: OutlineRing, tolerance: number): OutlineRing => {
  if (ring.length <= 4) return ring;
  let split = 0;
  let farthest = -1;
  for (let index = 1; index < ring.length; index += 1) {
    const distance = Math.hypot(ring[index][0] - ring[0][0], ring[index][1] - ring[0][1]);
    if (distance > farthest) {
      farthest = distance;
      split = index;
    }
  }
  const head = simplifyOpen(ring.slice(0, split + 1), tolerance);
  const tail = simplifyOpen([...ring.slice(split), ring[0]], tolerance);
  const merged = [...head.slice(0, -1), ...tail.slice(0, -1)];
  return merged.length >= 3 ? merged : ring;
};

interface LatticeStep { x: number; y: number; }

const stepPriority = (step: LatticeStep, incoming: LatticeStep): number => {
  if (step.x === -incoming.y && step.y === incoming.x) return 0; // turn right: hug the region
  if (step.x === incoming.x && step.y === incoming.y) return 1;
  if (step.x === incoming.y && step.y === -incoming.x) return 2;
  return 3;
};

/**
 * Walk the mask's inside region into closed lattice rings.
 *
 * Every inside cell contributes a directed step along each of its sides that
 * faces outside, which makes the region's boundary one closed loop per contour
 * (with the interior always to the right of the travel). Where two regions touch
 * only diagonally a vertex has two outgoing steps; the walk then takes the most
 * clockwise one, so the two regions stay two rings.
 */
const traceRings = (mask: BinaryMask): OutlineRing[] => {
  const { width, height, alpha } = mask;
  const inside = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && alpha[y * width + x] >= COVERAGE_THRESHOLD;

  const rowStride = width + 1;
  const key = (x: number, y: number): number => y * rowStride + x;
  const steps = new Map<number, LatticeStep[]>();
  const pushStep = (fromX: number, fromY: number, step: LatticeStep) => {
    const vertex = key(fromX, fromY);
    const list = steps.get(vertex);
    if (list) list.push(step);
    else steps.set(vertex, [step]);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!inside(x, y)) continue;
      if (!inside(x, y - 1)) pushStep(x, y, { x: 1, y: 0 });
      if (!inside(x + 1, y)) pushStep(x + 1, y, { x: 0, y: 1 });
      if (!inside(x, y + 1)) pushStep(x + 1, y + 1, { x: -1, y: 0 });
      if (!inside(x - 1, y)) pushStep(x, y + 1, { x: 0, y: -1 });
    }
  }

  const remaining = new Map<number, LatticeStep[]>();
  for (const [vertex, list] of steps) remaining.set(vertex, [...list]);

  const takeStep = (vertex: number, incoming: LatticeStep): LatticeStep | undefined => {
    const list = remaining.get(vertex);
    if (!list || list.length === 0) return undefined;
    let bestIndex = 0;
    let bestPriority = stepPriority(list[0], incoming);
    for (let index = 1; index < list.length; index += 1) {
      const priority = stepPriority(list[index], incoming);
      if (priority < bestPriority) {
        bestIndex = index;
        bestPriority = priority;
      }
    }
    return list.splice(bestIndex, 1)[0];
  };

  const rings: OutlineRing[] = [];
  const guardLimit = steps.size * 4 + 16;
  for (const startVertex of steps.keys()) {
    while ((remaining.get(startVertex)?.length ?? 0) > 0) {
      const ring: OutlineRing = [];
      let x = startVertex % rowStride;
      let y = Math.floor(startVertex / rowStride);
      let incoming: LatticeStep = { x: 0, y: 0 };
      for (let guard = 0; guard < guardLimit; guard += 1) {
        const step = takeStep(key(x, y), incoming);
        if (!step) break;
        ring.push([x, y]);
        incoming = step;
        x += step.x;
        y += step.y;
        if (key(x, y) === startVertex) break;
      }
      if (ring.length >= 4) rings.push(ring);
    }
  }
  return rings;
};

/**
 * Trace the mask's inside region into rings, then group them into regions.
 *
 * The walk above produces one closed ring per boundary; a ring nested an even
 * number of times inside another is an exterior, an odd nesting is a hole of the
 * deepest exterior that contains it. Nesting is decided on the exact lattice
 * rings (before simplification) so a reduced ring can never change the result.
 */
export const traceBinaryMask = (mask: BinaryMask, tolerance = SIMPLIFY_TOLERANCE): OutlinePolygon[] => {
  if (mask.width <= 0 || mask.height <= 0) return [];
  const rings = traceRings(mask);
  if (rings.length === 0) return [];

  const samples = rings.map(interiorSample);
  const depths = rings.map((_, index) => rings.reduce(
    (depth, other, otherIndex) => (otherIndex === index ? depth : depth + (pointInRing(samples[index], other) ? 1 : 0)),
    0,
  ));

  const polygons: { exterior: number; holes: number[] }[] = [];
  rings.forEach((_, index) => {
    if (depths[index] % 2 === 0) polygons.push({ exterior: index, holes: [] });
  });
  rings.forEach((_, index) => {
    if (depths[index] % 2 === 0) return;
    let parent = -1;
    rings.forEach((_, candidate) => {
      if (candidate === index || depths[candidate] % 2 !== 0) return;
      if (!pointInRing(samples[index], rings[candidate])) return;
      if (parent < 0 || depths[candidate] > depths[parent]) parent = candidate;
    });
    const owner = polygons.find((polygon) => polygon.exterior === parent);
    if (owner) owner.holes.push(index);
  });

  return polygons.map(({ exterior, holes }) => [exterior, ...holes]
    .map((ringIndex) => simplifyRing(rings[ringIndex], tolerance)));
};

interface CachedOutline {
  polygons: OutlinePolygon[];
  /** Traced before the font was reported ready; retraced on the next lookup. */
  provisional: boolean;
}

const outlineCache = new Map<string, CachedOutline>();

/** Remember a trace, dropping the oldest entries once the cache is full. */
const rememberOutline = (key: string, entry: CachedOutline): void => {
  outlineCache.delete(key);
  outlineCache.set(key, entry);
  while (outlineCache.size > MAX_CACHED_OUTLINES) {
    const oldest = outlineCache.keys().next();
    if (oldest.done) break;
    outlineCache.delete(oldest.value);
  }
};

/**
 * Whether the faces the canvas draws with are settled.
 *
 * Before `document.fonts` reports `loaded` a webfont can still arrive and change
 * the raster, exactly as it changes the stage, so a trace taken then is kept but
 * replaced on the next lookup. Once loading has settled the face cannot change
 * again — including a font that never loads because the machine is offline — so
 * one trace is kept instead of tracing again on every frame.
 */
const isFontSettled = (): boolean => {
  if (typeof document === 'undefined' || !document.fonts) return true;
  try {
    return document.fonts.status === 'loaded';
  } catch {
    // An environment that cannot answer is treated as settled: retracing forever
    // would be worse than trusting the raster the user already sees.
    return true;
  }
};

const traceText = (text: string, fontSize: number, fontFamily: string): OutlinePolygon[] | null => {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    // The same metric authority the hit test uses, so the raster covers what the
    // renderer draws: `getTextMetrics` measures the bold advance width.
    const { halfW, halfH, offsetY } = getTextMetrics(text, fontSize, fontFamily);
    const padding = fontSize * 0.5;
    const width = 2 * (halfW + padding);
    const height = 2 * (halfH + padding);
    const scale = Math.min(SUPERSAMPLE, Math.floor(MAX_MASK_SIDE / Math.max(width, height, 1)));
    if (scale < 1) return null;

    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const anchorX = (halfW + padding) * scale;
    const anchorY = (-offsetY + halfH + padding) * scale;

    const font = `bold ${fontSize * scale}px ${fontFamily}`;
    context.font = font;
    if (!context.font.includes(fontFamily)) return null; // the canvas refused the family
    context.textAlign = 'center';
    // The stage draws the non-staggered text with the SVG default baseline, so
    // the canvas matches it: the anchor sits on the baseline, centred.
    context.textBaseline = 'alphabetic';
    context.fillStyle = '#000000';
    context.fillText(text, anchorX, anchorY);

    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const alpha = new Uint8Array(canvas.width * canvas.height);
    for (let index = 0; index < alpha.length; index += 1) alpha[index] = image.data[index * 4 + 3];

    const latticeRings = traceBinaryMask({ width: canvas.width, height: canvas.height, alpha });
    return latticeRings.map((polygon) => polygon.map((ring) => ring.map(
      ([x, y]): [number, number] => [(x - anchorX) / scale, (y - anchorY) / scale],
    )));
  } catch {
    // Canvas, font and image data are external boundaries: an unavailable or
    // unreadable raster yields no geometry instead of a wrong one.
    return null;
  }
};

/**
 * The text layer's outline in its own local space, or `null` when it cannot be
 * traced (see the module note). Cached per text, family and size.
 */
export const getTextOutlinePolygons = (part: CharacterPart): OutlinePolygon[] | null => {
  const text = part.textValue?.trim();
  if (!text) return null;
  const fontSize = part.fontSize || 24;
  const fontFamily = part.fontFamily || 'Outfit';
  const key = `${text}|${fontFamily}|${fontSize}`;

  const settled = isFontSettled();
  const cached = outlineCache.get(key);
  if (cached && (settled || !cached.provisional)) return cached.polygons;

  const traced = traceText(text, fontSize, fontFamily);
  if (!traced) return cached?.polygons ?? null;
  rememberOutline(key, { polygons: traced, provisional: !settled });
  return traced;
};
