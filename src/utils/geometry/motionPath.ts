/**
 * Motion path geometry: where along a drawn path a layer that follows it sits.
 *
 * A path is measured once into an arc-length table, so a progress of 0.5 is
 * the point halfway along the path's LENGTH, not halfway through its vertex
 * list (a short segment and a long one would otherwise take the same time).
 * Segments are drawn exactly as `sampleBezierPath` / `buildBezierPathD` draw
 * them: a cubic from a vertex's `handleOut` to the next vertex's `handleIn`,
 * a missing handle sitting on its vertex, and a closed path's closing segment
 * included.
 *
 * Self-contained factory (no module-scope references): the OGraf runtime
 * embeds its source, so the editor, the static export and the runtime place a
 * follower with the same arithmetic.
 */

export interface MotionPathVertex {
  x: number;
  y: number;
  handleIn?: { x: number; y: number };
  handleOut?: { x: number; y: number };
}

export interface MotionPathInput {
  closed: boolean;
  points: readonly MotionPathVertex[];
}

/** A measured path: samples along it and the running length at each. */
export interface MotionPathTable {
  closed: boolean;
  xs: number[];
  ys: number[];
  lengths: number[];
  total: number;
}

/** A point on the path and the direction of travel there, in degrees (SVG rotate sense). */
export interface MotionPathPose {
  x: number;
  y: number;
  angle: number;
}

/**
 * A layer's link to the path it follows. The path is another layer's outline
 * (a freeform layer), placed by that layer's own transform, so moving or
 * editing the path moves the follower too. `progress` is the static share of
 * the path's length (the `motionPathProgress` channel keys it over time);
 * `orient` turns the follower with the direction of travel.
 */
export interface MotionPathLink {
  sourcePartId: string;
  enabled?: boolean;
  orient?: boolean;
  progress?: number;
}

/** A 2D affine map, as `containerMath` writes it: x' = a x + c y + e, y' = b x + d y + f. */
export interface MotionPathAffine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/** Whether a stored value is a well-formed link (import validation). */
export const isMotionPathLink = (value: unknown): value is MotionPathLink => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const link = value as Record<string, unknown>;
  return typeof link.sourcePartId === 'string' && link.sourcePartId.length > 0
    && (link.enabled === undefined || typeof link.enabled === 'boolean')
    && (link.orient === undefined || typeof link.orient === 'boolean')
    && (link.progress === undefined || (typeof link.progress === 'number' && Number.isFinite(link.progress)));
};

