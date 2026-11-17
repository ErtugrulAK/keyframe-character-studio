import { describe, expect, it } from 'vitest';
import type { PropertyKeyframe, Track } from '../types/animator';
import { effectiveSegmentAuthority } from '../utils/animation/defaults';
import { readKeyframeGroupEasing, setKeyframeGroupEasing } from '../utils/animation/keyframeEasing';
import { interpolateChannel } from '../utils/animation/defaults';

const key = (id: string, frame: number, extra: Partial<PropertyKeyframe> = {}): PropertyKeyframe => ({ id, frame, value: frame, easing: 'linear', ...extra });

const track = (channels: Partial<Record<'x' | 'y', PropertyKeyframe[]>>, extra: Partial<Track> = {}): Track => ({
  id: 't', partId: 'p', name: 'P', color: '#fff', visible: true, locked: false, expanded: false, keyframes: [],
  channels: { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [], trimPathStart: [], trimPathEnd: [], trimPathOffset: [], ...channels },
  ...extra,
} as Track);

describe('setKeyframeGroupEasing', () => {
  it('sets the easing on every channel key at the frame, keeping ids and values', () => {
    const before = track({ x: [key('x0', 0), key('x30', 30)], y: [key('y0', 0), key('y30', 30)] });
    const { track: after, changed } = setKeyframeGroupEasing(before, [0], 'Sequence', 'easeInOut');
    expect(changed).toBe(true);
    expect(after.channels!.x.map((k) => [k.id, k.value, k.easing])).toEqual([['x0', 0, 'easeInOut'], ['x30', 30, 'linear']]);
    expect(after.channels!.y[0].easing).toBe('easeInOut');
  });

  it('removes the curve data that would outrank the named easing on that segment only', () => {
    const before = track({ x: [
      key('a', 0, { easing: 'cubic_bezier', bezierControlPoints: [0.1, 0.2, 0.3, 0.4], bezierOut: { x: 0.3, y: 0 } }),
      key('b', 30, { bezierIn: { x: 0.7, y: 1 }, bezierOut: { x: 0.2, y: 0 } }),
      key('c', 60, { bezierIn: { x: 0.8, y: 1 } }),
    ] });
    const after = setKeyframeGroupEasing(before, [0], 'Sequence', 'easeOut').track.channels!.x;
    expect(effectiveSegmentAuthority(after[0], after[1])).toBe('named');
    expect(after[0].easing).toBe('easeOut');
    // The next segment (30 -> 60) keeps its own handle pair.
    expect(after[1].bezierOut).toEqual({ x: 0.2, y: 0 });
    expect(after[2].bezierIn).toEqual({ x: 0.8, y: 1 });
    expect(effectiveSegmentAuthority(after[1], after[2])).toBe('handles');
  });

  it('touches only the given sequence', () => {
    const before = track({ x: [key('s', 0), key('o', 0, { templateId: 'Out' })] });
    const after = setKeyframeGroupEasing(before, [0], 'Out', 'hold').track.channels!.x;
    expect(after.find((k) => k.id === 's')!.easing).toBe('linear');
    expect(after.find((k) => k.id === 'o')!.easing).toBe('hold');
  });

  it('reports no change (and returns the same track) when nothing is keyed there', () => {
    const before = track({ x: [key('x0', 0)] });
    const result = setKeyframeGroupEasing(before, [12], 'Sequence', 'easeIn');
    expect(result.changed).toBe(false);
    expect(result.track).toBe(before);
  });

  it('eases several frames at once (F9 on a selection) and mask channels too', () => {
    const before = track({ x: [key('x0', 0), key('x10', 10), key('x20', 20)] }, {
      maskChannels: { 'm1:maskOffsetX': [key('m0', 10), key('m1', 20)] } as Track['maskChannels'],
    });
    const after = setKeyframeGroupEasing(before, [0, 10], 'Sequence', 'easeInOut').track;
    expect(after.channels!.x.map((k) => k.easing)).toEqual(['easeInOut', 'easeInOut', 'linear']);
    expect((after.maskChannels as Record<string, PropertyKeyframe[]>)['m1:maskOffsetX'][0].easing).toBe('easeInOut');
  });
});

describe('Copy / Paste Easing', () => {
  it('reads the one curve the keys at a frame start with', () => {
    const before = track({ x: [key('x0', 0, { easing: 'easeOut' }), key('x30', 30)], y: [key('y0', 0, { easing: 'easeOut' }), key('y30', 30)] });
    expect(readKeyframeGroupEasing(before, 0, 'Sequence')).toEqual({ easing: 'easeOut' });
    expect(readKeyframeGroupEasing(before, 15, 'Sequence')).toBeNull();
  });

  it('gives no curve when the channels at the frame disagree', () => {
    const before = track({ x: [key('x0', 0, { easing: 'easeOut' }), key('x30', 30)], y: [key('y0', 0, { easing: 'easeIn' }), key('y30', 30)] });
    expect(readKeyframeGroupEasing(before, 0, 'Sequence')).toBeNull();
  });

  it('carries a temporal handle pair as the same cubic, so the pasted segment plays exactly the copied one', () => {
    const source = track({ x: [
      key('a', 0, { easing: 'bezier', bezierOut: { x: 0.8, y: 0.1 } }),
      key('b', 30, { value: 300, bezierIn: { x: 0.2, y: 0.9 } }),
    ] });
    const curve = readKeyframeGroupEasing(source, 0, 'Sequence');
    expect(curve).toEqual({ easing: 'bezier', controlPoints: [0.8, 0.1, 0.2, 0.9] });
    const target = track({ x: [key('c', 0, { value: 0 }), key('d', 30, { value: 300 })] });
    const pasted = setKeyframeGroupEasing(target, [0], 'Sequence', curve!.easing, curve!.controlPoints).track;
    for (const frame of [3, 9, 15, 21, 27]) {
      expect(interpolateChannel(pasted.channels!.x, frame, 0)).toBeCloseTo(interpolateChannel(source.channels!.x, frame, 0), 6);
    }
  });

  it('pasting control points replaces the segment curve and leaves values and frames alone', () => {
    const target = track({ x: [key('c', 0, { value: 5 }), key('d', 30, { value: 50, bezierIn: { x: 0.5, y: 0.5 } })] });
    const after = setKeyframeGroupEasing(target, [0], 'Sequence', 'cubic_bezier', [0.1, 0.2, 0.3, 0.4]).track.channels!.x;
    expect(after.map((k) => [k.id, k.frame, k.value])).toEqual([['c', 0, 5], ['d', 30, 50]]);
    expect(after[0].bezierControlPoints).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(after[1].bezierIn).toBeUndefined();
    expect(effectiveSegmentAuthority(after[0], after[1])).toBe('controlPoints');
  });

  it('a hold copies as a hold', () => {
    const before = track({ x: [key('a', 0, { easing: 'hold', bezierControlPoints: [0, 0, 1, 1] }), key('b', 30)] });
    expect(readKeyframeGroupEasing(before, 0, 'Sequence')).toEqual({ easing: 'hold' });
  });
});
