/**
 * M5 — SequencerTimeline canonical channel integration tests
 *
 * Verifies the pure helpers extracted from SequencerTimeline:
 *   - computeMaxFrame (timeline length across legacy + channels)
 *   - hasChannelDataForTemplate / resolveCurveSegment
 *   - bezier edits land on channel keyframes via the dual mutator
 */

import { describe, test, expect } from 'vitest';
import { computeMaxFrame, hasChannelDataForTemplate, resolveAdjacentKeyframeFrame, resolveChannelKeyframeFrames, resolveConnectorSegments, resolveCurveSegment, resolveLayerKeyframeFrames } from '../utils/timelineMetrics';
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

describe('M5 — hasChannelDataForTemplate / updateKeyframeBezierPointsMutator', () => {

  test('7: template filtering — channel data is reported per template', () => {
    const track = makeTrack('a', { channels: { x: [pk('x1', 30, 5, 'Outro')] } });
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

describe('M5 — resolveCurveSegment', () => {
  const kf = (id: string, frame: number, templateId = 'Sequence') => pk(id, frame, frame, templateId);

  test('a single keyframe owns no segment', () => {
    expect(resolveCurveSegment([kf('a', 0)], 'Sequence', 'a', 0)).toBeNull();
    expect(resolveCurveSegment([], 'Sequence', null, 0)).toBeNull();
  });

  test('the first keyframe has nothing before it', () => {
    const list = [kf('a', 0), kf('b', 30)];
    expect(resolveCurveSegment(list, 'Sequence', 'a', 0)).toBeNull();
  });

  test('a later keyframe resolves the segment that leads into it', () => {
    const list = [kf('a', 0), kf('b', 30), kf('c', 60), kf('d', 90), kf('e', 120)];
    const segment = resolveCurveSegment(list, 'Sequence', 'd', 90);
    expect(segment?.from.id).toBe('c');
    expect(segment?.to.id).toBe('d');
    expect(segment?.from.frame).toBe(60);
    expect(segment?.to.frame).toBe(90);
    expect(segment?.list.map((k) => k.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  test('the playhead picks the keyframe; the selection is the fallback', () => {
    const list = [kf('a', 0), kf('b', 30), kf('c', 60)];
    expect(resolveCurveSegment(list, 'Sequence', 'a', 60)?.from.id).toBe('b');
    expect(resolveCurveSegment(list, 'Sequence', 'c', 7)?.from.id).toBe('b');
  });

  test('an unrelated selection or a frame between keyframes resolves nothing', () => {
    const list = [kf('a', 0), kf('b', 30)];
    expect(resolveCurveSegment(list, 'Sequence', 'nope', 12)).toBeNull();
    expect(resolveCurveSegment(list, 'Sequence', null, 30)?.from.id).toBe('a');
  });

  test('keyframes of another template never participate', () => {
    const list = [kf('a', 0, 'Outro'), kf('b', 30), kf('c', 60)];
    const segment = resolveCurveSegment(list, 'Sequence', 'c', 60);
    expect(segment?.from.id).toBe('b');
    expect(segment?.list.map((k) => k.id)).toEqual(['b', 'c']);
    expect(resolveCurveSegment(list, 'Outro', 'a', 0)).toBeNull();
  });
});

describe('R3-07 — per-layer keyframe navigation', () => {
  test('resolves every canonical channel frame once, in frame order', () => {
    const track = makeTrack('a', {
      channels: {
        x: [pk('x1', 30), pk('x2', 0)],
        opacity: [pk('o1', 30)],
        trimPathEnd: [pk('t1', 90)],
      },
    });
    expect(resolveLayerKeyframeFrames(track, 'Sequence')).toEqual([0, 30, 90]);
  });

  test('reads the legacy composite list the evaluator still resolves', () => {
    const track = makeTrack('a', { keyframes: [lkf('k0', 0), lkf('k20', 20)] });
    expect(resolveLayerKeyframeFrames(track, 'Sequence')).toEqual([0, 20]);
  });

  test('scopes the read to the active template', () => {
    const track = makeTrack('a', {
      channels: { x: [pk('x1', 0, 5), pk('x2', 45, 9, 'Outro')] },
    });
    expect(resolveLayerKeyframeFrames(track, 'Sequence')).toEqual([0]);
    expect(resolveLayerKeyframeFrames(track, 'Outro')).toEqual([45]);
  });

  test('previous/next are strictly adjacent and null at the ends', () => {
    const frames = [0, 12, 48];
    expect(resolveAdjacentKeyframeFrame(frames, 20, 'previous')).toBe(12);
    expect(resolveAdjacentKeyframeFrame(frames, 20, 'next')).toBe(48);
    expect(resolveAdjacentKeyframeFrame(frames, 0, 'previous')).toBeNull();
    expect(resolveAdjacentKeyframeFrame(frames, 48, 'next')).toBeNull();
    // Standing ON a keyframe still moves to the neighbouring key.
    expect(resolveAdjacentKeyframeFrame(frames, 12, 'previous')).toBe(0);
    expect(resolveAdjacentKeyframeFrame(frames, 12, 'next')).toBe(48);
    expect(resolveAdjacentKeyframeFrame([], 5, 'next')).toBeNull();
  });

  /*
   * R4-05 — the policy the per-layer control (and now every property-level
   * control) is pinned to. 0 keys and 1 key are the cases that must never
   * promise a jump the layer cannot make, and navigation never wraps.
   */
  test('0 keys: the layer resolves no frame and both directions stay disabled', () => {
    const track = makeTrack('a');
    const frames = resolveLayerKeyframeFrames(track, 'Sequence');
    expect(frames).toEqual([]);
    expect(resolveAdjacentKeyframeFrame(frames, 20, 'previous')).toBeNull();
    expect(resolveAdjacentKeyframeFrame(frames, 20, 'next')).toBeNull();
  });

  test('keys of another template do not arm the control', () => {
    const track = makeTrack('a', { channels: { x: [pk('x1', 40, 1, 'Outro')] } });
    const frames = resolveLayerKeyframeFrames(track, 'Sequence');
    expect(frames).toEqual([]);
    expect(resolveAdjacentKeyframeFrame(frames, 40, 'previous')).toBeNull();
    expect(resolveAdjacentKeyframeFrame(frames, 40, 'next')).toBeNull();
  });

  test('1 key: disabled on both sides while the playhead sits on it', () => {
    const track = makeTrack('a', { channels: { x: [pk('x1', 24)] } });
    const frames = resolveLayerKeyframeFrames(track, 'Sequence');
    expect(frames).toEqual([24]);
    expect(resolveAdjacentKeyframeFrame(frames, 24, 'previous')).toBeNull();
    expect(resolveAdjacentKeyframeFrame(frames, 24, 'next')).toBeNull();
  });

  test('1 key: only the direction that reaches it is enabled', () => {
    const track = makeTrack('a', { channels: { x: [pk('x1', 24)] } });
    const frames = resolveLayerKeyframeFrames(track, 'Sequence');
    // Before the key: forward reaches it, backward has nothing to reach.
    expect(resolveAdjacentKeyframeFrame(frames, 0, 'previous')).toBeNull();
    expect(resolveAdjacentKeyframeFrame(frames, 0, 'next')).toBe(24);
    // After the key: backward reaches it, forward has nothing to reach.
    expect(resolveAdjacentKeyframeFrame(frames, 60, 'previous')).toBe(24);
    expect(resolveAdjacentKeyframeFrame(frames, 60, 'next')).toBeNull();
  });

  test('2+ keys: each side is enabled only when that side has a key, and never wraps', () => {
    const track = makeTrack('a', { channels: { x: [pk('x1', 0)], opacity: [pk('o1', 30)] } });
    const frames = resolveLayerKeyframeFrames(track, 'Sequence');
    expect(frames).toEqual([0, 30]);
    expect(resolveAdjacentKeyframeFrame(frames, 0, 'previous')).toBeNull();
    expect(resolveAdjacentKeyframeFrame(frames, 30, 'next')).toBeNull();
    expect(resolveAdjacentKeyframeFrame(frames, 0, 'next')).toBe(30);
    expect(resolveAdjacentKeyframeFrame(frames, 30, 'previous')).toBe(0);
  });

  describe('R4-05 — per-property navigation', () => {
    const track = makeTrack('a', {
      channels: { x: [pk('x1', 10), pk('x2', 50)], opacity: [pk('o1', 80)] },
    });

    test('reads only the property\'s own frames', () => {
      expect(resolveChannelKeyframeFrames(track, 'x', 'Sequence')).toEqual([10, 50]);
      expect(resolveChannelKeyframeFrames(track, 'opacity', 'Sequence')).toEqual([80]);
      expect(resolveChannelKeyframeFrames(track, 'rotation', 'Sequence')).toEqual([]);
    });

    test('a key on a sibling property never arms this property', () => {
      const xFrames = resolveChannelKeyframeFrames(track, 'x', 'Sequence');
      // The layer moves on past frame 80, but X has nothing after 50.
      expect(resolveAdjacentKeyframeFrame(xFrames, 50, 'next')).toBeNull();
      expect(resolveAdjacentKeyframeFrame(xFrames, 50, 'previous')).toBe(10);
      expect(resolveAdjacentKeyframeFrame(xFrames, 10, 'previous')).toBeNull();
      // Opacity is the mirror image: its own single key, its own directions.
      const oFrames = resolveChannelKeyframeFrames(track, 'opacity', 'Sequence');
      expect(resolveAdjacentKeyframeFrame(oFrames, 80, 'previous')).toBeNull();
      expect(resolveAdjacentKeyframeFrame(oFrames, 80, 'next')).toBeNull();
      expect(resolveAdjacentKeyframeFrame(oFrames, 0, 'next')).toBe(80);
    });

    test('scopes the property read to the active template', () => {
      const templated = makeTrack('b', {
        channels: { x: [pk('x1', 5), pk('x2', 45, 1, 'Outro')] },
      });
      expect(resolveChannelKeyframeFrames(templated, 'x', 'Sequence')).toEqual([5]);
      expect(resolveChannelKeyframeFrames(templated, 'x', 'Outro')).toEqual([45]);
    });

    test('a legacy composite keyframe still counts for its channels', () => {
      const legacy = makeTrack('c', { keyframes: [lkf('k0', 0), lkf('k20', 20)] });
      expect(resolveChannelKeyframeFrames(legacy, 'x', 'Sequence')).toEqual([0, 20]);
      expect(resolveChannelKeyframeFrames(legacy, 'opacity', 'Sequence')).toEqual([0, 20]);
    });
  });
});

describe('R4-08 — connector segments clear the keyframe glyphs', () => {
  test('one segment per gap, each cleared of both glyphs', () => {
    expect(resolveConnectorSegments([0, 10, 30], 5, 9)).toEqual([
      { left: 9, width: 32 },   // 0→10 is a 50px span: 9px cleared at each end
      { left: 59, width: 82 },  // 10→30 is a 100px span
    ]);
  });

  test('a single keyframe owns no connector at all', () => {
    expect(resolveConnectorSegments([12], 5, 9)).toEqual([]);
    expect(resolveConnectorSegments([], 5, 9)).toEqual([]);
  });

  test('keys closer together than two glyph gaps emit no segment', () => {
    // Two frames at 5px are a 10px span, less than the 18px of clearance.
    expect(resolveConnectorSegments([4, 6], 5, 9)).toEqual([]);
    // Exactly two gaps is still empty: the segment would have zero width.
    expect(resolveConnectorSegments([0, 2], 9, 9)).toEqual([]);
  });

  test('every emitted segment starts after the previous glyph and ends before the next', () => {
    const frameWidth = 7;
    // Every gap here is wider than two glyph gaps, so segments and gaps align 1:1.
    const frames = [3, 11, 40];
    const segments = resolveConnectorSegments(frames, frameWidth, 9);
    expect(segments).toHaveLength(2);
    segments.forEach((segment, index) => {
      const from = frames[index] * frameWidth;
      const to = frames[index + 1] * frameWidth;
      expect(segment.left).toBeGreaterThanOrEqual(from + 9);
      expect(segment.left + segment.width).toBeLessThanOrEqual(to - 9);
    });
  });
});
