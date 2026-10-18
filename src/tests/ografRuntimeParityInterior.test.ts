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
// (N2b-S2: the old fixed-easeInOut drift constant is retired — the runtime
// now derives neighbor tangents; coverage of the difference lives in the
// independent bisection oracle below.)

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

// Hold-BRIDGE keys: the HOLD easing sits on the FIRST key, so the segment
// 0->100 is frozen at 10 and the value must switch to the key at 100 exactly
// at frame 100. This is the fixture where the editor's exact-keyframe
// short-circuit and the runtime's first-matching-bracket + `hold => 0` arm
// genuinely differ (the one-frame lag): editor 50, runtime 10 at f=100.
const HOLD_BRIDGE_KEYS = [
  key('b0', 0, 10, 'hold'),
  key('b1', 100, 50, 'linear'),
  key('b2', 200, 80, 'linear'),
];
const BRIDGE_EDITOR_AT_100 = 50;    // exact key value (independent semantics)
const BRIDGE_FROZEN_BEFORE = 10;    // every probe in [0, 100), both sides
const BRIDGE_RESUME_AT_100_5 = 50.15; // linear-prev segment resumes motion immediately after the key

// Fully hand-derived AutoBezier control points for segment a1->a2 of
// AUTOBZ_KEYS (independent of the production derivation code):
//   duration=50, delta=-80
//   previousSlope = (20-0)/100  = 0.2   -> normalized = 0.2*50/-80 = -0.125
//   nextSlope     = (90-100)/100 = -0.1 -> normalized = -0.1*50/-80 = 0.0625
//   CP = [1/3, clamp01(-0.125/3)=0, 2/3, clamp01(1-0.0625/3)=0.9791666667]
const HAND_AUTOBZ_CP: [number, number, number, number] = [1 / 3, 0, 2 / 3, 0.9791666667];
// x(t)=3(1-t)^2 t(1/3)+3(1-t)t^2(2/3)+t^3 gives x(0.5)=0.5 exactly, so the
// root is t=0.5 and y(0.5)=3(1-t)t^2(0.9791667)+t^3=0.4921875.
// value = 100 + (20-100) * 0.4921875 = 60.625 (fully hand-checked).
const HAND_AUTOBZ_VALUE_AT_75 = 60.625;

// One-sided freeform handle: only handleOut exists at frame 0, none at frame
// 100 — the editor falls back to the point anchor, the runtime mirrors the
// present handle; the two emit different C control positions at mid-tween.
function oneSidedHandleScene(): SceneData {
  const pathA = {
    version: 1, coordinateSpace: 'normalized', closed: false,
    points: [{ id: 'p', x: 0.5, y: 0.5, kind: 'corner', handleOut: { x: 0.6, y: 0.5 } }],
  };
  const pathB = {
    version: 1, coordinateSpace: 'normalized', closed: false,
    points: [{ id: 'p', x: 0.5, y: 0.5, kind: 'corner' }],
  };
  return {
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
}
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

  test('autoBezier parity: the emitted runtime derives neighbor tangents', async () => {
    const graphic = await instantiate(sceneWith(AUTOBZ_KEYS));
    // N2b-S2 flip: the fixed easeInOut fallback is gone; the runtime now
    // ports the editor derivation, so the drifted pin became the parity pin.
    expect(renderedX(graphic, 75)).toBeCloseTo(AUTOBZ_EXPECTED_AT_75, 6);
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

  test('hold bridge parity: the exact interior key wins over the frozen segment', async () => {
    const graphic = await instantiate(sceneWith(HOLD_BRIDGE_KEYS));
    // N2b-S2 flip: exact-key short-circuit ported; the one-frame lag is gone.
    expect(renderedX(graphic, 100)).toBe(BRIDGE_EDITOR_AT_100);
    // Frozen-segment agreement, unchanged.
    expect(renderedX(graphic, 99)).toBe(BRIDGE_FROZEN_BEFORE);
    expect(renderedX(graphic, 100.5)).toBeCloseTo(BRIDGE_RESUME_AT_100_5, 9);
  });

  test('hand-derived autoBezier oracle agrees with the code path within hand precision', () => {
    // Independent literal vs the derivation the editor uses: two oracles.
    const cp = deriveAutoBezierControlPoints(AUTOBZ_KEYS[1], AUTOBZ_KEYS[2], AUTOBZ_KEYS[0], AUTOBZ_KEYS[3]);
    expect(cp[0]).toBeCloseTo(HAND_AUTOBZ_CP[0], 9);
    expect(cp[1]).toBeCloseTo(HAND_AUTOBZ_CP[1], 9);
    expect(cp[2]).toBeCloseTo(HAND_AUTOBZ_CP[2], 9);
    expect(cp[3]).toBeCloseTo(HAND_AUTOBZ_CP[3], 9);
    expect(interpolateChannel(AUTOBZ_KEYS, 75, 0)).toBeCloseTo(HAND_AUTOBZ_VALUE_AT_75, 3);
  });

  // Class 1 additions (editor side of the bridge rows live in class 1 above).
});

describe('N2b-S0 — class 3: parity targets (flipped green by N2b-S2)', () => {
  test('autoBezier parity: runtime must equal the derived-tangent value', async () => {
    const graphic = await instantiate(sceneWith(AUTOBZ_KEYS));
    expect(renderedX(graphic, 75)).toBeCloseTo(AUTOBZ_EXPECTED_AT_75, 6);
  });

  // Honest boundary note (review repair): single-path authored shapes animate
  // through the editor's freeform path channel, which is NOT part of the
  // runtime TrackChannel set, and the emitted runtime rejects a fabricated
  // `channels.path` fixture at construction time (assertSafeScene). The
  // one-sided-handle numeric comparison therefore rides the mask-path channel
  // (LayerMaskPathChannel) fixture in N2b-S2 planning — asserting it here via
  // an unsupported channel would let a broken harness pass silently.
  test('N2-BOUNDARY: fabricated path-channel fixtures are refused at construction', async () => {
    await expect(instantiate(oneSidedHandleScene())).rejects.toThrow(/Invalid keyframe value/u);
  });
});

describe('N2b-S0 — class 1 additions: hold bridge and hand oracle', () => {
  test('editor resolves the exact interior key of a hold-frozen segment to the key value', () => {
    expect(interpolateChannel(HOLD_BRIDGE_KEYS, 100, 0)).toBe(BRIDGE_EDITOR_AT_100);
    expect(interpolateChannel(HOLD_BRIDGE_KEYS, 99, 0)).toBe(BRIDGE_FROZEN_BEFORE);
    expect(interpolateChannel(HOLD_BRIDGE_KEYS, 100.5, 0)).toBeCloseTo(BRIDGE_RESUME_AT_100_5, 9);
  });
});

describe('N2b-S0 — class 3 additions: bridge parity target', () => {
  test('hold bridge parity: at the exact key the runtime must show 50, not the stale 10', async () => {
    const graphic = await instantiate(sceneWith(HOLD_BRIDGE_KEYS));
    expect(renderedX(graphic, 100)).toBe(BRIDGE_EDITOR_AT_100);
  });

  test('hand oracle parity: autoBezier runtime must match the hand-derived 60.625', async () => {
    const graphic = await instantiate(sceneWith(AUTOBZ_KEYS));
    expect(renderedX(graphic, 75)).toBeCloseTo(HAND_AUTOBZ_VALUE_AT_75, 3);
  });
});
