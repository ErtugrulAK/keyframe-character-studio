/**
 * C-01 / C-02 / C-03 — Motion Curves targeting regression tests.
 *
 * The curve modal must edit the SELECTED layer's exact channel, never fall
 * back to another layer, never write a zero-duration segment, and mask scalar
 * curves must reach persisted mask state (evaluator-visible).
 */

import { describe, test, expect } from 'vitest';
import { resolveCurveTarget, resolveCurveSegment } from '../utils/timelineMetrics';
import { updateKeyframeBezierPointsMutator } from '../utils/trackMutations';
import { interpolateChannel } from '../utils/defaults';
import type { Track, TrackChannel, PropertyKeyframe, Keyframe, LayerMaskChannel } from '../types/animator';

function makeTrack(id: string, opts?: {
  partId?: string;
  keyframes?: Keyframe[];
  channels?: Partial<Record<TrackChannel, PropertyKeyframe[]>>;
  maskChannels?: Partial<Record<LayerMaskChannel, PropertyKeyframe[]>>;
}): Track {
  return {
    id,
    partId: opts?.partId ?? `part_${id}`,
    name: id,
    color: '#f00',
    keyframes: opts?.keyframes ?? [],
    channels: {
      x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
      maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
      trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
      ...(opts?.channels ?? {}),
    },
    maskChannels: opts?.maskChannels as Track['maskChannels'],
    visible: true,
    locked: false,
  } as Track;
}

const pk = (id: string, frame: number, value: number, templateId = 'Sequence'): PropertyKeyframe =>
  ({ id, frame, value, easing: 'linear', templateId }) as PropertyKeyframe;

const lkf = (id: string, frame: number, templateId?: string): Keyframe =>
  ({
    id, frame,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    easing: 'linear',
    ...(templateId ? { templateId } : {}),
  }) as Keyframe;

describe('C-01 — resolveCurveTarget resolves the exact selected layer/channel', () => {
  test('the exact Astra repro: selected legacy track never borrows another layer\'s canonical curve', () => {
    const canonicalA = makeTrack('a', { channels: { x: [pk('ax0', 0, 0), pk('ax30', 30, 30)] } });
    const legacyB = makeTrack('b', { keyframes: [lkf('b0', 0), lkf('b30', 30)] });

    // The selection is layer B (legacy keyframes), so the target is B's list.
    const target = resolveCurveTarget(legacyB, 'Sequence', 'b30');
    expect(target?.channel).toBeNull();
    expect(target?.keyframes.map((k) => k.id)).toEqual(['b0', 'b30']);

    // A's canonical channel is never produced from B's identity.
    const wrong = resolveCurveTarget(canonicalA, 'Sequence', 'b30');
    expect(wrong?.keyframes.map((k) => k.id)).not.toContain('b30');
  });

  test('two canonical layers keep their own channels', () => {
    const a = makeTrack('a', { channels: { x: [pk('ax0', 0, 0), pk('ax30', 30, 30)] } });
    const b = makeTrack('b', { channels: { x: [pk('bx0', 0, 0), pk('bx30', 30, 30)] } });

    expect(resolveCurveTarget(a, 'Sequence', 'ax30')?.keyframes.map((k) => k.id)).toEqual(['ax0', 'ax30']);
    expect(resolveCurveTarget(b, 'Sequence', 'bx30')?.keyframes.map((k) => k.id)).toEqual(['bx0', 'bx30']);
  });

  test('multiple properties: the selected keyframe chooses the channel', () => {
    const track = makeTrack('a', {
      channels: {
        x: [pk('x0', 0, 0), pk('x30', 30, 30)],
        opacity: [pk('o0', 0, 1), pk('o15', 15, 0.5)],
      },
    });

    expect(resolveCurveTarget(track, 'Sequence', 'o15')?.channel).toBe('opacity');
    expect(resolveCurveTarget(track, 'Sequence', 'x30')?.channel).toBe('x');
  });

  test('an unknown selection falls back to the first active channel of the same track', () => {
    const track = makeTrack('a', { channels: { x: [pk('x0', 0, 0), pk('x30', 30, 30)] } });
    expect(resolveCurveTarget(track, 'Sequence', 'nope')?.channel).toBe('x');
  });

  test('multiple sequences: only active-template keyframes are returned', () => {
    const track = makeTrack('a', {
      channels: { x: [pk('x0', 0, 0), pk('x30', 30, 30), pk('xo0', 0, 0, 'Outro'), pk('xo30', 30, 30, 'Outro')] },
    });

    const seq = resolveCurveTarget(track, 'Sequence', 'x30');
    expect(seq?.keyframes.map((k) => k.id)).toEqual(['x0', 'x30']);
    const outro = resolveCurveTarget(track, 'Outro', 'xo30');
    expect(outro?.keyframes.map((k) => k.id)).toEqual(['xo0', 'xo30']);
  });

  test('mask channels resolve to the exact mask identity', () => {
    const track = makeTrack('a', { maskChannels: { 'm1:opacity': [pk('m0', 0, 0), pk('m30', 30, 1)] } });
    const target = resolveCurveTarget(track, 'Sequence', 'm30');
    expect(target?.channel).toBe('m1:opacity');
    expect(target?.channelKeyframes.map((k) => k.id)).toEqual(['m0', 'm30']);
  });

  test('a track without active-sequence data resolves to null (no cross-layer fallback)', () => {
    const empty = makeTrack('a', { channels: { x: [pk('xo0', 0, 0, 'Outro')] } });
    expect(resolveCurveTarget(empty, 'Sequence', null)).toBeNull();
    expect(resolveCurveTarget(null, 'Sequence', 'x0')).toBeNull();
  });

  test('a reordered or partially deleted list still resolves the exact identity', () => {
    const reordered = makeTrack('a', { channels: { x: [pk('x30', 30, 30), pk('x0', 0, 0)] } });
    expect(resolveCurveTarget(reordered, 'Sequence', 'x0')?.channel).toBe('x');
    const deleted = makeTrack('a', { channels: { x: [pk('x30', 30, 30)] } });
    expect(resolveCurveTarget(deleted, 'Sequence', 'x0')?.keyframes.map((k) => k.id)).toEqual(['x30']);
  });
});

