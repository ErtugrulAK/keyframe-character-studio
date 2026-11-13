// A1 — Interpolation drift guard: editor authority vs emitted OGraf runtime.
//
// The easing/interpolation algebra intentionally exists in two sources (editor
// `utils/animation/defaults.ts` and the generated `ograf/runtimeTemplate.ts`). N2b and
// A2 restored numerical parity; this test is the tripwire that catches any
// future SINGLE-SIDED edit: a seeded deterministic fuzz over easings,
// duplicate frames, exact-key landings and fractional probes asserts the two
// implementations produce the same numbers for the same authored data.
//
// Deterministic by design (LCG seed fixed); one emit per key set.
// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { describe, expect, test } from 'vitest';
import type { PropertyKeyframe } from '../types/animator';
import type { SceneData } from '../types/composition';
import { interpolateChannel } from '../utils/animation/defaults';

const runtimePath = fileURLToPath(new URL('../ograf/runtimeTemplate.ts', import.meta.url)).replaceAll('\\', '/');

let seed = 0x5eed1e;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0xffffffff;
};
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)] as T;

const EASINGS = ['linear', 'easeIn', 'easeOut', 'easeInOut', 'hold', 'autoBezier', 'cubic_bezier', 'bounce', 'elastic', 'anticipate', 'overshoot'] as const;

function fuzzKeys(count: number): PropertyKeyframe[] {
  const keys: PropertyKeyframe[] = [];
  let frame = 0;
  for (let i = 0; i < count; i += 1) {
    frame += Math.floor(rand() * 9) + (i === 0 ? 0 : 1);
    if (rand() < 0.12 && keys.length > 0) frame = (keys[keys.length - 1] as PropertyKeyframe).frame; // duplicate frames
    const easing = pick(EASINGS);
    const key: PropertyKeyframe = {
      id: `f${i}`,
      frame,
      value: Math.round((rand() * 220 - 60) * 1000) / 1000,
      easing,
    };
    if (easing === 'cubic_bezier') {
      key.bezierControlPoints = [0.1, 0.2, 0.8, 0.9];
    }
    keys.push(key);
    // V6 fuzz matrix (O4): ~50% of SEGMENTS run a handle state — the guard
    // previously knew only the complete-pair happy path. States: complete
    // pair, OUTGOING-only (inert), INCOMING-only (inert), singular complete
    // pair (x=0 both ends → both Newton solvers take the break branch), and
    // plain (pairing suppressed; cp/named tiers already ride the easing pool).
    // Non-finite handles are NOT fuzzed, and no upstream boundary rejects
    // them: import/restore performs no typed/finite handle checks today, so
    // enforcement is a pending-approval policy audit (doc §O4). This
    // guard's contract is parity on the authored FINITE shapes only.
    if (keys.length >= 2) {
      const state = pick(['pair', 'pair', 'outOnly', 'inOnly', 'singular', 'none', 'none'] as const);
      const startKey = keys[keys.length - 2];
      const rounded = (value: number) => Math.round(value * 1000) / 1000;
      if (state === 'pair' || state === 'singular') {
        const zero = state === 'singular';
        startKey.bezierOut = { x: zero ? 0 : rounded(rand()), y: zero ? 0 : rounded(rand()) };
        key.bezierIn = { x: zero ? 0 : rounded(rand()), y: zero ? 0.2 : rounded(rand()) };
      } else if (state === 'outOnly') {
        startKey.bezierOut = { x: rounded(rand()), y: rounded(rand()) };
      } else if (state === 'inOnly') {
        key.bezierIn = { x: rounded(rand()), y: rounded(rand()) };
      }
    }
  }
  return keys;
}

async function emittedRuntime(keys: PropertyKeyframe[]): Promise<string> {
  const scene = {
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    name: 'A1 guard',
    width: 320,
    height: 180,
    fps: 60,
    totalFrames: keys[keys.length - 1]?.frame ?? 1,
    layers: [{
      id: 'shape', name: 'Shape', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1,
      opacity: 1, visible: true, zIndex: 1, fillColor: '#ff0000', strokeColor: '#000',
      strokeEnabled: false, fillEnabled: true, strokeWidth: 0,
    }],
    tracks: [{ partId: 'shape', channels: { x: keys } }],
  } as unknown as SceneData;
  const entry = 'virtual:kcs-a1';
  const resolved = `\0${entry}`;
  const result = await build({
    configFile: false,
    root: fileURLToPath(new URL('../../', import.meta.url)),
    logLevel: 'silent',
    plugins: [{
      name: 'kcs-a1',
      resolveId: (id) => (id.endsWith(entry) ? resolved : undefined),
      load: (id) => (id === resolved
        ? `import { generateGraphicModule } from ${JSON.stringify(runtimePath)}; export const moduleSource = generateGraphicModule(${JSON.stringify(scene)});`
        : undefined),
    }],
    build: { write: false, minify: true, lib: { entry, formats: ['iife'], name: 'KcsA1' } },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunk = outputs.flatMap((output) => ('output' in output ? output.output : []))
    .find((output) => output.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('A1 production compile failed to emit.');
  return new Function(`${chunk.code}\nreturn KcsA1.moduleSource;`)() as string;
}

class HostElement {
  innerHTML = '';
}

type Graphic = HostElement & { _currentFrame: number; _render: () => void };

function instantiate(source: string): Graphic {
  const body = source
    .replace('export default class Graphic', 'return class Graphic')
    .replaceAll('import.meta.url', JSON.stringify('https://example.test/graphic.mjs'));
  return new (new Function('HTMLElement', body)(HostElement) as new () => Graphic)();
}

function renderedX(graphic: Graphic, frame: number): number {
  graphic._currentFrame = frame;
  graphic._render();
  const match = /data-layer-id="shape"[\s\S]*?translate\(([-\d.]+) /u.exec(graphic.innerHTML);
  return match ? Number(match[1]) - 160 : NaN;
}

describe('A1 — seeded editor/runtime interpolation drift guard', () => {
  test('three fuzz channels agree at exact keys, half frames and in-between probes', async () => {
    for (const size of [40, 24, 64]) {
      const keys = fuzzKeys(size);
      const graphic = instantiate(await emittedRuntime(keys));
      const last = keys[keys.length - 1]?.frame ?? 0;
      const probes = [
        ...keys.map((key) => key.frame),
        ...keys.map((key) => key.frame + 0.5),
        ...keys.slice(0, -1).map((key, index) => (key.frame + (keys[index + 1] as typeof key).frame) / 2),
        -5, 0, last, last + 33,
      ];
      for (const probe of probes) {
        const editor = interpolateChannel(keys, probe, 0);
        const runtime = renderedX(graphic, probe);
        // Markup carries full-precision JS number strings; tolerance 6 only
        // absorbs float re-parsing, not semantics.
        expect([size, probe, runtime]).toEqual([size, probe, expect.closeTo(editor, 6)]);
      }
    }
  }, 180000);
});
