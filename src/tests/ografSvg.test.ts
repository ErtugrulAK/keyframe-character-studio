import { describe, expect, test } from 'vitest';
import type { AnimationTrackData, PropertyKeyframe } from '../types/animator';
import type { SceneData, SceneLayer } from '../types/composition';
import { evaluateOGrafScene } from '../ograf/evaluation';
import { renderOGrafSvg } from '../ograf/svgRenderer';

function makeLayer(overrides: Partial<SceneLayer> = {}): SceneLayer {
  return {
    id: 'layer-1',
    name: 'Layer',
    type: 'custom_box',
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
    width: 100,
    height: 50,
    ...overrides,
  };
}

function channel(...keyframes: PropertyKeyframe[]): PropertyKeyframe[] {
  return keyframes;
}

function makeTrack(partId: string, overrides: Partial<AnimationTrackData['channels']> = {}): AnimationTrackData {
  return {
    partId,
    channels: {
      x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
      maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
      trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
      ...overrides,
    },
  };
}

function makeScene(layers: SceneLayer[], tracks: AnimationTrackData[] = []): SceneData {
  return {
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    name: 'SVG Fixture',
    width: 320,
    height: 180,
    fps: 60,
    totalFrames: 120,
    layers,
    tracks,
  };
}

describe('OGraf standalone SVG Phase 2A', () => {
  test('renders supported primitive geometry with project viewBox and origin', () => {
    const scene = makeScene([
      makeLayer({ id: 'box', type: 'custom_box' }),
      makeLayer({ id: 'circle', type: 'custom_circle', x: 40, zIndex: 1 }),
      makeLayer({ id: 'triangle', type: 'custom_triangle', x: -40, zIndex: 2 }),
      makeLayer({ id: 'star', type: 'custom_star', zIndex: 3 }),
      makeLayer({ id: 'diamond', type: 'custom_diamond', zIndex: 4 }),
      makeLayer({ id: 'parallelogram', type: 'custom_parallelogram', zIndex: 5 }),
      makeLayer({ id: 'capsule', type: 'custom_capsule', zIndex: 6 }),
    ]);

    const svg = renderOGrafSvg(evaluateOGrafScene(scene, 0));

    expect(svg).toContain('width="320" height="180" viewBox="0 0 320 180"');
    expect(svg).toContain('<rect');
    expect(svg).toContain('<circle');
    expect(svg).toContain('<polygon');
    expect(svg.match(/data-layer-id=/g)).toHaveLength(7);
    expect(svg.indexOf('data-layer-id="box"')).toBeLessThan(svg.indexOf('data-layer-id="capsule"'));
  });

  test('renders freeform geometry deterministically', () => {
    const scene = makeScene([makeLayer({ type: 'custom_freeform', points: [{ x: -10, y: -10 }, { x: 20, y: -10 }, { x: 0, y: 20 }] })]);
    const evaluated = evaluateOGrafScene(scene, 0);

    expect(renderOGrafSvg(evaluated)).toContain('<path d="M -10 -10 L 20 -10 L 0 20 Z"');
  });

  test('reuses canonical channel interpolation and preserves hierarchy', () => {
    const parent = makeLayer({ id: 'parent', x: 20, y: 10, rotation: 90, scaleX: 2, scaleY: 2 });
    const child = makeLayer({ id: 'child', parentId: 'parent', x: 10, y: 0, zIndex: 1 });
    const track = makeTrack('child', {
      x: channel({ id: 'x0', frame: 0, value: 0, easing: 'linear' }, { id: 'x1', frame: 10, value: 20, easing: 'linear' }),
    });
    const evaluated = evaluateOGrafScene(makeScene([parent, child], [track]), 5);
    const childResult = evaluated.layers.find((layer) => layer.id === 'child');

    expect(childResult?.transform.x).toBeCloseTo(20);
    expect(childResult?.transform.y).toBeCloseTo(30);
    expect(childResult?.transform.rotation).toBe(90);
    expect(childResult?.transform.scaleX).toBe(2);
    expect(childResult?.transform.scaleY).toBe(2);
  });

  test('preserves mirrored transforms, zIndex, visibility, fill, stroke, and opacity', () => {
    const scene = makeScene([
      makeLayer({ id: 'hidden', visible: false, zIndex: 0 }),
      makeLayer({ id: 'mirrored', scaleX: -1, fillColor: '#00ff00', strokeColor: '#0000ff', fillOpacity: 0.4, strokeOpacity: 0.6, zIndex: 1 }),
    ]);
    const evaluated = evaluateOGrafScene(scene, 0);
    const svg = renderOGrafSvg(evaluated);

    expect(svg).not.toContain('data-layer-id="hidden"');
    expect(svg).toContain('data-layer-id="mirrored"');
    expect(svg).toContain('scale(-1 1)');
    expect(svg).toContain('fill="#00ff00"');
    expect(svg).toContain('stroke="#0000ff"');
    expect(svg).toContain('fill-opacity="0.4"');
    expect(svg).toContain('stroke-opacity="0.6"');
  });

  test('preserves Trim Path and Stroke Alignment through SVG-native output', () => {
    const scene = makeScene([makeLayer({
      trimPathEnabled: true,
      trimPathStart: 0.2,
      trimPathEnd: 0.7,
      trimPathOffset: 90,
      strokeAlignment: 'inside',
      strokeWidth: 4,
      fillEnabled: true,
      strokeEnabled: true,
    })]);
    const svg = renderOGrafSvg(evaluateOGrafScene(scene, 0));

    expect(svg).toContain('stroke-dasharray="0.5 0.5"');
    expect(svg).toContain('mask id="inside-stroke-layer-1"');
    expect(svg).toContain('stroke-width="8"');
  });

  test('renders text and package-relative local image references with text alpha', () => {
    const scene = makeScene([
      makeLayer({ id: 'text', type: 'custom_text', textValue: '<Hello>', fontSize: 30, fontFamily: 'Test Font', fillOpacity: 0.4, strokeOpacity: 0.6 }),
      makeLayer({ id: 'image', type: 'custom_image', imageUrl: 'assets/logo.png', width: 80, height: 40, zIndex: 1 }),
    ]);
    const svg = renderOGrafSvg(evaluateOGrafScene(scene, 0), {
      imageReferences: { 'assets/logo.png': 'assets/images/logo.png' },
    });

    expect(svg).toContain('&lt;Hello&gt;');
    expect(svg).toContain('font-family="Test Font"');
    expect(svg).toContain('fill-opacity="0.4"');
    expect(svg).toContain('stroke-opacity="0.6"');
    expect(svg).toContain('href="assets/images/logo.png"');
  });

  test('supports clip matte only with an existing supported source', () => {
    const source = makeLayer({ id: 'source', type: 'custom_circle' });
    const target = makeLayer({ id: 'target', x: 20, matte: { sourcePartId: 'source', mode: 'clip' }, zIndex: 1 });
    const svg = renderOGrafSvg(evaluateOGrafScene(makeScene([source, target]), 0));

    expect(svg).toContain('clipPath id="kcs-clip-source"');
    expect(svg).toContain('clip-path="url(#kcs-clip-source)"');
  });

  test('repeated evaluation and render are byte-for-byte deterministic and non-mutating', () => {
    const scene = makeScene([makeLayer({ rotation: 12, scaleX: -1 })]);
    const before = JSON.stringify(scene);
    const first = renderOGrafSvg(evaluateOGrafScene(scene, 12));
    const second = renderOGrafSvg(evaluateOGrafScene(scene, 12));

    expect(second).toBe(first);
    expect(JSON.stringify(scene)).toBe(before);
  });
});
