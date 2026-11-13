import { layerMaskChannel, layerMaskPathChannel, type AnimationChannel, type Track, type TrackChannel, type Transform } from '../../types/animator';
import { CHANNEL_ROW_HEIGHT, TRACK_ROW_HEIGHT } from './timelineConstants';
import { groupChannelKeyframesByFrame, resolveTrackChannels } from '../../utils/animation/channelKeyframeGroups';
import { hasChannelDataForTemplate } from '../../utils/editor/timelineMetrics';

/**
 * The timeline lane layout as DATA.
 *
 * A long layer list mounts only the tracks near its viewport (C4 row
 * windowing), so a marquee that hit-tested the rendered diamonds could not
 * reach a key on a row that was scrolled away. This module describes, for one
 * track, the same rows `TrackLane` renders — in the same order, with the same
 * heights and the same keyframe ids — so the marquee hit-tests the domain data
 * and the rendered lanes are only a projection of it.
 *
 * `TrackLane` reads its expanded-row order from `resolveLaneRows`, so the two
 * cannot drift apart.
 */

/** A row's place in the tree: 1 = a top group (Transform, Masks…), 2 and 3 nested in it. */
type LaneRowDepth = 1 | 2 | 3;

type LaneRow =
  | { kind: 'track' }
  | {
    kind: 'header';
    /** Expansion key suffix: `${track.id}_${group}` (transform, position, scale, trim, masks, mask:<id>, matte). */
    group: string;
    label: string;
    /** 1 for a top group, 2 for a group inside one (Position in Transform, a mask in Masks). */
    depth: 1 | 2;
    defaultExpanded: boolean;
    /** Channels the group holds (its keys are summarised on the header lane while it is closed). */
    channels: AnimationChannel[];
  }
  | { kind: 'channel'; channel: AnimationChannel; depth: LaneRowDepth };

type GroupExpanded = (key: string, defaultVal?: boolean) => boolean;

/**
 * What of the LAYER decides which property groups exist: its masks (in
 * stacking order, with their names) and whether it uses Trim Paths. Every
 * consumer (property tree, lanes, marquee, row heights) builds it with
 * `laneContextOf`, so they can never disagree.
 */
export interface LaneContext {
  masks?: readonly { id: string; name: string }[];
  trimPath?: boolean;
  /** The layer has a Track Matte (its feather and strength can be keyed). */
  trackMatte?: boolean;
  /**
   * Show only the properties that animate (their keys change the value), like
   * After Effects' U: groups with no animating member are left out.
   */
  animatedOnly?: boolean;
}

export const laneContextOf = (
  part: { masks?: readonly { id: string; name: string }[]; trimPathEnabled?: boolean; trackMatte?: unknown } | undefined,
  animatedOnly = false,
): LaneContext => ({
  masks: part?.masks?.map((mask) => ({ id: mask.id, name: mask.name })) ?? [],
  trimPath: part?.trimPathEnabled === true,
  trackMatte: Boolean(part?.trackMatte),
  ...(animatedOnly ? { animatedOnly: true } : {}),
});

const MASK_PROPERTIES = ['path', 'feather', 'opacity', 'expansion'] as const;
const TRIM_CHANNELS: TrackChannel[] = ['trimPathStart', 'trimPathEnd', 'trimPathOffset'];
const MATTE_CHANNELS: TrackChannel[] = ['matteFeather', 'matteStrength', 'matteGradientAngle'];

/** The mask ids a track animates, even for a mask the layer no longer lists. */
const animatedMaskIds = (track: Track): string[] => {
  const ids = new Set<string>();
  for (const key of [...Object.keys(track.maskChannels ?? {}), ...Object.keys(track.maskPathChannels ?? {})]) {
    const id = key.slice(0, key.lastIndexOf(':'));
    if (id) ids.add(id);
  }
  return [...ids];
};

/**
 * Whether a channel really animates, for the Animated Only view: its keys (in
 * any sequence) hold at least two different values. The layer row's + keys
 * every property at once, so a property that only got that one key, or holds
 * the same value at every key, does not count.
 */
