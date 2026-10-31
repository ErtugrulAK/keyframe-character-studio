// @vitest-environment node
/**
 * The OGraf runtime is an ordinary module now, so its rules are tested
 * directly, against the same factory the package embeds by source.
 */
import { describe, expect, it } from 'vitest';
import { createGraphicRuntime, type GraphicRuntimeEnvironment, type RuntimeScene } from '../ograf/runtime/graphicRuntime';
import { runtimeGraphicFactory } from '../ograf/runtimeSnippets';
import { compareByStackingOrder } from '../utils/stackingOrder';
import { resolveMatteSource } from '../utils/matte';
import { createWorldAffineAlgebra } from '../utils/containerMath';
import { TEXT_BOX_CENTRE_EM } from '../utils/textOrigin';

class HostElement { innerHTML = ''; }

const rect = (overrides: Partial<RuntimeScene['layers'][number]> = {}): RuntimeScene['layers'][number] => ({
  id: 'a', type: 'custom_rect', zIndex: 1, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, fillColor: '#ff0000', ...overrides,
});

const sceneOf = (layers: RuntimeScene['layers'], tracks: RuntimeScene['tracks'] = []): RuntimeScene => ({ width: 400, height: 300, fps: 30, totalFrames: 30, layers, tracks });

const environmentFor = (scene: RuntimeScene): GraphicRuntimeEnvironment => ({
  scene,
  bindings: { text: {}, image: {}, color: { tint: { layerId: 'a', property: 'fillColor' } } },
  imageReferences: {},
  fontReferences: {},
  moduleUrl: 'https://example.test/pkg/graphic.mjs',
  elementBase: HostElement as unknown as typeof HTMLElement,
  textBoxCentreEm: TEXT_BOX_CENTRE_EM,
  compareByStackingOrder,
  resolveMatteSource: resolveMatteSource as GraphicRuntimeEnvironment['resolveMatteSource'],
  affine: createWorldAffineAlgebra(),
});

const runtimeFor = (scene: RuntimeScene) => createGraphicRuntime(environmentFor(scene));

describe('graphic runtime', () => {
  it('interpolates a channel with its easing and holds outside the keys', () => {
    const { channelValue } = runtimeFor(sceneOf([rect()]));
    const keys = [{ frame: 0, value: 0, easing: 'linear' }, { frame: 10, value: 100 }];
    expect(channelValue(keys, -5, 7)).toBe(0);
    expect(channelValue(keys, 5, 7)).toBe(50);
    expect(channelValue(keys, 20, 7)).toBe(100);
    expect(channelValue([], 5, 7)).toBe(7);
    expect(channelValue([{ frame: 0, value: 0, easing: 'hold' }, { frame: 10, value: 100 }], 9, 7)).toBe(0);
  });

  it('reads only the keys of the active sequence', () => {
    const scene = { ...sceneOf([rect()]), activeTemplateId: 'Intro' };
    const { channelValue } = runtimeFor(scene);
    expect(channelValue([{ frame: 0, value: 1, templateId: 'Intro' }, { frame: 0, value: 2 }], 0, 0)).toBe(1);
  });

  it('refuses a parent cycle and a non-finite value before rendering', () => {
    const { assertSafeScene } = runtimeFor(sceneOf([rect()]));
    expect(() => assertSafeScene(sceneOf([rect({ id: 'a', parentId: 'b' }), rect({ id: 'b', parentId: 'a' })]))).toThrow('Layer parent cycle detected');
    expect(() => assertSafeScene(sceneOf([rect({ x: Number.NaN })]))).toThrow('Invalid numeric scene value: x');
  });

  it('paints by stacking order and nests a child in its parent', () => {
    const scene = sceneOf([rect({ id: 'top', zIndex: 2 }), rect({ id: 'child', zIndex: 1, parentId: 'top', x: 10 })]);
    scene.layers[0].x = 50;
    const svg = runtimeFor(scene).renderScene(scene, 0, false);
    expect(svg.indexOf('data-layer-id="child"')).toBeLessThan(svg.indexOf('data-layer-id="top"'));
    expect(svg).toContain('<g data-layer-id="child" data-z-index="1" opacity="1"><g transform="translate(260 150)');
  });

  it('validates public data before it reaches a layer', async () => {
    const { Graphic } = runtimeFor(sceneOf([rect()]));
    const graphic = new Graphic() as unknown as HostElement & InstanceType<typeof Graphic>;
    expect(await graphic.load({ renderType: 'realtime' })).toEqual({ statusCode: 200 });
    expect(await graphic.updateAction({ data: { tint: 'red' } })).toEqual({ statusCode: 400, statusMessage: 'Color value must be a #rrggbb value: tint' });
    expect(await graphic.updateAction({ data: { other: '#000000' } })).toEqual({ statusCode: 400, statusMessage: 'Unknown public field: other' });
    expect(await graphic.updateAction({ data: { tint: '#00ff00' } })).toEqual({ statusCode: 200 });
    expect(graphic.innerHTML).toContain('fill="#00ff00"');
  });

  it('is self-contained: its source runs without this module', () => {
    const source = runtimeGraphicFactory();
    expect(source).not.toMatch(/\bimport\b|__vite|require\(/u);
    const factory = new Function(`return (${source});`)() as typeof createGraphicRuntime;
    const scene = sceneOf([rect()]);
    const embedded = factory(environmentFor(scene));
    expect(embedded.renderScene(scene, 0, false)).toBe(runtimeFor(scene).renderScene(scene, 0, false));
  });
});
