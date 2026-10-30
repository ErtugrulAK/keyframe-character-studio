/**
 * Every text path draws its glyphs on the baseline, as the stage does.
 *
 * The stage's non-staggered text, its outline trace and its selection bounds put
 * the baseline on the layer origin (no dominant-baseline). The text matte mask,
 * the OGraf/GIF static renderer, the OGraf runtime and staggered text used
 * dominant-baseline="middle", which put their glyphs about a quarter of a line
 * lower than the text the user sees. The pixel side is in
 * e2e/text-baseline-parity.spec.ts.
 */

import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { CharacterPart } from '../types/animator';
import type { SceneData, SceneLayer } from '../types/composition';
import { renderTextOrClonerPart } from '../components/Canvas/renderers/parts/TextAndClonerRenderers';
import { renderOGrafSvg } from '../ograf/svgRenderer';
import { evaluateOGrafScene } from '../ograf/evaluation';
import { generateGraphicModule } from '../ograf/runtimeTemplate';

const textLayer: SceneLayer = {
  id: 'headline', name: 'Headline', type: 'custom_text',
  x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1,
  fillColor: '#ffffff', strokeColor: '#000000', fillEnabled: true, strokeEnabled: false, strokeWidth: 0,
  textValue: 'HHH', fontSize: 80, fontFamily: 'Arial',
};

const scene: SceneData = {
  version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Baseline',
  width: 400, height: 300, fps: 30, totalFrames: 30,
  layers: [textLayer], tracks: [{ partId: 'headline', channels: {} as never }],
};

type GeneratedGraphic = HTMLElement & { _render: () => void };

const runtimeMarkup = (authored: SceneData): string => {
  const source = generateGraphicModule(authored);
  const Graphic = new Function('HTMLElement', `${source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href')}`)(HTMLElement) as unknown as new () => GeneratedGraphic;
  customElements.define('x-ograf-text-baseline', Graphic);
  const graphic = document.createElement('x-ograf-text-baseline') as GeneratedGraphic;
  graphic._render();
  return graphic.innerHTML;
};

const stageText = (overrides: Partial<CharacterPart>): string => renderToString(
  renderTextOrClonerPart({
    part: { ...textLayer, ...overrides } as unknown as CharacterPart,
    fill: '#ffffff',
    stroke: 'none',
    isSelected: false,
    currentFrame: 0,
  }) as React.ReactElement,
);

/** The opening tag of the (only) <text> element in the markup. */
const textTag = (markup: string): string => {
  const match = /<text\b[^>]*>/u.exec(markup);
  if (!match) throw new Error('no <text> element in the markup');
  return match[0];
};

describe('text sits on its baseline in every renderer', () => {
  it('the stage text is the reference: centred, baseline on the origin', () => {
    const tag = textTag(stageText({}));
    expect(tag).toContain('text-anchor="middle"');
    expect(tag).toContain('y="0"');
    expect(tag).not.toContain('dominant-baseline');
  });

  it('staggered stage text uses the same baseline', () => {
    expect(textTag(stageText({ textAnimMode: 'chars' }))).not.toContain('dominant-baseline');
    expect(textTag(stageText({ textAnimMode: 'words' }))).not.toContain('dominant-baseline');
  });

  it('the OGraf/GIF static renderer uses the same baseline', () => {
    const tag = textTag(renderOGrafSvg(evaluateOGrafScene(scene, 0)));
    expect(tag).toContain('text-anchor="middle"');
    expect(tag).toContain('y="0"');
    expect(tag).not.toContain('dominant-baseline');
  });

  it('the OGraf runtime uses the same baseline', () => {
    const tag = textTag(runtimeMarkup(scene));
    expect(tag).toContain('text-anchor="middle"');
    expect(tag).toContain('y="0"');
    expect(tag).not.toContain('dominant-baseline');
  });
});
