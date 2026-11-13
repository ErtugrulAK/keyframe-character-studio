import { describe, expect, test } from 'vitest';
import type { AnimationTrackData, CharacterPart, PropertyKeyframe } from '../types/animator';
import type { SceneData, SceneLayer } from '../types/composition';
import { evaluateOGrafScene } from '../ograf/evaluation';
import { compileOGrafPackage } from '../ograf/packageCompiler';
import { renderOGrafSvg } from '../ograf/svgRenderer';
import { evaluateTransform } from '../utils/animation/evaluateTransform';
import { makeEmptyChannels } from '../utils/animation/defaults';
import { onAir } from './helpers/ografOnAir';
import { validateImportedDocument } from '../utils/persistence/importValidation';

// An L-shaped path: 200 right, then 200 down (400 long), drawn by a freeform
// layer placed at (-100, -50) and turned 0°.
const PATH = {
  version: 1 as const,
  coordinateSpace: 'local' as const,
  closed: false,
  points: [
    { id: 'p0', x: 0, y: 0, kind: 'corner' as const },
    { id: 'p1', x: 200, y: 0, kind: 'corner' as const },
    { id: 'p2', x: 200, y: 200, kind: 'corner' as const },
  ],
};

function layer(overrides: Partial<SceneLayer>): SceneLayer {
  return {
    id: 'layer', name: 'Layer', type: 'custom_rect',
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 0,
    width: 20, height: 20,
    fillColor: '#ff0000', fillEnabled: true, strokeEnabled: false,
    ...overrides,
  } as SceneLayer;
}

const keys = (pairs: Array<[number, number]>): PropertyKeyframe[] =>
  pairs.map(([frame, value], index) => ({ id: `k${index}`, frame, value, easing: 'linear' }));

function scene(follower: Partial<SceneLayer>, progress: PropertyKeyframe[], extra: Partial<AnimationTrackData['channels']> = {}): SceneData {
  return {
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    name: 'Motion Path Parity',
    width: 640,
    height: 360,
    fps: 30,
    totalFrames: 60,
    layers: [
      layer({ id: 'road', type: 'custom_freeform', x: -100, y: -50, path: PATH, strokeEnabled: true, fillEnabled: false, strokeColor: '#ffffff', strokeWidth: 2 } as Partial<SceneLayer>),
      layer({ id: 'ball', zIndex: 1, x: 999, y: 999, ...follower }),
    ],
    tracks: [{ partId: 'ball', channels: { ...makeEmptyChannels(), motionPathProgress: progress, ...extra } }],
  };
}

type GeneratedGraphic = HTMLElement & {
  _currentFrame: number;
  _render: () => void;
  load: (params: { renderType: 'realtime'; data?: unknown }) => Promise<Record<string, unknown>>;
  dispose: () => Promise<Record<string, unknown>>;
};
let counter = 0;
function instantiateGraphic(source: string): GeneratedGraphic {
  const Graphic = new Function('HTMLElement', `${source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href')}`)(HTMLElement) as unknown as new () => GeneratedGraphic;
  counter += 1;
  const tagName = `x-motion-path-parity-${counter}`;
  customElements.define(tagName, Graphic);
  return document.createElement(tagName) as GeneratedGraphic;
}

