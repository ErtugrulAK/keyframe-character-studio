// @vitest-environment jsdom
/**
 * "Operator can pick any image": the exported image field becomes a picture
 * chooser (`file-path/image-path`) and the runtime accepts any address that
 * can only name a picture. Without the mark, only packaged images pass, as
 * before. The runtime repeats `utils/layers/operatorImage` inline; the table
 * below runs through both.
 */
import { describe, expect, test } from 'vitest';
import type { SceneData, SceneLayer } from '../types/composition';
import { compileOGrafPackage } from '../ograf/packageCompiler';
import { operatorImageAddress } from '../utils/layers/operatorImage';

type Result = { statusCode: number; statusMessage?: string };
type LiveGraphic = HTMLElement & {
  load: (params: { renderType: string; data?: Record<string, unknown> }) => Promise<Result>;
  playAction: (params?: { skipAnimation?: boolean }) => Promise<unknown>;
  updateAction: (params: { data: Record<string, unknown> }) => Promise<Result>;
};

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

const image = (extra: Partial<SceneLayer> = {}): SceneLayer => ({
  id: 'photo', name: 'Photo', type: 'custom_image', imageUrl: 'source/logo.png', width: 100, height: 50,
  x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#ffffff', strokeColor: 'none', ...extra,
} as SceneLayer);

const sceneOf = (layer: SceneLayer): SceneData => ({
  version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Photo', width: 320, height: 180, fps: 30, totalFrames: 30, layers: [layer], tracks: [],
});

const OPTIONS = { assetCatalog: { 'source/logo.png': { kind: 'local' as const, sourcePath: 'logo.png', packagedPath: 'assets/images/logo.png' } } };

const mount = (data: SceneData): LiveGraphic => {
  const source = compileOGrafPackage(data, OPTIONS).files.find((file) => file.path === 'graphic.mjs')?.content || '';
  const Graphic = new Function('HTMLElement', `${source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href')}`)(HTMLElement) as new () => LiveGraphic;
  const tag = `x-ograf-operator-image-${Math.random().toString(36).slice(2)}`;
  customElements.define(tag, Graphic);
  const graphic = document.createElement(tag) as LiveGraphic;
  document.body.appendChild(graphic);
  return graphic;
};

const href = (graphic: Element) => graphic.querySelector('[data-layer-id="photo"] image')?.getAttribute('href') ?? '';

// [value, the address the graphic loads, or null when refused]
const CASES: Array<[string, string | null]> = [
  ['https://cdn.example/team/logo.png', 'https://cdn.example/team/logo.png'],
  ['http://10.0.0.5/still.jpg', 'http://10.0.0.5/still.jpg'],
  ['file:///D:/media/guest.png', 'file:///D:/media/guest.png'],
  ['D:\\media\\guest.png', 'file:///D:/media/guest.png'],
  [PNG, PNG],
  ['photos/guest.webp', 'photos/guest.webp'],
  ['javascript:alert(1)', null],
  ['data:image/svg+xml;base64,PHN2Zz4=', null],
  ['data:text/html;base64,PGI+', null],
  ['blob:https://x/1', null],
  ['//evil.example/x.png', null],
  ['a.png" onload="x', null],
  ['', null],
];

describe('operator image: the editor rule', () => {
  test.each(CASES)('%s', (value, expected) => {
    expect(operatorImageAddress(value) ?? null).toBe(expected);
  });
});

describe('operator image in the OGraf package', () => {
  test('marked: a picture chooser, with a warning that the picture is not packaged; unmarked: the packaged choice', () => {
    const marked = compileOGrafPackage(sceneOf(image({ operatorImageAny: true })), OPTIONS);
    expect(marked.manifest.schema.properties.image_photo).toEqual({
      type: 'string', gddType: 'file-path/image-path', gddOptions: { extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
      title: 'Photo', label: 'Photo', default: 'assets/images/logo.png',
    });
    expect(marked.diagnostics.find((item) => item.code === 'OGRAF_OPERATOR_IMAGE_ANY')).toMatchObject({ severity: 'WARNING', layerId: 'photo' });

    const plain = compileOGrafPackage(sceneOf(image()), OPTIONS);
    expect(plain.manifest.schema.properties.image_photo).toMatchObject({ gddType: 'select', enum: ['assets/images/logo.png'] });
    expect(plain.diagnostics.some((item) => item.code === 'OGRAF_OPERATOR_IMAGE_ANY')).toBe(false);
  });

  test('the runtime accepts exactly what the editor rule accepts', async () => {
    const graphic = mount(sceneOf(image({ operatorImageAny: true })));
    expect((await graphic.load({ renderType: 'realtime' })).statusCode).toBe(200);
    await graphic.playAction({ skipAnimation: true });
    for (const [value, expected] of CASES) {
      const before = href(graphic);
      const result = await graphic.updateAction({ data: { image_photo: value } });
      if (expected === null) {
        expect(result, value).toEqual({ statusCode: 400, statusMessage: 'Image value is not a picture address: image_photo' });
        expect(href(graphic)).toBe(before);
      } else {
        expect(result.statusCode, value).toBe(200);
        expect(href(graphic), value).toContain(expected.startsWith('photos/') ? 'photos/guest.webp' : expected);
      }
    }
  });

  test('unmarked, a picture address is still refused', async () => {
    const graphic = mount(sceneOf(image()));
    expect((await graphic.load({ renderType: 'realtime' })).statusCode).toBe(200);
    expect(await graphic.updateAction({ data: { image_photo: 'https://cdn.example/team/logo.png' } }))
      .toEqual({ statusCode: 400, statusMessage: 'Image value is not a packaged asset: image_photo' });
  });
});
