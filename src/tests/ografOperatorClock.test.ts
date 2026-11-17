// @vitest-environment jsdom
/**
 * A clock the playout operator runs: a text with a Stopwatch or Countdown
 * effect, marked `operatorClock`, waits on air at its start value until the
 * Start button; Pause and Reset work as on a stopwatch. The time it shows goes
 * through the editor's own clock format (`utils/animation/textEffects`); only
 * the elapsed time comes from the buttons instead of the timeline.
 */
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { SceneData, SceneLayer } from '../types/composition';
import { compileOGrafPackage } from '../ograf/packageCompiler';

type Result = { statusCode: number; statusMessage?: string };
type LiveGraphic = HTMLElement & {
  load: (params: { renderType: string; data?: Record<string, unknown> }) => Promise<Result>;
  playAction: (params?: { skipAnimation?: boolean }) => Promise<unknown>;
  customAction: (params: { id: string; payload?: unknown }) => Promise<Result>;
  dispose: () => Promise<Result>;
  setActionsSchedule: (params: { schedule: unknown[] }) => Promise<Result>;
  goToTime: (params: { timestamp: number }) => Promise<Result>;
  _clockTimer: unknown;
};

const clockText = (id: string, extra: Partial<SceneLayer>): SceneLayer => ({
  id, name: id, type: 'custom_text', textValue: '', fontSize: 72, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, fillColor: '#ffffff', strokeColor: '#000000', ...extra,
} as SceneLayer);

const scene: SceneData = {
  version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Clocks',
  width: 1920, height: 1080, fps: 30, totalFrames: 30,
  layers: [
    clockText('match', { name: 'Match clock', operatorClock: true, textEffect: { kind: 'clock', mode: 'stopwatch', startFrame: 0, format: 'mm:ss' } }),
    clockText('shot', { name: 'Shot clock', zIndex: 2, operatorClock: true, textEffect: { kind: 'clock', mode: 'countdown', startFrame: 0, seconds: 24, format: 'ss' } }),
    // Not marked: runs along the timeline as before.
    clockText('timeline', { name: 'Timeline clock', zIndex: 3, textEffect: { kind: 'clock', mode: 'stopwatch', startFrame: 0, format: 'mm:ss' } }),
  ],
  tracks: [],
};

const mount = (data: SceneData): LiveGraphic => {
  const source = compileOGrafPackage(data).files.find((file) => file.path === 'graphic.mjs')?.content || '';
  const Graphic = new Function('HTMLElement', `${source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href')}`)(HTMLElement) as new () => LiveGraphic;
  const tag = `x-ograf-operator-clock-${Math.random().toString(36).slice(2)}`;
  customElements.define(tag, Graphic);
  const graphic = document.createElement(tag) as LiveGraphic;
  document.body.appendChild(graphic);
  return graphic;
};

const shown = (graphic: Element, id: string) => graphic.querySelector(`[data-layer-id="${id}"] text`)?.textContent ?? '';

afterEach(() => { vi.useRealTimers(); });

describe('operator clock in the OGraf package', () => {
  test('Start / Pause / Reset buttons per marked clock; unmarked clocks have none', () => {
    const { manifest } = compileOGrafPackage(scene);
    expect(manifest.customActions?.map((action) => action.id)).toEqual([
      'clock:clock_match:start', 'clock:clock_match:pause', 'clock:clock_match:reset',
      'clock:clock_shot:start', 'clock:clock_shot:pause', 'clock:clock_shot:reset',
    ]);
    expect(manifest.customActions?.[0]).toEqual({ id: 'clock:clock_match:start', name: 'Match clock: Start', description: 'Starts (or continues) Match clock.', schema: null });
  });

  test('waits at its start value, runs after Start, holds on Pause, goes back on Reset', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-11-17T20:00:00Z'));
    const graphic = mount(scene);
    expect((await graphic.load({ renderType: 'realtime' })).statusCode).toBe(200);
    await graphic.playAction({ skipAnimation: true });
    expect(shown(graphic, 'match')).toBe('00:00');
    expect(shown(graphic, 'shot')).toBe('24');

    expect((await graphic.customAction({ id: 'clock:clock_match:start' })).statusCode).toBe(200);
    expect((await graphic.customAction({ id: 'clock:clock_shot:start' })).statusCode).toBe(200);
    vi.advanceTimersByTime(65_000);
    // The timer redraws on its own while a clock runs.
    expect(shown(graphic, 'match')).toBe('01:05');
    expect(shown(graphic, 'shot')).toBe('0');

    expect((await graphic.customAction({ id: 'clock:clock_match:pause' })).statusCode).toBe(200);
    vi.advanceTimersByTime(10_000);
    expect(shown(graphic, 'match')).toBe('01:05');
    expect((await graphic.customAction({ id: 'clock:clock_match:start' })).statusCode).toBe(200);
    vi.advanceTimersByTime(5_000);
    expect(shown(graphic, 'match')).toBe('01:10');

    expect((await graphic.customAction({ id: 'clock:clock_shot:reset' })).statusCode).toBe(200);
    expect(shown(graphic, 'shot')).toBe('24');

    expect(await graphic.customAction({ id: 'clock:clock_timeline:start' })).toEqual({ statusCode: 400, statusMessage: 'Unknown custom action: clock:clock_timeline:start' });

    await graphic.customAction({ id: 'clock:clock_match:pause' });
    await graphic.customAction({ id: 'clock:clock_shot:pause' });
    expect(graphic._clockTimer).toBeNull();
  });

  test('a frame-by-frame render takes the clock times from the schedule', async () => {
    const graphic = mount(scene);
    expect((await graphic.load({ renderType: 'non-realtime' })).statusCode).toBe(200);
    await graphic.setActionsSchedule({ schedule: [
      { timestamp: 0, action: { type: 'playAction', params: { skipAnimation: true } } },
      { timestamp: 1000, action: { type: 'customAction', params: { id: 'clock:clock_match:start', payload: null } } },
      { timestamp: 4000, action: { type: 'customAction', params: { id: 'clock:clock_match:pause', payload: null } } },
    ] });
    await graphic.goToTime({ timestamp: 500 });
    expect(shown(graphic, 'match')).toBe('00:00');
    await graphic.goToTime({ timestamp: 3000 });
    expect(shown(graphic, 'match')).toBe('00:02');
    await graphic.goToTime({ timestamp: 9000 });
    expect(shown(graphic, 'match')).toBe('00:03');
    expect(graphic._clockTimer).toBeNull();
  });
});
