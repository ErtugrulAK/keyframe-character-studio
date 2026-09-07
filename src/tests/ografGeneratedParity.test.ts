import { describe, expect, test } from 'vitest';
import type { AnimationTrackData, PropertyKeyframe } from '../types/animator';
import type { SceneData, SceneLayer } from '../types/composition';
import { evaluateOGrafScene } from '../ograf/evaluation';
import { compileOGrafPackage } from '../ograf/packageCompiler';
import { renderOGrafSvg } from '../ograf/svgRenderer';

function layer(overrides: Partial<SceneLayer> = {}): SceneLayer {
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
    ...overrides,
  };
}

function track(partId: string, x: PropertyKeyframe[]): AnimationTrackData {
  return {
    partId,
    channels: {
      x,
      y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
      maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
      trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
    },
  };
}

function scene(layers: SceneLayer[], tracks: AnimationTrackData[] = []): SceneData {
  return {
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    name: 'Generated Parity',
    width: 320,
    height: 180,
    fps: 60,
    totalFrames: 60,
    layers,
    tracks,
  };
}

type GeneratedGraphic = HTMLElement & {
  load: (params: { renderType: 'realtime'; data?: unknown }) => Promise<Record<string, unknown>>;
  dispose: () => Promise<Record<string, unknown>>;
  playAction: (params: { skipAnimation?: boolean }) => Promise<Record<string, unknown>>;
};

let graphicCounter = 0;
function instantiateGraphic(source: string): GeneratedGraphic {
  const Graphic = new Function('HTMLElement', `${source.replace('export default class Graphic', 'return class Graphic')}`)(HTMLElement) as unknown as new () => GeneratedGraphic;
  graphicCounter += 1;
  const tagName = `x-ograf-parity-${graphicCounter}`;
  customElements.define(tagName, Graphic);
  return document.createElement(tagName) as GeneratedGraphic;
}

