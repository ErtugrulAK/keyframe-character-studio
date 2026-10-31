import { layerMaskChannel, layerMaskPathChannel, type AnimationChannel, type Track, type TrackChannel, type Transform } from '../../types/animator';
import { CHANNEL_ROW_HEIGHT, TRACK_ROW_HEIGHT } from './timelineConstants';
import { groupChannelKeyframesByFrame, resolveTrackChannels } from '../../utils/channelKeyframeGroups';
import { hasChannelDataForTemplate } from '../../utils/timelineMetrics';

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

/** A property row's place in the tree: a layer property, or a member of a group. */
type LaneRowDepth = 1 | 2;

type LaneRow =
  | { kind: 'track' }
  | {
    kind: 'header';
    /** Expansion key suffix: `${track.id}_${group}` (position, scale, trim, mask:<id>). */
    group: string;
    label: string;
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
}

export const laneContextOf = (part: { masks?: readonly { id: string; name: string }[]; trimPathEnabled?: boolean } | undefined): LaneContext => ({
  masks: part?.masks?.map((mask) => ({ id: mask.id, name: mask.name })) ?? [],
  trimPath: part?.trimPathEnabled === true,
});

const MASK_PROPERTIES = ['path', 'feather', 'opacity', 'expansion'] as const;
const TRIM_CHANNELS: TrackChannel[] = ['trimPathStart', 'trimPathEnd', 'trimPathOffset'];

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
 * The rows of one track's lane group, top to bottom (the layer row first).
 *
 * The property list reads like other motion tools (After Effects):
 *   Position › X, Y · Scale › X, Y · Rotation · Opacity
 *   Trim Paths › Start, End, Offset   — only when the layer uses Trim Paths
 *                                       (or still holds Trim keys)
 *   <mask name> › Path, Feather, Opacity, Expansion   — one group per mask
 */
export const resolveLaneRows = (track: Track, isGroupExpanded: GroupExpanded, context: LaneContext = {}): LaneRow[] => {
  const rows: LaneRow[] = [{ kind: 'track' }];
  if (track.expanded !== true) return rows;
  const channel = (value: AnimationChannel, depth: LaneRowDepth): LaneRow => ({ kind: 'channel', channel: value, depth });
  const group = (key: string, label: string, defaultExpanded: boolean, channels: AnimationChannel[]) => {
    rows.push({ kind: 'header', group: key, label, defaultExpanded, channels });
    if (isGroupExpanded(`${track.id}_${key}`, defaultExpanded)) channels.forEach((value) => rows.push(channel(value, 2)));
  };
  group('position', 'Position', true, ['x', 'y']);
  group('scale', 'Scale', false, ['scaleX', 'scaleY']);
  rows.push(channel('rotation', 1));
  rows.push(channel('opacity', 1));
  const trimKeyed = TRIM_CHANNELS.some((value) => (track.channels?.[value]?.length ?? 0) > 0);
  if (context.trimPath || trimKeyed) group('trim', 'Trim Paths', true, TRIM_CHANNELS);
  const masks = [...(context.masks ?? [])];
  for (const id of animatedMaskIds(track)) if (!masks.some((mask) => mask.id === id)) masks.push({ id, name: id });
  for (const mask of masks) {
    group(`mask:${mask.id}`, mask.name || mask.id, false, MASK_PROPERTIES.map((property) => (
      property === 'path' ? layerMaskPathChannel(mask.id) : layerMaskChannel(mask.id, property)
    )));
  }
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
