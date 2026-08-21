import type { AnimationTrackData, BodyPartType, CharacterPart } from '../types/animator';
import { interpolateChannel } from './defaults';

export interface ResolvedTrimPath {
  enabled: boolean;
  start: number;
  end: number;
  offset: number;
  isModern: boolean;
}

export interface TrimPathDashProps {
  [key: string]: string | number | undefined;
  pathLength: 1;
  strokeDasharray?: string;
  strokeDashoffset?: number;
}

export const TRIM_PATH_ELIGIBLE_TYPES: ReadonlySet<BodyPartType> = new Set([
  'custom_rect',
  'custom_box',
  'custom_circle',
  'custom_triangle',
  'custom_star',
  'custom_diamond',
  'custom_parallelogram',
  'custom_capsule',
  'custom_freeform',
]);

export const isTrimPathEligible = (type: BodyPartType): boolean => TRIM_PATH_ELIGIBLE_TYPES.has(type);

const clamp01 = (value: number | undefined, fallback: number): number => (
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback
);

/** Normalize degrees into one deterministic turn in [0, 360). */
export const normalizeTrimPathOffset = (degrees: number | undefined): number => {
  if (typeof degrees !== 'number' || !Number.isFinite(degrees)) return 0;
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

/**
 * Resolve modern Trim Path fields without materializing legacy data.
 * Missing modern fields keep the historical strokeProgress renderer path.
 */
export const resolveTrimPath = (
  part: Pick<CharacterPart, 'trimPathEnabled' | 'trimPathStart' | 'trimPathEnd' | 'trimPathOffset'>,
): ResolvedTrimPath => {
  const isModern = part.trimPathEnabled !== undefined
    || part.trimPathStart !== undefined
    || part.trimPathEnd !== undefined
    || part.trimPathOffset !== undefined;

  return {
    enabled: part.trimPathEnabled === true,
    start: clamp01(part.trimPathStart, 0),
    end: clamp01(part.trimPathEnd, 1),
    offset: normalizeTrimPathOffset(part.trimPathOffset),
    isModern,
  };
};

export const evaluateTrimPath = (
  part: Pick<CharacterPart, 'trimPathEnabled' | 'trimPathStart' | 'trimPathEnd' | 'trimPathOffset'>,
  track: AnimationTrackData | undefined,
  frame: number,
  templateId: string,
): ResolvedTrimPath => {
  const base = resolveTrimPath(part);
  if (!track?.channels) return base;
  const filter = (channel: 'trimPathStart' | 'trimPathEnd' | 'trimPathOffset') =>
    (track.channels[channel] || []).filter((kf) => (kf.templateId || 'Sequence') === templateId);

  const startKfs = filter('trimPathStart');
  const endKfs = filter('trimPathEnd');
  const offsetKfs = filter('trimPathOffset');
  return {
    ...base,
    start: clamp01(startKfs.length ? interpolateChannel(startKfs, frame, base.start) : base.start, base.start),
    end: clamp01(endKfs.length ? interpolateChannel(endKfs, frame, base.end) : base.end, base.end),
    offset: normalizeTrimPathOffset(offsetKfs.length ? interpolateChannel(offsetKfs, frame, base.offset) : base.offset),
  };
};

/**
 * Native SVG normalized dash semantics. The path is treated as cyclic for
 * closed shape paths (including the existing closed freeform path contract).
 * Start > End therefore wraps naturally through the repeated dash pattern.
 */
export const getTrimPathDashProps = (trim: ResolvedTrimPath): TrimPathDashProps | null => {
  if (!trim.enabled) return null;

  const start = trim.start;
  const rawSpan = trim.end - start;
  const span = ((rawSpan % 1) + 1) % 1;
  const begin = ((start + trim.offset / 360) % 1 + 1) % 1;
  const dashOffset = begin === 0 ? 0 : -begin;

  if (rawSpan === 1) return { pathLength: 1 };
  if (span === 0) {
    return { pathLength: 1, strokeDasharray: '0 1', strokeDashoffset: dashOffset };
  }

  return {
    pathLength: 1,
    strokeDasharray: `${span} ${1 - span}`,
    strokeDashoffset: dashOffset,
  };
};