export const createMotionPath = () => {
  const STEPS_PER_SEGMENT = 32;

  const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
  const finitePoint = (point: { x: number; y: number } | undefined): boolean =>
    !!point && finite(point.x) && finite(point.y);

  /** The arc-length table of a path, or null when it has no segment to follow. */
  const measure = (path: MotionPathInput | undefined | null): MotionPathTable | null => {
    if (!path || !Array.isArray(path.points)) return null;
    const vertices = path.points.filter((point) => finitePoint(point));
    if (vertices.length < 2) return null;
    const closed = path.closed === true;
    const xs: number[] = [vertices[0].x];
    const ys: number[] = [vertices[0].y];
    const lengths: number[] = [0];
    let total = 0;
    const segmentCount = closed ? vertices.length : vertices.length - 1;
    for (let index = 0; index < segmentCount; index += 1) {
      const start = vertices[index];
      const end = vertices[(index + 1) % vertices.length];
      const p1 = finitePoint(start.handleOut) ? start.handleOut! : start;
      const p2 = finitePoint(end.handleIn) ? end.handleIn! : end;
      for (let step = 1; step <= STEPS_PER_SEGMENT; step += 1) {
        const t = step / STEPS_PER_SEGMENT;
        const u = 1 - t;
        const x = u * u * u * start.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * end.x;
        const y = u * u * u * start.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * end.y;
        total += Math.hypot(x - xs[xs.length - 1], y - ys[ys.length - 1]);
        xs.push(x);
        ys.push(y);
        lengths.push(total);
      }
    }
    return { closed, xs, ys, lengths, total };
  };

  /** The direction of travel leaving sample `index` (or arriving, at the end), skipping zero-length steps. */
  const directionAt = (table: MotionPathTable, index: number): number => {
    const last = table.xs.length - 1;
    for (let forward = index; forward < last; forward += 1) {
      const dx = table.xs[forward + 1] - table.xs[forward];
      const dy = table.ys[forward + 1] - table.ys[forward];
      if (dx !== 0 || dy !== 0) return (Math.atan2(dy, dx) * 180) / Math.PI;
    }
    for (let backward = Math.min(index, last); backward > 0; backward -= 1) {
      const dx = table.xs[backward] - table.xs[backward - 1];
      const dy = table.ys[backward] - table.ys[backward - 1];
      if (dx !== 0 || dy !== 0) return (Math.atan2(dy, dx) * 180) / Math.PI;
    }
    return 0;
  };

  /** The point `length` units along the path (clamped to its ends). */
  const pointAtLength = (table: MotionPathTable, length: number): { x: number; y: number; index: number } => {
    const target = Math.min(table.total, Math.max(0, length));
    let low = 0;
    let high = table.xs.length - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (table.lengths[middle] <= target) low = middle;
      else high = middle;
    }
    const span = table.lengths[high] - table.lengths[low];
    const t = span > 0 ? (target - table.lengths[low]) / span : 0;
    return {
      x: table.xs[low] + (table.xs[high] - table.xs[low]) * t,
      y: table.ys[low] + (table.ys[high] - table.ys[low]) * t,
      index: low,
    };
  };

  /**
   * The pose at `progress` of the path's length. An open path holds its ends
   * (progress clamps to 0..1); a closed path loops, so 1.25 is a quarter into
   * a second lap. The direction is read across a short window centred on the
   * point, so it is the curve's tangent there rather than the chord ahead.
   */
  const poseAt = (table: MotionPathTable, progress: number): MotionPathPose => {
    if (!(table.total > 0)) return { x: table.xs[0], y: table.ys[0], angle: 0 };
    const raw = finite(progress) ? progress : 0;
    let amount = table.closed ? raw - Math.floor(raw) : Math.min(1, Math.max(0, raw));
    if (table.closed && raw > 0 && amount === 0) amount = 1;
    const target = amount * table.total;
    const point = pointAtLength(table, target);
    const reach = table.total / (table.xs.length - 1) / 2;
    const wrap = (length: number) => (table.closed ? ((length % table.total) + table.total) % table.total : length);
    const behind = pointAtLength(table, wrap(target - reach));
    const ahead = pointAtLength(table, wrap(target + reach));
    const dx = ahead.x - behind.x;
    const dy = ahead.y - behind.y;
    const angle = dx !== 0 || dy !== 0 ? (Math.atan2(dy, dx) * 180) / Math.PI : directionAt(table, point.index);
    return { x: point.x, y: point.y, angle };
  };

  /**
   * The pose at `progress` carried through the path layer's own transform:
   * where the follower sits in the space the path layer is placed in, and the
   * direction of travel there (the path's tangent turned by the same map).
   */
  const follow = (table: MotionPathTable, affine: MotionPathAffine, progress: number): MotionPathPose => {
    const pose = poseAt(table, progress);
    const radians = (pose.angle * Math.PI) / 180;
    const ux = Math.cos(radians);
    const uy = Math.sin(radians);
    const tx = affine.a * ux + affine.c * uy;
    const ty = affine.b * ux + affine.d * uy;
    return {
      x: affine.a * pose.x + affine.c * pose.y + affine.e,
      y: affine.b * pose.x + affine.d * pose.y + affine.f,
      angle: tx !== 0 || ty !== 0 ? (Math.atan2(ty, tx) * 180) / Math.PI : pose.angle,
    };
  };

  return { measure, poseAt, follow };
};

const motionPath = createMotionPath();
export const measureMotionPath = motionPath.measure;
export const motionPathPoseAt = motionPath.poseAt;
export const followMotionPath = motionPath.follow;
