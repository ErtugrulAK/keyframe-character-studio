/**
 * Non-real-time replay is a pure function of the schedule and the time.
 *
 * A renderer that captures frames (an export, a thumbnail, a scrubbing
 * preview) may seek in any order. Whatever happened before — an earlier seek
 * further ahead, a data update after the requested time — the frame at T must
 * be the one the schedule shows at T, byte for byte. In particular a data
 * update (updateAction) is undone when the renderer seeks back before it.
 */
import { describe, expect, test } from 'vitest';
import type { SceneData, SceneLayer } from '../types/composition';
import { compileOGrafPackage } from '../ograf/packageCompiler';

type LiveGraphic = HTMLElement & {
  load: (params: { renderType: string; data?: Record<string, unknown> }) => Promise<{ statusCode: number }>;
  setActionsSchedule: (params: { schedule: unknown[] }) => Promise<{ statusCode: number }>;
  goToTime: (params: { timestamp: number }) => Promise<{ statusCode: number }>;
};

const box: SceneLayer = {
  id: 'box', name: 'Box', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218', width: 120, height: 60,
} as SceneLayer;

const headline: SceneLayer = {
  id: 'title', name: 'Headline', type: 'custom_text', x: 0, y: 120, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 2, fillColor: '#ffffff', strokeColor: '#101218', textValue: 'Original', fontSize: 48,
} as SceneLayer;

// 60 frames at 30 fps: x 0 -> 600 and rotation 0 -> 90 over a 2 s play.
const scene: SceneData = {
  version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Replay',
  width: 1920, height: 1080, fps: 30, totalFrames: 60,
  layers: [box, headline],
  tracks: [{
    partId: 'box',
    channels: {
      x: [{ id: 'x0', frame: 0, value: 0, easing: 'easeInOut' }, { id: 'x1', frame: 60, value: 600, easing: 'linear' }],
      rotation: [{ id: 'r0', frame: 0, value: 0, easing: 'linear' }, { id: 'r1', frame: 60, value: 90, easing: 'linear' }],
    } as never,
  }],
};

const mount = (): LiveGraphic => {
  const plan = compileOGrafPackage(scene);
  expect(plan.status).toBe('ready-to-materialize');
  const source = plan.files.find((file) => file.path === 'graphic.mjs')?.content || '';
  const Graphic = new Function('HTMLElement', `${source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href')}`)(HTMLElement) as new () => LiveGraphic;
  const tag = `x-ograf-replay-${Math.random().toString(36).slice(2)}`;
  customElements.define(tag, Graphic);
  const graphic = document.createElement(tag) as LiveGraphic;
  document.body.appendChild(graphic);
  return graphic;
};

const schedule = [
  { timestamp: 0, action: { type: 'playAction', params: {} } },
  { timestamp: 1000, action: { type: 'updateAction', params: { data: { headline: 'Updated' } } } },
  { timestamp: 3000, action: { type: 'stopAction', params: {} } },
];

const textOf = (graphic: HTMLElement) => graphic.querySelector('[data-layer-id="title"] text')?.textContent;

const frameAt = async (graphic: LiveGraphic, timestamp: number): Promise<string> => {
  expect((await graphic.goToTime({ timestamp })).statusCode).toBe(200);
  return graphic.innerHTML;
};

describe('OGraf non-real-time replay', () => {
  test('a data update applies from its time and is undone when seeking back before it', async () => {
    const graphic = mount();
    await graphic.load({ renderType: 'non-realtime' });
    await graphic.setActionsSchedule({ schedule });
    await graphic.goToTime({ timestamp: 1500 });
    expect(textOf(graphic)).toBe('Updated');
    await graphic.goToTime({ timestamp: 500 });
    expect(textOf(graphic)).toBe('Original');
    await graphic.goToTime({ timestamp: 1500 });
    expect(textOf(graphic)).toBe('Updated');
    graphic.remove();
  });

  test('a frame is the same whatever was rendered before it', async () => {
    const graphic = mount();
    await graphic.load({ renderType: 'non-realtime' });
    await graphic.setActionsSchedule({ schedule });
    const times = [250, 750, 1250, 1999, 2600];
    const forward: string[] = [];
    for (const time of times) forward.push(await frameAt(graphic, time));
    const backward: string[] = [];
    for (const time of [...times].reverse()) backward.unshift(await frameAt(graphic, time));
    expect(backward).toEqual(forward);
    // A repeated seek to the same time changes nothing either.
    expect(await frameAt(graphic, 1250)).toBe(forward[2]);
    // And the frames really differ from each other, so the comparison means something.
    expect(new Set(forward).size).toBe(forward.length);
    graphic.remove();
  });

  test('a fresh instance renders the same frame as a seeked one', async () => {
    const seeked = mount();
    await seeked.load({ renderType: 'non-realtime' });
    await seeked.setActionsSchedule({ schedule });
    await frameAt(seeked, 2600);
    const late = await frameAt(seeked, 750);
    const fresh = mount();
    await fresh.load({ renderType: 'non-realtime' });
    await fresh.setActionsSchedule({ schedule });
    expect(await frameAt(fresh, 750)).toBe(late);
    seeked.remove();
    fresh.remove();
  });
});
