import type { AnimationChannel, Track, TrackChannel, Transform } from '../../types/animator';
import { CHANNEL_ROW_HEIGHT, TRACK_ROW_HEIGHT } from './timelineConstants';
import { groupChannelKeyframesByFrame, resolveTrackChannels } from '../../utils/channelKeyframeGroups';
import { hasChannelDataForTemplate } from '../../utils/timelineMetrics';

/**
 * C5 — the timeline lane layout as DATA.
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

export type LaneRow =
  | { kind: 'track' }
  | { kind: 'header'; group: 'position' | 'scale' | 'trim' }
  | { kind: 'channel'; channel: AnimationChannel };

type GroupExpanded = (key: string, defaultVal?: boolean) => boolean;

/** The rows of one track's lane group, top to bottom (the layer row first). */
export const resolveLaneRows = (track: Track, isGroupExpanded: GroupExpanded): LaneRow[] => {
  const rows: LaneRow[] = [{ kind: 'track' }];
  if (track.expanded !== true) return rows;
  const channel = (value: AnimationChannel): LaneRow => ({ kind: 'channel', channel: value });
  rows.push({ kind: 'header', group: 'position' });
  if (isGroupExpanded(`${track.id}_position`, true)) rows.push(channel('x'), channel('y'));
  rows.push(channel('rotation'));
  rows.push({ kind: 'header', group: 'scale' });
  if (isGroupExpanded(`${track.id}_scale`, false)) rows.push(channel('scaleX'), channel('scaleY'));
  rows.push(channel('opacity'));
  rows.push({ kind: 'header', group: 'trim' });
  if (isGroupExpanded(`${track.id}_trim`, true)) rows.push(channel('trimPathStart'), channel('trimPathEnd'), channel('trimPathOffset'));
  Object.keys(track.maskChannels ?? {}).forEach((key) => rows.push(channel(key as AnimationChannel)));
  Object.keys(track.maskPathChannels ?? {}).forEach((key) => rows.push(channel(key as AnimationChannel)));
  return rows;
};

export const laneRowHeight = (row: LaneRow): number => (row.kind === 'track' ? TRACK_ROW_HEIGHT : CHANNEL_ROW_HEIGHT);

/** The height of one track's whole lane group. */
export const laneGroupHeight = (track: Track, isGroupExpanded: GroupExpanded): number => (
  resolveLaneRows(track, isGroupExpanded).reduce((sum, row) => sum + laneRowHeight(row), 0)
);

/** A keyframe glyph of the lane layout, in lane-group space (top of the layer row = 0). */
export interface LaneKeyframe {
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
): LaneKeyframe[] => {
  const template = activeTemplateId || 'Sequence';
  const resolved = resolveTrackChannels(track, basePose);
  const out: LaneKeyframe[] = [];
  let top = 0;
  resolveLaneRows(track, isGroupExpanded).forEach((row) => {
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