const isAnimating = (track: Track, value: AnimationChannel): boolean => {
  const source = value.endsWith(':path')
    ? track.maskPathChannels?.[value as keyof NonNullable<Track['maskPathChannels']>]
    : value.includes(':')
      ? track.maskChannels?.[value as keyof NonNullable<Track['maskChannels']>]
      : track.channels?.[value as TrackChannel];
  const keys = (source ?? []) as Array<{ value: unknown; templateId?: string }>;
  const firstOf = new Map<string, string>();
  for (const key of keys) {
    const template = key.templateId || 'Sequence';
    const valueKey = JSON.stringify(key.value);
    const first = firstOf.get(template);
    if (first === undefined) firstOf.set(template, valueKey);
    else if (first !== valueKey) return true;
  }
  return false;
};

/**
 * The rows of one track's lane group, top to bottom (the layer row first).
 *
 * The property tree is grouped like After Effects and EffectCraft:
 *   Trim Paths › Start, End, Offset          — only when the layer uses it
 *   Masks › <mask name> › Path, Feather, Opacity, Expansion
 *   Track Matte › Feather, Strength, Gradient Angle — only with a Track Matte
 *   Transform › Position › X, Y · Scale › X, Y · Rotation · Opacity
 * A group whose properties all lack keys still shows (it is where a key is
 * added), unless the Animated Only view is on.
 */
export const resolveLaneRows = (track: Track, isGroupExpanded: GroupExpanded, context: LaneContext = {}): LaneRow[] => {
  const rows: LaneRow[] = [{ kind: 'track' }];
  if (track.expanded !== true) return rows;
  const only = context.animatedOnly === true;
  const keep = (value: AnimationChannel) => !only || isAnimating(track, value);
  /** One group: a header, then (when open) its members; a member may be a nested group. */
  type Member = AnimationChannel | { group: string; label: string; defaultExpanded: boolean; channels: AnimationChannel[] };
  const group = (key: string, label: string, defaultExpanded: boolean, members: Member[], depth: 1 | 2 = 1) => {
    const kept = members.filter((member) => (typeof member === 'string' ? keep(member) : member.channels.some(keep)));
    if (kept.length === 0) return;
    const channels = kept.flatMap((member) => (typeof member === 'string' ? [member] : member.channels.filter(keep)));
    rows.push({ kind: 'header', group: key, label, depth, defaultExpanded, channels });
    if (!isGroupExpanded(`${track.id}_${key}`, defaultExpanded)) return;
    for (const member of kept) {
      if (typeof member === 'string') rows.push({ kind: 'channel', channel: member, depth: (depth + 1) as LaneRowDepth });
      else group(member.group, member.label, member.defaultExpanded, member.channels, 2);
    }
  };
  const trimKeyed = TRIM_CHANNELS.some((value) => (track.channels?.[value]?.length ?? 0) > 0);
  if (context.trimPath || trimKeyed) group('trim', 'Trim Paths', true, TRIM_CHANNELS);
  const masks = [...(context.masks ?? [])];
  for (const id of animatedMaskIds(track)) if (!masks.some((mask) => mask.id === id)) masks.push({ id, name: id });
  if (masks.length > 0) {
    group('masks', 'Masks', true, masks.map((mask) => ({
      group: `mask:${mask.id}`,
      label: mask.name || mask.id,
      defaultExpanded: false,
      channels: MASK_PROPERTIES.map((property) => (property === 'path' ? layerMaskPathChannel(mask.id) : layerMaskChannel(mask.id, property))),
    })));
  }
  const matteKeyed = MATTE_CHANNELS.some((value) => (track.channels?.[value]?.length ?? 0) > 0);
  if (context.trackMatte || matteKeyed) group('matte', 'Track Matte', true, MATTE_CHANNELS);
  group('transform', 'Transform', true, [
    { group: 'position', label: 'Position', defaultExpanded: true, channels: ['x', 'y'] },
    { group: 'scale', label: 'Scale', defaultExpanded: false, channels: ['scaleX', 'scaleY'] },
    'rotation',
    'opacity',
  ]);
  return rows;
};

