// N2b-S0 — interpolation drift characterization (test-only; no runtime change).
//
// Three assertion classes, deliberately separated:
//   EXPECTED-AND-GREEN : editor authority vs INDEPENDENT hand arithmetic —
//                        always asserted equal (green gate on the harness).
//   CHARACTERIZATION   : the production-minified emitted runtime's CURRENT
//                        output, pinned as recorded with an `N2-DRIFT` marker
//                        on rows that differ from the independent expectation.
//                        Descriptive, not aspirational; they fail the moment
//                        either side moves and S2 flips them on purpose.
//   PARITY-TARGET      : `test.fails` rows asserting runtime == independent
//                        expectation — pass while the drift exists and go RED
//                        the moment S2 fixes it (the flip is the checklist).
//
// Hold semantics (both authorities): the easing belongs to the segment that
// STARTS at the key, so a hold key freezes its value until the next key.
//
// The emitted bytes go through the SAME production minifier pipeline as
// `ografProductionRuntime.test.ts`, so minification is characterized too.

// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { describe, expect, test } from 'vitest';
import type { PropertyKeyframe } from '../types/animator';
import type { SceneData } from '../types/composition';
import { interpolateChannel, deriveAutoBezierControlPoints } from '../utils/defaults';
import { interpolateBezierPath } from '../utils/bezierPath';

// --- independent helper: bisection (a different algorithm than the runtime's
// Newton iteration, so agreement is real evidence, not shared code) -----------

function solveCubicY([x1, y1, x2, y2]: number[], input: number): number {
  const bez = (a: number, b: number, t: number) => {
    const inv = 1 - t;
    return 3 * inv * inv * t * a + 3 * inv * t * t * b + t * t * t;
  };
  if (input <= 0) return 0;
  if (input >= 1) return 1;
  let low = 0;
  let high = 1;
  let t = input;
  for (let i = 0; i < 80; i += 1) {
    const x = bez(x1, x2, t);
    if (Math.abs(x - input) < 1e-10) break;
    if (x < input) low = t; else high = t;
    t = (low + high) / 2;
  }
  return bez(y1, y2, t);
}

// --- channel fixtures ---------------------------------------------------------

const key = (id: string, frame: number, value: number, easing: PropertyKeyframe['easing'], extra: Partial<PropertyKeyframe> = {}): PropertyKeyframe =>
  ({ id, frame, value, easing, ...extra });

const HOLD_KEYS = [
  key('k0', 0, 10, 'linear'),
  key('k1', 100, 50, 'hold'),
  key('k2', 200, 80, 'linear'),
];
// Independent linear/hold arithmetic:
const EXPECT_HOLD_AT_50 = 30;    // 10 + (50-10) * 0.5, prev easing linear
const EXPECT_HOLD_FROZEN = 50;   // every probe in [100, 200)

const AUTOBZ_KEYS = [
  key('a0', 0, 0, 'linear'),
  key('a1', 50, 100, 'autoBezier'),
  key('a2', 100, 20, 'autoBezier'),
  key('a3', 150, 90, 'autoBezier'),
  key('a4', 200, 0, 'linear'),
];
// Independent value at f=75: editor-derived control points, bisected solve.
const AUTOBZ_EXPECTED_AT_75 = 100 + (20 - 100) * solveCubicY(
  deriveAutoBezierControlPoints(AUTOBZ_KEYS[1], AUTOBZ_KEYS[2], AUTOBZ_KEYS[0], AUTOBZ_KEYS[3]),
  0.5,
);
// The runtime's CURRENT fallback: fixed easeInOut handles.
const AUTOBZ_DRIFTED_AT_75 = 100 + (20 - 100) * solveCubicY([0.42, 0, 0.58, 1], 0.5);

const STORED_CP_KEYS = [
  key('c0', 0, 0, 'cubic_bezier', { bezierControlPoints: [0.1, 0.9, 0.9, 0.1] }),
  key('c1', 100, 100, 'linear'),
];

const DUPLICATE_KEYS = [
  key('d0', 0, 5, 'linear'),
  key('d1', 50, 7, 'linear'),
  key('d2', 50, 9, 'hold'),
  key('d3', 100, 11, 'linear'),
];

// --- emitted runtime (production-minified, same pipeline as the prod spec) ---

const runtimePath = fileURLToPath(new URL('../ograf/runtimeTemplate.ts', import.meta.url)).replaceAll('\\', '/');

