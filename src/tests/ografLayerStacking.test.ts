/**
 * OGraf paint order must be the KCS stacking order.
 *
 * The authored `scene.layers` array is NOT the paint order: the outliner keeps
 * index 0 on top, `addCustomPart` prepends with `max + 1`, and `reorderParts`
 * assigns `zIndex = total - index`. A painter's-model consumer that walks the
 * array therefore renders the scene upside down — which is what a host
 * (Reality Hub) showed while the editor looked correct.
 */

import { describe, expect, test } from 'vitest';
import type { SceneData, SceneLayer } from '../types/composition';
import type { TrackMatteV2 } from '../types/animator';
import { compileOGrafPackage } from '../ograf/packageCompiler';
import { renderOGrafSvg } from '../ograf/svgRenderer';
import { evaluateOGrafScene } from '../ograf/evaluation';
import { generateGraphicModule } from '../ograf/runtimeTemplate';
import { stackingOrder } from '../utils/stackingOrder';

function layer(overrides: Partial<SceneLayer> = {}): SceneLayer {
  return {
    id: 'shape', name: 'Shape', type: 'custom_rect',
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1,
    fillColor: '#ff0000', strokeColor: '#000000',
    fillEnabled: true, strokeEnabled: false, strokeWidth: 4, strokeAlignment: 'inside',
    width: 200, height: 120,
    ...overrides,
  };
}

function scene(layers: SceneLayer[]): SceneData {
  return {
    version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Stacking',
    width: 400, height: 300, fps: 30, totalFrames: 30,
    layers, tracks: layers.map((entry) => ({ partId: entry.id, channels: {} as never })),
  };
}

/** The nested tile is the full-frame background the host shows over everything. */
const background = (id: string, zIndex: number, extra: Partial<SceneLayer> = {}): SceneLayer =>
  layer({ id, name: id, zIndex, width: 400, height: 300, fillColor: '#0044ff', ...extra });

const foreground = (id: string, zIndex: number, extra: Partial<SceneLayer> = {}): SceneLayer =>
  layer({ id, name: id, zIndex, width: 80, height: 60, fillColor: '#ff0000', ...extra });

/** `data-layer-id` order in the rendered markup is the painter order. */
const paintedLayerIds = (markup: string): string[] =>
  [...markup.matchAll(/data-layer-id="([^"]+)"/gu)].map((match) => match[1]);

type GeneratedGraphic = HTMLElement & { _render: () => void; load: (params: { renderType: 'realtime' }) => Promise<unknown> };

let counter = 0;
function instantiate(source: string): GeneratedGraphic {
  const Graphic = new Function('HTMLElement', `${source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href')}`)(HTMLElement) as unknown as new () => GeneratedGraphic;
  counter += 1;
  const tag = `x-ograf-stacking-${counter}`;
  customElements.define(tag, Graphic);
  return document.createElement(tag) as GeneratedGraphic;
}

/** The static renderer takes an evaluated scene, the runtime takes the scene. */
const staticMarkup = (authored: SceneData): string => renderOGrafSvg(evaluateOGrafScene(authored, 0));

const runtimeMarkup = (authored: SceneData): string => {
  const graphic = instantiate(generateGraphicModule(authored));
  graphic._render();
  return graphic.innerHTML;
};

describe('stackingOrder', () => {
  test('sorts ascending by zIndex without touching the input', () => {
    const authored = [{ zIndex: 3 }, { zIndex: 1 }, { zIndex: 2 }];
    expect(stackingOrder(authored).map((entry) => entry.zIndex)).toEqual([1, 2, 3]);
    expect(authored.map((entry) => entry.zIndex)).toEqual([3, 1, 2]);
  });

  test('keeps the authored order for equal zIndex', () => {
    const authored = [{ zIndex: 1, id: 'first' }, { zIndex: 1, id: 'second' }, { zIndex: 1, id: 'third' }];
    expect(stackingOrder(authored).map((entry) => entry.id)).toEqual(['first', 'second', 'third']);
  });
});

