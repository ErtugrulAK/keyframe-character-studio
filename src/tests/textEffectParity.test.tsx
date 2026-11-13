/**
 * A text effect shows the same characters on the stage, in the static SVG and
 * in the generated OGraf graphic at every frame: all three take them from the
 * one authority (`utils/animation/textEffects`), the runtime through its
 * embedded source.
 */
import { describe, expect, it } from 'vitest';
import type { SceneData, SceneLayer } from '../types/composition';
import type { TextEffect } from '../utils/animation/textEffects';
import { resolveDisplayedText } from '../utils/animation/textEffects';
import { generateGraphicModule } from '../ograf/runtimeTemplate';
import { renderOGrafSvg } from '../ograf/svgRenderer';
import { evaluateOGrafScene } from '../ograf/evaluation';
import { runtimeTextEffects } from '../ograf/runtimeSnippets';
import { validateImportedDocument } from '../utils/persistence/importValidation';

const textLayer = (textValue: string, textEffect: TextEffect): SceneLayer => ({
  id: 'title', name: 'Title', type: 'custom_text', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, fillColor: '#ffffff', strokeColor: '#000000', textValue, fontSize: 48, textEffect,
} as SceneLayer);

const scene = (layer: SceneLayer): SceneData => ({
  version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Effects', width: 400, height: 300, fps: 30, totalFrames: 60,
  layers: [layer], tracks: [{ partId: layer.id, channels: {} as never }],
} as SceneData);

type Generated = HTMLElement & { _render: () => void; _currentFrame: number };
let counter = 0;
const runtimeAt = (authored: SceneData, frame: number): string => {
  const source = generateGraphicModule(authored);
  const Graphic = new Function('HTMLElement', source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href'))(HTMLElement) as new () => Generated;
  counter += 1;
  customElements.define(`x-text-effect-${counter}`, Graphic);
  const graphic = document.createElement(`x-text-effect-${counter}`) as Generated;
  graphic._currentFrame = frame;
  graphic._render();
  return graphic.innerHTML;
};

const textOf = (markup: string) => {
  const match = /<text[^>]*>([\s\S]*?)<\/text>/u.exec(markup);
  if (!match) throw new Error('no text drawn');
  const hidden = /<tspan[^>]*fill-opacity="0"[^>]*>([\s\S]*?)<\/tspan>/u.exec(match[1]);
  return { shown: match[1].replace(/<tspan[\s\S]*$/u, ''), hidden: hidden ? hidden[1] : '' };
};

describe('text effects agree in every path', () => {
  const cases: Array<[string, TextEffect]> = [
    ['HELLO WORLD', { kind: 'typewriter', startFrame: 0, durationFrames: 22 }],
    ['Score 1.250', { kind: 'count', startFrame: 5, durationFrames: 20, from: 900 }],
  ];
  for (const [text, effect] of cases) {
    it(`${effect.kind}: editor evaluation, static SVG and runtime draw the same characters`, () => {
      const authored = scene(textLayer(text, effect));
      for (const frame of [0, 4, 11, 17, 30]) {
        const expected = resolveDisplayedText(text, effect, frame);
        const evaluated = evaluateOGrafScene(authored, frame).layers[0];
        expect(evaluated.content.displayedText, `evaluation @${frame}`).toEqual(expected);
        expect(textOf(renderOGrafSvg(evaluateOGrafScene(authored, frame))), `static @${frame}`).toEqual(expected);
        expect(textOf(runtimeAt(authored, frame)), `runtime @${frame}`).toEqual(expected);
      }
    });
  }

  it('the runtime runs the embedded source of the same helper', () => {
    const embedded = new Function(`return ${runtimeTextEffects()}`)() as { resolveDisplayedText: typeof resolveDisplayedText };
    for (const frame of [0, 3, 9]) {
      expect(embedded.resolveDisplayedText('€3,50', { kind: 'count', startFrame: 0, durationFrames: 9 }, frame))
        .toEqual(resolveDisplayedText('€3,50', { kind: 'count', startFrame: 0, durationFrames: 9 }, frame));
    }
  });

  it('a text without an effect is drawn as written, with no hidden part', () => {
    const plain = scene({ ...textLayer('Plain', { kind: 'typewriter', startFrame: 0, durationFrames: 1 }), textEffect: undefined });
    expect(evaluateOGrafScene(plain, 0).layers[0].content.displayedText).toBeUndefined();
    expect(textOf(runtimeAt(plain, 0))).toEqual({ shown: 'Plain', hidden: '' });
  });
});

describe('the scene file keeps a text effect, and refuses a broken one', () => {
  it('accepts a typewriter and a count', () => {
    for (const effect of [{ kind: 'typewriter', startFrame: 0, durationFrames: 10 }, { kind: 'count', startFrame: 2, durationFrames: 8, from: -5 }]) {
      expect(validateImportedDocument(JSON.stringify(scene(textLayer('7', effect as TextEffect)))).ok).toBe(true);
    }
  });

  it('refuses an unknown kind or a negative length', () => {
    for (const effect of [{ kind: 'spin', startFrame: 0, durationFrames: 10 }, { kind: 'count', startFrame: 0, durationFrames: -1 }, { kind: 'count', startFrame: 0, durationFrames: 5, from: 'x' }]) {
      const result = validateImportedDocument(JSON.stringify(scene(textLayer('7', effect as unknown as TextEffect))));
      expect(result.ok).toBe(false);
    }
  });
});
