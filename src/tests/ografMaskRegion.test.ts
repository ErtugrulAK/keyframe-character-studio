/**
 * Manual QA (rc.6 round 2): masked OGraf scenes dropped frames in the player.
 * Every layer mask declared the whole scene as its region, so the browser
 * painted a full-frame offscreen buffer per mask per frame. A mask's region is
 * now the area where the mask chain can be non-zero, limited to where the
 * layer itself paints; outside it the mask cannot change a pixel.
 */
import { describe, expect, test } from 'vitest';
import type { BezierPath, LayerMask } from '../types/animator';
import type { SceneData, SceneLayer } from '../types/composition';
import { compileOGrafPackage } from '../ograf/packageCompiler';

const square = (cx: number, cy: number, r: number): BezierPath => ({
  version: 1,
  coordinateSpace: 'local',
  closed: true,
  points: [
    { id: 'a', x: cx - r, y: cy - r },
    { id: 'b', x: cx + r, y: cy - r },
    { id: 'c', x: cx + r, y: cy + r },
    { id: 'd', x: cx - r, y: cy + r },
  ],
} as BezierPath);

const mask = (id: string, mode: LayerMask['mode'], extra: Partial<LayerMask> = {}): LayerMask => ({
  id, name: id, path: square(0, 0, 20), mode, inverted: false, opacity: 1, feather: 0, expansion: 0, ...extra,
} as LayerMask);

const layer = (overrides: Partial<SceneLayer>): SceneLayer => ({
  id: 'target', name: 'Target', type: 'custom_circle', x: 0, y: 0, rotation: 0,
  scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#ffffff', strokeColor: '#000000', strokeWidth: 0, width: 60, height: 60,
  ...overrides,
});

const scene = (layers: SceneLayer[]): SceneData => ({
  version: 2, coordinateSystem: 'project-unit-center-v1', name: 'Mask region',
  width: 1920, height: 1080, fps: 30, totalFrames: 10, layers, tracks: [],
});

type Region = { x: number; y: number; width: number; height: number };

/** The rendered region of each layer mask, keyed by mask id. */
async function maskRegions(data: SceneData): Promise<Record<string, Region>> {
  const plan = compileOGrafPackage(data);
  expect(plan.status).toBe('ready-to-materialize');
  const source = plan.files.find((file) => file.path === 'graphic.mjs')?.content || '';
  const Graphic = new Function('HTMLElement', `${source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href')}`)(HTMLElement) as new () => HTMLElement & { load: (params: { renderType: 'realtime' }) => Promise<unknown> };
  const tag = `x-ograf-mask-region-${Math.random().toString(36).slice(2)}`;
  customElements.define(tag, Graphic);
  const graphic = document.createElement(tag) as InstanceType<typeof Graphic>;
  document.body.appendChild(graphic);
  await graphic.load({ renderType: 'realtime' });
  const regions: Record<string, Region> = {};
  graphic.querySelectorAll('mask[id^="kcs-ograf-layer-mask"]').forEach((element) => {
    regions[element.id] = (['x', 'y', 'width', 'height'] as const).reduce((region, key) => ({ ...region, [key]: Number(element.getAttribute(key)) }), {} as Region);
  });
  graphic.remove();
  return regions;
}

const FULL: Region = { x: 0, y: 0, width: 1920, height: 1080 };
const only = (regions: Record<string, Region>): Region => {
  const values = Object.values(regions);
  expect(values).toHaveLength(1);
  return values[0];
};

describe('OGraf layer mask regions', () => {
  test('an add mask covers its own path (plus one pixel), not the scene', async () => {
    const region = only(await maskRegions(scene([layer({ masks: [mask('m', 'add')] })])));
    // The path is a 40px square at the scene centre (960, 540).
    expect(region).toEqual({ x: 939, y: 519, width: 42, height: 42 });
  });

  test('feather and expansion widen it by the blur and dilation reach', async () => {
    const region = only(await maskRegions(scene([layer({ masks: [mask('m', 'add', { feather: 10, expansion: 3 })] })])));
    // 20 (half side) + 2 × 10 (feather) + 3 (expansion) + 1.
    expect(region).toEqual({ x: 960 - 44, y: 540 - 44, width: 88, height: 88 });
  });

  test('a hole mask is bounded by where the layer paints, not by its path', async () => {
    // The circle primitive is r = 30 at scale 2: it paints within ±60, padded by 2 px.
    const region = only(await maskRegions(scene([layer({ scaleX: 2, scaleY: 2, masks: [mask('m', 'subtract')] })])));
    expect(region).toEqual({ x: 960 - 62, y: 540 - 62, width: 124, height: 124 });
  });

  test('a layer whose extent is unknown here keeps the scene region for a hole', async () => {
    const region = only(await maskRegions(scene([layer({ type: 'custom_text', textValue: 'Hi', fontSize: 40, masks: [mask('m', 'subtract')] } as Partial<SceneLayer>)])));
    expect(region).toEqual(FULL);
  });

  test('a chain is bounded by what it can still reach', async () => {
    const regions = await maskRegions(scene([layer({
      scaleX: 10, scaleY: 10,
      masks: [
        mask('first', 'add', { path: square(-10, 0, 5) }),
        mask('second', 'add', { path: square(10, 0, 5) }),
        mask('third', 'intersect', { path: square(10, 0, 5) }),
      ],
    })]));
    const [first, second, third] = Object.values(regions);
    // Add grows the bound to both squares; intersect shrinks it to the last one.
    expect(first.width).toBeLessThan(second.width);
    expect(second.x).toBe(first.x);
    expect(third.x).toBeGreaterThan(first.x);
    expect(third.width).toBeLessThan(second.width);
  });
});
