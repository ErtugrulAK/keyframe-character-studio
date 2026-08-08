/**
 * M3 — KeyframesTab channel model tests
 *
 * Verifies the frame-grouped channel keyframe model that KeyframesTab now
 * consumes, plus the add/delete/move semantics against canonical channels.
 */

import { describe, test, expect } from 'vitest';
import { groupChannelKeyframesByFrame, buildTransformSnapshot, DISPLAY_CHANNELS } from '../utils/channelKeyframeGroups';
import {
  addPropertyKeyframeMutator,
  deletePropertyKeyframeMutator,
  updatePropertyKeyframeFrameMutator,
} from '../utils/trackMutations';
import type { Track, TrackChannel, PropertyKeyframe } from '../types/animator';

function makeTrack(channels: Partial<Record<TrackChannel, PropertyKeyframe[]>>): Track {
  return {
    id: 'trk_1',
    partId: 'L1',
    name: 'T',
    color: '#f00',
    keyframes: [],
    channels: {
      x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
      maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
      ...channels,
    },
    visible: true,
    locked: false,
  } as Track;
}

const pk = (id: string, frame: number, value: number, templateId?: string): PropertyKeyframe => ({
  id, frame, value, easing: 'linear', ...(templateId ? { templateId } : {}),
} as PropertyKeyframe);

describe('M3 — groupChannelKeyframesByFrame (KeyframesTab data model)', () => {

  test('1: channel keyframes visible grouped by frame', () => {
    const track = makeTrack({
      x: [pk('x0', 0, 10), pk('x1', 60, 20)],
      y: [pk('y0', 0, 30)],
      opacity: [pk('o0', 120, 0.5)],
    });

    const groups = groupChannelKeyframesByFrame(track.channels, 'Sequence');
    expect(groups).toHaveLength(3);
    expect(groups[0].frame).toBe(0);
    expect(groups[0].channels).toEqual(['x', 'y']); // DISPLAY_CHANNELS order
    expect(groups[1].frame).toBe(60);
    expect(groups[1].channels).toEqual(['x']);
    expect(groups[2].frame).toBe(120);
    expect(groups[2].channels).toEqual(['opacity']);
    // keyframes map exposes per-channel entries
    expect(groups[0].keyframes.x.value).toBe(10);
    expect(groups[0].keyframes.y.value).toBe(30);
  });

  test('2: same-frame channels do not overwrite each other', () => {
    const track = makeTrack({
      x: [pk('x0', 30, 5)],
      rotation: [pk('r0', 30, 90)],
      scaleX: [pk('sx0', 30, 2)],
    });

    const groups = groupChannelKeyframesByFrame(track.channels, 'Sequence');
    expect(groups).toHaveLength(1);
    expect(groups[0].channels).toEqual(['x', 'rotation', 'scaleX']);
    expect(groups[0].keyframes.x.value).toBe(5);
    expect(groups[0].keyframes.rotation.value).toBe(90);
    expect(groups[0].keyframes.scaleX.value).toBe(2);
  });

  test('3: template filter applied', () => {
    const track = makeTrack({
      x: [pk('x_seq', 0, 10, 'Sequence'), pk('x_outro', 30, 99, 'Outro')],
    });

    const seq = groupChannelKeyframesByFrame(track.channels, 'Sequence');
    expect(seq).toHaveLength(1);
    expect(seq[0].frame).toBe(0);

    const outro = groupChannelKeyframesByFrame(track.channels, 'Outro');
    expect(outro).toHaveLength(1);
    expect(outro[0].frame).toBe(30);
  });

  test('4: empty / undefined channels → empty groups', () => {
    expect(groupChannelKeyframesByFrame(undefined, 'Sequence')).toHaveLength(0);
    expect(groupChannelKeyframesByFrame(makeTrack({}).channels, 'Sequence')).toHaveLength(0);
  });

  test('5: representative easing from first channel', () => {
    const track = makeTrack({
      x: [pk('x0', 0, 1)],
      y: [pk('y0', 0, 2, undefined) as PropertyKeyframe],
    });
    track.channels.x[0] = { ...track.channels.x[0], easing: 'easeIn' } as PropertyKeyframe;

    const groups = groupChannelKeyframesByFrame(track.channels, 'Sequence');
    expect(groups[0].easing).toBe('easeIn');
  });
});

