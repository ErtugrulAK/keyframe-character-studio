/**
 * Layer effects (drop shadow, glow, blur, blend) are one description drawn by
 * the stage, the static SVG and the generated OGraf graphic. Before, only the
 * stage drew the drop shadow: every export silently lost it.
 */
import { describe, expect, it } from 'vitest';
import type { SceneData, SceneLayer } from '../types/composition';
import { layerBlendMode, layerFilterMarkup, hasLayerFilter } from '../utils/layers/layerEffects';
import { generateGraphicModule } from '../ograf/runtimeTemplate';
import { renderOGrafSvg } from '../ograf/svgRenderer';
import { evaluateOGrafScene } from '../ograf/evaluation';
import { runtimeLayerEffects } from '../ograf/runtimeSnippets';
import { validateImportedDocument } from '../utils/persistence/importValidation';

describe('the layer effect filter', () => {
  it('a drop shadow is the feDropShadow chain, in the region the stage always used, with no tag a parser lower-cases', () => {
    const markup = layerFilterMarkup({ shadowColor: '#000000', shadowBlur: 6, shadowOffsetX: 2, shadowOffsetY: 3 }, 'f');
    expect(markup.startsWith('<filter id="f" x="-50%" y="-50%" width="200%" height="200%">')).toBe(true);
    expect(markup).toContain('<feGaussianBlur in="SourceAlpha" stdDeviation="6" result="kcsShadowBlur">');
    expect(markup).toContain('<feOffset in="kcsShadowBlur" dx="2" dy="3"');
    expect(markup).toContain('flood-color="#000000" flood-opacity="0.85"');
    expect(markup).toMatch(/<feMergeNode in="kcsShadow"><\/feMergeNode><feMergeNode in="SourceGraphic"><\/feMergeNode>/u);
    expect(markup).not.toContain('feDropShadow');
  });

  it('a glow and a blur build their primitives under the layer, in a wider region', () => {
    const markup = layerFilterMarkup({ glowColor: '#ffcc00', glowSize: 12, glowStrength: 0.5, layerBlur: 3 }, 'g');
    expect(markup).toContain('x="-100%"');
    expect(markup).toContain('<feGaussianBlur in="SourceAlpha" stdDeviation="12"');
    expect(markup).toContain('flood-color="#ffcc00" flood-opacity="0.5"');
    expect(markup).toContain('<feGaussianBlur in="SourceGraphic" stdDeviation="3" result="kcsBody">');
    expect(markup).toMatch(/<feMergeNode in="kcsGlow"><\/feMergeNode><feMergeNode in="kcsBody"><\/feMergeNode><\/feMerge>/u);
  });

  it('no effect, no filter; a glow without a size is no glow', () => {
    expect(hasLayerFilter({})).toBe(false);
    expect(layerFilterMarkup({ glowColor: '#fff', glowSize: 0 }, 'x')).toBe('');
  });

  it('escapes colours and ids', () => {
    expect(layerFilterMarkup({ shadowColor: '"><script>' }, 'a"b')).not.toContain('<script>');
  });

  it('maps blend modes to CSS, and normal to none', () => {
    expect(layerBlendMode({ blendMode: 'multiply' })).toBe('multiply');
    expect(layerBlendMode({ blendMode: 'add' })).toBe('plus-lighter');
    expect(layerBlendMode({ blendMode: 'normal' })).toBeNull();
    expect(layerBlendMode({})).toBeNull();
  });
});

const rect = (extra: Partial<SceneLayer>): SceneLayer => ({
  id: 'card', name: 'Card', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#ff0000', strokeColor: '#000000', ...extra,
} as SceneLayer);
const scene = (layer: SceneLayer): SceneData => ({
  version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Fx', width: 400, height: 300, fps: 30, totalFrames: 30,
  layers: [layer], tracks: [{ partId: layer.id, channels: {} as never }],
} as SceneData);

type Generated = HTMLElement & { _render: () => void };
let counter = 0;
const runtimeMarkup = (authored: SceneData): string => {
  const source = generateGraphicModule(authored);
  const Graphic = new Function('HTMLElement', source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href'))(HTMLElement) as new () => Generated;
  counter += 1;
  customElements.define(`x-layer-fx-${counter}`, Graphic);
  const graphic = document.createElement(`x-layer-fx-${counter}`) as Generated;
  graphic._render();
  return graphic.innerHTML;
};
const filterBody = (markup: string) => (/<filter[^>]*>([\s\S]*?)<\/filter>/u.exec(markup) ?? [])[1];

describe('every exporter draws the effects', () => {
  const effects: Array<[string, Partial<SceneLayer>]> = [
    ['a drop shadow (missing from exports before)', { shadowColor: '#000000', shadowBlur: 5, shadowOffsetY: 6 }],
    ['a glow and a blur', { glowColor: '#00ffcc', glowSize: 9, glowStrength: 0.7, layerBlur: 2 }],
  ];
  for (const [label, fields] of effects) {
    it(label, () => {
      const authored = scene(rect(fields));
      const expected = filterBody(layerFilterMarkup(fields, 'x'));
      expect(expected).toBeTruthy();
      expect(filterBody(renderOGrafSvg(evaluateOGrafScene(authored, 0)))).toBe(expected);
      expect(filterBody(runtimeMarkup(authored))).toBe(expected);
    });
  }

  it('a blend mode reaches the static SVG and the runtime', () => {
    const authored = scene(rect({ blendMode: 'screen' }));
    expect(renderOGrafSvg(evaluateOGrafScene(authored, 0))).toContain('style="mix-blend-mode:screen"');
    expect(runtimeMarkup(authored)).toContain('style="mix-blend-mode:screen"');
  });

  it('a plain layer gets no filter and no blend', () => {
    const markup = runtimeMarkup(scene(rect({})));
    expect(markup).not.toContain('<filter');
    expect(markup).not.toContain('mix-blend-mode');
  });

  it('the runtime runs the embedded source of the same helper', () => {
    const embedded = new Function(`return ${runtimeLayerEffects()}`)() as { layerFilterMarkup: typeof layerFilterMarkup };
    const fields = { glowColor: '#123456', glowSize: 4, shadowColor: '#000', layerBlur: 1 };
    expect(embedded.layerFilterMarkup(fields, 'q')).toBe(layerFilterMarkup(fields, 'q'));
  });
});

describe('the scene file', () => {
  it('keeps effects and refuses an unknown blend mode', () => {
    expect(validateImportedDocument(JSON.stringify(scene(rect({ glowColor: '#fff', glowSize: 4, blendMode: 'multiply', layerBlur: 2 }))))).toMatchObject({ ok: true });
    expect(validateImportedDocument(JSON.stringify(scene(rect({ blendMode: 'dissolve' as never })))).ok).toBe(false);
    expect(validateImportedDocument(JSON.stringify(scene(rect({ glowSize: 'big' as never })))).ok).toBe(false);
  });
});
