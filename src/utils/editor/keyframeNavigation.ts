import type { CharacterPart, Track } from '../../types/animator';
import { resolveAuthoredBasePose } from '../animation/channelKeyframeGroups';
import { resolveAdjacentKeyframeFrame, resolveLayerKeyframeFrames } from './timelineMetrics';

/**
 * The frame Ctrl+Left / Ctrl+Right moves the playhead to: the nearest keyframe
 * before or after `frame` in the active sequence, among the selected layers,
 * or among every layer when nothing is selected. Each layer's frames come from
 * the same projection its timeline row draws, so the jump lands on a diamond
 * the user can see. Null when there is no keyframe in that direction.
 */
export function resolveSceneAdjacentKeyframeFrame({
  tracks,
  parts,
  activeTemplateId,
  partIds,
  frame,
  direction,
}: {
  tracks: readonly Track[];
  parts: readonly CharacterPart[];
  activeTemplateId: string;
  partIds: readonly string[];
  frame: number;
  direction: 'previous' | 'next';
}): number | null {
  const selected = partIds.length > 0 ? new Set(partIds) : null;
  const frames: number[] = [];
  for (const track of tracks) {
    if (selected && !selected.has(track.partId)) continue;
    frames.push(...resolveLayerKeyframeFrames(track, activeTemplateId || 'Sequence', resolveAuthoredBasePose(parts, track.partId)));
  }
  return resolveAdjacentKeyframeFrame(frames, frame, direction);
}
