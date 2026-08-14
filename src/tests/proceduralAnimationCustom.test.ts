import { describe, it, expect } from 'vitest';
import { computeProceduralDelta } from '../utils/proceduralAnimation';
import { sampleCustomPreset } from '../utils/presetSampler';
import type { CharacterPart, CustomMotionPreset, Track, TrackChannel } from '../types/animator';

/**
 * M25 25B — Runtime proof: can the EXISTING procedural runtime execute a
 * CustomMotionPreset created by the 25A data layer?
 *
 * The preset shape below is exactly what 25A's savePreset stores (id/name/
 * type/durationFrames/keyframes + CustomMotionPresetKeyframe fields).
 */

const CUSTOM_IN: CustomMotionPreset = {
  id: 'test-custom-in',
  name: 'Test Custom In',
  type: 'in',
  durationFrames: 20,
  keyframes: [
    { progress: 0, deltaX: -200, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0, easing: 'easeInOut' },
    { progress: 1, deltaX: 0, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, easing: 'easeInOut' },
  ],
};

const CUSTOM_OUT: CustomMotionPreset = {
  id: 'test-custom-out',
  name: 'Test Custom Out',
  type: 'out',
  durationFrames: 20,
  keyframes: [
    { progress: 0, deltaX: 0, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, easing: 'easeInOut' },
    { progress: 1, deltaX: 0, deltaY: 200, rotation: 90, scaleX: 1.5, scaleY: 1.5, opacity: 0, easing: 'easeInOut' },
  ],
};

function makePart(id: string, overrides: Partial<CharacterPart> = {}): CharacterPart {
  return {
    id, name: `Part ${id}`, type: 'custom_box', zIndex: 1, pivot: { x: 0, y: 0 },
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    fillColor: '#ff0000', strokeColor: '#101218', strokeWidth: 2,
    ...overrides,
  } as CharacterPart;
}

function makeTracks(): Track[] {
  return [{
    id: 't1', partId: 'p1', name: 'Part p1', color: '#3b82f6', keyframes: [], channels: {},
  }];
}

function evalDelta(
  part: CharacterPart,
  runtime: { appMode: 'edit' | 'broadcast'; broadcast: Record<string, { state: string; progress: number }>; liveStunts: Record<string, never> },
  presets: CustomMotionPreset[],
  currentFrame = 0,
) {
  return computeProceduralDelta(part, makeTracks(), 90, currentFrame, runtime, presets);
}

describe('M25 25B — custom preset lookup by id', () => {
  it('finds a custom preset by id in the collection', () => {
    const presets = [CUSTOM_IN, CUSTOM_OUT];
    // broadcast animating_in with inAnimPreset pointing at the custom id
    const part = makePart('p1', { inAnimPreset: 'test-custom-in', inAnimDuration: 20, enableMotionAnim: true });
    const d = evalDelta(part, { appMode: 'broadcast', broadcast: { p1: { state: 'animating_in', progress: 0.5 } }, liveStunts: {} }, presets);
    expect(d.opacityMul).not.toBe(1); // the custom preset actually sampled (not builtin fallback)
  });
});

describe('M25 25B — custom preset execution (broadcast mode)', () => {
  it('type "in": deltaX/deltaY/opacity interpolate through the custom keyframes', () => {
    const part = makePart('p1', { inAnimPreset: 'test-custom-in', inAnimDuration: 20, enableMotionAnim: true });
    const d = evalDelta(part, { appMode: 'broadcast', broadcast: { p1: { state: 'animating_in', progress: 0.5 } }, liveStunts: {} }, [CUSTOM_IN]);
    expect(d.x).toBeCloseTo(-100);   // -200 → 0 at midpoint
    expect(d.y).toBeCloseTo(0);
    expect(d.rotation).toBeCloseTo(0);
    expect(d.scaleX).toBeCloseTo(1);
    expect(d.scaleY).toBeCloseTo(1);
    expect(d.opacityMul).toBeCloseTo(0.5);
  });

  it('type "out": OUT mode follows the same runtime semantics (reverse direction data)', () => {
    const part = makePart('p1', { outAnimPreset: 'test-custom-out', outAnimDuration: 20, enableMotionAnim: true });
    const d = evalDelta(part, { appMode: 'broadcast', broadcast: { p1: { state: 'animating_out', progress: 0.5 } }, liveStunts: {} }, [CUSTOM_OUT]);
    expect(d.y).toBeCloseTo(100);     // 0 → 200 at midpoint
    expect(d.rotation).toBeCloseTo(45); // 0 → 90
    expect(d.scaleX).toBeCloseTo(1.25); // 1 → 1.5
    expect(d.scaleY).toBeCloseTo(1.25);
    expect(d.opacityMul).toBeCloseTo(0.5); // 1 → 0
  });

  it('durationFrames is accepted without runtime schema changes (inAnimDuration drives frame split)', () => {
    const part = makePart('p1', { inAnimPreset: 'test-custom-in', inAnimDuration: 20, enableMotionAnim: true });
    const d = evalDelta(part, { appMode: 'broadcast', broadcast: { p1: { state: 'animating_in', progress: 0.25 } }, liveStunts: {} }, [CUSTOM_IN]);
    expect(d.x).toBeCloseTo(-150); // quarter of the way
    expect(d.opacityMul).toBeCloseTo(0.25);
  });
});