async function minifiedModuleSource(scene: SceneData): Promise<string> {
  const entry = 'virtual:kcs-n2b-s0';
  const resolvedEntry = `\0${entry}`;
  const result = await build({
    configFile: false,
    root: fileURLToPath(new URL('../../', import.meta.url)),
    logLevel: 'silent',
    plugins: [{
      name: 'kcs-n2b-s0',
      resolveId: (id) => (id.endsWith(entry) ? resolvedEntry : undefined),
      load: (id) => (id === resolvedEntry
        ? `import { generateGraphicModule } from ${JSON.stringify(runtimePath)}; export const moduleSource = generateGraphicModule(${JSON.stringify(scene)});`
        : undefined),
    }],
    build: { write: false, minify: true, lib: { entry, formats: ['iife'], name: 'KcsN2bS0' } },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunk = outputs.flatMap((output) => ('output' in output ? output.output : []))
    .find((output) => output.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('N2b-S0 production compile failed to emit.');
  return new Function(`${chunk.code}\nreturn KcsN2bS0.moduleSource;`)() as string;
}

class HostElement {
  innerHTML = '';
}

type RuntimeGraphic = HostElement & {
  _currentFrame: number;
  _render: () => void;
  load: (p: { renderType: string }) => Promise<{ statusCode: number }>;
};

async function instantiate(scene: SceneData): Promise<RuntimeGraphic> {
  const source = (await minifiedModuleSource(scene))
    .replace('export default class Graphic', 'return class Graphic')
    .replaceAll('import.meta.url', JSON.stringify('https://example.test/graphic.mjs'));
  const Graphic = new Function('HTMLElement', source)(HostElement) as new () => RuntimeGraphic;
  const graphic = new Graphic();
  const loaded = await graphic.load({ renderType: 'realtime' });
  expect(loaded.statusCode).toBe(200);
  return graphic;
}

function sceneWith(x: PropertyKeyframe[]): SceneData {
  const base = {
    type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1,
    opacity: 1, visible: true, zIndex: 1, fillColor: '#ff0000',
    strokeColor: '#000000', fillEnabled: true, strokeEnabled: false, strokeWidth: 0,
  };
  return {
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    name: 'N2b S0',
    width: 320,
    height: 180,
    fps: 60,
    totalFrames: 200,
    layers: [{ ...base, id: 'shape', name: 'Shape' }],
    tracks: [{ partId: 'shape', channels: { x } }],
  } as unknown as SceneData;
}

function renderedX(graphic: RuntimeGraphic, frame: number): number {
  graphic._currentFrame = frame;
  graphic._render();
  const match = /data-layer-id="shape"[\s\S]*?translate\(([-\d.]+) /u.exec(graphic.innerHTML);
  return match ? Number(match[1]) - 160 : NaN;
}

describe('N2b-S0 — class 1: editor authority vs independent arithmetic', () => {
  test('hold rows exact at every probe', () => {
    expect(interpolateChannel(HOLD_KEYS, 50, 0)).toBe(EXPECT_HOLD_AT_50);
    expect(interpolateChannel(HOLD_KEYS, 100, 0)).toBe(EXPECT_HOLD_FROZEN);
    expect(interpolateChannel(HOLD_KEYS, 100.5, 0)).toBe(EXPECT_HOLD_FROZEN);
    expect(interpolateChannel(HOLD_KEYS, 150, 0)).toBe(EXPECT_HOLD_FROZEN);
  });

  test('autoBezier derived-tangent value at the segment midpoint', () => {
    expect(interpolateChannel(AUTOBZ_KEYS, 75, 0)).toBeCloseTo(AUTOBZ_EXPECTED_AT_75, 6);
  });

  test('stored control points beat derivation', () => {
    const independent = 100 * solveCubicY([0.1, 0.9, 0.9, 0.1], 0.5);
    expect(Math.abs(interpolateChannel(STORED_CP_KEYS, 50, 0) - independent)).toBeLessThan(1e-6);
  });

  test('duplicate-frame zero-duration: exact key wins with the first stable key', () => {
    expect(interpolateChannel(DUPLICATE_KEYS, 50, 0)).toBe(7);
  });

  test('one-sided path handle falls back to the ANCHOR (editor convention)', () => {
    const a = {
      version: 1 as const, coordinateSpace: 'normalized' as const, closed: false,
      points: [{ id: 'p', x: 0.5, y: 0.5, kind: 'corner' as const, handleOut: { x: 0.6, y: 0.5 } }],
    };
    const b = {
      version: 1 as const, coordinateSpace: 'normalized' as const, closed: false,
      points: [{ id: 'p', x: 0.5, y: 0.5, kind: 'corner' as const }],
    };
    const mid = interpolateBezierPath(a, b, 0.5)?.points[0];
    // Independent: lerp(handleOut=0.6 -> missing?fallback=anchor=0.5) at t=.5 = 0.55
    expect(mid?.handleOut?.x).toBeCloseTo(0.55, 10);
    expect(mid?.handleIn).toBeUndefined();
  });
});

describe('N2b-S0 — class 2: production-minified runtime characterization', () => {
  test('hold curve agrees at every documented probe', async () => {
    const graphic = await instantiate(sceneWith(HOLD_KEYS));
    expect(renderedX(graphic, 50)).toBe(EXPECT_HOLD_AT_50);
    expect(renderedX(graphic, 100)).toBe(EXPECT_HOLD_FROZEN);
    expect(renderedX(graphic, 100.5)).toBe(EXPECT_HOLD_FROZEN);
    expect(renderedX(graphic, 150)).toBe(EXPECT_HOLD_FROZEN);
  });

  test('N2-DRIFT autoBezier: emitted runtime uses the fixed easeInOut curve', async () => {
    const graphic = await instantiate(sceneWith(AUTOBZ_KEYS));
    expect(renderedX(graphic, 75)).toBeCloseTo(AUTOBZ_DRIFTED_AT_75, 6);
    // The drifted value is NOT the target; see class 3 for the parity row.
    expect(AUTOBZ_DRIFTED_AT_75).not.toBeCloseTo(AUTOBZ_EXPECTED_AT_75, 6);
  });

  test('duplicate/zero-duration frames agree across authorities', async () => {
    const graphic = await instantiate(sceneWith(DUPLICATE_KEYS));
    expect(renderedX(graphic, 50)).toBe(7);
  });

  test('seek direction and fractional frames are deterministic', async () => {
    const graphic = await instantiate(sceneWith(HOLD_KEYS));
    const forward = renderedX(graphic, 75);
    expect(forward).toBe(40);
    renderedX(graphic, 150);
    const backward = renderedX(graphic, 75);
    expect(backward).toBe(forward);
  });

  test('stored control points match the editor solve (characterized parity)', async () => {
    const graphic = await instantiate(sceneWith(STORED_CP_KEYS));
    expect(renderedX(graphic, 50)).toBeCloseTo(100 * solveCubicY([0.1, 0.9, 0.9, 0.1], 0.5), 6);
  });
});

describe('N2b-S0 — class 3: parity targets (red until N2b-S2)', () => {
  test.fails('autoBezier parity: runtime must equal the derived-tangent value', async () => {
    const graphic = await instantiate(sceneWith(AUTOBZ_KEYS));
    expect(renderedX(graphic, 75)).toBeCloseTo(AUTOBZ_EXPECTED_AT_75, 6);
  });

  test.fails('one-sided path handle parity: runtime must fall back to the anchor', async () => {
    const pathA = {
      version: 1, coordinateSpace: 'normalized', closed: false,
      points: [{ id: 'p', x: 0.5, y: 0.5, kind: 'corner', handleOut: { x: 0.6, y: 0.5 } }],
    };
    const pathB = {
      version: 1, coordinateSpace: 'normalized', closed: false,
      points: [{ id: 'p', x: 0.5, y: 0.5, kind: 'corner' }],
    };
    const scene = {
      version: 1,
      coordinateSystem: 'project-unit-center-v1',
      name: 'N2b S0 path',
      width: 320,
      height: 180,
      fps: 60,
      totalFrames: 100,
      layers: [{
        id: 'shape', name: 'Shape', type: 'custom_freeform', x: 0, y: 0, rotation: 0,
        scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
        fillColor: '#ff0000', strokeEnabled: false, fillEnabled: true, path: pathA,
      }],
      tracks: [{
        partId: 'shape',
        channels: {
          path: [
            { id: 'p0', frame: 0, easing: 'linear', value: pathA },
            { id: 'p1', frame: 100, easing: 'linear', value: pathB },
          ],
        },
      }],
    } as unknown as SceneData;
    const graphic = await instantiate(scene);
    graphic._currentFrame = 50;
    graphic._render();
    // Runtime mirrors the missing handle from the OTHER handle (start=0.6 ->
    // lerped 0.55?? no: start=a||b uses the present handle itself); the editor
    // lerps from the ANCHOR 0.5. The emitted C control x must show the editor's
    // 0.55 — the runtime currently emits its mirrored value instead.
    expect(graphic.innerHTML).toMatch(/C ?0?\.55/u);
  });
});
