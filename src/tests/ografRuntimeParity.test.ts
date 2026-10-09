/**
 * The generated runtime must not carry its own copy of a KCS rule.
 *
 * Three separate paths paint a scene — the editor's evaluator, the static SVG
 * renderer and the generated `graphic.mjs` — and the runtime used to hand-copy
 * rules that also lived in the application. Those copies drifted twice: the
 * painted order was inverted because the runtime sorted the authored array, and a
 * disabled Track Matte V2 suppressed the legacy matte in the export but not in
 * the editor.
 *
 * This file proves the copies are gone: the runtime's comparator and matte
 * resolver are KCS's own helpers, embedded from their single definition, and all
 * three paths agree on the result.
 */

import { describe, expect, test } from 'vitest';
import type { SceneData, SceneLayer } from '../types/composition';
import type { TrackMatteV2 } from '../types/animator';
import { compareByStackingOrder, stackingOrder } from '../utils/stackingOrder';
import { resolveMatteSource } from '../utils/matte';
import { runtimeCompareByStackingOrder, runtimeResolveMatteSource } from '../ograf/runtimeSnippets';
import { generateGraphicModule } from '../ograf/runtimeTemplate';
import { renderOGrafSvg } from '../ograf/svgRenderer';
import { evaluateOGrafScene } from '../ograf/evaluation';

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
    version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Parity',
    width: 400, height: 300, fps: 30, totalFrames: 30,
    layers, tracks: layers.map((entry) => ({ partId: entry.id, channels: {} as never })),
  };
}

const paintedLayerIds = (markup: string): string[] =>
  [...markup.matchAll(/data-layer-id="([^"]+)"/gu)].map((match) => match[1]);

type GeneratedGraphic = HTMLElement & { _render: () => void };

let counter = 0;
function instantiate(source: string): GeneratedGraphic {
  const Graphic = new Function('HTMLElement', `${source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href')}`)(HTMLElement) as unknown as new () => GeneratedGraphic;
  counter += 1;
  const tag = `x-ograf-parity-net-${counter}`;
  customElements.define(tag, Graphic);
  return document.createElement(tag) as GeneratedGraphic;
}

const runtimeMarkup = (authored: SceneData): string => {
  const graphic = instantiate(generateGraphicModule(authored));
  graphic._render();
  return graphic.innerHTML;
};

const staticMarkup = (authored: SceneData): string => renderOGrafSvg(evaluateOGrafScene(authored, 0));

describe('the runtime carries KCS rules, not copies of them', () => {
  test('the embedded comparator is the canonical helper source', () => {
    expect(runtimeCompareByStackingOrder()).toBe(String(compareByStackingOrder));
  });

  test('the embedded matte resolver is the canonical helper source', () => {
    expect(runtimeResolveMatteSource()).toBe(String(resolveMatteSource));
  });

  test('the generated module contains no hand-written comparator', () => {
    const source = generateGraphicModule(scene([layer({ id: 'a', zIndex: 2 }), layer({ id: 'b', zIndex: 1 })]));
    // The rule appears exactly once, as the embedded helper.
    expect(source.split('a.zIndex - b.zIndex').length - 1).toBe(1);
    expect(source).toContain('function stackingOrder(items) { return items.slice().sort(compareByStackingOrder); }');
  });

  test('the generated module contains no hand-written matte precedence', () => {
    const source = generateGraphicModule(scene([layer({ id: 'a' })]));
    // The precedence chain lives in the embedded resolver, so the module does not
    // repeat the `trackMatte && enabled !== false` decision.
    expect(source).toContain('const resolveMatteSource = ');
    expect(source).not.toContain('if (layer.trackMatte && layer.trackMatte.enabled !== false) return {');
  });
});

