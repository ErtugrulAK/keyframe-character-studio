/**
 * The derived world affine must reach the exported runtime, not only the editor.
 *
 * A group's anisotropic resize is applied in the PARENT's frame: the nesting
 * `R(θp)·S(sp)·R(θc)·S(sc)` is a general 2×2, and folding the parent into the
 * child's own axes (rotation adds, scales multiply) applies the parent's stretch
 * along the CHILD's axis — the reported bug, where a 90°-rotated child of a
 * horizontally stretched group stretched upward while the drawn group frame
 * stretched sideways.
 *
 * The editor preview and the static SVG renderer read the map through
 * `worldAffineOf`; the generated `graphic.mjs` cannot import the application, so
 * it runs the canonical helpers embedded from `utils/geometry/containerMath` — the same
 * source, not a second copy of the law. This file proves the emitted helper set is
 * closed under its own references, that the spelling decision is the canonical
 * `affineTrsReading`, and that a layer whose map IS a TRS keeps the historical
 * markup byte for byte.
 */
import { describe, expect, test } from 'vitest';
import type { SceneData, SceneLayer, WorldTransform } from '../types/composition';
import { affineSvgTransform, affineTrsReading, worldAffineOf } from '../utils/geometry/containerMath';
import { EDITOR_CAMERA_CENTER } from '../utils/geometry/projectCoordinates';
import { generateGraphicModule } from '../ograf/runtimeTemplate';
import { renderOGrafSvg } from '../ograf/svgRenderer';
import { evaluateOGrafScene } from '../ograf/evaluation';

function layer(overrides: Partial<SceneLayer> = {}): SceneLayer {
  return {
    id: 'shape', name: 'Shape', type: 'custom_rect',
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1,
    fillColor: '#ff0000', strokeColor: '#000000',
    fillEnabled: true, strokeEnabled: false, strokeWidth: 4, strokeAlignment: 'center',
    width: 200, height: 120,
    ...overrides,
  };
}

function scene(layers: SceneLayer[]): SceneData {
  return {
    version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Affine',
    width: 400, height: 300, fps: 30, totalFrames: 30,
    layers, tracks: layers.map((entry) => ({ partId: entry.id, channels: {} as never })),
  };
}

/** A container exactly as layer grouping saves one: no geometry, no paint. */
const container = (overrides: Partial<SceneLayer> = {}): SceneLayer => layer({
  id: 'group', name: 'Group', type: 'custom_freeform',
  x: 40, y: 0, zIndex: 2, opacity: 0, visible: false,
  fillColor: 'none', strokeColor: 'none', width: undefined, height: undefined,
  ...overrides,
});

const child = (overrides: Partial<SceneLayer> = {}): SceneLayer => layer({
  id: 'child', name: 'Child', parentId: 'group', x: -100, y: 0, zIndex: 1,
  ...overrides,
});

/** Horizontally stretched container (2:1): the nesting a TRS cannot fold. */
const stretched = (childOverrides: Partial<SceneLayer> = {}): SceneData =>
  scene([container({ scaleX: 2, scaleY: 1 }), child(childOverrides)]);

const staticMarkup = (authored: SceneData): string => renderOGrafSvg(evaluateOGrafScene(authored, 0));

type GeneratedGraphic = HTMLElement & { _render: () => void };
let counter = 0;

/** The runtime instantiated from the very source the OGraf package carries. */
function runtimeMarkup(authored: SceneData): string {
  const source = generateGraphicModule(authored)
    .replace('export default class Graphic', 'return class Graphic')
    .replaceAll('import.meta.url', 'location.href');
  const Graphic = new Function('HTMLElement', source)(HTMLElement) as unknown as new () => GeneratedGraphic;
  counter += 1;
  const tag = `x-ograf-affine-${counter}`;
  customElements.define(tag, Graphic);
  const graphic = document.createElement(tag) as GeneratedGraphic;
  graphic._render();
  return graphic.innerHTML;
}

/** The `transform` attribute of one painted layer, as both paths emit it. */
function transformOf(markup: string, id: string): string {
  const match = new RegExp(`data-layer-id="${id}"[^>]*><g transform="([^"]+)"`, 'u').exec(markup);
  if (!match) throw new Error(`No painted transform for layer "${id}".`);
  return match[1];
}

