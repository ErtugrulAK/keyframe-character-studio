import type { EasingType, Track, TrackChannel } from '../types/animator';
import { TRACK_CHANNELS } from '../types/animator';

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

type EasedKeyframe = {
  frame: number;
  easing: EasingType;
  templateId?: string;
  bezierControlPoints?: unknown;
  bezierIn?: unknown;
  bezierOut?: unknown;
};

const inTemplate = (keyframe: { templateId?: string }, templateId: string): boolean => (keyframe.templateId || 'Sequence') === templateId;

/**
 * One channel's keys with the named easing on the segments that START at
 * `frames`. A named easing only wins when nothing outranks it
 * (`effectiveSegmentAuthority`: hold > temporal handle pair > control points >
 * named), so the segment's own curve data goes: the start key's control points
 * and outgoing handle, and the next key's incoming handle (the other half of the
 * pair; it shapes this segment only).
 */
const easeChannel = <K extends EasedKeyframe>(keyframes: K[], frames: ReadonlySet<number>, templateId: string, easing: EasingType): { keyframes: K[]; changed: boolean } => {
  const ordered = keyframes.filter((keyframe) => inTemplate(keyframe, templateId)).sort((a, b) => a.frame - b.frame);
  const starts = new Set(ordered.filter((keyframe) => frames.has(keyframe.frame)));
  if (starts.size === 0) return { keyframes, changed: false };
  const nextOfStart = new Set(ordered.filter((_, index) => index > 0 && starts.has(ordered[index - 1])));
  const next = keyframes.map((keyframe) => {
    let result: K = keyframe;
    if (starts.has(keyframe)) {
      const { bezierControlPoints: _points, bezierOut: _out, ...rest } = keyframe;
      result = { ...rest, easing } as K;
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
 * composite keys. One call is one edit; the caller owns the history entry.
 */
export const setKeyframeGroupEasing = (track: Track, frames: readonly number[], templateId: string, easing: EasingType): { track: Track; changed: boolean } => {
  const wanted = new Set(frames);
  let changed = false;
  const easeMap = <K extends EasedKeyframe>(map: Record<string, K[]> | undefined): Record<string, K[]> | undefined => {
    if (!map) return map;
    return Object.fromEntries(Object.entries(map).map(([channel, keyframes]) => {
      const eased = easeChannel(keyframes ?? [], wanted, templateId, easing);
      changed = changed || eased.changed;
      return [channel, eased.keyframes];
    }));
  };
  const channels = track.channels
    ? Object.fromEntries(TRACK_CHANNELS.map((channel: TrackChannel) => {
      const eased = easeChannel(track.channels?.[channel] ?? [], wanted, templateId, easing);
      changed = changed || eased.changed;
      return [channel, eased.keyframes];
    })) as Track['channels']
    : track.channels;
  const maskChannels = easeMap(track.maskChannels as Record<string, EasedKeyframe[]> | undefined) as Track['maskChannels'];
  const maskPathChannels = easeMap(track.maskPathChannels as Record<string, EasedKeyframe[]> | undefined) as Track['maskPathChannels'];
  let keyframes = track.keyframes;
  if (keyframes) {
    const eased = easeChannel(keyframes, wanted, templateId, easing);
    changed = changed || eased.changed;
    keyframes = eased.keyframes;
  }
  if (!changed) return { track, changed: false };
  return { track: { ...track, channels, maskChannels, maskPathChannels, keyframes }, changed: true };
};