describe('M25 25B — edit mode execution (25B-fix: custom presets resolve in edit mode)', () => {
  it('edit mode with a custom IN preset applies the custom deltas', () => {
    const part = makePart('p1', { inAnimPreset: 'test-custom-in', inAnimDuration: 20, enableMotionAnim: true });
    // frame 5 of 20 → progress 0.25 → x = -150, opacity = 0.25
    const d = evalDelta(part, { appMode: 'edit', broadcast: {}, liveStunts: {} }, [CUSTOM_IN], 5);
    expect(d.x).toBeCloseTo(-150);
    expect(d.opacityMul).toBeCloseTo(0.25);
  });

  it('edit mode with a custom OUT preset applies the custom deltas', () => {
    const part = makePart('p1', { outAnimPreset: 'test-custom-out', outAnimDuration: 20, enableMotionAnim: true });
    // totalFrames 90, frame 85 → remaining 5/20 = 0.25 → y = 50, rot = 22.5
    const d = evalDelta(part, { appMode: 'edit', broadcast: {}, liveStunts: {} }, [CUSTOM_OUT], 85);
    expect(d.y).toBeCloseTo(50);
    expect(d.rotation).toBeCloseTo(22.5);
    expect(d.scaleX).toBeCloseTo(1.125);
    expect(d.opacityMul).toBeCloseTo(0.75); // 1 → 0 at 0.25
  });

  it('edit mode missing custom preset keeps the safe fallback (no motion, full opacity)', () => {
    const part = makePart('p1', { inAnimPreset: 'does-not-exist', inAnimDuration: 20, enableMotionAnim: true });
    const d = evalDelta(part, { appMode: 'edit', broadcast: {}, liveStunts: {} }, [], 5);
    expect(d.x).toBe(0);
    expect(d.opacityMul).toBe(1);
  });
});

describe('M25 25B — missing preset safety', () => {
  it('unknown custom id is safe: no crash, no motion, full opacity (builtin default fallback)', () => {
    const part = makePart('p1', { inAnimPreset: 'does-not-exist', inAnimDuration: 20, enableMotionAnim: true });
    const d = evalDelta(part, { appMode: 'broadcast', broadcast: { p1: { state: 'animating_in', progress: 0.5 } }, liveStunts: {} }, []);
    expect(d.x).toBe(0);
    expect(d.y).toBe(0);
    expect(d.rotation).toBe(0);
    expect(d.scaleX).toBe(1);
    expect(d.opacityMul).toBe(1);
  });
});

