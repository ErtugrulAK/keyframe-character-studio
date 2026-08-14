import { describe, it, expect } from 'vitest';
import { builtinPresetToCustomKeyframes } from '../utils/presetConversion';
import { sampleCustomPreset } from '../utils/presetSampler';
import { computeProceduralDelta } from '../utils/proceduralAnimation';
import type { CharacterPart } from '../types/animator';

/**
 * M25 25C — builtin → custom conversion equivalence.
 * A saved custom preset must reproduce the builtin animation through the
 * EXISTING custom sampler. Keyframe points are sampled exactly, so the
 * custom output equals the builtin output at every sampled progress point
 * (0 / 0.5 / 1 asserted here).
 */

function makePart(overrides: Partial<CharacterPart> = {}): CharacterPart {
  return {
    id: 'p1', name: 'Part One', type: 'custom_box', zIndex: 1, pivot: { x: 0, y: 0 },
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    fillColor: '#ff0000', strokeColor: '#101218', strokeWidth: 2,
    ...overrides,
  } as CharacterPart;
}

function builtinDelta(builtinId: string, progress: number, mode: 'in' | 'out') {
  const part = makePart({
    enableMotionAnim: true,
    ...(mode === 'in' ? { inAnimPreset: builtinId, inAnimDuration: 30 } : { outAnimPreset: builtinId, outAnimDuration: 30 }),
  });
  return computeProceduralDelta(
    part, [], 90, 0,
    {
      appMode: 'broadcast',
      broadcast: { p1: { state: mode === 'in' ? 'animating_in' : 'animating_out', progress } },
      liveStunts: {},
    },
    [],
  );
}

function customDelta(builtinId: string, progress: number, mode: 'in' | 'out') {
  const kfs = builtinPresetToCustomKeyframes(builtinId, 30, mode);
  const s = sampleCustomPreset(kfs, progress);
  return { x: s.deltaX, y: s.deltaY, rotation: s.rotation, scaleX: s.scaleX, scaleY: s.scaleY, opacityMul: s.opacity };
}

const POINTS = [0, 0.5, 1];

describe('M25 25C — runtime equivalence: builtin vs saved custom', () => {
  it('slide-scale-left reproduces at progress 0 / 0.5 / 1', () => {
    for (const p of POINTS) {
      const b = builtinDelta('slide-scale-left', p, 'in');
      const c = customDelta('slide-scale-left', p, 'in');
      expect(c.x).toBeCloseTo(b.x, 6);
      expect(c.y).toBeCloseTo(b.y, 6);
      expect(c.rotation).toBeCloseTo(b.rotation, 6);
      expect(c.scaleX).toBeCloseTo(b.scaleX, 6);
      expect(c.scaleY).toBeCloseTo(b.scaleY, 6);
      expect(c.opacityMul).toBeCloseTo(b.opacityMul, 6);
    }
  });

  it('soft-pop reproduces at progress 0 / 0.5 / 1', () => {
    for (const p of POINTS) {
      const b = builtinDelta('soft-pop', p, 'in');
      const c = customDelta('soft-pop', p, 'in');
      expect(c.scaleX).toBeCloseTo(b.scaleX, 6);
      expect(c.scaleY).toBeCloseTo(b.scaleY, 6);
      expect(c.opacityMul).toBeCloseTo(b.opacityMul, 6);
      expect(c.x).toBeCloseTo(b.x, 6);
    }
  });

  it('slide-left (basic) reproduces at progress 0 / 0.5 / 1', () => {
    for (const p of POINTS) {
      const b = builtinDelta('slide-left', p, 'in');
      const c = customDelta('slide-left', p, 'in');
      expect(c.x).toBeCloseTo(b.x, 6);
      expect(c.opacityMul).toBeCloseTo(b.opacityMul, 6);
    }
  });

  it('OUT mode (slide-scale-right) reproduces at progress 0 / 0.5 / 1', () => {
    for (const p of POINTS) {
      const b = builtinDelta('slide-scale-right', p, 'out');
      const c = customDelta('slide-scale-right', p, 'out');
      expect(c.x).toBeCloseTo(b.x, 6);
      expect(c.scaleX).toBeCloseTo(b.scaleX, 6);
      expect(c.opacityMul).toBeCloseTo(b.opacityMul, 6);
    }
  });

  it('produced keyframes are independent of the builtin id (standalone data)', () => {
    const kfs = builtinPresetToCustomKeyframes('slide-scale-left', 30, 'in');
    expect(kfs).toHaveLength(5); // 0 / 0.25 / 0.5 / 0.75 / 1
    expect(kfs[0].progress).toBe(0);
    expect(kfs[4].progress).toBe(1);
    // fully resolved deltas — no reference to the builtin id anywhere
    expect(kfs.some((k) => k.deltaX !== 0)).toBe(true);
    expect(kfs[4]).toEqual({ progress: 1, deltaX: 0, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 });
  });
});
