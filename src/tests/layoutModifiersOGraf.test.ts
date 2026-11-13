/**
 * Layout modifiers in the OGraf package: the runtime lays the scene out again
 * whenever its data changes (a follower moves with its text, an emptied text
 * hides, a group stays justified), repeated copies are painted, and the static
 * renderer agrees.
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
  id, name: id, type: 'custom_box', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, fillColor: '#2563eb', strokeColor: '#101218', ...extra,
} as SceneLayer);

// jsdom has no canvas: text measures 0.56 em per character.
const scene = (layers: SceneLayer[]): SceneData => ({
  version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Modifiers',
  width: 1920, height: 1080, fps: 30, totalFrames: 30, layers, tracks: [],
});

const mount = (data: SceneData): LiveGraphic => {
  const source = compileOGrafPackage(data).files.find((file) => file.path === 'graphic.mjs')?.content || '';
  const Graphic = new Function('HTMLElement', `${source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href')}`)(HTMLElement) as new () => LiveGraphic;
  const tag = `x-ograf-modifiers-${Math.random().toString(36).slice(2)}`;
  customElements.define(tag, Graphic);
  const graphic = document.createElement(tag) as LiveGraphic;
  document.body.appendChild(graphic);
  return graphic;
};

/** A layer's painted centre x on the 1920 px canvas, from its transform. */
const xOf = (markup: Element | Document, id: string) => {
  const transform = markup.querySelector(`[data-layer-id="${id}"] g`)?.getAttribute('transform') ?? '';
  return Number(/translate\(([-\d.]+)/.exec(transform)?.[1]);
};
/** A layer's painted opacity; a layer that is not painted at all is 0. */
const opacityOf = (markup: Element | Document, id: string) => {
  const element = markup.querySelector(`[data-layer-id="${id}"]`);
  return element ? Number(element.getAttribute('opacity') ?? 1) : 0;
};

const headline = layer('title', { name: 'Headline', type: 'custom_text', textValue: 'Hi', fontSize: 72, zIndex: 2, textFit: { hideWhenEmpty: true } });

describe('layout modifiers in the OGraf package', () => {
  test('a follower moves with its text on every update, and an emptied text hides with its bar', async () => {
    const graphic = mount(scene([
      layer('bar', { type: 'custom_rect', fitToText: { textLayerId: 'title', padding: 24 } }),
      layer('tag', { x: 8, follow: { targetLayerId: 'title' } }),
      headline,
    ]));
    await graphic.load({ renderType: 'realtime' });
    await graphic.playAction({ skipAnimation: true });
    // "Hi": 2 x 0.56 x 72 = 80.64 px, its right edge at 40.32; the box's left edge 8 px past it.
    expect(xOf(graphic, 'tag')).toBeCloseTo(960 + 40.32 + 8 + 30);

    await graphic.updateAction({ data: { headline: 'Hello' } });
    expect(xOf(graphic, 'tag')).toBeCloseTo(960 + (5 * 0.56 * 72) / 2 + 8 + 30);

    await graphic.updateAction({ data: { headline: '' } });
    expect(opacityOf(graphic, 'title')).toBe(0);
    expect(opacityOf(graphic, 'bar')).toBe(0);
    // The text collapsed to its x: the box takes its place.
    expect(xOf(graphic, 'tag')).toBeCloseTo(960 + 8 + 30);
    graphic.remove();
  });

  test('a justified group stays centred as its text changes', async () => {
    const graphic = mount(scene([
      layer('group', { isGroup: true, x: 0, justify: { horizontal: 'center' } } as Partial<SceneLayer>),
      { ...headline, parentId: 'group', textFit: undefined },
      layer('tag', { parentId: 'group', x: 8, follow: { targetLayerId: 'title' } }),
    ]));
    await graphic.load({ renderType: 'realtime' });
    await graphic.playAction({ skipAnimation: true });
    const centre = (markup: Element) => {
      const text = (markup.querySelector('[data-layer-id="title"] text')?.textContent ?? '').length * 0.56 * 72;
      const left = xOf(markup, 'title') - text / 2;
      const right = xOf(markup, 'tag') + 30;
      return (left + right) / 2;
    };
    expect(centre(graphic)).toBeCloseTo(960);
    await graphic.updateAction({ data: { headline: 'A longer headline' } });
    expect(centre(graphic)).toBeCloseTo(960);
    graphic.remove();
  });

  test('repeated copies are painted by the runtime and the static renderer', async () => {
    const data = scene([layer('dot', { type: 'custom_circle', repeater: { count: 3, offsetX: 100, fade: 0.25 } })]);
    const graphic = mount(data);
    await graphic.load({ renderType: 'realtime' });
    await graphic.playAction({ skipAnimation: true });
    expect([xOf(graphic, 'dot'), xOf(graphic, 'dot__copy1'), xOf(graphic, 'dot__copy2')]).toEqual([960, 1060, 1160]);
    expect(opacityOf(graphic, 'dot__copy1')).toBeCloseTo(0.75);
    expect(opacityOf(graphic, 'dot__copy2')).toBeCloseTo(0.5);
    graphic.remove();

    const markup = new DOMParser().parseFromString(renderOGrafSvg(evaluateOGrafScene(data, 0)), 'image/svg+xml');
    expect(xOf(markup, 'dot__copy2')).toBe(1160);
    // Copies are not public fields of the graphic.
    expect(Object.keys(compileOGrafPackage(data).manifest.schema.properties ?? {})).not.toContain('dot__copy1');
  });
});
