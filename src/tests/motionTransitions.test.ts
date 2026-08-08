import { describe, it, expect } from 'vitest';
import { generateTransitionKeyframes, generateTransitionChannelKeyframes } from '../utils/motionTransitions';
import { applyTransitionChannelsMutator } from '../utils/trackMutations';
import type { Transform, Track, TrackChannel, PropertyKeyframe } from '../types/animator';

describe('MotionTransitions Utility', () => {
  const baseTransform: Transform = { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

  it('returns null for "none" transition', () => {
    const result = generateTransitionKeyframes(baseTransform, 'none', 0, 15);
    expect(result).toBeNull();
  });

  it('generates accurate move_left keyframes', () => {
    const result = generateTransitionKeyframes(baseTransform, 'move_left', 10, 25);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.kfStart.frame).toBe(10);
      expect(result.kfEnd.frame).toBe(25);
      
      expect(result.kfStart.transform.x).toBe(350); // 100 + 250
      expect(result.kfStart.transform.opacity).toBe(0);
      expect(result.kfEnd.transform.opacity).toBe(1);
    }
  });

  it('generates accurate bounce keyframes with custom easing', () => {
    const result = generateTransitionKeyframes(baseTransform, 'bounce', 0, 15);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.kfStart.transform.y).toBe(-80); // 100 - 180
      expect(result.kfStart.easing).toBe('bounce');
    }
  });
});

// ─── M8a: canonical channel transition ─────────────────────────────────

