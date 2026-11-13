/**
 * The stage, the static SVG renderer and the OGraf runtime paint every layer
 * from the same draw descriptors (`utils/layers/drawDescriptor`), so for one layer
 * they write the same paint and text attributes.
 *
 * Before, the runtime wrote its own: text in sans-serif with a 1.5 outline
 * (the editor: Outfit, 0.5), a legacy outline the editor suppresses, opacity
 * outside 0..1, every outline masked to its outside half (a centred stroke
 * drew outside), and repeated attributes the browser resolved to the first.
 */
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import type React from 'react';
import type { CharacterPart } from '../types/animator';
import type { SceneData, SceneLayer } from '../types/composition';
import { renderOGrafSvg } from '../ograf/svgRenderer';
import { evaluateOGrafScene } from '../ograf/evaluation';
import { generateGraphicModule } from '../ograf/runtimeTemplate';
import { renderTextOrClonerPart } from '../components/Canvas/renderers/parts/TextAndClonerRenderers';
import { renderShapePart } from '../components/Canvas/renderers/parts/ShapePartRenderers';

const base = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#ff0000', strokeColor: '#000000' };

const sceneOf = (layer: SceneLayer): SceneData => ({
  version: 1, coordinateSystem: 'project-unit-center-v1', name: 's', width: 400, height: 300, fps: 30, totalFrames: 30,
  layers: [layer], tracks: [{ partId: layer.id, channels: {} as never }],
} as SceneData);

const runtimeMarkup = (scene: SceneData): string => {
  const source = generateGraphicModule(scene).replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', JSON.stringify('https://example.test/'));
  class Host { innerHTML = ''; }
  const graphic = new (new Function('HTMLElement', source)(Host))() as Host & { _render: () => void };
  graphic._render();
  return graphic.innerHTML;
};

/** Every opening tag outside <defs>, as name -> attribute map; repeated attributes fail the test. */
const paintedTags = (markup: string, tag: string): Array<Record<string, string>> => {
  const body = markup.replace(/<defs>.*?<\/defs>/gsu, '');
  return [...body.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'gu'))].map((match) => {
    const attributes: Record<string, string> = {};
    for (const [, name, value] of match[1].matchAll(/ ([a-zA-Z:-]+)="([^"]*)"/gu)) {
      expect(attributes, `repeated ${name} on <${tag}>`).not.toHaveProperty(name);
      attributes[name] = value;
    }
    return attributes;
  });
};

const PAINT = ['fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width'];
const TEXT = [...PAINT, 'y', 'font-size', 'font-weight', 'font-family'];
const pick = (attributes: Record<string, string>, names: string[]) => Object.fromEntries(names.map((name) => [name, attributes[name]]));

const shapes: Array<[string, Partial<SceneLayer>, string]> = [
  ['legacy rect with a custom outline colour', { type: 'custom_rect' }, 'rect'],
  ['legacy rect with the default outline colour', { type: 'custom_rect', strokeColor: '#101218' }, 'rect'],
  ['legacy triangle', { type: 'custom_triangle' }, 'polygon'],
  ['legacy capsule', { type: 'custom_capsule' }, 'rect'],
  ['modern circle', { type: 'custom_circle', fillEnabled: true, strokeEnabled: true, strokeWidth: 4 }, 'circle'],
  ['out-of-range opacity and width', { type: 'custom_rect', fillEnabled: true, strokeEnabled: true, fillOpacity: 1.7, strokeOpacity: -1, strokeWidth: -2 }, 'rect'],
  ['inside outline', { type: 'custom_rect', fillEnabled: true, strokeEnabled: true, strokeWidth: 6, strokeAlignment: 'inside' }, 'rect'],
  ['outside outline', { type: 'custom_star', fillEnabled: true, strokeEnabled: true, strokeWidth: 6, strokeAlignment: 'outside' }, 'polygon'],
  ['outline switched off', { type: 'custom_diamond', fillEnabled: false, strokeEnabled: false }, 'polygon'],
];