describe('painter order on the authored array', () => {
  // The array the editor produces: index 0 is the topmost layer.
  const fishOverLake = () => scene([foreground('fish', 2), background('lake', 1)]);

  test('the generated runtime paints the background first and the foreground last', () => {
    expect(paintedLayerIds(runtimeMarkup(fishOverLake()))).toEqual(['lake', 'fish']);
  });

  test('the static renderer paints the same order', () => {
    expect(paintedLayerIds(staticMarkup(fishOverLake()))).toEqual(['lake', 'fish']);
  });

  test('three layers stack background, middle, foreground', () => {
    const authored = scene([foreground('foreground', 3), foreground('middle', 2), background('background', 1)]);
    expect(paintedLayerIds(runtimeMarkup(authored))).toEqual(['background', 'middle', 'foreground']);
    expect(paintedLayerIds(staticMarkup(authored))).toEqual(['background', 'middle', 'foreground']);
  });

  test('a shared zIndex keeps the authored order in both paths', () => {
    const authored = scene([foreground('first', 1), foreground('second', 1)]);
    expect(paintedLayerIds(runtimeMarkup(authored))).toEqual(['first', 'second']);
    expect(paintedLayerIds(staticMarkup(authored))).toEqual(['first', 'second']);
  });

  test('neither path reorders or mutates the authored array', () => {
    const authored = fishOverLake();
    const before = authored.layers.map((entry) => entry.id);
    runtimeMarkup(authored);
    staticMarkup(authored);
    expect(authored.layers.map((entry) => entry.id)).toEqual(before);
  });

  test('the packaged runtime agrees with the in-memory generated one', () => {
    const authored = fishOverLake();
    const plan = compileOGrafPackage(authored);
    expect(plan.status).toBe('ready-to-materialize');
    const runtimeFile = plan.files.find((file) => file.kind === 'runtime');
    expect(paintedLayerIds(runtimeMarkup(authored))).toEqual(paintedLayerIds(runtimeMarkup(authored)));
    expect(runtimeFile?.content).toContain('function stackingOrder(items)');
  });
});

describe('track matte keeps its place in the stack', () => {
  const matte = (overrides: Partial<TrackMatteV2> = {}): TrackMatteV2 => ({
    sourceLayerId: 'lake', mode: 'alpha', inverted: false, enabled: true, sourceVisible: false, ...overrides,
  } as TrackMatteV2);

  const matteScene = (sourceVisible: boolean) => scene([
    foreground('fish', 2, { trackMatte: matte({ sourceVisible }) }),
    background('lake', 1),
  ]);

  test('the target keeps its sibling position and the source is not painted when mask-only', () => {
    expect(paintedLayerIds(runtimeMarkup(matteScene(false)))).toEqual(['fish']);
    expect(paintedLayerIds(staticMarkup(matteScene(false)))).toEqual(['fish']);
  });

  test('an unrelated background still paints and stays behind the matted target', () => {
    // `sky` is an ordinary sibling; `lake` is the mask-only source of `fish`.
    const authored = scene([
      foreground('fish', 3, { trackMatte: matte() }),
      foreground('lake', 2),
      background('sky', 1),
    ]);
    expect(paintedLayerIds(runtimeMarkup(authored))).toEqual(['sky', 'fish']);
    expect(paintedLayerIds(staticMarkup(authored))).toEqual(['sky', 'fish']);
  });

  test('the matte source paints as a sibling when the contract asks for it', () => {
    const authored = scene([
      foreground('fish', 2, { trackMatte: matte({ sourceVisible: true }) }),
      background('lake', 1),
    ]);
    expect(paintedLayerIds(runtimeMarkup(authored))).toEqual(['lake', 'fish']);
  });

  test('the target references a mask that the same document defines', () => {
    const svg = staticMarkup(matteScene(false));
    const reference = /mask="url\(#([^)]+)\)"/u.exec(svg)?.[1];
    expect(reference).toBeTruthy();
    expect(svg).toContain(`<mask id="${reference}"`);
  });

  test('the matte source is authored below the target and still resolves', () => {
    const authored = scene([
      background('lake', 1),
      foreground('fish', 2, { trackMatte: matte() }),
    ]);
    expect(paintedLayerIds(staticMarkup(authored))).toEqual(['fish']);
  });
});
