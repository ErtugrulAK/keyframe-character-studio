/**
 * Text boxes in the OGraf package: the runtime fits a text (and the shape that
 * follows it) whenever its data changes, the static renderer agrees, and the
 * field's character limit is the schema's maxLength.
 */
import { describe, expect, test } from 'vitest';
import type { SceneData, SceneLayer } from '../types/composition';
import { compileOGrafPackage } from '../ograf/packageCompiler';
import { evaluateOGrafScene } from '../ograf/evaluation';
import { renderOGrafSvg } from '../ograf/svgRenderer';

type LiveGraphic = HTMLElement & {
  load: (params: { renderType: string; data?: Record<string, unknown> }) => Promise<{ statusCode: number }>;
  playAction: (params?: { skipAnimation?: boolean }) => Promise<unknown>;
  updateAction: (params: { data: Record<string, unknown> }) => Promise<{ statusCode: number }>;
};

const layer = (id: string, extra: Partial<SceneLayer>): SceneLayer => ({
  id, name: id, type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, fillColor: '#2563eb', strokeColor: '#101218', ...extra,
} as SceneLayer);

// jsdom has no canvas: text measures 0.56 em per character.
const scene: SceneData = {
  version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Fit',
  width: 1920, height: 1080, fps: 30, totalFrames: 30,
  layers: [
    layer('bar', { name: 'Bar', scaleX: 8, scaleY: 1.6, fitToText: { textLayerId: 'title', padding: 24, maxWidth: 960 } }),
    layer('title', { name: 'Headline', type: 'custom_text', textValue: 'Hi', fontSize: 72, zIndex: 2, textFit: { maxLength: 60 } }),
  ],
  tracks: [],
};

const mount = (): LiveGraphic => {
  const source = compileOGrafPackage(scene).files.find((file) => file.path === 'graphic.mjs')?.content || '';
  const Graphic = new Function('HTMLElement', `${source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href')}`)(HTMLElement) as new () => LiveGraphic;
  const tag = `x-ograf-text-fit-${Math.random().toString(36).slice(2)}`;
  customElements.define(tag, Graphic);
  const graphic = document.createElement(tag) as LiveGraphic;
  document.body.appendChild(graphic);
  return graphic;
};

const fontSizeOf = (markup: Element | Document) => Number(markup.querySelector('[data-layer-id="title"] text')?.getAttribute('font-size'));
const textOf = (markup: Element | Document) => markup.querySelector('[data-layer-id="title"] text')?.textContent ?? '';
/** The bar's painted scaleX, from its transform. */
const barScaleX = (markup: Element | Document) => {
  const transform = markup.querySelector('[data-layer-id="bar"] g')?.getAttribute('transform') ?? '';
  return Number(/scale\(([-\d.]+)/.exec(transform)?.[1]);
};

describe('text boxes in the OGraf package', () => {
  test('the schema limits the field to the text box character limit', () => {
    const plan = compileOGrafPackage(scene);
    const field = Object.values(plan.manifest.schema.properties).find((property) => (property as { title?: string }).title === 'Headline');
    expect(field).toMatchObject({ type: 'string', maxLength: 60, default: 'Hi' });
  });

  test('the runtime refits on every update: the bar hugs short text, stops at its max, the text shrinks and is cut', async () => {
    const graphic = mount();
    await graphic.load({ renderType: 'realtime' });
    await graphic.playAction({ skipAnimation: true });
    // "Hi": 2 x 0.56 x 72 = 80.64 px + 48 padding on a 120 px rect.
    expect(fontSizeOf(graphic)).toBe(72);
    expect(barScaleX(graphic)).toBeCloseTo((80.64 + 48) / 120);

    await graphic.updateAction({ data: { headline: 'x'.repeat(80) } });
    expect(textOf(graphic)).toHaveLength(60);
    expect(fontSizeOf(graphic)).toBe(36); // the 50 % floor
    expect(barScaleX(graphic)).toBeCloseTo(960 / 120); // held at its max width

    await graphic.updateAction({ data: { headline: 'Hi' } });
    expect(fontSizeOf(graphic)).toBe(72);
    graphic.remove();
  });

  test('the static renderer (GIF, thumbnail) draws the same fit', () => {
    const long: SceneData = { ...scene, layers: scene.layers.map((item) => (item.id === 'title' ? { ...item, textValue: 'x'.repeat(80) } : item)) };
    const markup = new DOMParser().parseFromString(renderOGrafSvg(evaluateOGrafScene(long, 0)), 'image/svg+xml');
    expect(fontSizeOf(markup)).toBe(36);
    expect(textOf(markup)).toHaveLength(60);
  });
});