describe('C-03 — only strictly positive-duration segments are editable', () => {
  const kf = (id: string, frame: number) => pk(id, frame, frame);

  test('duplicate frames produce no segment', () => {
    const list = [kf('a', 0), kf('b', 30), kf('c', 30), kf('d', 90)];
    // playhead between keyframes, selection on the duplicate-frame keyframe
    expect(resolveCurveSegment(list, 'Sequence', 'c', 31)).toBeNull();
    // playhead exactly on the duplicate frame still resolves a real segment
    expect(resolveCurveSegment(list, 'Sequence', 'c', 90)?.from.id).toBe('c');
  });

  test('the first, middle, and reordered distinct-frame cases stay correct', () => {
    const list = [kf('a', 0), kf('b', 30), kf('c', 60)];
    expect(resolveCurveSegment(list, 'Sequence', 'a', 0)).toBeNull();
    expect(resolveCurveSegment(list, 'Sequence', 'b', 30)?.from.id).toBe('a');
    expect(resolveCurveSegment(list, 'Sequence', 'c', 60)?.from.id).toBe('b');
  });
});

describe('C-02 — mask scalar curve edits reach persisted, evaluated mask state', () => {
  const mask = [pk('m0', 0, 0, 'Sequence'), pk('m30', 30, 1, 'Sequence')];

  test('the dual mutator writes the mask channel curve', () => {
    const track = makeTrack('a', { maskChannels: { 'm1:opacity': mask } });
    const [updated] = updateKeyframeBezierPointsMutator([track], track.id, 'm0', [0.42, 0, 1, 1]);

    const maskKeyframes = updated.maskChannels?.['m1:opacity'] ?? [];
    const from = maskKeyframes.find((k) => k.id === 'm0');
    const to = maskKeyframes.find((k) => k.id === 'm30');
    expect(from?.easing).toBe('cubic_bezier');
    expect(from?.bezierControlPoints).toEqual([0.42, 0, 1, 1]);
    expect(to?.easing).toBe('linear');
    expect(from?.value).toBe(0);
  });

  test('the evaluated mask value changes at a mid-frame after the edit', () => {
    const track = makeTrack('a', { maskChannels: { 'm1:opacity': mask } });
    const [updated] = updateKeyframeBezierPointsMutator([track], track.id, 'm0', [0.42, 0, 1, 1]);
    const edited = updated.maskChannels?.['m1:opacity'] ?? [];

    const before = interpolateChannel(mask, 15, 1);
    const after = interpolateChannel(edited, 15, 1);
    expect(before).toBe(0.5);
    expect(after).not.toBe(before);
    expect(after).toBeCloseTo(0.3153, 3); // ease-in pulls the mid-frame value down
  });

  test('a transform channel curve edit is unaffected by mask support', () => {
    const track = makeTrack('a', {
      channels: { x: [pk('x0', 0, 0), pk('x30', 30, 30)] },
      maskChannels: { 'm1:opacity': mask },
    });
    const [updated] = updateKeyframeBezierPointsMutator([track], track.id, 'x0', [0.2, 0, 0.8, 1]);
    expect(updated.maskChannels?.['m1:opacity'].every((k) => k.easing === 'linear')).toBe(true);
    expect(updated.channels.x.find((k) => k.id === 'x0')?.bezierControlPoints).toEqual([0.2, 0, 0.8, 1]);
  });
});
