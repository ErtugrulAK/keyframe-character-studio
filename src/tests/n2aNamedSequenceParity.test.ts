// N2a — named-sequence runtime parity.
//
// The generated runtime filters keyframes by the scene's persisted
// `activeTemplateId`, but the SSR/GIF default path (`evaluateSceneFrame` with
// no sequence argument, called by the animated-GIF exporter frame-by-frame)
// hardcoded 'Sequence', so an animated export of a scene with an active named
// sequence silently dropped the authored sequence. Expected values below are
// hand arithmetic on linear channels over the 320x180 artboard (origin 160,90),
// independently of any implementation.

import { describe, expect, test } from 'vitest';
import type { AnimationTrackData, PropertyKeyframe } from '../types/animator';
import type { SceneData, SceneLayer } from '../types/composition';
import { evaluateSceneFrame, evaluateOGrafScene } from '../ograf/evaluation';
import { compileOGrafPackage } from '../ograf/packageCompiler';
import { renderOGrafSvg } from '../ograf/svgRenderer';

function layer(): SceneLayer {
  return {
    id: 'shape',
    name: 'Shape',
    type: 'custom_rect',
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    visible: true,
    zIndex: 0,
    fillColor: '#ff0000',
    strokeColor: '#000000',
    fillEnabled: true,
    strokeEnabled: true,
    strokeWidth: 4,
    strokeAlignment: 'inside',
    trimPathEnabled: true,
    trimPathStart: 0.2,
    trimPathEnd: 0.8,
    trimPathOffset: 45,
  };
}

function dualTrack(): AnimationTrackData {
  const x: PropertyKeyframe[] = [
    { id: 'sequence-0', frame: 0, value: 20, easing: 'linear', templateId: 'Sequence' },
    { id: 'sequence-1', frame: 60, value: 40, easing: 'linear', templateId: 'Sequence' },
    { id: 'named-0', frame: 0, value: 100, easing: 'linear', templateId: 'Named' },
    { id: 'named-1', frame: 60, value: 140, easing: 'linear', templateId: 'Named' },
  ];
  return {
    partId: 'shape',
    channels: {
      x,
      y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
      maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
      trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
    },
  };
}

function sceneFor(activeTemplateId?: string): SceneData {
  return {
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    name: 'N2a Parity',
    width: 320,
    height: 180,
    fps: 60,
    totalFrames: 60,
    layers: [layer()],
    tracks: [dualTrack()],
    ...(activeTemplateId === undefined ? {} : { activeTemplateId }),
  };
}

// Hand arithmetic (linear, artboard origin 160,90), frame 30 of 0..60:
// Sequence: 20→40 ⇒ 30    ⇒ translate(190 90)
// Named:   100→140 ⇒ 120  ⇒ translate(280 90)
// No matching keys ⇒ authored base pose x=0 ⇒ translate(160 90)
const SEQUENCE_AT_30 = 'translate(190 90)';
const NAMED_AT_30 = 'translate(280 90)';
const BASE_POSE_AT_30 = 'translate(160 90)';

type GeneratedGraphic = HTMLElement & {
  _currentFrame: number;
  _render: () => void;
  load: (params: { renderType: 'realtime'; data?: unknown }) => Promise<Record<string, unknown>>;
  dispose: (params?: never) => Promise<Record<string, unknown>>;
};

let graphicCounter = 0;

function instantiateGraphic(source: string): GeneratedGraphic {
  const Graphic = new Function('HTMLElement', `${source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href')}`)(HTMLElement) as unknown as new () => GeneratedGraphic;
  graphicCounter += 1;
  const tagName = `x-ograf-n2a-${graphicCounter}`;
  customElements.define(tagName, Graphic);
  return document.createElement(tagName) as GeneratedGraphic;
}

describe('N2a — active named sequence drives the SSR/GIF default', () => {
  test('SSR default follows the scene activeTemplateId instead of hardcoded Sequence', () => {
    const svg = renderOGrafSvg(evaluateOGrafScene(sceneFor('Named'), 30));
    expect(svg).toContain(NAMED_AT_30);
  });

  test('the exact GIF frame call (no sequence argument) evaluates the active sequence', () => {
    const evaluated = evaluateSceneFrame(sceneFor('Named'), 30);
    expect(evaluated.layers[0].transform.x).toBe(120);
  });

  test('an explicit Sequence override still wins over the active named sequence', () => {
    const svg = renderOGrafSvg(evaluateOGrafScene(sceneFor('Named'), 30, { sequenceId: 'Sequence' }));
    expect(svg).toContain(SEQUENCE_AT_30);
  });

  test('a scene without activeTemplateId keeps the historical Sequence default', () => {
    const svg = renderOGrafSvg(evaluateOGrafScene(sceneFor(undefined), 30));
    expect(svg).toContain(SEQUENCE_AT_30);
  });

  test('an empty activeTemplateId falls back to Sequence, as the runtime does', () => {
    const svg = renderOGrafSvg(evaluateOGrafScene(sceneFor(''), 30));
    expect(svg).toContain(SEQUENCE_AT_30);
  });

  test('a named sequence with no authored keys yields the authored base pose on both sides', async () => {
    const authored = sceneFor('Ghost');
    const svg = renderOGrafSvg(evaluateOGrafScene(authored, 30));
    expect(svg).toContain(BASE_POSE_AT_30);

    const plan = compileOGrafPackage(authored);
    const source = plan.files.find((file) => file.path === 'graphic.mjs')?.content || '';
    const graphic = instantiateGraphic(source);
    await graphic.load({ renderType: 'realtime', data: {} });
    graphic._currentFrame = 30;
    graphic._render();
    expect(graphic.innerHTML).toContain(BASE_POSE_AT_30);
    await graphic.dispose();
  });

  test('generated runtime and SSR default agree frame by frame on the active sequence', async () => {
    const authored = sceneFor('Named');
    const plan = compileOGrafPackage(authored);
    const source = plan.files.find((file) => file.path === 'graphic.mjs')?.content || '';
    const graphic = instantiateGraphic(source);
    await graphic.load({ renderType: 'realtime', data: {} });

    // Hand arithmetic per frame: Named 100→140 linear over 0..60.
    for (const [frame, translation] of [
      [0, 'translate(260 90)'],
      [15, 'translate(270 90)'],
      [30, 'translate(280 90)'],
      [45, 'translate(290 90)'],
      [60, 'translate(300 90)'],
    ] as const) {
      graphic._currentFrame = frame;
      graphic._render();
      expect(graphic.innerHTML).toContain(translation);
      expect(renderOGrafSvg(evaluateOGrafScene(authored, frame))).toContain(translation);
    }
    await graphic.dispose();
  });

  test('explicit sequenceId option behaves identically to the new default when they match', () => {
    const viaOption = renderOGrafSvg(evaluateOGrafScene(sceneFor('Named'), 30, { sequenceId: 'Named' }));
    const viaDefault = renderOGrafSvg(evaluateOGrafScene(sceneFor('Named'), 30));
    expect(viaOption).toBe(viaDefault);
    expect(viaOption).toContain(NAMED_AT_30);
  });
});
