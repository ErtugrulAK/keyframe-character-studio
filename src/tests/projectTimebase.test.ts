import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayback } from '../hooks/usePlayback';
import { useSerialization } from '../hooks/useSerialization';
import { frameToSeconds, sanitizeProjectFps, secondsToFrame } from '../utils/timebase';
import { generateGraphicModule } from '../ograf/runtimeTemplate';
import type { SceneData, SceneLayer } from '../types/composition';

/**
 * Manual QA Round 4 — R4-15 (release critical): the FPS/TIMEBASE contract.
 *
 *   seconds = frame / fps
 *
 * The authored FPS is a time mapping, never a redraw budget. These tests drive
 * the REAL playback loop with an explicit requestAnimationFrame harness so the
 * simulated monitor refresh rate is a parameter: 30, 60, 120 and 144 Hz must all
 * reach the same frame at the same wall-clock instant, and a throttled callback
 * must recover the time it lost instead of stretching the animation.
 *
 * The probe instant sits one millisecond PAST the boundary it asserts (t = 2000 ms
 * is the last instant of frame N, not the first of frame N + 1): the frame
 * interval of 1000/fps has no exact binary representation, so `floor` at the
 * boundary itself is a floating-point coin toss. One millisecond of headroom
 * keeps the assertion about the contract instead of about rounding.
 */

interface RafHarness {
  /** Advance the simulated clock by `elapsedMs` in steps of at most `stepMs`. */
  advance: (elapsedMs: number, stepMs: number) => void;
}

const REFRESH_CADENCES_HZ = [30, 60, 120, 144];

const installRafHarness = (): RafHarness => {
  let clock = 1000;
  let nextId = 1;
  const queued = new Map<number, FrameRequestCallback>();
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextId;
    nextId += 1;
    queued.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    queued.delete(id);
  });
  return {
    advance: (elapsedMs: number, stepMs: number) => {
      let remaining = elapsedMs;
      while (remaining > 0) {
        const step = Math.min(stepMs, remaining);
        remaining -= step;
        clock += step;
        const due = [...queued.values()];
        queued.clear();
        due.forEach((callback) => callback(clock));
      }
    },
  };
};

/** Start playback of `fps`-rated `seconds`-long animation and return the harness. */
const playFor = (fps: number, seconds: number) => {
  const harness = installRafHarness();
  const { result } = renderHook(() => usePlayback());
  act(() => {
    result.current.setFps(fps);
    result.current.setTotalFrames(fps * seconds);
    result.current.setIsPlaying(true);
  });
  return { harness, result };
};

const refreshStepMs = (hz: number) => 1000 / hz;

