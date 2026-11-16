import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CharacterPart } from '../types/animator';
import type { SceneData, SceneLayer } from '../types/composition';
import { renderTextOrClonerPart } from '../components/Canvas/renderers/parts/TextAndClonerRenderers';
import { evaluateOGrafScene } from '../ograf/evaluation';
import { generateGraphicModule } from '../ograf/runtimeTemplate';
import { renderOGrafSvg } from '../ograf/svgRenderer';
import { describeText } from '../utils/layers/drawDescriptor';
import { textMaskContent } from '../utils/layers/matte';
import { applyTextCase, isTextCase } from '../utils/layers/textCase';
import { validateImportedDocument } from '../utils/persistence/importValidation';

const textLayer = (overrides: Partial<SceneLayer> = {}): SceneLayer => ({
  id: 'title', name: 'Title', type: 'custom_text',
  x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  textValue: 'Goal for Ankara', fontSize: 48, fontFamily: 'Outfit', fillColor: '#ffffff', strokeColor: '#000000', textOrigin: 'center',
  ...overrides,
} as SceneLayer);

const sceneWith = (layer: SceneLayer): SceneData => ({
  version: 2, coordinateSystem: 'project-unit-center-v1', name: 'Caps', width: 640, height: 360, fps: 30, totalFrames: 60,
  layers: [layer], tracks: [],
});

/** The characters of the text drawn for the layer `id` (its effect's hidden tail included). */
const textIn = (markup: string, id: string): string => {
  const at = markup.indexOf(`data-layer-id="${id}"`);
  const from = at < 0 ? markup : markup.slice(at);
  const run = /<text[^>]*>([\s\S]*?)<\/text>/u.exec(from)?.[1] ?? '';
  return run.replace(/<[^>]+>/gu, '');
};

type Generated = HTMLElement & { _render: () => void; _currentFrame: number };
let counter = 0;
/** The generated graphic module (the same source a package carries), drawn at `frame`. */
const runtimeText = (authored: SceneData, frame: number): string => {
  const source = generateGraphicModule(authored);
  const Graphic = new Function('HTMLElement', source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href'))(HTMLElement) as new () => Generated;
  counter += 1;
  customElements.define(`x-text-case-${counter}`, Graphic);
  const graphic = document.createElement(`x-text-case-${counter}`) as Generated;
  graphic._currentFrame = frame;
  graphic._render();
  return textIn(graphic.innerHTML, 'title');
};

describe('all caps', () => {
  it('shows capitals and keeps the written text; only "upper" is a case', () => {
    expect(applyTextCase('Goal for Ankara', 'upper')).toBe('GOAL FOR ANKARA');
    expect(applyTextCase('Goal for Ankara', undefined)).toBe('Goal for Ankara');
    expect(isTextCase('upper')).toBe(true);
    for (const value of ['lower', 'UPPER', 1, null]) expect(isTextCase(value)).toBe(false);
    // The draw descriptor (shared by the editor, the static SVG and the runtime).
    expect(describeText({ textValue: 'Score', textCase: 'upper' }, 0).text).toBe('SCORE');
    expect(describeText({ textValue: 'Score' }, 0).text).toBe('Score');
    // The matte cut from a text cuts the capitals.
    expect(textMaskContent({ textValue: 'Score', textCase: 'upper' } as CharacterPart)?.content).toBe('SCORE');
  });

  it('the editor, the static SVG and the OGraf runtime draw the same capitals', async () => {
    const part = { id: 'title', type: 'custom_text', textValue: 'Goal for Ankara', textCase: 'upper', fontSize: 48, fillColor: '#ffffff', strokeColor: '#000000', baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } } as unknown as CharacterPart;
    const editor = render(<svg>{renderTextOrClonerPart({ part, fill: '#ffffff', stroke: '#000000', isSelected: false, currentFrame: 0 })}</svg>);
    expect(editor.container.querySelector('text')?.textContent).toBe('GOAL FOR ANKARA');
    editor.unmount();

    const authored = sceneWith(textLayer({ textCase: 'upper' }));
    expect(textIn(renderOGrafSvg(evaluateOGrafScene(authored, 0)), 'title')).toBe('GOAL FOR ANKARA');
    expect(runtimeText(authored, 0)).toBe('GOAL FOR ANKARA');
  });

  it('a typewriter types the capitals, the same in the static SVG and the runtime', async () => {
    const authored = sceneWith(textLayer({ textCase: 'upper', textValue: 'go team', textEffect: { kind: 'typewriter', startFrame: 0, durationFrames: 30 } } as Partial<SceneLayer>));
    const evaluated = evaluateOGrafScene(authored, 15).layers.find((layer) => layer.id === 'title')!;
    const written = sceneWith(textLayer({ textValue: 'go team', textEffect: { kind: 'typewriter', startFrame: 0, durationFrames: 30 } } as Partial<SceneLayer>));
    const asWritten = evaluateOGrafScene(written, 15).layers.find((layer) => layer.id === 'title')!.content.displayedText!;
    // The same letters revealed at the same frame, in capitals.
    expect(asWritten.shown.length).toBeGreaterThan(0);
    expect(evaluated.content.displayedText).toEqual({ ...asWritten, shown: asWritten.shown.toUpperCase(), hidden: asWritten.hidden.toUpperCase() });
    // Shown + hidden tail: the whole run, in capitals.
    expect(textIn(renderOGrafSvg(evaluateOGrafScene(authored, 15)), 'title')).toBe('GO TEAM');
    expect(runtimeText(authored, 15)).toBe('GO TEAM');
  });

  it('a text without the setting draws exactly as written', async () => {
    const authored = sceneWith(textLayer());
    expect(textIn(renderOGrafSvg(evaluateOGrafScene(authored, 0)), 'title')).toBe('Goal for Ankara');
    expect(runtimeText(authored, 0)).toBe('Goal for Ankara');
  });

  it('a saved setting opens again; any other case is refused whole', () => {
    expect(validateImportedDocument(JSON.stringify(sceneWith(textLayer({ textCase: 'upper' })))).ok).toBe(true);
    for (const textCase of ['lower', 'UPPER', 1]) {
      expect(validateImportedDocument(JSON.stringify(sceneWith(textLayer({ textCase: textCase as SceneLayer['textCase'] })))).ok).toBe(false);
    }
  });
});
