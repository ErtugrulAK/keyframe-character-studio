import { describe, expect, it } from 'vitest';
import type { CharacterPart, EasingType, PropertyKeyframe, Track } from '../types/animator';
import { applyEasing, deriveAutoBezierControlPoints, interpolateChannel, lerp, makeEmptyChannels } from '../utils/defaults';
import { createTransformEvaluator, evaluateTransform } from '../utils/evaluateTransform';

/**
 * The evaluator's lookups and searches were rewritten for speed (index instead
 * of a scan per parent level, cached key order, binary search, one world pose
 * per layer and frame). These tests pin that every result is the SAME as the
 * straightforward algorithm it replaced, on seeded random scenes.
 */

/** The previous interpolateChannel, kept verbatim as the reference. */
function referenceInterpolateChannel(keyframes: PropertyKeyframe[], frame: number, fallback: number): number {
  if (!keyframes || keyframes.length === 0) return fallback;
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
  const exact = sorted.find((k) => k.frame === frame);
  if (exact) return exact.value;
  if (frame <= sorted[0].frame) return sorted[0].value;
  if (frame >= sorted[sorted.length - 1].frame) return sorted[sorted.length - 1].value;
  let prev = sorted[0];
  let next = sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (frame >= sorted[i].frame && frame <= sorted[i + 1].frame) {
      prev = sorted[i];
      next = sorted[i + 1];
      break;
    }
  }
  const duration = next.frame - prev.frame;
  if (duration <= 0) return prev.value;
  const progress = (frame - prev.frame) / duration;
  const previousPrevious = sorted[sorted.indexOf(prev) - 1];
  const nextNext = sorted[sorted.indexOf(next) + 1];
  const autoBezier = prev.easing === 'autoBezier' ? deriveAutoBezierControlPoints(prev, next, previousPrevious, nextNext) : undefined;
  const eased = applyEasing(progress, prev.easing, prev.bezierControlPoints ?? autoBezier, prev.bezierOut && next.bezierIn ? { out: prev.bezierOut, in: next.bezierIn } : undefined);
  return lerp(prev.value, next.value, eased);
}

/** Deterministic PRNG (mulberry32). */
const random = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const EASINGS: EasingType[] = ['linear', 'easeIn', 'easeOut', 'easeInOut', 'hold', 'autoBezier', 'overshoot'];

const randomKeys = (next: () => number, count: number, prefix: string): PropertyKeyframe[] => Array.from({ length: count }, (_, i) => ({
  id: `${prefix}${i}`,
  // Small frame range so equal frames (duplicates) occur, in random order.
  frame: Math.floor(next() * 40),
  value: Math.round(next() * 400 - 200),
  easing: EASINGS[Math.floor(next() * EASINGS.length)],
  ...(next() < 0.2 ? { bezierControlPoints: [next(), next(), next(), next()] as [number, number, number, number] } : {}),
  ...(next() < 0.2 ? { bezierOut: { x: next(), y: next() }, bezierIn: { x: next(), y: next() } } : {}),
}));

describe('evaluator equivalence', () => {
  it('interpolateChannel matches the reference on unsorted lists with duplicate frames', () => {
    const next = random(7);
    for (let scene = 0; scene < 300; scene += 1) {
      const keys = randomKeys(next, 1 + Math.floor(next() * 8), `k${scene}_`);
      for (let frame = -3; frame <= 43; frame += 0.5) {
        expect(interpolateChannel(keys, frame, 17)).toBe(referenceInterpolateChannel(keys, frame, 17));
      }
    }
    expect(interpolateChannel([], 3, 17)).toBe(17);
  });

  const part = (id: string, parentId?: string): CharacterPart => ({
    id, name: id, type: 'custom_rect', zIndex: 1, pivot: { x: 0, y: 0 },
    baseTransform: { x: 10, y: -5, rotation: 3, scaleX: 1, scaleY: 1, opacity: 1 },
    ...(parentId ? { parentId } : {}),
  } as CharacterPart);

  const track = (partId: string, next: () => number): Track => ({
    id: `t-${partId}`, partId, name: partId, color: '#fff', visible: true, locked: false, expanded: false, keyframes: [],
    channels: { ...makeEmptyChannels(), x: randomKeys(next, 4, `${partId}x`), rotation: randomKeys(next, 3, `${partId}r`), scaleX: randomKeys(next, 2, `${partId}s`).map((k) => ({ ...k, value: 0.5 + Math.abs(k.value) / 200 })) },
  } as Track);

  it('a shared evaluator gives the same world poses as one evaluation per layer, deep chains included', () => {
    const next = random(11);
    for (let scene = 0; scene < 40; scene += 1) {
      const parts: CharacterPart[] = [];
      for (let i = 0; i < 12; i += 1) {
        const parent = i > 0 && next() < 0.7 ? `p${Math.floor(next() * i)}` : undefined;
        parts.push(part(`p${i}`, parent));
      }
      const tracks = parts.map((p) => track(p.id, next));
      const shared = createTransformEvaluator(parts, tracks, 'Sequence');
      for (const frame of [0, 7, 13.5, 30, 45]) {
        for (const p of parts) {
          // A fresh copy of the inputs defeats every cache: the reference.
          const fresh = evaluateTransform(structuredClone(parts), structuredClone(tracks), 'Sequence', p.id, frame);
          expect(shared(p.id, frame)).toEqual(fresh);
        }
      }
    }
  });

  it('a parent cycle (an invalid scene) still terminates and is not cached into other layers', () => {
    const parts = [part('a', 'b'), part('b', 'a'), part('c', 'a')];
    const tracks: Track[] = [];
    const shared = createTransformEvaluator(parts, tracks, 'Sequence');
    for (const id of ['a', 'b', 'c', 'a']) {
      expect(shared(id, 0)).toEqual(evaluateTransform(structuredClone(parts), tracks, 'Sequence', id, 0));
    }
  });
});