describe('R4-15 — the authored FPS is a time mapping, not a redraw budget', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reaches the authored end at the authored wall-clock duration at 30, 60 and 120 FPS', () => {
    for (const fps of [30, 60, 120]) {
      for (const cadence of REFRESH_CADENCES_HZ) {
        const { harness, result } = playFor(fps, 2);
        act(() => { harness.advance(2001, refreshStepMs(cadence)); });

        // 2 seconds of animation, at 30/60/120 authored FPS, on a 30/60/120/144 Hz
        // display: the end pose, on time, with playback stopped.
        expect(result.current.currentFrame, `${fps} FPS on a ${cadence} Hz display`).toBe(fps * 2);
        expect(result.current.isPlaying).toBe(false);
        expect(frameToSeconds(result.current.currentFrame, fps)).toBeCloseTo(2, 6);
      }
    }
  });

  it('holds the same frame at the one-second midpoint at every rate and refresh cadence', () => {
    for (const fps of [30, 60, 120]) {
      for (const cadence of REFRESH_CADENCES_HZ) {
        const { harness, result } = playFor(fps, 2);
        act(() => { harness.advance(1001, refreshStepMs(cadence)); });

        expect(result.current.currentFrame, `${fps} FPS on a ${cadence} Hz display`).toBe(fps);
        expect(result.current.isPlaying).toBe(true);
        expect(frameToSeconds(result.current.currentFrame, fps)).toBeCloseTo(1, 6);
      }
    }
  });

  it('advances a 120 FPS animation by two frames per 60 Hz callback', () => {
    const { harness, result } = playFor(120, 2);
    act(() => { harness.advance(1001, refreshStepMs(60)); });

    // One frame per callback would report 60 here and double the animation's
    // wall-clock duration; elapsed-time stepping reports the authored 120.
    expect(result.current.currentFrame).toBe(120);
  });

  it('recovers the time a stalled or throttled callback lost', () => {
    const { harness, result } = playFor(60, 2);
    // A single half-second gap (backgrounded tab, blocked main thread) must buy
    // ~30 authored frames — not one. The probe is one millisecond past the
    // boundary, because 1000/60 has no exact binary representation.
    act(() => { harness.advance(501, 501); });

    expect(result.current.currentFrame).toBe(30);

    act(() => { harness.advance(501, 501); });
    expect(result.current.currentFrame).toBe(60);
  });

  it('keeps the frame-count contract on a looping animation across the wrap', () => {
    const harness = installRafHarness();
    const { result } = renderHook(() => usePlayback());
    act(() => {
      result.current.setFps(60);
      result.current.setTotalFrames(60);
      result.current.setIsLooping(true);
      result.current.setIsPlaying(true);
    });

    act(() => { harness.advance(2501, refreshStepMs(60)); });

    // 2.5 seconds at 60 FPS with a 61-frame cycle (0 and 60 are the same pose):
    // 150 frames in, the playhead is on frame 150 % 61 = 28, still playing.
    expect(result.current.currentFrame).toBe(28);
    expect(result.current.isPlaying).toBe(true);
  });
});

describe('R4-15 — the frame/second conversions and the FPS authority', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('round-trips frame -> seconds -> frame at the offered rates', () => {
    for (const fps of [24, 30, 60, 120]) {
      expect(frameToSeconds(0, fps)).toBe(0);
      expect(frameToSeconds(fps, fps)).toBe(1);
      expect(secondsToFrame(2, fps)).toBe(fps * 2);
      expect(frameToSeconds(secondsToFrame(2, fps), fps)).toBeCloseTo(2, 9);
      // 2 seconds is the same wall-clock duration at every authored rate.
      expect(frameToSeconds(fps * 2, fps)).toBe(2);
    }
  });

  it('rounds a fractional rate to a whole one and refuses a rate that cannot map', () => {
    expect(sanitizeProjectFps(59.94)).toBe(60);
    expect(sanitizeProjectFps(23.976)).toBe(24);
    expect(sanitizeProjectFps(30)).toBe(30);
    expect(sanitizeProjectFps(0, 60)).toBe(60);
    expect(sanitizeProjectFps(-30, 60)).toBe(60);
    expect(sanitizeProjectFps(Number.NaN, 60)).toBe(60);
    expect(sanitizeProjectFps(Number.POSITIVE_INFINITY, 60)).toBe(60);
  });

  it('never lets a hand-edited FPS break the mapping authority', () => {
    const { result } = renderHook(() => usePlayback());
    expect(result.current.fps).toBe(60);

    act(() => { result.current.setFps(0); });
    expect(result.current.fps).toBe(60);

    act(() => { result.current.setFps(Number.NaN); });
    expect(result.current.fps).toBe(60);

    act(() => { result.current.setFps(59.94); });
    expect(result.current.fps).toBe(60);

    act(() => { result.current.setFps(120); });
    expect(result.current.fps).toBe(120);
  });
});

