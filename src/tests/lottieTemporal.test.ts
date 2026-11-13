import { describe, expect, it } from 'vitest';
import { mapLottieKeyframes, mapLottieSegmentTiming, type LottieKeyframe } from '../interop/lottie/temporal';

const context = (overrides: Partial<Parameters<typeof mapLottieKeyframes>[1]> = {}) => ({
  dimension: 0,
  documentInPoint: 0,
  keyframeLimit: 100,
  path: 'layers[0].ks.o',
  channel: 'opacity',
  ...overrides,
});

const codes = (diagnostics: { code: string }[]) => diagnostics.map((entry) => entry.code);

describe('mapLottieKeyframes', () => {
  it('splits one Lottie segment across the two keyframes it connects', () => {
    const frames: LottieKeyframe[] = [
      { time: 0, values: [0], out: { x: [0.3], y: [0] }, in: { x: [0.7], y: [1] } },
      { time: 30, values: [100] },
    ];
    const { keyframes, diagnostics } = mapLottieKeyframes(frames, context());
    expect(keyframes[0]).toMatchObject({ frame: 0, value: 0, easing: 'bezier', bezierOut: { x: 0.3, y: 0 } });
    expect(keyframes[1]).toMatchObject({ frame: 30, value: 100, easing: 'bezier', bezierIn: { x: 0.7, y: 1 } });
    expect(diagnostics).toEqual([]);
  });

  it('offsets by the in-point and layer start, rounds, and never goes below frame 0', () => {
    const frames: LottieKeyframe[] = [{ time: 2.4, values: [1] }, { time: 20.6, values: [2] }];
    const { keyframes } = mapLottieKeyframes(frames, context({ documentInPoint: 5, layerStartTime: 0 }));
    expect(keyframes.map((k) => k.frame)).toEqual([0, 16]);
  });

  it('reads the channel dimension of vector values and per-dimension handles', () => {
    const frames: LottieKeyframe[] = [
      { time: 0, values: [10, 20], out: { x: [0.1, 0.2], y: [0.3, 0.4] }, in: { x: [0.5, 0.6], y: [0.7, 0.8] } },
      { time: 10, values: [30, 40] },
    ];
    const { keyframes } = mapLottieKeyframes(frames, context({ dimension: 1, channel: 'y' }));
    expect(keyframes[0]).toMatchObject({ value: 20, bezierOut: { x: 0.2, y: 0.4 } });
    expect(keyframes[1]).toMatchObject({ value: 40, bezierIn: { x: 0.6, y: 0.8 } });
  });

  it('applies a one-entry handle to every dimension', () => {
    const frames: LottieKeyframe[] = [
      { time: 0, values: [0, 0], out: { x: [0.25], y: [0.1] }, in: { x: [0.75], y: [0.9] } },
      { time: 10, values: [1, 1] },
    ];
    const { keyframes } = mapLottieKeyframes(frames, context({ dimension: 1 }));
    expect(keyframes[0].bezierOut).toEqual({ x: 0.25, y: 0.1 });
  });

  it('keeps a hold keyframe as hold and gives it no outgoing handle', () => {
    const frames: LottieKeyframe[] = [
      { time: 0, values: [0], hold: true, out: { x: [0.3], y: [0] } },
      { time: 10, values: [1] },
    ];
    const { keyframes } = mapLottieKeyframes(frames, context());
    expect(keyframes[0].easing).toBe('hold');
    expect(keyframes[0].bezierOut).toBeUndefined();
  });

  it('keeps a target hold while taking its incoming half', () => {
    const frames: LottieKeyframe[] = [
      { time: 0, values: [0], out: { x: [0.3], y: [0] }, in: { x: [0.7], y: [1] } },
      { time: 10, values: [1], hold: true },
      { time: 20, values: [2] },
    ];
    const { keyframes } = mapLottieKeyframes(frames, context());
    expect(keyframes[1]).toMatchObject({ easing: 'hold', bezierIn: { x: 0.7, y: 1 } });
  });

  it('caps a channel at the keyframe limit and reports it', () => {
    const frames: LottieKeyframe[] = [0, 1, 2, 3].map((time) => ({ time, values: [time] }));
    const { keyframes, diagnostics } = mapLottieKeyframes(frames, context({ keyframeLimit: 2 }));
    expect(keyframes).toHaveLength(2);
    expect(codes(diagnostics)).toEqual(['LOTTIE_KEYFRAME_LIMIT']);
  });

  it('reports roving and expression keyframes and keeps their segments linear', () => {
    const frames: LottieKeyframe[] = [
      { time: 0, values: [0], roving: true, out: { x: [0.3], y: [0] }, in: { x: [0.7], y: [1] } },
      { time: 10, values: [1], expression: 'wiggle(1,2)', out: { x: [0.3], y: [0] } },
      { time: 20, values: [2] },
    ];
    const { keyframes, diagnostics } = mapLottieKeyframes(frames, context());
    expect(keyframes.map((k) => k.easing)).toEqual(['linear', 'linear', 'linear']);
    expect(codes(diagnostics)).toEqual(['LOTTIE_ROVING_KEYFRAME', 'LOTTIE_UNSUPPORTED_EXPRESSION']);
  });

  it('reports an unreadable outgoing handle and imports the segment as linear', () => {
    const frames: LottieKeyframe[] = [{ time: 0, values: [0], out: { x: [] as number[] } }, { time: 10, values: [1] }];
    const { keyframes, diagnostics } = mapLottieKeyframes(frames, context());
    expect(keyframes[0].easing).toBe('linear');
    expect(diagnostics.map((d) => d.path)).toContain('layers[0].ks.o[0].o');
  });

  it('reports a lone incoming handle at the missing outgoing one', () => {
    const frames: LottieKeyframe[] = [{ time: 0, values: [0], in: { x: [0.7], y: [1] } }, { time: 10, values: [1] }];
    const { keyframes, diagnostics } = mapLottieKeyframes(frames, context());
    expect(diagnostics.some((d) => d.path === 'layers[0].ks.o[0].o' && /no outgoing/.test(d.message))).toBe(true);
    expect(keyframes[1].bezierIn).toEqual({ x: 0.7, y: 1 });
  });

  it('names the default cubic when only the outgoing half was read', () => {
    const frames: LottieKeyframe[] = [{ time: 0, values: [0], out: { x: [0.3], y: [0] } }, { time: 10, values: [1] }];
    const { diagnostics } = mapLottieKeyframes(frames, context());
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ code: 'LOTTIE_UNREADABLE_EASING', path: 'layers[0].ks.o[0].i' });
    expect(diagnostics[0].message).toMatch(/default cubic/);
  });

  it('gives every diagnostic an action', () => {
    const frames: LottieKeyframe[] = [
      { time: 0, values: [0], roving: true },
      { time: 1, values: [1], expression: 'x' },
      { time: 2, values: [2], out: { x: [0.3], y: [0] } },
      { time: 3, values: [3] },
    ];
    const { diagnostics } = mapLottieSegmentTiming(frames, context({ keyframeLimit: 3 }));
    expect(diagnostics.length).toBeGreaterThan(0);
    diagnostics.forEach((entry) => expect(entry.action.length).toBeGreaterThan(0));
  });

  it('builds stable ids from the channel name and index', () => {
    const { keyframes } = mapLottieKeyframes([{ time: 0, values: [0] }, { time: 1, values: [1] }], context({ channel: 'x' }));
    expect(keyframes.map((k) => k.id)).toEqual(['kf-x-0', 'kf-x-1']);
  });
});