describe('M8a — generateTransitionChannelKeyframes', () => {
  const base: Transform = { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

  it('1: creates 6 start channel values (fade)', () => {
    const t = generateTransitionChannelKeyframes(base, 'fade', 10, 25);
    expect(t).not.toBeNull();
    if (!t) return;
    expect(t.startFrame).toBe(10);
    expect(t.endFrame).toBe(25);
    expect(Object.keys(t.start)).toEqual(['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']);
    // fade: only opacity animates; other channels hold base values
    expect(t.start.opacity).toBe(0);
    expect(t.start.x).toBe(100);
    expect(t.end.opacity).toBe(1);
  });

  it('2: creates 6 end channel values', () => {
    const t = generateTransitionChannelKeyframes(base, 'move_left', 10, 25);
    if (!t) return;
    expect(Object.keys(t.end)).toEqual(['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']);
    expect(t.end.x).toBe(100);
  });

  it('3: start/end frames preserved', () => {
    const t = generateTransitionChannelKeyframes(base, 'spin', 30, 45);
    if (!t) return;
    expect(t.startFrame).toBe(30);
    expect(t.endFrame).toBe(45);
  });

  it('4: move_left values correct (x+250, opacity 0→1)', () => {
    const t = generateTransitionChannelKeyframes(base, 'move_left', 0, 15);
    if (!t) return;
    expect(t.start.x).toBe(350);
    expect(t.start.opacity).toBe(0);
    expect(t.end.opacity).toBe(1);
    expect(t.end.y).toBe(100);
  });

  it('5: easing preserved (bounce/overshoot)', () => {
    expect(generateTransitionChannelKeyframes(base, 'bounce', 0, 15)!.easing).toBe('bounce');
    expect(generateTransitionChannelKeyframes(base, 'flash', 0, 15)!.easing).toBe('overshoot');
    expect(generateTransitionChannelKeyframes(base, 'fade', 0, 15)!.easing).toBe('easeOut');
  });

  it('6: duration preserved (endFrame = startFrame + 15)', () => {
    const t = generateTransitionChannelKeyframes(base, 'fade', 40, 55);
    if (!t) return;
    expect(t.endFrame - t.startFrame).toBe(15);
  });

  it('7: spin rotation -360', () => {
    const t = generateTransitionChannelKeyframes(base, 'spin', 0, 15);
    if (!t) return;
    expect(t.start.rotation).toBe(-360);
    expect(t.end.rotation).toBe(0);
  });

  it('11: opacity 0 preserved in start values', () => {
    const t = generateTransitionChannelKeyframes(base, 'fade', 0, 15);
    if (!t) return;
    expect(t.start.opacity).toBe(0);
  });

  it('none → null', () => {
    expect(generateTransitionChannelKeyframes(base, 'none', 0, 15)).toBeNull();
  });
});

describe('M8a — applyTransitionChannelsMutator', () => {
  function makeTrack(channels: Partial<Record<TrackChannel, PropertyKeyframe[]>> = {}): Track {
    return {
      id: 'trk_1', partId: 'part_1', name: 'T1', color: '#f00',
      keyframes: [],
      channels: {
        x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
        maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
        ...channels,
      },
      visible: true, locked: false,
    } as Track;
  }
  const pk = (id: string, frame: number, value: number, templateId = 'Sequence'): PropertyKeyframe =>
    ({ id, frame, value, easing: 'linear', templateId }) as PropertyKeyframe;
  const base: Transform = { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

  it('9: keyframes inside [start,end] removed, outside kept (same as legacy)', () => {
    const track = makeTrack({
      x: [pk('in', 20, 5, 'Sequence'), pk('out_before', 5, 1, 'Sequence'), pk('out_after', 60, 9, 'Sequence')],
    });
    const transition = generateTransitionChannelKeyframes(base, 'fade', 10, 25)!;
    const [updated] = applyTransitionChannelsMutator([track], 'trk_1', transition, 'Sequence');

    const frames = updated.channels.x.map((k) => k.frame);
    expect(frames).not.toContain(20);   // inside window removed
    expect(frames).toContain(5);        // before window kept
    expect(frames).toContain(60);       // after window kept
    expect(frames).toContain(10);       // start kf
    expect(frames).toContain(25);       // end kf
  });

  it('7: start keyframe carries active template + transition easing', () => {
    const track = makeTrack({});
    const transition = generateTransitionChannelKeyframes(base, 'bounce', 0, 15)!;
    const [updated] = applyTransitionChannelsMutator([track], 'trk_1', transition, 'Outro');

    const startKf = updated.channels.x.find((k) => k.frame === 0)!;
    expect(startKf.templateId).toBe('Outro');
    expect(startKf.easing).toBe('bounce');
    const endKf = updated.channels.x.find((k) => k.frame === 15)!;
    expect(endKf.easing).toBe('linear');
  });

  it('8: other template untouched', () => {
    const track = makeTrack({
      x: [pk('seq0', 20, 5, 'Sequence')],
      y: [pk('outro0', 20, 7, 'Outro')],
    });
    const transition = generateTransitionChannelKeyframes(base, 'fade', 10, 25)!;
    const [updated] = applyTransitionChannelsMutator([track], 'trk_1', transition, 'Outro');

    // Sequence keyframes untouched (window-clearing scoped to Outro)
    expect(updated.channels.x.find((k) => k.id === 'seq0')).toBeDefined();
    // Outro inside window cleared, replaced with transition kfs
    expect(updated.channels.y.filter((k) => (k.templateId || 'Sequence') === 'Outro' && k.frame === 20)).toHaveLength(0);
    expect(updated.channels.y.filter((k) => (k.templateId || 'Sequence') === 'Outro')).toHaveLength(2);
  });

  it('10: other tracks unaffected', () => {
    const t1 = makeTrack({});
    const t2 = makeTrack({});
    t2.id = 'trk_2';
    t2.partId = 'part_2';
    const transition = generateTransitionChannelKeyframes(base, 'fade', 10, 25)!;
    const [u1, u2] = applyTransitionChannelsMutator([t1, t2], 'trk_1', transition, 'Sequence');

    expect(u1.channels.x).toHaveLength(2);
    expect(u2.channels.x).toHaveLength(0);
  });

  it('13: canonical transition does not touch legacy keyframes[]', () => {
    const track = makeTrack({});
    track.keyframes = [
      { id: 'legacy_kf', frame: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' },
    ];
    const transition = generateTransitionChannelKeyframes(base, 'fade', 10, 25)!;
    const [updated] = applyTransitionChannelsMutator([track], 'trk_1', transition, 'Sequence');

    expect(updated.keyframes).toHaveLength(1); // legacy array untouched
    expect(updated.channels.x).toHaveLength(2); // canonical transition written
  });

  it('none → clears active template channels only', () => {
    const track = makeTrack({
      x: [pk('seq0', 5, 1, 'Sequence'), pk('outro0', 5, 9, 'Outro')],
      opacity: [pk('o_seq', 10, 0.5, 'Sequence')],
    });
    const [updated] = applyTransitionChannelsMutator([track], 'trk_1', null, 'Sequence');

    expect(updated.channels.x).toHaveLength(1); // only Outro survives
    expect(updated.channels.x[0].id).toBe('outro0');
    expect(updated.channels.opacity).toHaveLength(0);
  });
});
