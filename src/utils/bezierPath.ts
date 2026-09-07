import type {
  BezierPath,
  BezierVertex,
  FreeformPoint,
  MaskPoint,
  PathCoordinateSpace,
  PathHandle,
} from '../types/animator';

export interface PathPoint {
  x: number;
  y: number;
}

const isFinitePoint = (point: unknown): point is PathPoint => {
  if (!point || typeof point !== 'object') return false;
  const candidate = point as Record<string, unknown>;
  return Number.isFinite(candidate.x) && Number.isFinite(candidate.y);
};

const sanitizeHandle = (handle: unknown): PathHandle | undefined =>
  isFinitePoint(handle) ? { x: handle.x, y: handle.y } : undefined;

const sanitizeVertex = (vertex: unknown, index: number): BezierVertex | undefined => {
  if (!isFinitePoint(vertex)) return undefined;
  const candidate = vertex as unknown as Record<string, unknown>;
  const kind = candidate.kind === 'smooth' || candidate.kind === 'corner' ? candidate.kind : undefined;
  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : `vertex-${index}`,
    x: vertex.x,
    y: vertex.y,
    ...(sanitizeHandle(candidate.handleIn) ? { handleIn: sanitizeHandle(candidate.handleIn) } : {}),
    ...(sanitizeHandle(candidate.handleOut) ? { handleOut: sanitizeHandle(candidate.handleOut) } : {}),
    ...(kind ? { kind } : {}),
  };
};

export const createBezierPath = (
  points: readonly PathPoint[],
  coordinateSpace: PathCoordinateSpace,
  closed = true,
): BezierPath => ({
  version: 1,
  coordinateSpace,
  closed,
  points: points.map((point, index) => ({
    id: `vertex-${index}`,
    x: point.x,
    y: point.y,
    kind: 'corner',
  })),
});

export const legacyFreeformPointsToPath = (
  points: readonly FreeformPoint[] | undefined,
  closed = true,
): BezierPath | undefined => {
  if (!Array.isArray(points) || points.length < 2) return undefined;
  return createBezierPath(points, 'local', closed);
};

export const legacyMaskPointsToPath = (
  points: readonly MaskPoint[] | undefined,
  closed = true,
): BezierPath | undefined => {
  if (!Array.isArray(points) || points.length < 2) return undefined;
  return {
    ...createBezierPath(points, 'normalized', closed),
    points: points.map((point, index) => ({
      id: `vertex-${index}`,
      x: point.x,
      y: point.y,
      kind: 'corner',
      ...(point.handleIn ? { handleIn: { ...point.handleIn } } : {}),
      ...(point.handleOut ? { handleOut: { ...point.handleOut } } : {}),
    })),
  };
};

export const normalizeBezierPath = (
  value: unknown,
  fallbackCoordinateSpace: PathCoordinateSpace,
  fallbackClosed = true,
): BezierPath | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.points)) return undefined;
  const points = candidate.points
    .map((point, index) => sanitizeVertex(point, index))
    .filter((point): point is BezierVertex => Boolean(point));
  if (points.length < 2) return undefined;
  const coordinateSpace = candidate.coordinateSpace === 'normalized' || candidate.coordinateSpace === 'local'
    ? candidate.coordinateSpace
    : fallbackCoordinateSpace;
  return {
    version: 1,
    coordinateSpace,
    closed: typeof candidate.closed === 'boolean' ? candidate.closed : fallbackClosed,
    points,
  };
};

export const buildBezierPathD = (
  path: BezierPath | undefined,
  mapPoint: (point: PathPoint) => PathPoint = (point) => point,
): string => {
  if (!path || path.points.length < 2) return '';
  const points = path.points.map((point) => mapPoint(point));
  const mapHandle = (handle: PathHandle | undefined, fallback: PathPoint): PathPoint =>
    mapPoint(handle ?? fallback);
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = path.points[index - 1];
    const current = path.points[index];
    const end = points[index];
    const out = mapHandle(previous.handleOut, previous);
    const incoming = mapHandle(current.handleIn, current);
    if (previous.handleOut || current.handleIn) {
      pathD += ` C ${out.x} ${out.y}, ${incoming.x} ${incoming.y}, ${end.x} ${end.y}`;
    } else {
      pathD += ` L ${end.x} ${end.y}`;
    }
  }
  if (path.closed) {
    const previous = path.points[path.points.length - 1];
    const current = path.points[0];
    const end = points[0];
    const out = mapHandle(previous.handleOut, previous);
    const incoming = mapHandle(current.handleIn, current);
    if (previous.handleOut || current.handleIn) {
      pathD += ` C ${out.x} ${out.y}, ${incoming.x} ${incoming.y}, ${end.x} ${end.y}`;
    }
    pathD += ' Z';
  }
  return pathD;
};

