/**
 * R3-04 — moving the selected keyframe set (pure mutation authority).
 *
 * The timeline lets the user marquee/Shift-select several keyframes; dragging any
 * SELECTED keyframe must move the WHOLE set by the same frame delta, with one
 * deterministic collision policy and no silent overwrite of unrelated keys.
 */

import { describe, expect, it } from 'vitest';
import type { PropertyKeyframe, Track } from '../types/animator';
import { makeEmptyChannels } from '../utils/defaults';
import {
  frameGroupKeyframes,
  locateKeyframe,
  moveKeyframesMutator,
  resolveKeyframeMoveTargets,
} from '../utils/trackMutations';

const pk = (id: string, frame: number, value: number, channel = 'x'): PropertyKeyframe => ({
  id: `${channel}_${id}`,
  frame,
  value,
  easing: 'linear',
  templateId: 'Sequence',
});

const track = (partId: string, channels: Partial<Record<string, PropertyKeyframe[]>>, keyframes: Track['keyframes'] = []): Track => ({
  id: `track_${partId}`,
  partId,
  name: partId,
  color: '#38bdf8',
  visible: true,
  locked: false,
  keyframes,
  channels: { ...makeEmptyChannels(), ...channels },
});

const framesOf = (t: Track, channel: keyof Track['channels']) =>
  (t.channels[channel] ?? []).map((keyframe) => keyframe.frame);

describe('R3-04 — frame-group location', () => {
  it('locates a canonical keyframe and the whole frame group it belongs to', () => {
    const target = track('a', { x: [pk('1', 10, 1)], y: [pk('1', 10, 2)], rotation: [pk('2', 30, 3)] });
    expect(locateKeyframe(target, 'x_1', 'Sequence')).toMatchObject({ store: 'channels', channel: 'x', frame: 10 });
    expect(locateKeyframe(target, 'missing', 'Sequence')).toBeNull();
    expect(frameGroupKeyframes(target, 10, 'Sequence').map((key) => `${key.store}|${key.channel}`).sort())
      .toEqual(['channels|x', 'channels|y']);
    expect(frameGroupKeyframes(target, 30, 'Sequence')).toHaveLength(1);
  });

  it('expands a frame-group representative to the whole group, and a channel key to itself', () => {
    const target = track('a', { x: [pk('1', 10, 1, 'x')], y: [pk('1', 10, 2, 'y')] });
    // x_1 is the representative the layer row draws → the whole frame group moves.
    const viaRow = resolveKeyframeMoveTargets([target], ['x_1'], 'Sequence', true);
    expect(viaRow.map((entry) => entry.channel).sort()).toEqual(['x', 'y']);
    // Grabbed on the channel lane → only the grabbed keyframe moves.
    const viaChannel = resolveKeyframeMoveTargets([target], ['y_1'], 'Sequence', false);
    expect(viaChannel.map((entry) => entry.channel)).toEqual(['y']);
  });

  it('resolves a selection that spans channels, stores and layers', () => {
    const first = track('a', { x: [pk('1', 10, 1)] });
    const legacy = track('b', {}, [{
      id: 'kf0', frame: 20, easing: 'linear', templateId: 'Sequence',
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    }]);
    const targets = resolveKeyframeMoveTargets([first, legacy], ['x_1', 'kf0'], 'Sequence', true);
    expect(targets.map((entry) => `${entry.trackId}|${entry.store}|${entry.frame}`).sort())
      .toEqual(['track_a|channels|10', 'track_b|keyframes|20']);
  });
});