const texts: Array<[string, Partial<SceneLayer>]> = [
  ['legacy text', { textValue: 'Hi' }],
  ['modern text with an outline', { textValue: 'Hi', fillEnabled: true, strokeEnabled: true, strokeWidth: 2 }],
  ['text without an outline, centred origin', { textValue: 'Hi', fillEnabled: true, strokeEnabled: false, textOrigin: 'center', fontSize: 80 }],
  ['text in another font', { textValue: 'Hi', fontFamily: 'Arial', fillOpacity: 0.4 }],
];

describe('one draw descriptor, three renderers', () => {
  it.each(shapes)('paints a %s the same in the static renderer and the runtime', (_label, overrides, tag) => {
    const scene = sceneOf({ ...base, id: 'a', name: 'a', ...overrides } as SceneLayer);
    const staticTags = paintedTags(renderOGrafSvg(evaluateOGrafScene(scene, 0)), tag);
    const runtimeTags = paintedTags(runtimeMarkup(scene), tag);
    // Same number of drawn copies: one for a centred outline, fill + outline for inside/outside.
    expect(runtimeTags.length).toBe(staticTags.length);
    runtimeTags.forEach((attributes, index) => expect(pick(attributes, [...PAINT, 'vector-effect'])).toEqual(pick(staticTags[index], [...PAINT, 'vector-effect'])));
  });

  it.each(texts)('writes %s the same on the stage, in the static renderer and in the runtime', (_label, overrides) => {
    const layer = { ...base, id: 'a', name: 'a', type: 'custom_text', ...overrides } as SceneLayer;
    const scene = sceneOf(layer);
    const [staticText] = paintedTags(renderOGrafSvg(evaluateOGrafScene(scene, 0)), 'text');
    const [runtimeText] = paintedTags(runtimeMarkup(scene), 'text');
    const stage = renderToString(renderTextOrClonerPart({ part: layer as unknown as CharacterPart, fill: layer.fillColor as string, stroke: 'none', isSelected: false, currentFrame: 0 }) as React.ReactElement);
    const [stageText] = paintedTags(stage, 'text');
    expect(pick(runtimeText, TEXT)).toEqual(pick(staticText, TEXT));
    // The stage paints with the renderer's resolved fill (a gradient may replace it), so compare it where it is a colour.
    expect(pick(stageText, TEXT)).toEqual(pick(staticText, TEXT));
  });

  // The corner radius follows the editor: a box and a rectangle take the
  // authored radius, a capsule keeps its fixed round ends whatever is authored.
  // The runtime drew a box square; the static renderer rounded a capsule's ends to the authored radius.
  const corners: Array<[string, Partial<SceneLayer>]> = [
    ['rounded box', { type: 'custom_box', borderRadius: 12 }],
    ['rounded rect', { type: 'custom_rect', borderRadius: 12 }],
    ['capsule with an authored radius', { type: 'custom_capsule', borderRadius: 5 }],
    ['modern rounded box', { type: 'custom_box', borderRadius: 8, fillEnabled: true, strokeEnabled: false }],
    ['modern capsule with an authored radius', { type: 'custom_capsule', borderRadius: 5, fillEnabled: true, strokeEnabled: false }],
  ];
  const GEOMETRY = ['x', 'y', 'width', 'height', 'rx'];

  it.each(corners)('gives a %s editor corners in the static renderer and the runtime', (_label, overrides) => {
    const layer = { ...base, id: 'a', name: 'a', ...overrides } as SceneLayer;
    const scene = sceneOf(layer);
    const stage = renderToString(renderShapePart({ part: layer as unknown as CharacterPart, fill: layer.fillColor as string, stroke: 'none', isSelected: false }) as React.ReactElement);
    // The stage may add a transparent hit rect; every rect it draws has the same corners.
    const [stageRect] = paintedTags(stage, 'rect');
    const [staticRect] = paintedTags(renderOGrafSvg(evaluateOGrafScene(scene, 0)), 'rect');
    const [runtimeRect] = paintedTags(runtimeMarkup(scene), 'rect');
    expect(pick(staticRect, GEOMETRY)).toEqual(pick(stageRect, GEOMETRY));
    expect(pick(runtimeRect, GEOMETRY)).toEqual(pick(stageRect, GEOMETRY));
  });
});
