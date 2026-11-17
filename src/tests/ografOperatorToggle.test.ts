// @vitest-environment jsdom
/**
 * The operator's show/hide switch: a layer marked `operatorToggle` becomes an
 * on/off field in the OGraf schema, and turning it off in the playout hides the
 * layer and its children. Nothing changes for a layer without the mark.
 */
import { describe, expect, test } from 'vitest';
import type { SceneData, SceneLayer } from '../types/composition';
import { compileOGrafPackage } from '../ograf/packageCompiler';

type LiveGraphic = HTMLElement & {
  load: (params: { renderType: string; data?: Record<string, unknown> }) => Promise<{ statusCode: number; statusMessage?: string }>;
  playAction: (params?: { skipAnimation?: boolean }) => Promise<unknown>;
  updateAction: (params: { data: Record<string, unknown> }) => Promise<{ statusCode: number; statusMessage?: string }>;
};

const layer = (id: string, extra: Partial<SceneLayer> = {}): SceneLayer => ({
  id, name: id, type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, fillColor: '#2563eb', strokeColor: '#101218', ...extra,
} as SceneLayer);

const scene: SceneData = {
  version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Toggle',
  width: 1920, height: 1080, fps: 30, totalFrames: 30,
  layers: [
    // A group is saved as not visible: its children draw themselves.
    layer('badge', { name: 'Live badge', isGroup: true, visible: false, operatorToggle: true }),
    layer('dot', { name: 'Dot', parentId: 'badge', zIndex: 2 }),
    layer('plain', { name: 'Plain', zIndex: 3 }),
    layer('shape', { name: 'Shape', zIndex: 4, operatorToggle: true }),
    layer('target', { name: 'Target', zIndex: 5, trackMatte: { enabled: true, sourceLayerId: 'shape', mode: 'alpha' } as SceneLayer['trackMatte'] }),
  ],
  tracks: [],
};

const mount = (data: SceneData): LiveGraphic => {
  const source = compileOGrafPackage(data).files.find((file) => file.path === 'graphic.mjs')?.content || '';
  const Graphic = new Function('HTMLElement', `${source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href')}`)(HTMLElement) as new () => LiveGraphic;
  const tag = `x-ograf-operator-toggle-${Math.random().toString(36).slice(2)}`;
  customElements.define(tag, Graphic);
  const graphic = document.createElement(tag) as LiveGraphic;
  document.body.appendChild(graphic);
  return graphic;
};

const drawn = (graphic: Element, id: string) => graphic.querySelector(`[data-layer-id="${id}"]`) !== null;

describe('operator show/hide switch in the OGraf package', () => {
  test('a marked layer is an on/off field, on by default; a matte source and an unmarked layer are not', () => {
    const { properties } = compileOGrafPackage(scene).manifest.schema;
    const toggles = Object.entries(properties).filter(([, property]) => property.gddType === 'boolean');
    expect(toggles).toEqual([['show_badge', { type: 'boolean', gddType: 'boolean', title: 'Show Live badge', label: 'Show Live badge', default: true }]]);
  });

  test('off hides the layer and its children, on brings them back, and only true or false is accepted', async () => {
    const graphic = mount(scene);
    expect((await graphic.load({ renderType: 'realtime' })).statusCode).toBe(200);
    await graphic.playAction({ skipAnimation: true });
    expect(drawn(graphic, 'dot')).toBe(true);

    expect((await graphic.updateAction({ data: { show_badge: false } })).statusCode).toBe(200);
    expect(drawn(graphic, 'dot')).toBe(false);
    expect(drawn(graphic, 'plain')).toBe(true);

    expect(await graphic.updateAction({ data: { show_badge: 'no' } })).toEqual({ statusCode: 400, statusMessage: 'Show/hide value must be true or false: show_badge' });
    expect(drawn(graphic, 'dot')).toBe(false);

    expect((await graphic.updateAction({ data: { show_badge: true } })).statusCode).toBe(200);
    expect(drawn(graphic, 'dot')).toBe(true);
  });

  test('a graphic loaded with the switch off starts hidden', async () => {
    const graphic = mount(scene);
    expect((await graphic.load({ renderType: 'realtime', data: { show_badge: false } })).statusCode).toBe(200);
    await graphic.playAction({ skipAnimation: true });
    expect(drawn(graphic, 'dot')).toBe(false);
    expect(drawn(graphic, 'plain')).toBe(true);
  });

  test('a scene without the mark exports exactly the fields it did before', () => {
    const unmarked: SceneData = { ...scene, layers: scene.layers.map(({ operatorToggle: _ignored, ...rest }) => rest as SceneLayer) };
    const { properties } = compileOGrafPackage(unmarked).manifest.schema;
    expect(Object.values(properties).some((property) => property.gddType === 'boolean')).toBe(false);
  });
});