export const buildNormalizedPathD = (
  path: BezierPath | undefined,
  width: number,
  height: number,
): string => buildBezierPathD(path, (point) => (
  path?.coordinateSpace === 'normalized'
    ? { x: (point.x - 0.5) * width, y: (point.y - 0.5) * height }
    : point
));

export const areBezierPathsTopologyCompatible = (
  first: BezierPath | undefined,
  second: BezierPath | undefined,
): boolean => Boolean(
  first
  && second
  && first.coordinateSpace === second.coordinateSpace
  && first.closed === second.closed
  && first.points.length === second.points.length
  && first.points.every((point, index) => point.id === second.points[index]?.id),
);

export const interpolateBezierPath = (
  previous: BezierPath | undefined,
  next: BezierPath | undefined,
  progress: number,
): BezierPath | undefined => {
  if (!previous || !next || !areBezierPathsTopologyCompatible(previous, next)) return previous;
  const t = Math.max(0, Math.min(1, progress));
  const lerp = (a: number, b: number) => a + (b - a) * t;
  const interpolateHandle = (
    a: PathHandle | undefined,
    b: PathHandle | undefined,
    anchor: PathPoint,
  ): PathHandle | undefined => {
    if (!a && !b) return undefined;
    if (t === 0) return a;
    if (t === 1) return b;
    const start = a ?? anchor;
    const end = b ?? anchor;
    return { x: lerp(start.x, end.x), y: lerp(start.y, end.y) };
  };
  return {
    version: 1,
    coordinateSpace: previous.coordinateSpace,
    closed: previous.closed,
    points: previous.points.map((point, index) => {
      const target = next.points[index];
      const handleIn = interpolateHandle(point.handleIn, target.handleIn, point);
      const handleOut = interpolateHandle(point.handleOut, target.handleOut, point);
      return {
        id: point.id,
        x: lerp(point.x, target.x),
        y: lerp(point.y, target.y),
        ...(handleIn ? { handleIn } : {}),
        ...(handleOut ? { handleOut } : {}),
        kind: t < 0.5 ? point.kind : target.kind,
      };
    }),
  };
};

export const pathToLegacyFreeformPoints = (path: BezierPath | undefined): FreeformPoint[] | undefined =>
  path?.points.map(({ x, y }) => ({ x, y }));

export const pathToLegacyMaskPoints = (path: BezierPath | undefined): MaskPoint[] | undefined =>
  path?.points.map(({ x, y, handleIn, handleOut }) => ({
    x,
    y,
    ...(handleIn ? { handleIn: { ...handleIn } } : {}),
    ...(handleOut ? { handleOut: { ...handleOut } } : {}),
  }));

export const sampleBezierPath = (path: BezierPath | undefined, samplesPerSegment = 16): PathPoint[] => {
  if (!path || path.points.length < 2) return [];
  const samples: PathPoint[] = [];
  const segmentCount = path.closed ? path.points.length : path.points.length - 1;
  const count = Math.max(2, Math.floor(samplesPerSegment));
  const cubic = (p0: PathPoint, p1: PathPoint, p2: PathPoint, p3: PathPoint, t: number): PathPoint => {
    const u = 1 - t;
    return {
      x: u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x,
      y: u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y,
    };
  };
  for (let index = 0; index < segmentCount; index += 1) {
    const start = path.points[index];
    const end = path.points[(index + 1) % path.points.length];
    const p0 = { x: start.x, y: start.y };
    const p1 = start.handleOut ?? p0;
    const p2 = end.handleIn ?? { x: end.x, y: end.y };
    const p3 = { x: end.x, y: end.y };
    for (let step = 0; step < count; step += 1) {
      samples.push(cubic(p0, p1, p2, p3, step / count));
    }
  }
  const last = path.points[path.points.length - 1];
  samples.push({ x: last.x, y: last.y });
  return samples;
};