const laneRowHeight = (row: LaneRow): number => (row.kind === 'track' ? TRACK_ROW_HEIGHT : CHANNEL_ROW_HEIGHT);

/** The height of one track's whole lane group. */
export const laneGroupHeight = (track: Track, isGroupExpanded: GroupExpanded, context: LaneContext = {}): number => (
  resolveLaneRows(track, isGroupExpanded, context).reduce((sum, row) => sum + laneRowHeight(row), 0)
);

/** A keyframe glyph of the lane layout, in lane-group space (top of the layer row = 0). */
interface LaneKeyframe {
  id: string;
  frame: number;
  /** Vertical centre of its row inside the lane group. */
  centerY: number;
}

const templateOf = (keyframe: { templateId?: string }): string => keyframe.templateId || 'Sequence';

/**
 * Every keyframe glyph one track's lanes show, with the id the diamond carries:
 * the layer row shows one diamond per frame group (its first channel's key) on a
 * canonical track, or the legacy composite keys; a channel row shows its keys.
 */
export const laneKeyframes = (
  track: Track,
  basePose: Partial<Transform> | undefined,
  activeTemplateId: string | null,
  isGroupExpanded: GroupExpanded,
  context: LaneContext = {},
): LaneKeyframe[] => {
  const template = activeTemplateId || 'Sequence';
  const resolved = resolveTrackChannels(track, basePose);
  const out: LaneKeyframe[] = [];
  let top = 0;
  resolveLaneRows(track, isGroupExpanded, context).forEach((row) => {
    const height = laneRowHeight(row);
    const centerY = top + height / 2;
    top += height;
    if (row.kind === 'header') return;
    if (row.kind === 'track') {
      if (hasChannelDataForTemplate(track, template)) {
        groupChannelKeyframesByFrame(resolved, template).forEach((group) => {
          out.push({ id: group.keyframes[group.channels[0]].id, frame: group.frame, centerY });
        });
      } else {
        (track.keyframes ?? []).filter((keyframe) => templateOf(keyframe) === template)
          .forEach((keyframe) => out.push({ id: keyframe.id, frame: keyframe.frame, centerY }));
      }
      return;
    }
    const key = row.channel;
    const source = key.endsWith(':path')
      ? track.maskPathChannels?.[key as keyof NonNullable<Track['maskPathChannels']>]
      : key.includes(':')
        ? track.maskChannels?.[key as keyof NonNullable<Track['maskChannels']>]
        : resolved[key as TrackChannel];
    (source ?? []).filter((keyframe) => templateOf(keyframe) === template)
      .forEach((keyframe) => out.push({ id: keyframe.id, frame: keyframe.frame, centerY }));
  });
  return out;
};

/**
 * Every key glyph of every track (mounted or not) in the grid's content space —
 * the space the marquee box is drawn in. `trackTops[i]` is track i's top inside
 * the lanes block and `lanesOrigin` is that block's position in content space.
 */
export const laneKeyframePositions = (
  tracks: Track[],
  trackTops: number[],
  lanesOrigin: { x: number; y: number },
  frameWidth: number,
  keyframesOf: (track: Track) => LaneKeyframe[],
): Array<{ id: string; x: number; y: number }> => tracks.flatMap((track, index) => (
  keyframesOf(track).map((keyframe) => ({
    id: keyframe.id,
    x: lanesOrigin.x + keyframe.frame * frameWidth,
    y: lanesOrigin.y + trackTops[index] + keyframe.centerY,
  }))
));

/**
 * Edge auto-scroll of a drag gesture: how far to scroll one axis this step when
 * the pointer is within `edge` px of (or beyond) the viewport's start or end.
 * Proportional to the depth, capped, and 0 in the interior.
 */
export const edgeScrollStep = (pointer: number, start: number, end: number, edge = 28, maxStep = 24): number => {
  if (pointer < start + edge) return -Math.min(maxStep, Math.max(2, Math.round((start + edge - pointer) / 2)));
  if (pointer > end - edge) return Math.min(maxStep, Math.max(2, Math.round((pointer - (end - edge)) / 2)));
  return 0;
};
