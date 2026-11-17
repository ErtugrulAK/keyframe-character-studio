import type { EasingType, Track, TrackChannel } from '../../types/animator';
import { TRACK_CHANNELS } from '../../types/animator';
import { sequenceIdOf } from './sequenceId';

/**
 * The easings the timeline offers as quick commands (keyframe right-click menu,
 * F9 = Easy Ease). The graph editor keeps the full curve presets.
 */
export const QUICK_EASINGS: ReadonlyArray<{ easing: EasingType; label: string }> = [
  { easing: 'linear', label: 'Linear' },
  { easing: 'easeIn', label: 'Ease In' },
  { easing: 'easeOut', label: 'Ease Out' },
  { easing: 'easeInOut', label: 'Easy Ease (In-Out)' },
  { easing: 'hold', label: 'Hold' },
];

type ControlPoints = [number, number, number, number];

/**
 * The curve of the segment that starts at a keyframe, written so it can be
 * put on another segment: a named easing, plus control points when the curve
 * is a custom one. A temporal handle pair (`bezierOut` here, `bezierIn` on the
 * next key) is the same cubic as control points `[out.x, out.y, in.x, in.y]`
 * (`defaults.applyEasing`), so it travels as control points.
 */
export interface SegmentCurve {
  easing: EasingType;
  controlPoints?: ControlPoints;
}

type EasedKeyframe = {
  frame: number;
  easing: EasingType;
  templateId?: string;
  bezierControlPoints?: unknown;
  bezierIn?: unknown;
  bezierOut?: unknown;
};

const inTemplate = (keyframe: { templateId?: string }, templateId: string): boolean => sequenceIdOf(keyframe) === templateId;

/**
 * One channel's keys with the named easing on the segments that START at
 * `frames`. A named easing only wins when nothing outranks it
 * (`effectiveSegmentAuthority`: hold > temporal handle pair > control points >
 * named), so the segment's own curve data goes: the start key's control points
 * and outgoing handle, and the next key's incoming handle (the other half of the
 * pair; it shapes this segment only).
 */
const easeChannel = <K extends EasedKeyframe>(keyframes: K[], frames: ReadonlySet<number>, templateId: string, easing: EasingType, controlPoints?: ControlPoints): { keyframes: K[]; changed: boolean } => {
  const ordered = keyframes.filter((keyframe) => inTemplate(keyframe, templateId)).sort((a, b) => a.frame - b.frame);
  const starts = new Set(ordered.filter((keyframe) => frames.has(keyframe.frame)));
  if (starts.size === 0) return { keyframes, changed: false };
  const nextOfStart = new Set(ordered.filter((_, index) => index > 0 && starts.has(ordered[index - 1])));
  const next = keyframes.map((keyframe) => {
    let result: K = keyframe;
    if (starts.has(keyframe)) {
      const { bezierControlPoints: _points, bezierOut: _out, ...rest } = keyframe;
      result = (controlPoints ? { ...rest, easing, bezierControlPoints: [...controlPoints] } : { ...rest, easing }) as K;
    }
    if (nextOfStart.has(keyframe) && result.bezierIn !== undefined) {
      const { bezierIn: _in, ...rest } = result;
      result = rest as K;
    }
    return result;
  });
  return { keyframes: next, changed: true };
};

/**
 * Sets the easing of every keyframe of `track` at `frames` in `templateId`:
 * transform and Trim Path channels, mask channels, mask paths and legacy
 * composite keys. With `controlPoints` the segments take that custom curve
 * (Paste Easing). One call is one edit; the caller owns the history entry.
 */