function evaluatedTransform(authored: SceneData, id: string): WorldTransform {
  const found = evaluateOGrafScene(authored, 0).layers.find((entry) => entry.id === id);
  if (!found) throw new Error(`Layer "${id}" was not evaluated.`);
  return found.transform;
}


describe('preview, export and runtime spell the same world map', () => {
  test('a plain TRS layer keeps the historical spelling byte for byte', () => {
    const authored = scene([layer({ x: 140, y: -10, rotation: 45, scaleX: 2, scaleY: 3 })]);

    for (const markup of [staticMarkup(authored), runtimeMarkup(authored)]) {
      expect(transformOf(markup, 'shape')).toBe('translate(340 140) rotate(45) scale(2 3)');
    }
  });

  test('a 90°-rotated child of a stretched group emits the exact swapped reading, not the folded one', () => {
    const authored = stretched({ rotation: 90 });

    // The parent's horizontal stretch rides the child's rotated axes: the map is
    // shear-free, so rotate/scale carries it exactly — the historical spelling
    // that e2e parsers read, with the axes swapped.
    for (const markup of [staticMarkup(authored), runtimeMarkup(authored)]) {
      expect(transformOf(markup, 'child')).toBe('translate(40 150) rotate(90) scale(1 2)');
      // The bug's own spelling applied the stretch along the child's own axis.
      expect(markup).not.toContain('rotate(90) scale(2 1)');
      expect(markup).not.toContain('matrix(');
    }
  });

  test('the preview emitter carries the same reading for the same evaluated world', () => {
    const authored = stretched({ rotation: 90 });
    const world = evaluatedTransform(authored, 'child');

    // Same map, different output origin: the editor camera vs the project centre.
    expect(affineSvgTransform(worldAffineOf(world), world, EDITOR_CAMERA_CENTER))
      .toBe('translate(140, 240) rotate(90) scale(1, 2)');
    expect(affineTrsReading(worldAffineOf(world), world)).toMatchObject({ rotation: 90, scaleX: 1, scaleY: 2 });
  });

  test('a genuinely sheared nesting falls back to the exact matrix in both paths', () => {
    const authored = stretched({ rotation: 30 });
    const world = evaluatedTransform(authored, 'child');
    const affine = worldAffineOf(world);

    // A 30° child really shears: no rotate/scale pair reproduces this map, which
    // is why `affineTrsReading` reports null here and nowhere else.
    expect(world.affine).toBeDefined();
    expect(affineTrsReading(affine, world)).toBeNull();
    const expected = `translate(200 150) matrix(${affine.a} ${affine.b} ${affine.c} ${affine.d} ${affine.e} ${affine.f})`;
    expect(expected).toBe('translate(200 150) matrix(1.7320508075688774 0.49999999999999994 -0.9999999999999999 0.8660254037844387 -160 0)');
    for (const markup of [staticMarkup(authored), runtimeMarkup(authored)]) {
      expect(transformOf(markup, 'child')).toBe(expected);
    }
  });

  test('a 180°-rotated child stays on the historical path with no derived field at all', () => {
    const authored = stretched({ rotation: 180 });
    const world = evaluatedTransform(authored, 'child');

    // Its nesting is TRS-exact up to floating-point noise, so the shared tolerant
    // rule keeps both the field and the spelling on the historical path.
    expect(world.affine).toBeUndefined();
    for (const markup of [staticMarkup(authored), runtimeMarkup(authored)]) {
      expect(transformOf(markup, 'child')).toBe('translate(40 150) rotate(180) scale(2 1)');
    }
  });

  test('a grandchild accumulates the swapped map through the chain in both paths', () => {
    const authored = scene([
      container({ scaleX: 2, scaleY: 1 }),
      child({ rotation: 90 }),
      layer({ id: 'leaf', name: 'Leaf', parentId: 'child', x: 10, y: 0, zIndex: 0 }),
    ]);
    const leaf = evaluatedTransform(authored, 'leaf');

    // The leaf's local +10 rides the child's rotated map (the offset lands on the
    // world y axis), and the reading is the child's own swapped rotate/scale.
    expect(leaf.affine).toBeDefined();
    const exported = transformOf(staticMarkup(authored), 'leaf');
    expect(exported).toBe('translate(40 160) rotate(90) scale(1 2)');
    expect(transformOf(runtimeMarkup(authored), 'leaf')).toBe(exported);
  });
});