describe('M3 — channel CRUD semantics used by KeyframesTab', () => {

  test('add snapshot writes 6 channels at same frame (no loss)', () => {
    let track = makeTrack({});
    // Simulate KeyframesTab handleAdd: one addPropertyKeyframe per channel
    const values = { x: 1, y: 2, rotation: 3, scaleX: 4, scaleY: 5, opacity: 0.5 };
    for (const [ch, val] of Object.entries(values)) {
      track = addPropertyKeyframeMutator([track], 'trk_1', ch as TrackChannel, 45, val as number, 'easeInOut', 'Sequence')[0];
    }

    const groups = groupChannelKeyframesByFrame(track.channels, 'Sequence');
    expect(groups).toHaveLength(1);
    expect(groups[0].channels).toEqual(['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']);
    expect(groups[0].keyframes.opacity.value).toBeCloseTo(0.5, 5);
  });

  test('delete removes all channel keyframes at that frame', () => {
    const track = makeTrack({
      x: [pk('x0', 30, 5), pk('x1', 90, 9)],
      y: [pk('y0', 30, 7)],
    });

    // Simulate KeyframesTab handleDelete for frame 30
    const groups = groupChannelKeyframesByFrame(track.channels, 'Sequence');
    const g30 = groups.find((g) => g.frame === 30)!;
    let updated = track;
    for (const ch of g30.channels) {
      updated = deletePropertyKeyframeMutator([updated], 'trk_1', ch as TrackChannel, g30.keyframes[ch].id)[0];
    }

    const remaining = groupChannelKeyframesByFrame(updated.channels, 'Sequence');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].frame).toBe(90);
    // x1 survived (other frame)
    expect(remaining[0].keyframes.x.value).toBe(9);
  });

  test('move updates frame on all channels at that frame', () => {
    const track = makeTrack({
      x: [pk('x0', 30, 5)],
      rotation: [pk('r0', 30, 90)],
    });

    // Simulate KeyframesTab handleFrameChange 30 → 75
    const groups = groupChannelKeyframesByFrame(track.channels, 'Sequence');
    const g30 = groups[0];
    let updated = track;
    for (const ch of g30.channels) {
      updated = updatePropertyKeyframeFrameMutator([updated], 'trk_1', ch as TrackChannel, g30.keyframes[ch].id, 75)[0];
    }

    const after = groupChannelKeyframesByFrame(updated.channels, 'Sequence');
    expect(after).toHaveLength(1);
    expect(after[0].frame).toBe(75);
    expect(after[0].channels).toEqual(['x', 'rotation']);
  });

  test('legacy keyframes array untouched by channel operations', () => {
    const track = makeTrack({ x: [pk('x0', 30, 5)] });
    track.keyframes = [
      { id: 'kf_legacy', frame: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' },
    ];

    const [updated] = addPropertyKeyframeMutator([track], 'trk_1', 'y', 30, 7, 'linear', 'Sequence');
    expect(updated.keyframes).toHaveLength(1);
    expect(updated.keyframes[0].id).toBe('kf_legacy');
  });
});

describe('M7 — buildTransformSnapshot (Outliner Add Composite Keyframe)', () => {

  test('1: maps all 6 transform values to canonical channels', () => {
    const snapshot = buildTransformSnapshot({ x: 10, y: 20, rotation: 30, scaleX: 2, scaleY: 3, opacity: 0.5 });
    expect(snapshot.x).toBe(10);
    expect(snapshot.y).toBe(20);
    expect(snapshot.rotation).toBe(30);
    expect(snapshot.scaleX).toBe(2);
    expect(snapshot.scaleY).toBe(3);
    expect(snapshot.opacity).toBeCloseTo(0.5, 5);
  });

  test('2: opacity 0 preserved (no falsy coercion)', () => {
    const snapshot = buildTransformSnapshot({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0 });
    expect(snapshot.opacity).toBe(0);
    expect(snapshot.x).toBe(0);
  });

  test('3: snapshot keys match DISPLAY_CHANNELS (same-frame add writes all 6)', () => {
    const snapshot = buildTransformSnapshot({ x: 1, y: 2, rotation: 3, scaleX: 4, scaleY: 5, opacity: 6 });
    expect(Object.keys(snapshot)).toEqual(['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']);
    // DISPLAY_CHANNELS order aligns with snapshot keys
    for (const ch of DISPLAY_CHANNELS) {
      expect(snapshot[ch]).toBeDefined();
    }
  });
});