describe('editor, static renderer and runtime agree', () => {
  const background = (id: string, zIndex: number): SceneLayer => layer({ id, name: id, zIndex, width: 400, height: 300, fillColor: '#0044ff' });
  const foreground = (id: string, zIndex: number, extra: Partial<SceneLayer> = {}): SceneLayer => layer({ id, name: id, zIndex, width: 80, height: 60, ...extra });

  const matte = (overrides: Partial<TrackMatteV2> = {}): TrackMatteV2 =>
    ({ sourceLayerId: 'lake', mode: 'alpha', inverted: false, enabled: true, sourceVisible: false, ...overrides } as TrackMatteV2);

  test('painted order matches the shared stacking order', () => {
    const authored = scene([foreground('fish', 2), background('lake', 1)]);
    const expected = stackingOrder(authored.layers).map((entry) => entry.id);
    expect(expected).toEqual(['lake', 'fish']);
    expect(paintedLayerIds(runtimeMarkup(authored))).toEqual(expected);
    expect(paintedLayerIds(staticMarkup(authored))).toEqual(expected);
  });

  test('an enabled Track Matte V2 wins in every path', () => {
    const authored = scene([
      foreground('fish', 2, { trackMatte: matte({ mode: 'luminance' }), matte: { sourcePartId: 'lake', mode: 'alpha', enabled: true } as never }),
      background('lake', 1),
    ]);
    expect(resolveMatteSource({ matte: authored.layers[0].matte, trackMatte: authored.layers[0].trackMatte })).toEqual({ sourceId: 'lake', kind: 'track' });
    for (const markup of [runtimeMarkup(authored), staticMarkup(authored)]) {
      expect(markup).toContain('mask-type="luminance"');
      expect(markup).not.toContain('mask-type="alpha"');
    }
  });

  test('a disabled Track Matte V2 falls back to the legacy matte in every path', () => {
    const authored = scene([
      foreground('fish', 2, { trackMatte: matte({ enabled: false }), matte: { sourcePartId: 'lake', mode: 'alpha', enabled: true } as never }),
      background('lake', 1),
    ]);
    expect(resolveMatteSource({ matte: authored.layers[0].matte, trackMatte: authored.layers[0].trackMatte })).toEqual({ sourceId: 'lake', kind: 'legacy' });
    for (const markup of [runtimeMarkup(authored), staticMarkup(authored)]) {
      expect(markup).toContain('mask-type="alpha"');
      expect(markup).toContain('mask="url(#');
    }
  });

  test('no usable source resolves to no matte in every path', () => {
    const authored = scene([
      foreground('fish', 2, { trackMatte: matte({ enabled: false }) }),
      background('lake', 1),
    ]);
    expect(resolveMatteSource({ matte: undefined, trackMatte: authored.layers[0].trackMatte })).toBeUndefined();
    // The precise signal: no track-matte definition is emitted at all. Asserting
    // on a bare `mask="url(#` would also catch the layer-mask mechanism.
    for (const markup of [runtimeMarkup(authored), staticMarkup(authored)]) {
      expect(markup).not.toContain('kcs-ograf-track-matte');
    }
  });

  test('sourceVisible controls whether the source paints, in every path', () => {
    const hidden = scene([foreground('fish', 2, { trackMatte: matte({ sourceVisible: false }) }), background('lake', 1)]);
    const shown = scene([foreground('fish', 2, { trackMatte: matte({ sourceVisible: true }) }), background('lake', 1)]);
    expect(paintedLayerIds(runtimeMarkup(hidden))).toEqual(['fish']);
    expect(paintedLayerIds(staticMarkup(hidden))).toEqual(['fish']);
    expect(paintedLayerIds(runtimeMarkup(shown))).toEqual(['lake', 'fish']);
    expect(paintedLayerIds(staticMarkup(shown))).toEqual(['lake', 'fish']);
  });

  test('an ordinary layer without a matte keeps its stacking position', () => {
    const authored = scene([foreground('top', 3), foreground('middle', 2), background('bottom', 1)]);
    const expected = ['bottom', 'middle', 'top'];
    expect(paintedLayerIds(runtimeMarkup(authored))).toEqual(expected);
    expect(paintedLayerIds(staticMarkup(authored))).toEqual(expected);
  });
});