/** The translate + rotate an SVG gives the layer `id`, read inside its group. */
const placementOf = (svg: string, id: string): { x: number; y: number; rotation: number } | undefined => {
  const at = svg.indexOf(`data-layer-id="${id}"`);
  if (at < 0) return undefined;
  // The layer's own placement is the first transform inside its group.
  const group = svg.slice(at);
  const t = /translate\(([-\d.e]+)[ ,]([-\d.e]+)\)/u.exec(group);
  const r = /rotate\(([-\d.e]+)/u.exec(group);
  if (!t) return undefined;
  return { x: Number(t[1]), y: Number(t[2]), rotation: r ? Number(r[1]) : 0 };
};

describe('motion path', () => {
  test('a follower walks the path by its length, the same in the editor, the static SVG and the runtime', async () => {
    const authored = scene({ motionPath: { sourcePartId: 'road', orient: true } }, keys([[0, 0], [60, 1]]));
    // Halfway (frame 30) is the corner: 200 of 400. A quarter (frame 15) is 100 along the top.
    const expected: Record<number, { x: number; y: number }> = {
      0: { x: -100, y: -50 },
      15: { x: 0, y: -50 },
      45: { x: 100, y: 50 },
      60: { x: 100, y: 150 },
    };
    for (const [frame, at] of Object.entries(expected)) {
      const evaluated = evaluateOGrafScene(authored, Number(frame)).layers.find((item) => item.id === 'ball')!;
      expect(evaluated.transform.x).toBeCloseTo(at.x, 6);
      expect(evaluated.transform.y).toBeCloseTo(at.y, 6);
    }
    // Orient: along the top it faces right (0°), down the side it faces down (90°).
    expect(evaluateOGrafScene(authored, 15).layers.find((item) => item.id === 'ball')!.transform.rotation).toBeCloseTo(0, 6);
    expect(evaluateOGrafScene(authored, 45).layers.find((item) => item.id === 'ball')!.transform.rotation).toBeCloseTo(90, 6);

    const plan = compileOGrafPackage(authored);
    expect(plan.status).toBe('ready-to-materialize');
    const graphic = instantiateGraphic(plan.files.find((file) => file.path === 'graphic.mjs')?.content || '');
    await graphic.load({ renderType: 'realtime', data: {} });
    await onAir(graphic);
    for (const frame of [0, 15, 30, 45, 60]) {
      const canonical = placementOf(renderOGrafSvg(evaluateOGrafScene(authored, frame)), 'ball');
      graphic._currentFrame = frame;
      graphic._render();
      const runtime = placementOf(graphic.innerHTML, 'ball');
      expect(canonical).toBeDefined();
      expect(runtime).toBeDefined();
      expect(runtime!.x).toBeCloseTo(canonical!.x, 4);
      expect(runtime!.y).toBeCloseTo(canonical!.y, 4);
      expect(runtime!.rotation).toBeCloseTo(canonical!.rotation, 4);
    }
    await graphic.dispose();
  });

  test('its own position keys add as an offset; the path layer moving moves it', () => {
    const authored = scene(
      { x: 999, motionPath: { sourcePartId: 'road' } },
      keys([[0, 0.25]]),
      { x: keys([[0, 999 + 7]]) },
    );
    authored.layers[0] = { ...authored.layers[0], x: -90 };
    const ball = evaluateOGrafScene(authored, 0).layers.find((item) => item.id === 'ball')!;
    // 100 along the top of a path placed at (-90, -50), plus the keyed +7 on X.
    expect(ball.transform.x).toBeCloseTo(-90 + 100 + 7, 6);
    expect(ball.transform.y).toBeCloseTo(-50, 6);
    // No orient: the rotation is the layer's own.
    expect(ball.transform.rotation).toBeCloseTo(0, 6);
  });

  test('a link it cannot honour leaves the layer where it is', () => {
    const base = (link: SceneLayer['motionPath'], other: Partial<SceneLayer> = {}) => {
      const authored = scene({ x: 33, y: 44, motionPath: link, ...other }, keys([[0, 0.5]]));
      return evaluateOGrafScene(authored, 0).layers.find((item) => item.id === 'ball')!.transform;
    };
    for (const link of [
      { sourcePartId: 'missing' },
      { sourcePartId: 'road', enabled: false },
      { sourcePartId: 'ball' },
    ]) {
      expect(base(link)).toMatchObject({ x: 33, y: 44 });
    }
    // Not the same parent: the path's space is not the follower's.
    const parts: CharacterPart[] = [
      { id: 'road', type: 'custom_freeform', path: PATH, baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } } as unknown as CharacterPart,
      { id: 'box', type: 'custom_rect', baseTransform: { x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } } as unknown as CharacterPart,
      { id: 'ball', type: 'custom_rect', parentId: 'box', motionPath: { sourcePartId: 'road' }, baseTransform: { x: 5, y: 6, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } } as unknown as CharacterPart,
    ];
    expect(evaluateTransform(parts, [], 'Sequence', 'ball', 0)).toMatchObject({ x: 55, y: 6 });
  });

  test('a saved link opens again; a malformed one is refused whole', () => {
    const good = scene({ motionPath: { sourcePartId: 'road', orient: true, progress: 0.3 } }, keys([[0, 0], [60, 1]]));
    const opened = validateImportedDocument(JSON.stringify(good));
    expect(opened.ok).toBe(true);
    for (const motionPath of [{ sourcePartId: '' }, { sourcePartId: 'road', progress: 'half' }, { sourcePartId: 'road', orient: 1 }, 'road']) {
      const bad = scene({ motionPath: motionPath as unknown as SceneLayer['motionPath'] }, []);
      const refused = validateImportedDocument(JSON.stringify(bad));
      expect(refused.ok).toBe(false);
    }
  });

  test('a layer with no link evaluates exactly as before', () => {
    const authored = scene({ x: 12, y: -8 }, keys([[0, 0.5]]));
    expect(evaluateOGrafScene(authored, 0).layers.find((item) => item.id === 'ball')!.transform).toMatchObject({ x: 12, y: -8, rotation: 0 });
  });
});
