import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFrameEase } from '../utils/workspaceLayout';

/**
 * `createFrameEase` is the shared contract behind every eased workspace edge: one
 * monotone frame-committed value per animation frame, an exact final value, and a
 * re-target that continues from the value the running frame last wrote.
 */
describe('createFrameEase', () => {
  let clock = 0;
  let pending: FrameRequestCallback[] = [];

  const installFrameClock = (): void => {
    clock = 0;
    pending = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pending.push(callback);
      return pending.length;
    });
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
      pending[handle - 1] = () => {};
    });
  };

  /** Advances the frame clock and runs exactly the callbacks it carried. */
  const advance = (deltaMs: number): void => {
    clock += deltaMs;
    const due = pending;
    pending = [];
    due.forEach((callback) => callback(clock));
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('C8: eases in and out — slow at both ends, half way at half time', () => {
    installFrameClock();
    const written: number[] = [];
    const ease = createFrameEase((value) => written.push(value), () => {});
    // advance(0) delivers the first frame, which only stamps the start time.
    ease.start(0, 100, 320);
    advance(0);
    for (let frame = 0; frame < 19; frame += 1) advance(16);
    // Frame 1 (16 ms, 5 %): the start is soft, far behind a linear ramp.
    expect(written[1]).toBeLessThan(1);
    // Frame 10 (160 ms): exactly half way.
    expect(written[10]).toBeCloseTo(50, 6);
    // Symmetric: the last step before the end is as soft as the first.
    expect(100 - written[19]).toBeCloseTo(written[1], 6);
  });

  it('writes one monotone value per frame and settles on the exact target', () => {
    installFrameClock();
    const written: number[] = [];
    const settled: number[] = [];
    const ease = createFrameEase(
      (value) => written.push(value),
      (value) => settled.push(value),
    );

    ease.start(0, 240, 240);
    advance(16);
    advance(16);
    advance(16);
    advance(16);
    advance(16);
    advance(16);
    expect(written.length).toBe(6);
    expect(written[0]).toBeLessThan(written[1]);
    for (let index = 1; index < written.length; index += 1) {
      expect(written[index]).toBeGreaterThan(written[index - 1]);
    }
    expect(settled).toEqual([]);
    expect(ease.isRunning()).toBe(true);

    // Progress past the end: the last frame settles instead of writing again.
    advance(400);
    expect(settled).toEqual([240]);
    expect(ease.isRunning()).toBe(false);
    expect(ease.current()).toBeNull();
    expect(written.every((value) => value < 240)).toBe(true);
  });

  it('re-targets from the interpolated value the running frame last wrote', () => {
    installFrameClock();
    const written: number[] = [];
    const ease = createFrameEase((value) => written.push(value), () => {});

    ease.start(0, 200, 240);
    advance(16);
    advance(16);
    const reversalPoint = ease.current();
    expect(reversalPoint).not.toBeNull();

    // The caller re-targets from what the panel actually shows right now.
    ease.start(reversalPoint ?? 0, 0, 240);
    advance(16);
    advance(16);
    // It continues from the reversal point — no jump back to the old start, no
    // jump forward to the abandoned target, no second animation — and travels
    // toward the new target from there.
    expect(written[2]).toBe(reversalPoint);
    expect(written[3]).toBeLessThan(written[2]);
    expect(written.every((value) => value < 200)).toBe(true);
  });

  it('settles immediately when the edge is already at its target', () => {
    installFrameClock();
    const written: number[] = [];
    const settled: number[] = [];
    const ease = createFrameEase((value) => written.push(value), (value) => settled.push(value));

    ease.start(144, 144, 240);
    expect(written).toEqual([]);
    expect(settled).toEqual([144]);
    expect(ease.isRunning()).toBe(false);
  });

  it('stops writing once it is cancelled', () => {
    installFrameClock();
    const written: number[] = [];
    const settled: number[] = [];
    const ease = createFrameEase((value) => written.push(value), (value) => settled.push(value));

    ease.start(0, 240, 240);
    advance(16);
    const afterFirstFrame = written.length;
    ease.cancel();
    advance(16);
    advance(400);
    expect(written.length).toBe(afterFirstFrame);
    expect(settled).toEqual([]);
    expect(ease.isRunning()).toBe(false);
  });
});