describe('generated runtime parity', () => {
  test('generated runtime matches Phase 2A SVG semantics for trim and stroke alignment', async () => {
    const authored = scene([layer()]);
    const plan = compileOGrafPackage(authored);
    expect(plan.status).toBe('ready-to-materialize');
    const source = plan.files.find((file) => file.path === 'graphic.mjs')?.content || '';
    const graphic = instantiateGraphic(source);
    await graphic.load({ renderType: 'realtime', data: {} });

    const canonical = renderOGrafSvg(evaluateOGrafScene(authored, 0));
    const generated = graphic.innerHTML;

    expect(generated).toContain('viewBox="0 0 320 180"');
    expect(generated).toContain('mask id="inside-stroke-shape"');
    expect(generated).toContain('stroke-dasharray="0.6000000000000001 0.3999999999999999"');
    expect(generated).toContain('stroke-dashoffset="-0.32499999999999996"');
    expect(generated).toContain('mask id="inside-stroke-shape"');
    expect(canonical).toContain('mask id="inside-stroke-shape"');
    expect(canonical).toContain('stroke-dasharray="0.6000000000000001 0.3999999999999999"');
    await graphic.dispose();
  });

  test('generated realtime final frame follows canonical evaluated transform', async () => {
    const authored = scene(
      [layer({ trimPathEnabled: undefined, strokeAlignment: 'center' })],
      [track('shape', [
        { id: 'x0', frame: 0, value: 0, easing: 'linear' },
        { id: 'x1', frame: 60, value: 80, easing: 'easeInOut' },
      ])],
    );
    const plan = compileOGrafPackage(authored);
    const source = plan.files.find((file) => file.path === 'graphic.mjs')?.content || '';
    const graphic = instantiateGraphic(source);
    await graphic.load({ renderType: 'realtime', data: {} });
    await graphic.playAction({ skipAnimation: true });

    const canonical = renderOGrafSvg(evaluateOGrafScene(authored, 60));
    const generated = graphic.innerHTML;
    expect(generated).toContain('translate(240 90)');
    expect(canonical).toContain('translate(240 90)');
    await graphic.dispose();
  });

  test('generated clip matte preserves source transform and deterministic ids', async () => {
    const authored = scene([
      layer({ id: 'source', type: 'custom_circle', strokeEnabled: false, trimPathEnabled: undefined }),
      layer({ id: 'target', x: 12, zIndex: 1, matte: { sourcePartId: 'source', mode: 'clip' }, trimPathEnabled: undefined }),
    ]);
    const plan = compileOGrafPackage(authored);
    const source = plan.files.find((file) => file.path === 'graphic.mjs')?.content || '';
    const graphic = instantiateGraphic(source);
    await graphic.load({ renderType: 'realtime', data: {} });

    const canonical = renderOGrafSvg(evaluateOGrafScene(authored, 0));
    expect(graphic.innerHTML).toContain('clipPath id="kcs-clip-source"');
    expect(graphic.innerHTML).toContain('clip-path="url(#kcs-clip-source)"');
    expect(canonical).toContain('clipPath id="kcs-clip-source"');
    expect(canonical).toContain('clip-path="url(#kcs-clip-source)"');
    await graphic.dispose();
  });

  test('generated runtime reads root mask channels and emits ordered mask filters with residual subtract opacity', async () => {
    const path = {
      version: 1 as const,
      coordinateSpace: 'normalized' as const,
      closed: true,
      points: [
        { id: 'p1', x: 0.2, y: 0.2, kind: 'corner' as const },
        { id: 'p2', x: 0.8, y: 0.2, kind: 'corner' as const },
        { id: 'p3', x: 0.8, y: 0.8, kind: 'corner' as const },
        { id: 'p4', x: 0.2, y: 0.8, kind: 'corner' as const },
      ],
    };
    const pathAtEnd = { ...path, points: path.points.map((point) => ({ ...point, x: point.x + 0.1 })) };
    const authored = scene([
      layer({
        masks: [
          { id: 'add', name: 'Add', path, mode: 'add', opacity: 1, feather: 0, expansion: 0 },
          { id: 'subtract', name: 'Subtract', path, mode: 'subtract', opacity: 0.25, feather: 4, expansion: 2 },
        ],
      }),
    ], [{
      ...track('shape', []),
      maskChannels: {
        'add:opacity': [{ id: 'add-opacity', frame: 0, value: 0.2, easing: 'linear' }],
        'subtract:opacity': [
          { id: 'subtract-opacity-0', frame: 0, value: 0.25, easing: 'linear' },
          { id: 'subtract-opacity-1', frame: 60, value: 0.75, easing: 'linear' },
        ],
        'subtract:feather': [{ id: 'subtract-feather', frame: 0, value: 4, easing: 'linear' }],
        'subtract:expansion': [{ id: 'subtract-expansion', frame: 0, value: 2, easing: 'linear' }],
      },
      maskPathChannels: {
        'add:path': [
          { id: 'add-path', frame: 0, value: path, easing: 'linear' },
          { id: 'add-path-end', frame: 60, value: pathAtEnd, easing: 'linear' },
        ],
        'subtract:path': [{ id: 'subtract-path', frame: 0, value: path, easing: 'linear' }],
      },
    }]);
    const plan = compileOGrafPackage(authored);
    const source = plan.files.find((file) => file.path === 'graphic.mjs')?.content || '';
    const graphic = instantiateGraphic(source);
    await graphic.load({ renderType: 'realtime', data: {} });
    expect(graphic.innerHTML).toContain('fill-opacity="0.2"');
    expect(graphic.innerHTML).toContain('fill-opacity="1" fill-rule="evenodd"');
    expect(graphic.innerHTML).toContain('fill-opacity="0.75"');
    expect(graphic.innerHTML).toContain('feMorphology');
    expect(graphic.innerHTML).toContain('feGaussianBlur');
    await graphic.playAction({ skipAnimation: true });
    expect(graphic.innerHTML).toContain('fill-opacity="0.25"');
    expect(graphic.innerHTML).toContain('M 136 72');
    await graphic.dispose();
  });

  test('generated runtime emits valid inverted alpha track matte definitions', async () => {
    const authored = scene([
      layer({ id: 'source', type: 'custom_circle', strokeEnabled: false, trimPathEnabled: undefined }),
      layer({
        id: 'target',
        zIndex: 1,
        trackMatte: { sourceLayerId: 'source', mode: 'alpha', inverted: true, sourceVisible: false },
        trimPathEnabled: undefined,
      }),
    ]);
    const plan = compileOGrafPackage(authored);
    const source = plan.files.find((file) => file.path === 'graphic.mjs')?.content || '';
    const graphic = instantiateGraphic(source);
    await graphic.load({ renderType: 'realtime', data: {} });
    expect(graphic.innerHTML).toContain('id="kcs-ograf-track-matte-target-source-alpha-inverted"');
    expect(graphic.innerHTML).toContain('fill-rule="evenodd"');
    expect(graphic.innerHTML).toContain('fill="black"');
    expect(graphic.innerHTML).not.toContain('data-layer-id="source"');
    await graphic.dispose();
  });
  test('generated runtime selects the persisted active named sequence for channels', async () => {
    const authored = {
      ...scene([layer({ strokeAlignment: 'center', trimPathEnabled: undefined })], [{
        ...track('shape', [
          { id: 'sequence-0', frame: 0, value: 20, easing: 'linear', templateId: 'Sequence' },
          { id: 'sequence-1', frame: 60, value: 40, easing: 'linear', templateId: 'Sequence' },
          { id: 'named-0', frame: 0, value: 100, easing: 'linear', templateId: 'Named' },
          { id: 'named-1', frame: 60, value: 140, easing: 'linear', templateId: 'Named' },
        ]),
      }]),
      activeTemplateId: 'Named',
    };
    const plan = compileOGrafPackage(authored);
    const source = plan.files.find((file) => file.path === 'graphic.mjs')?.content || '';
    const graphic = instantiateGraphic(source);
    await graphic.load({ renderType: 'realtime', data: {} });
    await graphic.playAction({ skipAnimation: true });
    expect(graphic.innerHTML).toContain('translate(300 90)');
    await graphic.dispose();
  });

  test('generated runtime sanitizes hostile logical ids while preserving references', async () => {
    const path = {
      version: 1 as const,
      coordinateSpace: 'normalized' as const,
      closed: true,
      points: [
        { id: 'p1', x: 0.2, y: 0.2, kind: 'corner' as const },
        { id: 'p2', x: 0.8, y: 0.2, kind: 'corner' as const },
        { id: 'p3', x: 0.8, y: 0.8, kind: 'corner' as const },
      ],
    };
    const sourceId = 'source / hostile';
    const targetId = 'target # hostile';
    const authored = scene([
      layer({ id: sourceId, type: 'custom_circle', strokeEnabled: false, trimPathEnabled: undefined }),
      layer({
        id: targetId,
        zIndex: 1,
        matte: { sourcePartId: sourceId, mode: 'clip' },
        masks: [{ id: 'mask / hostile', name: 'Mask', path, mode: 'add', opacity: 1, feather: 0, expansion: 0 }],
        trimPathEnabled: undefined,
      }),
    ]);
    const plan = compileOGrafPackage(authored);
    const source = plan.files.find((file) => file.path === 'graphic.mjs')?.content || '';
    const graphic = instantiateGraphic(source);
    await graphic.load({ renderType: 'realtime', data: {} });
    expect(graphic.innerHTML).toContain('id="kcs-clip-source___hostile"');
    expect(graphic.innerHTML).toContain('clip-path="url(#kcs-clip-source___hostile)"');
    expect(graphic.innerHTML).toContain('id="kcs-ograf-layer-mask-target___hostile-mask___hostile-add"');
    expect(graphic.innerHTML).not.toMatch(/\sid="[^"]*[/# ]/u);
    expect(graphic.innerHTML).not.toMatch(/url\(#[^)]*[/# ]/u);
    await graphic.dispose();
  });
});