describe('M25 25B — builtin regression (M23/M24 untouched)', () => {
  it('fade keeps opacity=eased', () => {
    const part = makePart('p1', { inAnimPreset: 'fade', inAnimDuration: 20, enableMotionAnim: true });
    const d = evalDelta(part, { appMode: 'broadcast', broadcast: { p1: { state: 'animating_in', progress: 0.5 } }, liveStunts: {} }, []);
    const eased = 1 - Math.pow(1 - 0.5, 3);
    expect(d.opacityMul).toBeCloseTo(eased);
    expect(d.x).toBe(0);
  });

  it('slide-left keeps x=300*(1-eased)', () => {
    const part = makePart('p1', { inAnimPreset: 'slide-left', inAnimDuration: 20, enableMotionAnim: true });
    const d = evalDelta(part, { appMode: 'broadcast', broadcast: { p1: { state: 'animating_in', progress: 0.5 } }, liveStunts: {} }, []);
    const eased = 1 - Math.pow(1 - 0.5, 3);
    expect(d.x).toBeCloseTo(300 * (1 - eased));
  });

  it('pop keeps scale=eased', () => {
    const part = makePart('p1', { inAnimPreset: 'pop', inAnimDuration: 20, enableMotionAnim: true });
    const d = evalDelta(part, { appMode: 'broadcast', broadcast: { p1: { state: 'animating_in', progress: 0.5 } }, liveStunts: {} }, []);
    const eased = 1 - Math.pow(1 - 0.5, 3);
    expect(d.scaleX).toBeCloseTo(eased);
  });

  it('M24 combination slide-scale-left is unchanged', () => {
    const part = makePart('p1', { inAnimPreset: 'slide-scale-left', inAnimDuration: 20, enableMotionAnim: true });
    const d = evalDelta(part, { appMode: 'broadcast', broadcast: { p1: { state: 'animating_in', progress: 0.5 } }, liveStunts: {} }, []);
    const eased = 1 - Math.pow(1 - 0.5, 3);
    expect(d.x).toBeCloseTo(300 * (1 - eased));
    expect(d.scaleX).toBeCloseTo(eased);
    expect(d.scaleY).toBeCloseTo(eased);
    expect(d.opacityMul).toBeCloseTo(eased);
  });

  it('M24 combination soft-pop is unchanged (scale 0.85→1, opacity=eased)', () => {
    const part = makePart('p1', { inAnimPreset: 'soft-pop', inAnimDuration: 20, enableMotionAnim: true });
    const d = evalDelta(part, { appMode: 'broadcast', broadcast: { p1: { state: 'animating_in', progress: 1 } }, liveStunts: {} }, []);
    expect(d.scaleX).toBeCloseTo(1);
    expect(d.opacityMul).toBeCloseTo(1);
    const dMid = evalDelta(part, { appMode: 'broadcast', broadcast: { p1: { state: 'animating_in', progress: 0.5 } }, liveStunts: {} }, []);
    expect(dMid.scaleX).toBeGreaterThan(0.85);
    expect(dMid.scaleX).toBeLessThan(1);
  });
});

describe('M25 25B — keyframe sampling (existing sampler)', () => {
  it('midpoint of a 3-keyframe curve interpolates the correct segment', () => {
    const kfs = [
      { progress: 0, deltaX: 0, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      { progress: 0.5, deltaX: 100, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      { progress: 1, deltaX: 0, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    ];
    expect(sampleCustomPreset(kfs, 0.25).deltaX).toBeCloseTo(50);
    expect(sampleCustomPreset(kfs, 0.5).deltaX).toBeCloseTo(100);
    expect(sampleCustomPreset(kfs, 0.75).deltaX).toBeCloseTo(50);
  });

  it('empty keyframes / boundary progress are safe', () => {
    expect(sampleCustomPreset([], 0.5)).toEqual({ deltaX: 0, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 });
    const kfs = CUSTOM_IN.keyframes;
    expect(sampleCustomPreset(kfs, 0)).toEqual(kfs[0]);
    expect(sampleCustomPreset(kfs, 1)).toEqual(kfs[kfs.length - 1]);
  });

  it('easing field is preserved as data (sampler interpolates linearly — existing behavior)', () => {
    expect(CUSTOM_IN.keyframes[0].easing).toBe('easeInOut');
    // linear midpoint is the current runtime contract
    expect(sampleCustomPreset(CUSTOM_IN.keyframes, 0.5).deltaX).toBeCloseTo(-100);
  });
});

describe('M25 25B — M8 + determinism', () => {
  it('executing a custom preset does not create TrackChannels or keyframes', () => {
    const tracks = makeTracks();
    const channelsBefore = JSON.stringify(tracks[0].channels);
    const part = makePart('p1', { inAnimPreset: 'test-custom-in', inAnimDuration: 20, enableMotionAnim: true });
    computeProceduralDelta(part, tracks, 90, 0, { appMode: 'broadcast', broadcast: { p1: { state: 'animating_in', progress: 0.5 } }, liveStunts: {} }, [CUSTOM_IN]);
    expect(JSON.stringify(tracks[0].channels)).toBe(channelsBefore); // no channel mutation
    expect((Object.keys(tracks[0].channels) as TrackChannel[]).length).toBe(0);
    expect(tracks[0].keyframes.length).toBe(0);
  });

  it('repeated evaluation is deterministic', () => {
    const part = makePart('p1', { inAnimPreset: 'test-custom-in', inAnimDuration: 20, enableMotionAnim: true });
    const runtime = { appMode: 'broadcast' as const, broadcast: { p1: { state: 'animating_in', progress: 0.4 } }, liveStunts: {} };
    const a = computeProceduralDelta(part, makeTracks(), 90, 0, runtime, [CUSTOM_IN]);
    const b = computeProceduralDelta(part, makeTracks(), 90, 0, runtime, [CUSTOM_IN]);
    expect(a).toEqual(b);
  });
});
