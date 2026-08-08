/**
 * M5 — SequencerTimeline canonical channel integration tests
 *
 * Verifies the pure helpers extracted from SequencerTimeline:
 *   - computeMaxFrame (timeline length across legacy + channels)
 *   - findChannelKeyframeAtFrame / hasChannelDataForTemplate
 *   - bezier edits land on channel keyframes via the dual mutator
 */

import { describe, test, expect } from 'vitest';
import { computeMaxFrame, findChannelKeyframeAtFrame, hasChannelDataForTemplate } from '../utils/timelineMetrics';
import { updateKeyframeBezierPointsMutator } from '../utils/trackMutations';
import type { Track, TrackChannel, PropertyKeyframe, Keyframe } from '../types/animator';

function makeTrack(id: string, opts?: {
  keyframes?: Keyframe[];
  channels?: Partial<Record<TrackChannel, PropertyKeyframe[]>>;
}): Track {
  return {
    id,
    partId: `part_${id}`,
    name: id,
    color: '#f00',
    keyframes: opts?.keyframes || [],
    channels: {
      x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
      maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
      ...(opts?.channels || {}),
    },
    visible: true,
    locked: false,
  } as Track;
}

const pk = (id: string, frame: number, value: number, templateId = 'Sequence'): PropertyKeyframe =>
  ({ id, frame, value, easing: 'linear', templateId }) as PropertyKeyframe;

const lkf = (id: string, frame: number): Keyframe =>
  ({ id, frame, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' }) as Keyframe;

describe('M5 — computeMaxFrame', () => {

  test('1: legacy maxFrame preserved', () => {
    const tracks = [makeTrack('a', { keyframes: [lkf('k1', 0), lkf('k2', 90)] })];
    expect(computeMaxFrame(tracks)).toBe(90);
  });

  test('2: channel-only track maxFrame correct', () => {
    const tracks = [makeTrack('a', { channels: { x: [pk('x1', 0), pk('x2', 140)] } })];
    expect(computeMaxFrame(tracks)).toBe(140);
  });

  test('3: channel frame beyond legacy wins', () => {
    const tracks = [makeTrack('a', {
      keyframes: [lkf('k1', 60)],
      channels: { opacity: [pk('o1', 180)] },
    })];
    expect(computeMaxFrame(tracks)).toBe(180);
  });

  test('4: multiple channels at same frame counted once (max is single value)', () => {
    const tracks = [makeTrack('a', {
      channels: { x: [pk('x1', 120)], y: [pk('y1', 120)], opacity: [pk('o1', 120)] },
    })];
    expect(computeMaxFrame(tracks)).toBe(120);
  });

  test('5: max across tracks and templates (existing behavior)', () => {
    const tracks = [
      makeTrack('a', { channels: { x: [pk('x1', 60, 0, 'Sequence')] } }),
      makeTrack('b', { channels: { x: [pk('x1', 200, 0, 'Outro')] } }),
    ];
    expect(computeMaxFrame(tracks)).toBe(200);
  });

  test('6: empty tracks / undefined channels → 0, no crash', () => {
    expect(computeMaxFrame([])).toBe(0);
    const noChannels = { id: 'a', partId: 'p', name: 'a', color: '#000', keyframes: [], visible: true, locked: false } as Track;
    expect(computeMaxFrame([noChannels])).toBe(0);
  });
});

describe('M5 — findChannelKeyframeAtFrame / hasChannelDataForTemplate', () => {

  test('7: finds channel keyframe at frame for active template', () => {
    const track = makeTrack('a', { channels: { x: [pk('x1', 30, 5, 'Sequence')] } });
    const found = findChannelKeyframeAtFrame(track, 'Sequence', 30);
    expect(found).not.toBeNull();
    expect(found!.id).toBe('x1');
    expect(findChannelKeyframeAtFrame(track, 'Sequence', 31)).toBeNull();
  });

  test('8: template filtering — other template not returned', () => {
    const track = makeTrack('a', { channels: { x: [pk('x1', 30, 5, 'Outro')] } });
    expect(findChannelKeyframeAtFrame(track, 'Sequence', 30)).toBeNull();
    expect(findChannelKeyframeAtFrame(track, 'Outro', 30)?.id).toBe('x1');
    expect(hasChannelDataForTemplate(track, 'Sequence')).toBe(false);
    expect(hasChannelDataForTemplate(track, 'Outro')).toBe(true);
  });

  test('9: bezier edit on channel keyframe preserves easing/bezier, other frames untouched', () => {
    const track = makeTrack('a', {
      channels: { x: [pk('x1', 30, 5), pk('x2', 90, 9)] },
    });

    const [updated] = updateKeyframeBezierPointsMutator([track], track.id, 'x1', [0.1, 0.2, 0.3, 0.4]);

    const kf1 = updated.channels.x.find((k) => k.id === 'x1')!;
    const kf2 = updated.channels.x.find((k) => k.id === 'x2')!;
    expect(kf1.easing).toBe('cubic_bezier');
    expect(kf1.bezierControlPoints).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(kf1.value).toBe(5);              // value preserved
    expect(kf2.easing).toBe('linear');      // other frame untouched
    expect(kf2.bezierControlPoints).toBeUndefined();
  });

  test('10: bezier mutator leaves other tracks alone', () => {
    const t1 = makeTrack('a', { channels: { x: [pk('x1', 30, 5)] } });
    const t2 = makeTrack('b', { channels: { x: [pk('x1', 30, 5)] } });

    const [u1, u2] = updateKeyframeBezierPointsMutator([t1, t2], t1.id, 'x1', [0.5, 0.5, 0.5, 0.5]);
    expect(u1.channels.x[0].bezierControlPoints).toEqual([0.5, 0.5, 0.5, 0.5]);
    expect(u2.channels.x[0].bezierControlPoints).toBeUndefined();
  });
});
