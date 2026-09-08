import { describe, expect, test } from 'vitest';
import type { AnimationTrackData, BezierPath, LayerMask, PathKeyframe } from '../types/animator';
import type { SceneData, SceneLayer } from '../types/composition';
import { layerMaskPathChannel } from '../types/animator';
import { compileOGrafPackage } from '../ograf/packageCompiler';
import { evaluateOGrafScene } from '../ograf/evaluation';
import { renderOGrafSvg } from '../ograf/svgRenderer';

const makePath = (offset: number, tangent = false): BezierPath => ({
  version: 1,
  coordinateSpace: 'normalized',
  closed: true,
  points: [
    { id: 'a', x: 0.2 + offset, y: 0.2, ...(tangent ? { handleOut: { x: 0.35 + offset, y: 0.2 } } : {}) },
    { id: 'b', x: 0.8, y: 0.2, ...(tangent ? { handleIn: { x: 0.65, y: 0.2 } } : {}) },
    { id: 'c', x: 0.8, y: 0.8 },
    { id: 'd', x: 0.2 + offset, y: 0.8 },
  ],
});

const channels = (): AnimationTrackData['channels'] => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const mask = (id: string, mode: LayerMask['mode']): LayerMask => ({
  id,
  name: id,
  path: makePath(0, true),
  mode,
  inverted: mode === 'difference',
  opacity: 0.8,
  feather: 2,
  expansion: mode === 'subtract' ? -1 : 1,
});

const layer = (overrides: Partial<SceneLayer> = {}): SceneLayer => ({
  id: 'target', name: 'Target', type: 'custom_rect', x: 0, y: 0, rotation: 0,
  scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#ffffff', strokeColor: '#000000', width: 120, height: 80,
  ...overrides,
});

function makeScene(): SceneData {
  const targetMaskKeys: PathKeyframe[] = [
    { id: 'mask-path-0', frame: 0, value: makePath(0, true), easing: 'linear' },
    { id: 'mask-path-10', frame: 10, value: makePath(0.2, true), easing: 'linear' },
  ];
  return {
    version: 2,
    coordinateSystem: 'project-unit-center-v1',
    name: 'OGraf V6 Parity', width: 320, height: 180, fps: 60, totalFrames: 10,
    layers: [
      layer({ id: 'source', name: 'Source', zIndex: 0, fillColor: '#ffffff' }),
      layer({
        id: 'target',
        masks: [mask('add', 'add'), mask('subtract', 'subtract'), mask('intersect', 'intersect'), mask('difference', 'difference')],
        trackMatte: { sourceLayerId: 'source', mode: 'alpha', inverted: false, sourceVisible: false },
      }),
    ],
    tracks: [{
      partId: 'target',
      channels: channels(),
      maskPathChannels: { [layerMaskPathChannel('add')]: targetMaskKeys },
      maskChannels: {
        'add:opacity': [
          { id: 'opacity-0', frame: 0, value: 0.2, easing: 'linear' },
          { id: 'opacity-10', frame: 10, value: 1, easing: 'linear' },
        ],
      },
    }],
  };
}

describe('OGraf V6 compositor parity', () => {
  test('emits animated cubic mask paths, all mask modes, and alpha matte semantics', () => {
    const scene = makeScene();
    const midpoint = renderOGrafSvg(evaluateOGrafScene(scene, 5));
    expect(midpoint).toContain('kcs-ograf-layer-mask-target-add-add');
    expect(midpoint).toContain('kcs-ograf-layer-mask-target-subtract');
    expect(midpoint).toContain('kcs-ograf-layer-mask-target-intersect');
    expect(midpoint).toContain('kcs-ograf-layer-mask-target-difference');
    expect(midpoint).toContain('data-mask-operation="difference"');
    expect(midpoint).toContain('kcs-ograf-layer-mask-target-difference-inverse');
    expect(midpoint).toContain('kcs-ograf-layer-mask-target-intersect-inverse');
    expect(midpoint).toContain('C');
    expect(midpoint).toContain('kcs-ograf-track-matte-target-source-alpha');
    expect(midpoint).not.toContain('data-layer-id="source"');
    expect(midpoint).toContain('fill-opacity="0.6000000000000001"');
  });

  test('generated runtime matches canonical V6 path and compositor invariants', async () => {
    const scene = makeScene();
    const plan = compileOGrafPackage(scene);
    expect(plan.status).toBe('ready-to-materialize');
    const source = plan.files.find((file) => file.path === 'graphic.mjs')?.content || '';
    const Graphic = new Function('HTMLElement', `${source.replace('export default class Graphic', 'return class Graphic')}`)(HTMLElement) as new () => HTMLElement & { load: (params: { renderType: 'realtime' }) => Promise<unknown>; _scene: SceneData; _currentFrame: number; _render: () => void };
    const tag = `x-ograf-v6-${Date.now()}`;
    customElements.define(tag, Graphic);
    const graphic = document.createElement(tag);
    document.body.appendChild(graphic);
    await graphic.load({ renderType: 'realtime' });
    graphic._currentFrame = 5;
    graphic._render();
    const canonical = renderOGrafSvg(evaluateOGrafScene(scene, 5));
    expect(canonical).toContain('kcs-ograf-layer-mask-target-add-add');
    expect(graphic.innerHTML).toContain('kcs-ograf-layer-mask-target-add-add');
    expect(graphic.innerHTML).toContain('kcs-ograf-track-matte-target-source-alpha');
    expect(graphic.innerHTML).toContain('C');
    for (const mode of ['add-add', 'subtract', 'intersect', 'difference']) {
      expect(graphic.innerHTML).toContain(`kcs-ograf-layer-mask-target-${mode}`);
    }
  });
});
