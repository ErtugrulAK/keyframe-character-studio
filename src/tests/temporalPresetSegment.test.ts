/**
 * V6-P0 (#57 blocker) — a preset is a SEGMENT gesture, not a keyframe gesture.
 *
 * The evaluator applies temporal handles only for a COMPLETE pair across the
 * segment (defaults.applyEasing via interpolateChannel: prev.bezierOut &&
 * next.bezierIn). The originally shipped preset select wrote both handles to
 * the ONE selected keyframe, so on a fresh channel the interpolation NEVER
 * changed — the affordance lied. RED tests below pin the defect with REAL
 * interpolated output; GREEN tests exercise the segment-level fix.
 *
 * Independent numeric anchor (Ease In Out preset (0.42,0,0.58,1), channel
 * 0→100 over frames 0→100): value at frame 25 must be 12.916193… (root of
 * x(s)=0.25 gives s≈0.22503, y(s)=0.1291619), NOT the linear 25.
 */

import { describe, expect, it } from 'vitest';
import { interpolateChannel } from '../utils/defaults';
import { applyTemporalHandlesToSegmentMutator } from '../utils/trackMutations';
import type { PropertyKeyframe } from '../types/animator';

const EASE_IN_OUT = { out: { x: 0.42, y: 0 }, in: { x: 0.58, y: 1 } };
const channel: PropertyKeyframe[] = [
  { id: 'a', frame: 0, value: 0, easing: 'linear' },
  { id: 'b', frame: 100, value: 100, easing: 'linear' },
];

describe('#57 RED — the single-key patch cannot move the curve', () => {
  it('preset applied to the FIRST key only: frame 25 still linear', () => {
    const patched = channel.map((k) => (k.id === 'a' ? { ...k, bezierOut: EASE_IN_OUT.out, bezierIn: EASE_IN_OUT.in } : k));
    expect(interpolateChannel(patched, 25, 0)).toBeCloseTo(25, 6); // next.bezierIn missing
  });

  it('preset applied to the LAST key only: frame 25 still linear', () => {
    const patched = channel.map((k) => (k.id === 'b' ? { ...k, bezierOut: EASE_IN_OUT.out, bezierIn: EASE_IN_OUT.in } : k));
    expect(interpolateChannel(patched, 25, 0)).toBeCloseTo(25, 6); // prev.bezierOut missing
  });
});

describe('#57 GREEN — segment-level atomic application', () => {
  const track = (keys: PropertyKeyframe[]) => ({
    id: 't1',
    partId: 'p1',
    name: 'T',
    color: '#fff',
    visible: true,
    locked: false,
    expanded: true,
    channels: { x: keys } as never,
  });

  const apply = (keys: PropertyKeyframe[], fromId: string) =>
    applyTemporalHandlesToSegmentMutator([track(keys)] as never, 't1', 'x', fromId, EASE_IN_OUT.out, EASE_IN_OUT.in);
  const keysOf = (result: unknown) => (result as Array<{ channels: { x: PropertyKeyframe[] } }>)[0].channels.x;

  it('applying to segment A→B writes BOTH endpoints and nothing else', () => {
    const keys = keysOf(apply(channel, 'a'));
    expect(keys.find((k) => k.id === 'a')!.bezierOut).toEqual(EASE_IN_OUT.out);
    expect(keys.find((k) => k.id === 'b')!.bezierIn).toEqual(EASE_IN_OUT.in);
    expect(keys.find((k) => k.id === 'a')!.bezierIn).toBeUndefined();
    expect(keys.find((k) => k.id === 'b')!.bezierOut).toBeUndefined();
  });

  it('REAL interpolated output at frame 25 is the independent 12.916193…', () => {
    expect(interpolateChannel(keysOf(apply(channel, 'a')), 25, 0)).toBeCloseTo(12.916193, 4);
  });

  it('quarter-frame asymmetry mirrors the curve', () => {
    const keys = keysOf(apply(channel, 'a'));
    expect(interpolateChannel(keys, 25, 0)).toBeLessThan(25);
    expect(interpolateChannel(keys, 75, 0)).toBeGreaterThan(75);
    expect(interpolateChannel(keys, 50, 0)).toBeCloseTo(50, 6); // ease-in-out is antisymmetric
  });

  it('the LAST key has no outgoing segment: strict no-op (undefined)', () => {
    expect(apply(channel, 'b')).toBeUndefined();
  });

  it('a HOLD start key refuses the write (hold outranks handles — explicit, never implied)', () => {
    const held: PropertyKeyframe[] = [
      { id: 'a', frame: 0, value: 0, easing: 'hold' },
      { id: 'b', frame: 100, value: 100, easing: 'linear' },
    ];
    expect(apply(held, 'a')).toBeUndefined();
  });

  it('three-key channel: only the addressed segment is touched', () => {
    const keys3: PropertyKeyframe[] = [
      { id: 'a', frame: 0, value: 0, easing: 'linear' },
      { id: 'm', frame: 50, value: 50, easing: 'linear', bezierOut: { x: 1 / 3, y: 2 / 3 }, bezierIn: { x: 2 / 3, y: 1 / 3 } },
      { id: 'b', frame: 100, value: 100, easing: 'linear' },
    ];
    const after = keysOf(apply(keys3, 'a'));
    // The outgoing segment of 'a' is A→M: M is the INCOMING endpoint, so its
    // bezierIn is legitimately replaced; everything downstream is untouched.
    expect(after.find((k) => k.id === 'm')!.bezierIn).toEqual(EASE_IN_OUT.in);
    expect(after.find((k) => k.id === 'm')!.bezierOut).toEqual(keys3[1].bezierOut); // M's own out intact
    expect(after.find((k) => k.id === 'b')).toEqual(keys3[2]); // far key byte-identical
  });

  it('template scope: the pair never crosses into another sequence', () => {
    const scoped: PropertyKeyframe[] = [
      { id: 'a', frame: 0, value: 0, easing: 'linear', templateId: 'Sequence' },
      { id: 'n', frame: 100, value: 100, easing: 'linear', templateId: 'Named' },
    ];
    // 'a' has no later key in ITS scope: refuse rather than reach into 'Named'.
    expect(apply(scoped, 'a')).toBeUndefined();
  });

  it('pure single-result transform: one call returns ONE new document (one undo entry)', () => {
    const before = [track(channel)] as never;
    const after = apply(channel, 'a') as never;
    expect(before).not.toBe(after);
    expect(after).toHaveLength(1);
    // and the untouched track instance identity proves nothing else moved
    expect((after as Array<{ id: string }>)[0].id).toBe('t1');
  });
});
