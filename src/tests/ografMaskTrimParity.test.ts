// A2 — Mask/Trim RUNTIME-ONLY normalization parity (RED first).
//
// Authority: the editor's `evaluateTrimPath` (utils/geometry/trimPath.ts) and
// `buildLayerMaskDefinition` (utils/layers/layerMasks.ts). The emitted OGraf runtime
// must reach the SAME effective numbers from the SAME authored data —
// normalization happens at runtime evaluation only; stored scene data is
// never rewritten.
//
// Independent expectations are computed by hand-arithmetic in this file,
// never by importing the runtime.
//
// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { describe, expect, test } from 'vitest';
import type { SceneData } from '../types/composition';

const runtimePath = fileURLToPath(new URL('../ograf/runtimeTemplate.ts', import.meta.url)).replaceAll('\\', '/');

async function emit(scene: SceneData): Promise<string> {
  const entry = 'virtual:kcs-a2';
  const resolved = `\0${entry}`;
  const result = await build({
    configFile: false,
    root: fileURLToPath(new URL('../../', import.meta.url)),
    logLevel: 'silent',
    plugins: [{
      name: 'kcs-a2',
      resolveId: (id) => (id.endsWith(entry) ? resolved : undefined),
      load: (id) => (id === resolved
        ? `import { generateGraphicModule } from ${JSON.stringify(runtimePath)}; export const moduleSource = generateGraphicModule(${JSON.stringify(scene)});`
        : undefined),
    }],
    build: { write: false, minify: true, lib: { entry, formats: ['iife'], name: 'KcsA2' } },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunk = outputs.flatMap((output) => ('output' in output ? output.output : []))
    .find((output) => output.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('A2 production compile failed to emit.');
  return new Function(`${chunk.code}\nreturn KcsA2.moduleSource;`)() as string;
}

class HostElement {
  innerHTML = '';
}

type Graphic = HostElement & {
  _currentFrame: number;
  _render: () => void;
  load: (p: { renderType: string }) => Promise<{ statusCode: number }>;
};

async function open(scene: SceneData): Promise<Graphic> {
  const source = (await emit(scene))
    .replace('export default class Graphic', 'return class Graphic')
    .replaceAll('import.meta.url', JSON.stringify('https://example.test/graphic.mjs'));
  const graphic = new (new Function('HTMLElement', source)(HostElement) as new () => Graphic)();
  expect((await graphic.load({ renderType: 'realtime' })).statusCode).toBe(200);
  return graphic;
}

const kf = (id: string, frame: number, value: number) => ({ id, frame, value, easing: 'linear' });

function sceneWith(layers: unknown[]): SceneData {
  return {
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    name: 'A2',
    width: 320,
    height: 180,
    fps: 60,
    totalFrames: 100,
    layers,
    tracks: [],
  } as unknown as SceneData;
}

const strokeLayer = (id: string, trim: Record<string, unknown>) => ({
  id, name: id, type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1,
  opacity: 1, visible: true, zIndex: 1, fillColor: 'none',
  strokeColor: '#000000', strokeEnabled: true, strokeWidth: 4, strokeAlignment: 'center',
  ...trim,
});
const dashOf = (html: string): string => /<rect[^>]*pathLength[^>]*>/u.exec(html)?.[0] ?? html;

describe('A2 — runtime trim normalization (RED until fixed)', () => {
  test('out-of-range static start clamps to 1 like the editor (span 0 -> dashed empty)', async () => {
    // Editor: clamp01(1.5, fallback 0) = 1; end 1; span rawSpan=0 special-cases
    // to full stroke only when EXACTLY 1 — start==end==1 is a zero span.
    const graphic = await open(sceneWith([strokeLayer('s', { trimPathEnabled: true, trimPathStart: 1.5, trimPathEnd: 1, trimPathOffset: 0 })]));
    graphic._currentFrame = 0;
    graphic._render();
    const tag = dashOf(graphic.innerHTML);
    expect(tag).toContain('stroke-dasharray="0 1"');
    expect(tag).not.toContain('dasharray="0.5');
  });

  test('animated negative end clamps per frame (key -0.3 -> 0)', async () => {
    const scene = sceneWith([strokeLayer('s', { trimPathEnabled: true, trimPathStart: 0, trimPathEnd: 0, trimPathOffset: 0 })]);
    (scene as unknown as { tracks: unknown[] }).tracks = [{
      partId: 's',
      channels: { trimPathEnd: [kf('e0', 0, -0.3), kf('e1', 100, 0.5)] },
    }];
    const graphic = await open(scene);
    graphic._currentFrame = 0;
    graphic._render();
    // Editor: clamp01(-0.3, fallback base.end=0) = 0 -> zero span, begin 0.
    expect(dashOf(graphic.innerHTML)).toContain('stroke-dasharray="0 1"');
  });

  test('null offset (NaN authored, JSON round-tripped) falls back to 0 degrees', async () => {
    // The emitted scene is JSON: NaN authored offsets arrive as null, and
    // assertSafeScene refuses NaN keyframe VALUES — the reachable runtime
    // surface is a null static field with a non-trivial span (the rawSpan===1
    // early return would otherwise mask the offset entirely).
    const graphic = await open(sceneWith([strokeLayer('s', {
      trimPathEnabled: true, trimPathStart: 0, trimPathEnd: 0.5, trimPathOffset: Number.NaN,
    })]));
    graphic._currentFrame = 0;
    graphic._render();
    const tag = dashOf(graphic.innerHTML);
    expect(tag).not.toContain('NaN');
    expect(tag).toContain('stroke-dasharray="0.5 0.5"');
    expect(tag).toContain('stroke-dashoffset="0"');
  });
});

describe('A2 — runtime mask normalization (RED until fixed)', () => {
  const maskLayer = (masks: unknown[]) => ({
    id: 'm', name: 'm', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1,
    opacity: 1, visible: true, zIndex: 1, fillColor: '#ff0000', strokeEnabled: false,
    fillEnabled: true, masks,
  });
  const openMask = (id: string, over: Record<string, unknown>) => ({
    id, mode: 'add', inverted: false, enabled: true,
    path: { version: 1, coordinateSpace: 'normalized', closed: true, points: [
      { id: 'a', x: 0.25, y: 0.25, kind: 'corner' }, { id: 'b', x: 0.75, y: 0.25, kind: 'corner' },
      { id: 'c', x: 0.75, y: 0.75, kind: 'corner' }, { id: 'd', x: 0.25, y: 0.75, kind: 'corner' },
    ] },
    ...over,
  });

  test('opacity above 1 renders as the clamped 1 in markup', async () => {
    const graphic = await open(sceneWith([maskLayer([openMask('m1', { opacity: 1.8 })])]));
    graphic._currentFrame = 0;
    graphic._render();
    expect(graphic.innerHTML).toContain('opacity="1"');
    expect(graphic.innerHTML).not.toContain('opacity="1.8"');
  });

  test('NaN expansion produces NO filter (editor: nonfinite -> 0 -> no morphology)', async () => {
    const graphic = await open(sceneWith([maskLayer([openMask('m1', { expansion: Number.NaN, opacity: 1 })])]));
    graphic._currentFrame = 0;
    graphic._render();
    expect(graphic.innerHTML).not.toContain('feMorphology');
  });

  test('negative feather produces no blur; finite expansion keeps its sign (erode)', async () => {
    const graphic = await open(sceneWith([maskLayer([openMask('m1', { feather: -5, expansion: -3, opacity: 1 })])]));
    graphic._currentFrame = 0;
    graphic._render();
    expect(graphic.innerHTML).not.toContain('feGaussianBlur');
    expect(graphic.innerHTML).toContain('operator="erode"');
  });
});
