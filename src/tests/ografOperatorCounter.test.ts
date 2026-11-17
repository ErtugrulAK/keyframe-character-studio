// @vitest-environment jsdom
/**
 * The operator's counter: a text marked `operatorCounter` that is a whole
 * number becomes an integer field with +1 / -1 buttons (OGraf customActions).
 * The runtime repeats the editor's rule (`utils/layers/operatorCounter`).
 */
import { describe, expect, test } from 'vitest';
import type { SceneData, SceneLayer } from '../types/composition';
import { compileOGrafPackage } from '../ograf/packageCompiler';
import { counterUnavailableReason, counterValueOf } from '../utils/layers/operatorCounter';

type Result = { statusCode: number; statusMessage?: string };
type LiveGraphic = HTMLElement & {
  load: (params: { renderType: string; data?: Record<string, unknown> }) => Promise<Result>;
  playAction: (params?: { skipAnimation?: boolean }) => Promise<unknown>;
  updateAction: (params: { data: Record<string, unknown> }) => Promise<Result>;
  customAction: (params: { id: string; payload?: unknown }) => Promise<Result>;
  setActionsSchedule: (params: { schedule: unknown[] }) => Promise<Result>;
  goToTime: (params: { timestamp: number }) => Promise<Result>;
};

const text = (id: string, value: string, extra: Partial<SceneLayer> = {}): SceneLayer => ({
  id, name: id, type: 'custom_text', textValue: value, fontSize: 72, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, fillColor: '#ffffff', strokeColor: '#000000', ...extra,
} as SceneLayer);

const scene: SceneData = {
  version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Score',
  width: 1920, height: 1080, fps: 30, totalFrames: 30,
  layers: [
    text('home', '2', { name: 'Home score', operatorCounter: true }),
    text('title', 'Final', { name: 'Title', zIndex: 2 }),
    // Marked, but not a number: stays a text field, no buttons.
    text('label', 'Goals', { name: 'Label', zIndex: 3, operatorCounter: true }),
  ],
  tracks: [],
};

const mount = (data: SceneData): LiveGraphic => {
  const source = compileOGrafPackage(data).files.find((file) => file.path === 'graphic.mjs')?.content || '';
  const Graphic = new Function('HTMLElement', `${source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href')}`)(HTMLElement) as new () => LiveGraphic;
  const tag = `x-ograf-operator-counter-${Math.random().toString(36).slice(2)}`;
  customElements.define(tag, Graphic);
  const graphic = document.createElement(tag) as LiveGraphic;
  document.body.appendChild(graphic);
  return graphic;
};

const shown = (graphic: Element, id: string) => graphic.querySelector(`[data-layer-id="${id}"] text`)?.textContent ?? '';

describe('operator counter: the editor rule', () => {
  test('a whole number (or an empty text) is a counter; anything else says why not', () => {
    expect(counterValueOf('42')).toBe(42);
    expect(counterValueOf(' -3 ')).toBe(-3);
    expect(counterValueOf('')).toBe(0);
    expect(counterValueOf('4.5')).toBeUndefined();
    expect(counterValueOf('1234567')).toBeUndefined();
    expect(counterUnavailableReason({ type: 'custom_text', textValue: '7' })).toBeUndefined();
    expect(counterUnavailableReason({ type: 'custom_text', textValue: 'Goals' })).toMatch(/whole number/);
    expect(counterUnavailableReason({ type: 'custom_text', textValue: '7', textEffect: { kind: 'count' } })).toMatch(/ANIMATE TEXT/);
    expect(counterUnavailableReason({ type: 'custom_rect' })).toMatch(/text layer/);
  });
});

describe('operator counter in the OGraf package', () => {
  test('a counter is an integer field with +1 / -1 buttons; a non-number keeps its text field', () => {
    const { manifest } = compileOGrafPackage(scene);
    expect(manifest.schema.properties.number_home).toEqual({
      type: 'integer', gddType: 'integer', minimum: -999999, maximum: 999999, title: 'Home score', label: 'Home score', default: 2,
    });
    expect(manifest.schema.properties.text_label).toMatchObject({ type: 'string', gddType: 'single-line', default: 'Goals' });
    expect(manifest.customActions).toEqual([
      { id: 'add:number_home:1', name: 'Home score +1', description: 'Adds one to Home score.', schema: null },
      { id: 'add:number_home:-1', name: 'Home score -1', description: 'Takes one from Home score.', schema: null },
    ]);
  });

  test('a scene without counters has no customActions', () => {
    const plain: SceneData = { ...scene, layers: scene.layers.map(({ operatorCounter: _ignored, ...rest }) => rest as SceneLayer) };
    expect(compileOGrafPackage(plain).manifest.customActions).toBeUndefined();
  });

  test('the buttons count, a typed number is set, and anything else is refused', async () => {
    const graphic = mount(scene);
    expect((await graphic.load({ renderType: 'realtime' })).statusCode).toBe(200);
    await graphic.playAction({ skipAnimation: true });
    expect(shown(graphic, 'home')).toBe('2');

    expect((await graphic.customAction({ id: 'add:number_home:1', payload: null })).statusCode).toBe(200);
    expect((await graphic.customAction({ id: 'add:number_home:1', payload: null })).statusCode).toBe(200);
    expect(shown(graphic, 'home')).toBe('4');
    expect((await graphic.customAction({ id: 'add:number_home:-1', payload: null })).statusCode).toBe(200);
    expect(shown(graphic, 'home')).toBe('3');

    expect((await graphic.updateAction({ data: { number_home: 10 } })).statusCode).toBe(200);
    expect(shown(graphic, 'home')).toBe('10');
    expect(await graphic.updateAction({ data: { number_home: 1.5 } })).toEqual({ statusCode: 400, statusMessage: 'Number value must be a whole number: number_home' });
    expect(await graphic.customAction({ id: 'add:text_title:1' })).toEqual({ statusCode: 400, statusMessage: 'Unknown custom action: add:text_title:1' });
    expect(await graphic.customAction({ id: 'add:number_home:5' })).toEqual({ statusCode: 400, statusMessage: 'Unknown custom action: add:number_home:5' });
    expect(shown(graphic, 'home')).toBe('10');
    expect(shown(graphic, 'title')).toBe('Final');
  });

  test('a frame-by-frame render replays the buttons at their time', async () => {
    const graphic = mount(scene);
    expect((await graphic.load({ renderType: 'non-realtime' })).statusCode).toBe(200);
    await graphic.setActionsSchedule({ schedule: [
      { timestamp: 0, action: { type: 'playAction', params: { skipAnimation: true } } },
      { timestamp: 500, action: { type: 'customAction', params: { id: 'add:number_home:1', payload: null } } },
    ] });
    await graphic.goToTime({ timestamp: 400 });
    expect(shown(graphic, 'home')).toBe('2');
    await graphic.goToTime({ timestamp: 600 });
    expect(shown(graphic, 'home')).toBe('3');
  });
});