describe('R4-15 — save and reload keep the FPS and the duration', () => {
  // The hook's mount effect depends on the setter identities: a fresh `vi.fn()`
  // per render would re-run it on every render and loop forever. The mocks are
  // therefore created once, like the hook's real setters.
  const mockSetFps = vi.fn();
  const mockSetTotalFrames = vi.fn();
  const mockSetProjectResolution = vi.fn();
  const mockSetTracks = vi.fn();
  const mockSetCharacterParts = vi.fn();
  const mockSetActiveProjectTemplateIdState = vi.fn();
  const mockSetMotionTemplates = vi.fn();
  const mockSetActiveTemplateIdState = vi.fn();
  const mockSetSceneTitleState = vi.fn();
  const mockSetProjectTemplates = vi.fn();
  const mockSetTemplateCanvasStore = vi.fn();
  const mockSetCurrentFrame = vi.fn();
  const mockSetIsPlaying = vi.fn();

  const renderSerialization = () => renderHook(() => useSerialization({
    fps: 30,
    setFps: mockSetFps,
    totalFrames: 60,
    setTotalFrames: mockSetTotalFrames,
    projectResolution: { width: 800, height: 600 },
    setProjectResolution: mockSetProjectResolution,
    tracks: [],
    setTracks: mockSetTracks,
    characterParts: [],
    setCharacterParts: mockSetCharacterParts,
    activeProjectTemplateId: 'default',
    setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
    motionTemplates: [],
    setMotionTemplates: mockSetMotionTemplates,
    activeTemplateId: 'Sequence',
    setActiveTemplateIdState: mockSetActiveTemplateIdState,
    sceneTitle: 'Timebase',
    setSceneTitleState: mockSetSceneTitleState,
    projectTemplates: [],
    setProjectTemplates: mockSetProjectTemplates,
    setTemplateCanvasStore: mockSetTemplateCanvasStore,
    setCurrentFrame: mockSetCurrentFrame,
    setIsPlaying: mockSetIsPlaying,
  }));

  beforeEach(() => {
    vi.useFakeTimers();
    mockSetFps.mockClear();
    mockSetTotalFrames.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('writes the authored FPS and frame count, and restores both', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => undefined);

    const first = renderSerialization();
    const saved = JSON.parse(first.result.current.exportProject()) as SceneData;
    expect(saved.fps).toBe(30);
    expect(saved.totalFrames).toBe(60);
    // The saved pair is the duration the viewer sees: 2 seconds.
    expect(frameToSeconds(saved.totalFrames, saved.fps)).toBe(2);

    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(saved));
    renderSerialization();

    expect(mockSetFps).toHaveBeenCalledWith(30);
    expect(mockSetTotalFrames).toHaveBeenCalledWith(60);
  });
});

describe('R4-15 — the exported OGraf runtime is time-driven, not cadence-driven', () => {
  let counter = 0;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const layer = (): SceneLayer => ({
    id: 'shape', name: 'Shape', type: 'custom_rect',
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1,
    fillColor: '#ff0000', strokeColor: '#000000',
    fillEnabled: true, strokeEnabled: false, strokeWidth: 4, strokeAlignment: 'inside',
    width: 200, height: 120,
  });

  const scene = (fps: number, totalFrames: number): SceneData => ({
    version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Timebase',
    width: 400, height: 300, fps, totalFrames,
    layers: [layer()],
    tracks: [{ partId: 'shape', channels: {} as never }],
  });

  type GeneratedGraphic = HTMLElement & { _animate: (frame: number, skip?: boolean) => Promise<unknown>; _currentFrame: number };

  const instantiate = (source: string): GeneratedGraphic => {
    const Graphic = new Function('HTMLElement', `${source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href')}`)(HTMLElement) as unknown as new () => GeneratedGraphic;
    counter += 1;
    const tag = `x-ograf-timebase-${counter}`;
    customElements.define(tag, Graphic);
    return document.createElement(tag) as GeneratedGraphic;
  };

  it('maps |frames| / fps to wall-clock time, so the host cadence cannot change it', async () => {
    const harness = installRafHarness();
    const graphic = instantiate(generateGraphicModule(scene(30, 60)));

    const running = graphic._animate(60, false);
    // 60 frames at 30 FPS: two seconds, at any host refresh rate. The runtime
    // keeps a FRACTIONAL playhead (it renders an interpolated pose), so the
    // midpoint is asserted with a frame's tolerance.
    act(() => { harness.advance(1001, refreshStepMs(144)); });
    expect(graphic._currentFrame).toBeCloseTo(30, 1);

    act(() => { harness.advance(1000, refreshStepMs(144)); });
    await running;
    expect(graphic._currentFrame).toBe(60);
  });
});
