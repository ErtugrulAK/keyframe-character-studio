/**
 * The generated graphic against the OGraf v1 renderer contract, as other
 * renderers than Reality Hub exercise it:
 * - nothing is painted before the first playAction (a renderer may load the
 *   next instance while the previous one is still on air);
 * - the SVG fills the element the renderer sizes, at any output resolution;
 * - a play after a stop plays in again from the first frame;
 * - non-real-time rendering: setActionsSchedule() + goToTime() give the frame
 *   the real-time rules would show at that time;
 * - the @font-face rules are written once, not per frame.
 */
import { describe, expect, test } from 'vitest';
import type { SceneData, SceneLayer } from '../types/composition';
import { compileOGrafPackage } from '../ograf/packageCompiler';

type LiveGraphic = HTMLElement & {
  load: (params: { renderType: string; data?: Record<string, unknown> }) => Promise<{ statusCode: number; statusMessage?: string }>;
  playAction: (params?: { skipAnimation?: boolean }) => Promise<{ statusCode: number; currentStep?: number }>;
  stopAction: (params?: { skipAnimation?: boolean }) => Promise<{ statusCode: number }>;
  updateAction: (params: { data: Record<string, unknown> }) => Promise<{ statusCode: number }>;
  setActionsSchedule: (params: { schedule: unknown[] }) => Promise<{ statusCode: number }>;
  goToTime: (params: { timestamp: number }) => Promise<{ statusCode: number; statusMessage?: string }>;
  _currentFrame: number;
};

const box: SceneLayer = {
  id: 'box', name: 'Box', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218', width: 120, height: 60,
};

// 60 frames at 30 fps: a play runs 2 s; x moves 0 -> 600 over it.
const scene: SceneData = {
  version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Contract',
  width: 1920, height: 1080, fps: 30, totalFrames: 60,
  layers: [box],
  tracks: [{
    partId: 'box',
    channels: {
      x: [{ id: 'x0', frame: 0, value: 0, easing: 'linear' }, { id: 'x1', frame: 60, value: 600, easing: 'linear' }],
    } as never,
  }],
};

const mount = (): LiveGraphic => {
  const plan = compileOGrafPackage(scene);
  expect(plan.status).toBe('ready-to-materialize');
  const source = plan.files.find((file) => file.path === 'graphic.mjs')?.content || '';
  const Graphic = new Function('HTMLElement', `${source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href')}`)(HTMLElement) as new () => LiveGraphic;
  const tag = `x-ograf-contract-${Math.random().toString(36).slice(2)}`;
  customElements.define(tag, Graphic);
  const graphic = document.createElement(tag) as LiveGraphic;
  document.body.appendChild(graphic);
  return graphic;
};

const painted = (graphic: HTMLElement): boolean => graphic.querySelector('[data-layer-id="box"]') !== null;
/** The box's scene-space x, read from its painted translate (scene centre 960). */
const boxX = (graphic: HTMLElement): number => {
  const transform = graphic.querySelector('[data-layer-id="box"] g')?.getAttribute('transform') ?? '';
  return Number(/translate\(([-\d.]+)/.exec(transform)?.[1]) - 960;
};

describe('OGraf renderer contract', () => {
  test('nothing is painted between load and the first play', async () => {
    const graphic = mount();
    expect((await graphic.load({ renderType: 'realtime' })).statusCode).toBe(200);
    expect(painted(graphic)).toBe(false);
    await graphic.updateAction({ data: {} });
    expect(painted(graphic)).toBe(false);
    await graphic.playAction({ skipAnimation: true });
    expect(painted(graphic)).toBe(true);
    graphic.remove();
  });

  test('the SVG fills the renderer-sized element with the authored aspect', async () => {
    const graphic = mount();
    await graphic.load({ renderType: 'realtime' });
    const svg = graphic.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('100%');
    expect(svg.getAttribute('height')).toBe('100%');
    expect(svg.getAttribute('viewBox')).toBe('0 0 1920 1080');
    graphic.remove();
  });

  test('a play after a stop plays in again from the first frame', async () => {
    const graphic = mount();
    await graphic.load({ renderType: 'realtime' });
    await graphic.playAction({ skipAnimation: true });
    expect(boxX(graphic)).toBeCloseTo(600);
    await graphic.stopAction({ skipAnimation: true });
    expect(painted(graphic)).toBe(false);
    // Hold the animation at its first tick: the frame it starts from is 0.
    const realFrame = globalThis.requestAnimationFrame;
    const realCancel = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = () => 1;
    globalThis.cancelAnimationFrame = () => undefined;
    try {
      const replay = graphic.playAction({});
      expect(graphic._currentFrame).toBe(0);
      await graphic.stopAction({ skipAnimation: true });
      expect((await replay).statusCode).toBe(200);
    } finally {
      globalThis.requestAnimationFrame = realFrame;
      globalThis.cancelAnimationFrame = realCancel;
    }
    graphic.remove();
  });

  test('the @font-face style is written once, not on every frame', async () => {
    const graphic = mount();
    await graphic.load({ renderType: 'realtime' });
    const style = graphic.querySelector('style');
    await graphic.playAction({ skipAnimation: true });
    await graphic.goToTime({ timestamp: 0 });
    expect(graphic.querySelector('style')).toBe(style);
    expect(graphic.querySelectorAll('style')).toHaveLength(1);
    graphic.remove();
  });

  test('non-real-time: goToTime renders what the schedule shows at that time', async () => {
    const graphic = mount();
    expect((await graphic.load({ renderType: 'non-realtime' })).statusCode).toBe(200);
    await graphic.setActionsSchedule({
      schedule: [
        { timestamp: 1000, action: { type: 'playAction', params: {} } },
        { timestamp: 5000, action: { type: 'stopAction', params: {} } },
      ],
    });
    await graphic.goToTime({ timestamp: 500 });
    expect(painted(graphic)).toBe(false); // before the play
    await graphic.goToTime({ timestamp: 2000 });
    expect(boxX(graphic)).toBeCloseTo(300); // 1 s into a 2 s play
    await graphic.goToTime({ timestamp: 4000 });
    expect(boxX(graphic)).toBeCloseTo(600); // held on the last frame
    await graphic.goToTime({ timestamp: 5000 });
    expect(painted(graphic)).toBe(false); // the stop at the end hides it at once
    // Seeking backwards is deterministic.
    await graphic.goToTime({ timestamp: 1500 });
    expect(boxX(graphic)).toBeCloseTo(150);
    graphic.remove();
  });

  test('non-real-time: a stop during the play finishes the timeline, then hides', async () => {
    const graphic = mount();
    await graphic.load({ renderType: 'non-realtime' });
    await graphic.setActionsSchedule({
      schedule: [
        { timestamp: 0, action: { type: 'playAction', params: {} } },
        { timestamp: 1000, action: { type: 'stopAction', params: {} } },
      ],
    });
    await graphic.goToTime({ timestamp: 1500 });
    expect(boxX(graphic)).toBeCloseTo(450);
    await graphic.goToTime({ timestamp: 2100 });
    expect(painted(graphic)).toBe(false);
    graphic.remove();
  });

  test('an unknown render type and a missing timestamp are refused', async () => {
    const graphic = mount();
    expect((await graphic.load({ renderType: 'offline' })).statusCode).toBe(400);
    await graphic.load({ renderType: 'non-realtime' });
    expect((await graphic.goToTime({ timestamp: Number.NaN })).statusCode).toBe(400);
    graphic.remove();
  });
});