describe('R3-04 — moving the set', () => {
  it('moves every selected keyframe by the same delta and preserves the spacing', () => {
    const target = track('a', { x: [pk('1', 10, 1, 'x'), pk('3', 30, 3, 'x')], y: [pk('1', 10, 2, 'y'), pk('3', 30, 4, 'y')] });
    const targets = resolveKeyframeMoveTargets([target], ['x_1', 'x_3'], 'Sequence', true);
    const outcome = moveKeyframesMutator([target], targets, 5, 120);

    expect(outcome.appliedDelta).toBe(5);
    expect(framesOf(outcome.tracks[0], 'x')).toEqual([15, 35]);
    expect(framesOf(outcome.tracks[0], 'y')).toEqual([15, 35]);
    // ids, values and easing travel with the keyframes.
    expect(outcome.tracks[0].channels.x.map((keyframe) => keyframe.id)).toEqual(['x_1', 'x_3']);
    expect(outcome.tracks[0].channels.y.map((keyframe) => keyframe.value)).toEqual([2, 4]);
  });

  it('is exact for a backwards move and keeps an unrelated keyframe untouched', () => {
    const target = track('a', { x: [pk('1', 10, 1), pk('9', 60, 9)] });
    const targets = resolveKeyframeMoveTargets([target], ['x_9'], 'Sequence', false);
    const outcome = moveKeyframesMutator([target], targets, -4, 120);
    expect(outcome.appliedDelta).toBe(-4);
    expect(framesOf(outcome.tracks[0], 'x')).toEqual([10, 56]);
  });

  it('clamps to frame 0 and to the project end', () => {
    const target = track('a', { x: [pk('1', 2, 1), pk('3', 30, 3)] });
    const targets = resolveKeyframeMoveTargets([target], ['x_1', 'x_3'], 'Sequence', true);

    const left = moveKeyframesMutator([target], targets, -10, 40);
    expect(left.appliedDelta).toBe(-2);
    expect(framesOf(left.tracks[0], 'x')).toEqual([0, 28]);

    const right = moveKeyframesMutator([target], targets, 30, 40);
    expect(right.appliedDelta).toBe(10);
    expect(framesOf(right.tracks[0], 'x')).toEqual([12, 40]);
  });

  it('never overwrites an unrelated keyframe: the move stops at the first collision', () => {
    const target = track('a', { x: [pk('1', 10, 1), pk('3', 30, 3), pk('9', 12, 9)] });
    const targets = resolveKeyframeMoveTargets([target], ['x_1', 'x_3'], 'Sequence', true);

    const outcome = moveKeyframesMutator([target], targets, 2, 120);
    // +2 would land on the unrelated keyframe at 12, so the set stops at +1.
    expect(outcome.appliedDelta).toBe(1);
    expect(framesOf(outcome.tracks[0], 'x')).toEqual([11, 12, 31]);
  });

  it('allows a set to move onto frames its own members vacate', () => {
    const target = track('a', { x: [pk('1', 10, 1), pk('3', 11, 3)] });
    const targets = resolveKeyframeMoveTargets([target], ['x_1', 'x_3'], 'Sequence', true);
    const outcome = moveKeyframesMutator([target], targets, 1, 120);
    expect(outcome.appliedDelta).toBe(1);
    expect(framesOf(outcome.tracks[0], 'x')).toEqual([11, 12]);
  });

  it('moves a legacy composite frame group with the canonical frame it shares', () => {
    const target = track(
      'a',
      { x: [pk('1', 20, 1, 'x')], y: [pk('1', 20, 2, 'y')] },
      [{
        id: 'kf0', frame: 20, easing: 'linear', templateId: 'Sequence',
        transform: { x: 5, y: 6, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      }],
    );
    const targets = resolveKeyframeMoveTargets([target], ['x_1'], 'Sequence', true);
    expect(targets.map((entry) => entry.store).sort()).toEqual(['channels', 'channels', 'keyframes']);

    const outcome = moveKeyframesMutator([target], targets, 3, 120);
    expect(outcome.appliedDelta).toBe(3);
    expect(framesOf(outcome.tracks[0], 'x')).toEqual([23]);
    expect(framesOf(outcome.tracks[0], 'y')).toEqual([23]);
    expect(outcome.tracks[0].keyframes?.[0].frame).toBe(23);
  });

  it('is a no-op for a zero delta and for an empty selection', () => {
    const target = track('a', { x: [pk('1', 10, 1)] });
    expect(moveKeyframesMutator([target], [], 5, 120)).toEqual({ tracks: [target], appliedDelta: 0 });
    const targets = resolveKeyframeMoveTargets([target], ['x_1'], 'Sequence', true);
    expect(moveKeyframesMutator([target], targets, 0, 120)).toEqual({ tracks: [target], appliedDelta: 0 });
  });
});