export const setKeyframeGroupEasing = (track: Track, frames: readonly number[], templateId: string, easing: EasingType, controlPoints?: ControlPoints): { track: Track; changed: boolean } => {
  const wanted = new Set(frames);
  let changed = false;
  const easeMap = <K extends EasedKeyframe>(map: Record<string, K[]> | undefined): Record<string, K[]> | undefined => {
    if (!map) return map;
    return Object.fromEntries(Object.entries(map).map(([channel, keyframes]) => {
      const eased = easeChannel(keyframes ?? [], wanted, templateId, easing, controlPoints);
      changed = changed || eased.changed;
      return [channel, eased.keyframes];
    }));
  };
  const channels = track.channels
    ? Object.fromEntries(TRACK_CHANNELS.map((channel: TrackChannel) => {
      const eased = easeChannel(track.channels?.[channel] ?? [], wanted, templateId, easing, controlPoints);
      changed = changed || eased.changed;
      return [channel, eased.keyframes];
    })) as Track['channels']
    : track.channels;
  const maskChannels = easeMap(track.maskChannels as Record<string, EasedKeyframe[]> | undefined) as Track['maskChannels'];
  const maskPathChannels = easeMap(track.maskPathChannels as Record<string, EasedKeyframe[]> | undefined) as Track['maskPathChannels'];
  let keyframes = track.keyframes;
  if (keyframes) {
    const eased = easeChannel(keyframes, wanted, templateId, easing, controlPoints);
    changed = changed || eased.changed;
    keyframes = eased.keyframes;
  }
  if (!changed) return { track, changed: false };
  return { track: { ...track, channels, maskChannels, maskPathChannels, keyframes }, changed: true };
};

type CurveKeyframe = EasedKeyframe & {
  bezierControlPoints?: ControlPoints;
  bezierIn?: { x: number; y: number };
  bezierOut?: { x: number; y: number };
};

/** The curve one channel's segment starting at `frame` plays, or undefined when it has no key there. */
const channelCurveAt = (keyframes: readonly CurveKeyframe[], frame: number, templateId: string): SegmentCurve | undefined => {
  const ordered = keyframes.filter((keyframe) => inTemplate(keyframe, templateId)).sort((a, b) => a.frame - b.frame);
  const index = ordered.findIndex((keyframe) => keyframe.frame === frame);
  if (index < 0) return undefined;
  const key = ordered[index];
  const next = ordered[index + 1];
  if (key.easing === 'hold') return { easing: 'hold' };
  if (key.bezierOut && next?.bezierIn) return { easing: key.easing, controlPoints: [key.bezierOut.x, key.bezierOut.y, next.bezierIn.x, next.bezierIn.y] };
  if (key.bezierControlPoints) return { easing: key.easing, controlPoints: [...key.bezierControlPoints] as ControlPoints };
  return { easing: key.easing };
};

const sameCurve = (a: SegmentCurve, b: SegmentCurve): boolean =>
  a.easing === b.easing
  && (a.controlPoints === undefined) === (b.controlPoints === undefined)
  && (a.controlPoints === undefined || a.controlPoints.every((value, index) => value === b.controlPoints?.[index]));

/**
 * The one curve the keyframes of `track` at `frame` start with (Copy Easing):
 * every keyed channel at that frame must play the same curve. Returns null
 * when nothing is keyed there or the channels disagree, so a paste never
 * guesses which of several curves was meant.
 */
export const readKeyframeGroupEasing = (track: Track, frame: number, templateId: string): SegmentCurve | null => {
  const lists: Array<readonly CurveKeyframe[]> = [
    ...TRACK_CHANNELS.map((channel: TrackChannel) => (track.channels?.[channel] ?? []) as readonly CurveKeyframe[]),
    ...Object.values(track.maskChannels ?? {}).map((keyframes) => (keyframes ?? []) as readonly CurveKeyframe[]),
    ...Object.values(track.maskPathChannels ?? {}).map((keyframes) => (keyframes ?? []) as readonly CurveKeyframe[]),
  ];
  const agreed = (candidates: Array<readonly CurveKeyframe[]>): SegmentCurve | null | 'mixed' => {
    let found: SegmentCurve | null = null;
    for (const list of candidates) {
      const curve = channelCurveAt(list, frame, templateId);
      if (!curve) continue;
      if (found && !sameCurve(found, curve)) return 'mixed';
      found = found ?? curve;
    }
    return found;
  };
  // Legacy composite keys are read only where no channel is keyed at that
  // frame: a track the timeline draws from its channels is read from them.
  const fromChannels = agreed(lists);
  if (fromChannels === 'mixed') return null;
  if (fromChannels) return fromChannels;
  const fromLegacy = agreed([(track.keyframes ?? []) as readonly CurveKeyframe[]]);
  return fromLegacy === 'mixed' ? null : fromLegacy;
};
