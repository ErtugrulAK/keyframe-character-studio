/**
 * Phase 2 Step 6 — evaluateFrame parity tests
 *
 * Verifies that the pure evaluateFrame function produces correct results
 * matching the current PartRenderer + useMath behavior.
 */

import { describe, test, expect } from 'vitest';
import { evaluateFrame } from '../utils/evaluateFrame';
import { evaluateTransform } from '../utils/evaluateTransform';
import type { CharacterPart, Track, Keyframe, CustomMotionPreset } from '../types/animator';
import type { RuntimeData } from '../types/composition';

// ─── Test Helpers ─────────────────────────────────────────────────────

function makeLayer(overrides: Partial<CharacterPart> = {}): CharacterPart {
  return {
    id: 'L1',
    name: 'Test',
    type: 'custom_box',
    zIndex: 1,
    fillColor: '#ffffff',
    strokeColor: '#000000',
    pivot: { x: 0, y: 0 },
    baseTransform: { x: 100, y: 200, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    ...overrides,
  } as CharacterPart;
}

function makeTrack(layerId: string, keyframes: Keyframe[] = []): Track {
  return {
    id: `T_${layerId}`,
    partId: layerId,
    name: 'Track',
    color: '#ff0000',
    keyframes,
    channels: { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
      maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [] },
    visible: true,
    locked: false,
  } as Track;
}

function makeRuntime(overrides: Partial<RuntimeData> = {}): RuntimeData {
  return {
    appMode: 'edit',
    broadcast: {},
    liveStunts: {},
    ...overrides,
  };
}

const NO_PRESETS: CustomMotionPreset[] = [];

// ─── Transform Tests ──────────────────────────────────────────────────

describe('evaluateFrame — transforms', () => {

  test('single layer base transform', () => {
    const layers = [makeLayer({ baseTransform: { x: 100, y: 200, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } })];
    const result = evaluateFrame(layers, [], 120, 0, makeRuntime(), NO_PRESETS);

    expect(result.layers).toHaveLength(1);
    expect(result.layers[0].transform.x).toBe(100);
    expect(result.layers[0].transform.y).toBe(200);
    expect(result.layers[0].transform.rotation).toBe(0);
    expect(result.layers[0].transform.scaleX).toBe(1);
    expect(result.layers[0].transform.scaleY).toBe(1);
    expect(result.layers[0].visible).toBe(true);
  });

  test('default transform for missing layer', () => {
    // evaluateTransform handles missing layer internally
    const result = evaluateTransform([], [], 'Sequence', 'nonexistent', 0);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  test('missing track returns base transform', () => {
    const layers = [makeLayer({ id: 'A', baseTransform: { x: 50, y: 60, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } })];
    // Track exists but for different partId
    const tracks = [makeTrack('B')];
    const result = evaluateFrame(layers, tracks, 120, 0, makeRuntime(), NO_PRESETS);

    expect(result.layers[0].transform.x).toBe(50);
    expect(result.layers[0].transform.y).toBe(60);
    expect(result.layers[0].opacity).toBe(1);
  });
});

// ─── Keyframe Tests ───────────────────────────────────────────────────

describe('evaluateFrame — keyframes', () => {

  test('legacy composite exact frame match', () => {
    const layers = [makeLayer({ id: 'A', baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } })];
    const tracks = [makeTrack('A', [
      { id: 'k1', frame: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' },
      { id: 'k2', frame: 60, transform: { x: 300, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' },
    ])];

    const result = evaluateFrame(layers, tracks, 120, 60, makeRuntime(), NO_PRESETS);
    expect(result.layers[0].transform.x).toBe(300);
  });

  test('legacy composite midpoint interpolation', () => {
    const layers = [makeLayer({ id: 'A', baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } })];
    const tracks = [makeTrack('A', [
      { id: 'k1', frame: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' },
      { id: 'k2', frame: 100, transform: { x: 100, y: 0, rotation: 0, scaleX: 2, scaleY: 2, opacity: 1 }, easing: 'linear' },
    ])];

    const result = evaluateFrame(layers, tracks, 120, 50, makeRuntime(), NO_PRESETS);
    expect(result.layers[0].transform.x).toBeCloseTo(50, 0);
    expect(result.layers[0].transform.scaleX).toBeCloseTo(1.5, 1);
  });

  test('per-channel overrides legacy composite', () => {
    const layers = [makeLayer({ id: 'A', baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } })];
    const tracks: Track[] = [{
      ...makeTrack('A'),
      keyframes: [
        { id: 'k1', frame: 10, transform: { x: 200, y: 200, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' },
      ],
      channels: {
        x: [{ id: 'px', frame: 10, value: 500, easing: 'linear' }],
        y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
        maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
      },
    } as any];

    const result = evaluateFrame(layers, tracks, 120, 10, makeRuntime(), NO_PRESETS);
    // Channel x=500 beats legacy x=200
    expect(result.layers[0].transform.x).toBe(500);
    // y has no channel, falls back to legacy y=200
    expect(result.layers[0].transform.y).toBe(200);
  });
});

// ─── Named Sequence Evaluation Tests ────────────────────────────────

describe('evaluateFrame — named sequence authority', () => {
  const BASE = { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

  function makeSequenceTrack(
    layerId: string,
    sequenceId: string,
    property: 'x' | 'y' | 'opacity',
    startValue: number,
    endValue: number,
    easing: Keyframe['easing'] = 'linear',
  ): Track {
    const track = makeTrack(layerId);
    track.channels[property] = [
      { id: `${sequenceId}-${property}-0`, frame: 0, value: startValue, easing, templateId: sequenceId },
      { id: `${sequenceId}-${property}-100`, frame: 100, value: endValue, easing: 'linear', templateId: sequenceId },
    ];
    return track;
  }

  test('keeps the omitted sequence ID backward-compatible with Sequence', () => {
    const layer = makeLayer({ id: 'A', baseTransform: BASE });
    const track = makeSequenceTrack('A', 'Sequence', 'x', 0, 100);

    const implicit = evaluateFrame([layer], [track], 100, 50, makeRuntime(), NO_PRESETS);
    const explicit = evaluateFrame([layer], [track], 100, 50, makeRuntime(), NO_PRESETS, undefined, 'Sequence');

    expect(implicit.layers[0].transform.x).toBe(50);
    expect(implicit).toEqual(explicit);
  });

  test('evaluates only the selected non-default canonical channel at frame 0, intermediate, and final', () => {
    const layer = makeLayer({ id: 'A', baseTransform: BASE });
    const special = makeSequenceTrack('A', 'SPECIAL', 'x', 200, 400);
    special.channels.x.push(
      { id: 'other-x-0', frame: 0, value: 900, easing: 'linear', templateId: 'OTHER' },
      { id: 'other-x-100', frame: 100, value: 1000, easing: 'linear', templateId: 'OTHER' },
    );

    const atStart = evaluateFrame([layer], [special], 100, 0, makeRuntime(), NO_PRESETS, undefined, 'SPECIAL');
    const atMiddle = evaluateFrame([layer], [special], 100, 50, makeRuntime(), NO_PRESETS, undefined, 'SPECIAL');
    const atEnd = evaluateFrame([layer], [special], 100, 100, makeRuntime(), NO_PRESETS, undefined, 'SPECIAL');

    expect(atStart.layers[0].transform.x).toBe(200);
    expect(atMiddle.layers[0].transform.x).toBe(300);
    expect(atEnd.layers[0].transform.x).toBe(400);
  });

  test('falls back to the base transform when the selected sequence has no keyframes', () => {
    const layer = makeLayer({ id: 'A', baseTransform: BASE });
    const track = makeSequenceTrack('A', 'OTHER', 'x', 200, 400);

    const result = evaluateFrame([layer], [track], 100, 50, makeRuntime(), NO_PRESETS, undefined, 'MISSING');

    expect(result.layers[0].transform.x).toBe(BASE.x);
    expect(result.layers[0].transform.y).toBe(BASE.y);
  });

  test('filters legacy composite keyframes by the selected sequence', () => {
    const layer = makeLayer({ id: 'A', baseTransform: BASE });
    const track = makeTrack('A', [
      { id: 'special-0', frame: 0, transform: { ...BASE, x: 100 }, easing: 'linear', templateId: 'SPECIAL' },
      { id: 'special-100', frame: 100, transform: { ...BASE, x: 300 }, easing: 'linear', templateId: 'SPECIAL' },
      { id: 'other-0', frame: 0, transform: { ...BASE, x: 800 }, easing: 'linear', templateId: 'OTHER' },
      { id: 'other-100', frame: 100, transform: { ...BASE, x: 900 }, easing: 'linear', templateId: 'OTHER' },
    ]);

    const result = evaluateFrame([layer], [track], 100, 50, makeRuntime(), NO_PRESETS, undefined, 'SPECIAL');

    expect(result.layers[0].transform.x).toBe(200);
  });

  test('preserves parent transform composition for a non-default sequence', () => {
    const parent = makeLayer({ id: 'P', baseTransform: { ...BASE, x: 0, y: 0 } });
    const child = makeLayer({ id: 'C', parentId: 'P', baseTransform: { ...BASE, x: 10, y: 0 } });
    const parentTrack = makeSequenceTrack('P', 'SPECIAL', 'x', 100, 200);

    const result = evaluateFrame(
      [parent, child],
      [parentTrack, makeTrack('C')],
      100,
      50,
      makeRuntime(),
      NO_PRESETS,
      undefined,
      'SPECIAL',
    );

    expect(result.layers.find((candidate) => candidate.id === 'C')?.transform.x).toBe(160);
  });

  test('preserves opacity easing for a non-default sequence', () => {
    const layer = makeLayer({ id: 'A', baseTransform: BASE });
    const track = makeSequenceTrack('A', 'SPECIAL', 'opacity', 0, 1, 'easeIn');
    const expected = evaluateTransform([layer], [track], 'SPECIAL', 'A', 50).opacity;

    const result = evaluateFrame([layer], [track], 100, 50, makeRuntime(), NO_PRESETS, undefined, 'SPECIAL');

    expect(result.layers[0].opacity).toBeCloseTo(expected, 5);
    expect(result.layers[0].opacity).toBeGreaterThan(0);
    expect(result.layers[0].opacity).toBeLessThan(0.5);
  });

  test('preserves procedural delta composition with a non-default sequence', () => {
    const layer = makeLayer({
      id: 'A',
      baseTransform: { ...BASE, x: 0 },
      inAnimPreset: 'slide-left',
      inAnimDuration: 30,
    });
    const track = makeSequenceTrack('A', 'SPECIAL', 'x', 100, 200);
    const runtime = makeRuntime({
      appMode: 'broadcast',
      broadcast: { A: { state: 'animating_in', progress: 0.5 } },
    });

    const result = evaluateFrame([layer], [track], 100, 50, runtime, NO_PRESETS, undefined, 'SPECIAL');

    expect(result.layers[0].transform.x).toBeCloseTo(187.5, 5);
    expect(result.layers[0].opacity).toBeCloseTo(0.875, 5);
  });

  test('evaluates matte source and target transforms through the same non-default sequence', () => {
    const source = makeLayer({ id: 'SOURCE', baseTransform: BASE });
    const target = makeLayer({
      id: 'TARGET',
      baseTransform: BASE,
      matte: { sourcePartId: 'SOURCE', mode: 'alpha', enabled: true },
    });
    const sourceTrack = makeSequenceTrack('SOURCE', 'SPECIAL', 'x', 100, 300);
    const targetTrack = makeSequenceTrack('TARGET', 'SPECIAL', 'y', 200, 400);

    const result = evaluateFrame(
      [source, target],
      [sourceTrack, targetTrack],
      100,
      50,
      makeRuntime(),
      NO_PRESETS,
      undefined,
      'SPECIAL',
    );

    expect(result.layers.find((candidate) => candidate.id === 'SOURCE')?.transform.x).toBe(200);
    expect(result.layers.find((candidate) => candidate.id === 'TARGET')?.transform.y).toBe(300);
  });
});

// ─── Hierarchy Tests ──────────────────────────────────────────────────

describe('evaluateFrame — hierarchy', () => {

  test('parent-child world transform', () => {
    const parent = makeLayer({ id: 'P', baseTransform: { x: 100, y: 0, rotation: 0, scaleX: 2, scaleY: 2, opacity: 1 } });
    const child = makeLayer({ id: 'C', parentId: 'P', baseTransform: { x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } });
    const layers = [parent, child];
    const tracks = [makeTrack('P'), makeTrack('C')];

    const result = evaluateFrame(layers, tracks, 120, 0, makeRuntime(), NO_PRESETS);

    const cLayer = result.layers.find(l => l.id === 'C')!;
    // child.x(50) * parent.sx(2) + parent.x(100) = 200
    expect(cLayer.transform.x).toBeCloseTo(200, 0);
    expect(cLayer.transform.scaleX).toBeCloseTo(2, 1);
  });

  test('nested hierarchy 3 levels', () => {
    const gp = makeLayer({ id: 'GP', baseTransform: { x: 10, y: 0, rotation: 0, scaleX: 2, scaleY: 2, opacity: 1 } });
    const p = makeLayer({ id: 'P', parentId: 'GP', baseTransform: { x: 20, y: 0, rotation: 0, scaleX: 1.5, scaleY: 1.5, opacity: 1 } });
    const c = makeLayer({ id: 'C', parentId: 'P', baseTransform: { x: 30, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } });
    const layers = [gp, p, c];
    const tracks = [makeTrack('GP'), makeTrack('P'), makeTrack('C')];

    const result = evaluateFrame(layers, tracks, 120, 0, makeRuntime(), NO_PRESETS);

    const cLayer = result.layers.find(l => l.id === 'C')!;
    // child.x(30)*p.sx(1.5)=45, +p.x(20)=65, *gp.sx(2)=130, +gp.x(10)=140
    expect(cLayer.transform.x).toBeCloseTo(140, 0);
    expect(cLayer.transform.scaleX).toBeCloseTo(3, 1);
  });

  test('parent rotation propagates to child', () => {
    const parent = makeLayer({ id: 'P', baseTransform: { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1, opacity: 1 } });
    const child = makeLayer({ id: 'C', parentId: 'P', baseTransform: { x: 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } });
    const layers = [parent, child];
    const tracks = [makeTrack('P'), makeTrack('C')];

    const result = evaluateFrame(layers, tracks, 120, 0, makeRuntime(), NO_PRESETS);

    const cLayer = result.layers.find(l => l.id === 'C')!;
    // Child at (100,0) in parent rotated 90° → (0, 100) in world
    expect(cLayer.transform.x).toBeCloseTo(0, 0);
    expect(cLayer.transform.y).toBeCloseTo(100, 0);
    expect(cLayer.transform.rotation).toBe(90);
  });

  test('Boolean operands inherit the parent transform while preserving local offsets', () => {
    const parent = makeLayer({ id: 'B', baseTransform: { x: 100, y: -20, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } });
    const operand = makeLayer({
      id: 'O',
      booleanGroupId: 'B',
      baseTransform: { x: 35, y: 15, rotation: 10, scaleX: 1, scaleY: 1, opacity: 1 },
    });
    const result = evaluateFrame([parent, operand], [makeTrack('B'), makeTrack('O')], 120, 0, makeRuntime(), NO_PRESETS);
    const evaluated = result.layers.find((layer) => layer.id === 'O')!;

    expect(evaluated.transform.x).toBe(135);
    expect(evaluated.transform.y).toBe(-5);
    expect(evaluated.transform.rotation).toBe(10);
  });

  test('missing parent falls back to no parent', () => {
    const child = makeLayer({ id: 'C', parentId: 'GHOST', baseTransform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } });
    const layers = [child];

    const result = evaluateFrame(layers, [], 120, 0, makeRuntime(), NO_PRESETS);

    // Should not crash — treats as root layer
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0].transform.x).toBe(10);
  });
});

// ─── Visibility & Opacity Tests ───────────────────────────────────────

describe('evaluateFrame — visibility & opacity', () => {

  test('base opacity flows through', () => {
    const layers = [makeLayer({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0.7 } })];
    const result = evaluateFrame(layers, [], 120, 0, makeRuntime(), NO_PRESETS);

    expect(result.layers[0].opacity).toBeCloseTo(0.7, 2);
    expect(result.layers[0].visible).toBe(true);
  });

  test('editVisible=false hides layer', () => {
    const layers = [makeLayer({ id: 'A' })];
    const tracks: Track[] = [{
      ...makeTrack('A'),
      editVisible: false,
    } as any];

    const result = evaluateFrame(layers, tracks, 120, 0, makeRuntime({ appMode: 'edit' }), NO_PRESETS);

    expect(result.layers[0].opacity).toBe(0);
    expect(result.layers[0].visible).toBe(false);
  });

  test('zIndex ordering', () => {
    const a = makeLayer({ id: 'A', zIndex: 3 });
    const b = makeLayer({ id: 'B', zIndex: 1 });
    const c = makeLayer({ id: 'C', zIndex: 2 });
    const layers = [a, b, c];

    const result = evaluateFrame(layers, [], 120, 0, makeRuntime(), NO_PRESETS);

    expect(result.layers[0].id).toBe('B'); // zIndex 1
    expect(result.layers[1].id).toBe('C'); // zIndex 2
    expect(result.layers[2].id).toBe('A'); // zIndex 3
  });

  test('zIndex sorting preserves zero/negative values and does not mutate source order', () => {
    const layers = [
      makeLayer({ id: 'zero', zIndex: 0 }),
      makeLayer({ id: 'negative', zIndex: -2 }),
      makeLayer({ id: 'positive', zIndex: 5 }),
    ];
    const sourceOrder = layers.map((layer) => layer.id);

    const result = evaluateFrame(layers, [], 120, 0, makeRuntime(), NO_PRESETS);

    expect(result.layers.map((layer) => layer.id)).toEqual(['negative', 'zero', 'positive']);
    expect(layers.map((layer) => layer.id)).toEqual(sourceOrder);
  });
});

// ─── Broadcast Tests ──────────────────────────────────────────────────

describe('evaluateFrame — broadcast', () => {

  test('broadcast hidden → opacity=0', () => {
    const layers = [makeLayer({ id: 'A' })];
    const runtime = makeRuntime({
      appMode: 'broadcast',
      broadcast: { A: { state: 'hidden', progress: 0 } },
    });

    const result = evaluateFrame(layers, [], 120, 0, runtime, NO_PRESETS);

    expect(result.layers[0].opacity).toBe(0);
    expect(result.layers[0].visible).toBe(false);
  });

  test('broadcast visible → opacity=1', () => {
    const layers = [makeLayer({ id: 'A' })];
    const runtime = makeRuntime({
      appMode: 'broadcast',
      broadcast: { A: { state: 'visible', progress: 1 } },
    });

    const result = evaluateFrame(layers, [], 120, 0, runtime, NO_PRESETS);

    expect(result.layers[0].opacity).toBe(1);
    expect(result.layers[0].visible).toBe(true);
  });

  test('broadcast fade-in preset', () => {
    const layer = makeLayer({
      id: 'A',
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    });
    (layer as any).inAnimPreset = 'fade';
    (layer as any).inAnimDuration = 30;
    const layers = [layer];
    const runtime = makeRuntime({
      appMode: 'broadcast',
      broadcast: { A: { state: 'animating_in', progress: 0.5 } },
    });

    const result = evaluateFrame(layers, [], 120, 30, runtime, NO_PRESETS);

    // At progress 0.5: eased = 1 - (1-0.5)^3 = 1 - 0.125 = 0.875
    expect(result.layers[0].opacity).toBeCloseTo(0.875, 2);
    expect(result.layers[0].visible).toBe(true);
  });

  test('broadcast fade-out preset', () => {
    const layer = makeLayer({
      id: 'A',
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    });
    (layer as any).outAnimPreset = 'fade';
    (layer as any).outAnimDuration = 30;
    const layers = [layer];
    const runtime = makeRuntime({
      appMode: 'broadcast',
      broadcast: { A: { state: 'animating_out', progress: 0.5 } },
    });

    const result = evaluateFrame(layers, [], 120, 60, runtime, NO_PRESETS);

    // Out progress 0.5: eased = 0.5^3 = 0.125
    expect(result.layers[0].opacity).toBeCloseTo(0.125, 2);
  });

  test('broadcast track muted → opacity=0', () => {
    const layers = [makeLayer({ id: 'A' })];
    const tracks: Track[] = [{
      ...makeTrack('A'),
      visible: false,
    }];
    const runtime = makeRuntime({
      appMode: 'broadcast',
      broadcast: { A: { state: 'visible', progress: 1 } },
    });

    const result = evaluateFrame(layers, tracks, 120, 0, runtime, NO_PRESETS);

    // track.visible=false → opacity=0 even though broadcast says visible
    expect(result.layers[0].opacity).toBe(0);
  });
});

// ─── Live Stunt Tests ─────────────────────────────────────────────────

describe('evaluateFrame — live stunts', () => {

  test('bounce stunt adds Y offset', () => {
    const layers = [makeLayer({ id: 'A', baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } })];
    const runtime = makeRuntime({
      appMode: 'edit',
      liveStunts: { A: { stunt: 'bounce', progress: 0.5 } },
    });

    const result = evaluateFrame(layers, [], 120, 0, runtime, NO_PRESETS);

    // sin(0.5 * PI) * -80 = sin(1.5708) * -80 = 1 * -80 = -80
    expect(result.layers[0].transform.y).toBeCloseTo(-80, 0);
  });

  test('float stunt adds oscillating Y', () => {
    const layers = [makeLayer({ id: 'A', baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } })];
    const runtime = makeRuntime({
      appMode: 'edit',
      liveStunts: { A: { stunt: 'float', progress: 0.25 } },
    });

    const result = evaluateFrame(layers, [], 120, 0, runtime, NO_PRESETS);

    // sin(0.25 * 2PI) * -30 = sin(1.5708) * -30 = -30
    expect(result.layers[0].transform.y).toBeCloseTo(-30, 0);
  });
});

// ─── Content Tests ────────────────────────────────────────────────────

describe('evaluateFrame — content passthrough', () => {

  test('shape layer content', () => {
    const layers = [makeLayer({
      fillColor: '#ff0000',
      strokeColor: '#0000ff',
      borderRadius: 8,
      shadowColor: 'rgba(0,0,0,0.3)',
      shadowBlur: 10,
    })];
    const result = evaluateFrame(layers, [], 120, 0, makeRuntime(), NO_PRESETS);

    expect(result.layers[0].content.fillColor).toBe('#ff0000');
    expect(result.layers[0].content.strokeColor).toBe('#0000ff');
    expect(result.layers[0].content.borderRadius).toBe(8);
    expect(result.layers[0].content.shadowColor).toBe('rgba(0,0,0,0.3)');
    expect(result.layers[0].content.shadowBlur).toBe(10);
  });

  test('text layer content', () => {
    const layers = [makeLayer({
      type: 'custom_text',
      textValue: 'Hello',
      fontSize: 24,
    })];
    (layers[0] as any).fontFamily = 'Arial';
    const result = evaluateFrame(layers, [], 120, 0, makeRuntime(), NO_PRESETS);

    expect(result.layers[0].content.textValue).toBe('Hello');
    expect(result.layers[0].content.fontSize).toBe(24);
  });
});

// ─── Extended Broadcast Preset Tests ────────────────────────────────

describe('evaluateFrame — broadcast presets extended', () => {

  function makeBroadcastLayer(preset: string, mode: 'in' | 'out') {
    const layer = makeLayer({
      id: 'A',
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    });
    if (mode === 'in') {
      (layer as any).inAnimPreset = preset;
      (layer as any).inAnimDuration = 30;
    } else {
      (layer as any).outAnimPreset = preset;
      (layer as any).outAnimDuration = 30;
    }
    return layer;
  }

  function makeRuntimeForPreset(mode: 'in' | 'out', progress: number): RuntimeData {
    return makeRuntime({
      appMode: 'broadcast',
      broadcast: { A: { state: mode === 'in' ? 'animating_in' : 'animating_out', progress } },
    });
  }

  test('broadcast slide-left in', () => {
    const layer = makeBroadcastLayer('slide-left', 'in');
    const result = evaluateFrame([layer], [], 120, 30, makeRuntimeForPreset('in', 0.5), NO_PRESETS);
    // eased = 0.875, dist = 300 * (1-0.875) = 37.5
    expect(result.layers[0].transform.x).toBeCloseTo(37.5, 0);
    expect(result.layers[0].opacity).toBeCloseTo(0.875, 2);
  });

  test('broadcast slide-right out', () => {
    const layer = makeBroadcastLayer('slide-right', 'out');
    const result = evaluateFrame([layer], [], 120, 60, makeRuntimeForPreset('out', 0.5), NO_PRESETS);
    // out eased = 0.125, dist = -300*(1-0.125)*(-1) = 262.5
    expect(result.layers[0].transform.x).toBeCloseTo(262.5, 0);
  });

  test('broadcast slide-up in', () => {
    const layer = makeBroadcastLayer('slide-up', 'in');
    const result = evaluateFrame([layer], [], 120, 30, makeRuntimeForPreset('in', 0.5), NO_PRESETS);
    expect(result.layers[0].transform.y).toBeCloseTo(37.5, 0);
  });

  test('broadcast slide-down out', () => {
    const layer = makeBroadcastLayer('slide-down', 'out');
    const result = evaluateFrame([layer], [], 120, 60, makeRuntimeForPreset('out', 0.5), NO_PRESETS);
    expect(result.layers[0].transform.y).toBeCloseTo(262.5, 0);
  });

  test('broadcast pop in', () => {
    const layer = makeBroadcastLayer('pop', 'in');
    const result = evaluateFrame([layer], [], 120, 30, makeRuntimeForPreset('in', 0.5), NO_PRESETS);
    // eased = 0.875, scale = 0.875
    expect(result.layers[0].transform.scaleX).toBeCloseTo(0.875, 2);
    expect(result.layers[0].transform.scaleY).toBeCloseTo(0.875, 2);
  });

  test('broadcast spin in', () => {
    const layer = makeBroadcastLayer('spin', 'in');
    const result = evaluateFrame([layer], [], 120, 30, makeRuntimeForPreset('in', 0.5), NO_PRESETS);
    // eased = 0.875, rot = (1-0.875) * -360 = -45
    expect(result.layers[0].transform.rotation).toBeCloseTo(-45, 0);
  });
});

// ─── enableMotionAnim = false ───────────────────────────────────────

describe('evaluateFrame — enableMotionAnim', () => {

  test('enableMotionAnim=false skips broadcast animation', () => {
    const layer = makeLayer({
      id: 'A',
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    });
    (layer as any).inAnimPreset = 'fade';
    (layer as any).inAnimDuration = 30;
    (layer as any).enableMotionAnim = false;
    const runtime = makeRuntime({
      appMode: 'broadcast',
      broadcast: { A: { state: 'animating_in', progress: 0.5 } },
    });

    const result = evaluateFrame([layer], [], 120, 30, runtime, NO_PRESETS);

    // Motion disabled → no broadcast animation applied → opacity stays at base
    expect(result.layers[0].opacity).toBe(1);
  });
});

// ─── custom_timeline frame override ─────────────────────────────────

describe('evaluateFrame — custom_timeline frame override', () => {

  test('custom_timeline evaluates at overridden frame', () => {
    const layer = makeLayer({
      id: 'A',
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    });
    (layer as any).inAnimPreset = 'custom_timeline';
    (layer as any).inAnimDuration = 30;
    const tracks = [makeTrack('A', [
      { id: 'k1', frame: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' },
      { id: 'k2', frame: 60, transform: { x: 300, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' },
    ])];
    const runtime = makeRuntime({
      appMode: 'broadcast',
      broadcast: { A: { state: 'animating_in', progress: 0.5 } },
    });

    // Without override: evaluates at currentFrame=30 → x=150 (midpoint of 0..300)
    const noOverride = evaluateFrame([layer], tracks, 120, 30, runtime, NO_PRESETS);
    expect(noOverride.layers[0].transform.x).toBeCloseTo(150, 0);

    // With override to frame 60: evaluates at frame 60 → x=300 (end keyframe)
    const withOverride = evaluateFrame([layer], tracks, 120, 30, runtime, NO_PRESETS, { A: 60 });
    expect(withOverride.layers[0].transform.x).toBe(300);
  });
});

// ─── Cloner / Particle content passthrough ──────────────────────────

describe('evaluateFrame — cloner/particle content', () => {

  test('clonerConfig passes through', () => {
    const clonerCfg = { mode: 'grid', countX: 3, countY: 2 };
    const layer = makeLayer({ id: 'A', type: 'mograph_cloner' });
    (layer as any).clonerConfig = clonerCfg;

    const result = evaluateFrame([layer], [], 120, 0, makeRuntime(), NO_PRESETS);
    expect(result.layers[0].content.clonerConfig).toEqual(clonerCfg);
  });

  test('particleConfig passes through', () => {
    const particleCfg = { count: 10, speed: 5 };
    const layer = makeLayer({ id: 'A', type: 'particle_system' });
    (layer as any).particleConfig = particleCfg;

    const result = evaluateFrame([layer], [], 120, 0, makeRuntime(), NO_PRESETS);
    expect(result.layers[0].content.particleConfig).toEqual(particleCfg);
  });
});

// ─── Opacity Parity Tests (P4-S2) ─────────────────────────────────────

describe('evaluateFrame — opacity parity with evaluateTransform', () => {

  test('base opacity is used when no keyframes exist', () => {
    const layers = [makeLayer({ id: 'A', baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0.6 } })];
    const result = evaluateFrame(layers, [], 120, 30, makeRuntime(), NO_PRESETS);

    expect(result.layers[0].opacity).toBeCloseTo(0.6, 5);
    expect(result.layers[0].transform.opacity).toBeCloseTo(0.6, 5);

    // Same value via evaluateTransform (used by useMath/getComputedTransform)
    const world = evaluateTransform(layers, [], 'Sequence', 'A', 30);
    expect(world.opacity).toBeCloseTo(0.6, 5);
  });

  test('legacy composite keyframe opacity is interpolated', () => {
    const kf0: Keyframe = {
      id: 'k0', frame: 0,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0.2 },
    };
    const kf120: Keyframe = {
      id: 'k1', frame: 120,
      transform: { x: 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1.0 },
    };
    const layers = [makeLayer({ id: 'A' })];
    const tracks = [makeTrack('A', [kf0, kf120])];

    const mid = evaluateFrame(layers, tracks, 120, 60, makeRuntime(), NO_PRESETS);
    // Linear interp at frame 60: 0.2 + (1.0-0.2)/2 = 0.6
    expect(mid.layers[0].opacity).toBeCloseTo(0.6, 4);

    // Parity: evaluateTransform (editor API source) returns the same opacity
    const worldMid = evaluateTransform(layers, tracks, 'Sequence', 'A', 60);
    expect(worldMid.opacity).toBeCloseTo(0.6, 4);

    const end = evaluateFrame(layers, tracks, 120, 120, makeRuntime(), NO_PRESETS);
    expect(end.layers[0].opacity).toBeCloseTo(1.0, 5);
  });

  test('canonical opacity channel wins over legacy keyframes', () => {
    const kfLegacy: Keyframe = {
      id: 'k0', frame: 0,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0.2 },
    };
    const layers = [makeLayer({ id: 'A' })];
    const track = makeTrack('A', [kfLegacy]);
    // opacity channel: 0 → 0.1, 120 → 0.9
    track.channels.opacity = [
      { id: 'pk1', frame: 0, value: 0.1, easing: 'linear' },
      { id: 'pk2', frame: 120, value: 0.9, easing: 'linear' },
    ];

    const result = evaluateFrame(layers, [track], 120, 60, makeRuntime(), NO_PRESETS);
    // Channel interpolation (0.1+0.8/2 = 0.5) wins over legacy keyframe (0.6)
    expect(result.layers[0].opacity).toBeCloseTo(0.5, 4);

    const world = evaluateTransform(layers, [track], 'Sequence', 'A', 60);
    expect(world.opacity).toBeCloseTo(0.5, 4);
  });

  test('animated opacity changes with frame', () => {
    const kf0: Keyframe = {
      id: 'k0', frame: 0,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0 },
    };
    const kf120: Keyframe = {
      id: 'k1', frame: 120,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    };
    const layers = [makeLayer({ id: 'A' })];
    const tracks = [makeTrack('A', [kf0, kf120])];

    const f0 = evaluateFrame(layers, tracks, 120, 0, makeRuntime(), NO_PRESETS);
    const f60 = evaluateFrame(layers, tracks, 120, 60, makeRuntime(), NO_PRESETS);
    const f120 = evaluateFrame(layers, tracks, 120, 120, makeRuntime(), NO_PRESETS);

    expect(f0.layers[0].opacity).toBeCloseTo(0, 4);
    expect(f60.layers[0].opacity).toBeCloseTo(0.5, 4);
    expect(f120.layers[0].opacity).toBeCloseTo(1, 4);
  });

  test('renderer (evaluateFrame) and editor API (evaluateTransform) agree at every frame', () => {
    const kf0: Keyframe = {
      id: 'k0', frame: 0,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0.3 },
    };
    const kf120: Keyframe = {
      id: 'k1', frame: 120,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0.9 },
    };
    const layers = [makeLayer({ id: 'A' })];
    const tracks = [makeTrack('A', [kf0, kf120])];

    for (const frame of [0, 15, 30, 45, 60, 75, 90, 105, 120]) {
      const frameResult = evaluateFrame(layers, tracks, 120, frame, makeRuntime(), NO_PRESETS);
      const world = evaluateTransform(layers, tracks, 'Sequence', 'A', frame);
      expect(frameResult.layers[0].opacity).toBeCloseTo(world.opacity, 5);
    }
  });
});

// ─── P4-S4: Legacy Keyframe[] ↔ Channels Migration Parity ──────────────

describe('P4-S4 — legacy composite vs canonical channel parity', () => {

  // Build two equivalent tracks for the same animation:
  //  - legacyTrack: composite Keyframe[] with full transform
  //  - channelTrack: same keyframes expressed as per-property channels
  const BASE = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

  function legacyTrack(transformAt0: any, transformAt120: any, easing: string = 'linear') {
    return makeTrack('A', [
      { id: 'kf0', frame: 0, transform: { ...BASE, ...transformAt0 }, easing } as any,
      { id: 'kf1', frame: 120, transform: { ...BASE, ...transformAt120 }, easing } as any,
    ]);
  }

  function channelTrack(channelKfs: Record<string, { v0: number; v120: number }>, easing: string = 'linear') {
    const tr = makeTrack('A', []);
    for (const [ch, kv] of Object.entries(channelKfs)) {
      (tr.channels as any)[ch] = [
        { id: `pk_${ch}_0`, frame: 0, value: kv.v0, easing } as any,
        { id: `pk_${ch}_1`, frame: 120, value: kv.v120, easing } as any,
      ];
    }
    return tr;
  }

  const layers = [makeLayer({ id: 'A' })];
  const FRAMES = [0, 30, 60, 90, 120];

  test('1: x interpolation parity', () => {
    const legacy = evaluateTransform(layers, [legacyTrack({ x: 0 }, { x: 100 })], 'Sequence', 'A', 60);
    const channel = evaluateTransform(layers, [channelTrack({ x: { v0: 0, v120: 100 } })], 'Sequence', 'A', 60);
    expect(channel.x).toBeCloseTo(legacy.x, 4);
    expect(channel.x).toBeCloseTo(50, 4);
  });

  test('2: y interpolation parity', () => {
    const legacy = evaluateTransform(layers, [legacyTrack({ y: 0 }, { y: 200 })], 'Sequence', 'A', 60);
    const channel = evaluateTransform(layers, [channelTrack({ y: { v0: 0, v120: 200 } })], 'Sequence', 'A', 60);
    expect(channel.y).toBeCloseTo(legacy.y, 4);
    expect(channel.y).toBeCloseTo(100, 4);
  });

  test('3: rotation interpolation parity', () => {
    const legacy = evaluateTransform(layers, [legacyTrack({ rotation: 0 }, { rotation: 360 })], 'Sequence', 'A', 60);
    const channel = evaluateTransform(layers, [channelTrack({ rotation: { v0: 0, v120: 360 } })], 'Sequence', 'A', 60);
    expect(channel.rotation).toBeCloseTo(legacy.rotation, 4);
    expect(channel.rotation).toBeCloseTo(180, 4);
  });

  test('4: scaleX interpolation parity', () => {
    const legacy = evaluateTransform(layers, [legacyTrack({ scaleX: 1 }, { scaleX: 3 })], 'Sequence', 'A', 60);
    const channel = evaluateTransform(layers, [channelTrack({ scaleX: { v0: 1, v120: 3 } })], 'Sequence', 'A', 60);
    expect(channel.scaleX).toBeCloseTo(legacy.scaleX, 4);
    expect(channel.scaleX).toBeCloseTo(2, 4);
  });

  test('5: scaleY interpolation parity', () => {
    const legacy = evaluateTransform(layers, [legacyTrack({ scaleY: 1 }, { scaleY: 2 })], 'Sequence', 'A', 60);
    const channel = evaluateTransform(layers, [channelTrack({ scaleY: { v0: 1, v120: 2 } })], 'Sequence', 'A', 60);
    expect(channel.scaleY).toBeCloseTo(legacy.scaleY, 4);
    expect(channel.scaleY).toBeCloseTo(1.5, 4);
  });

  test('6: opacity interpolation parity', () => {
    const legacy = evaluateTransform(layers, [legacyTrack({ opacity: 0 }, { opacity: 1 })], 'Sequence', 'A', 60);
    const channel = evaluateTransform(layers, [channelTrack({ opacity: { v0: 0, v120: 1 } })], 'Sequence', 'A', 60);
    expect(channel.opacity).toBeCloseTo(legacy.opacity, 4);
    expect(channel.opacity).toBeCloseTo(0.5, 4);
  });

  test('7: linear easing parity at intermediate frames', () => {
    for (const f of FRAMES) {
      const legacy = evaluateTransform(layers, [legacyTrack({ x: 0 }, { x: 100 }, 'linear')], 'Sequence', 'A', f);
      const channel = evaluateTransform(layers, [channelTrack({ x: { v0: 0, v120: 100 } }, 'linear')], 'Sequence', 'A', f);
      expect(channel.x).toBeCloseTo(legacy.x, 4);
    }
  });

  test('8: non-linear easing parity (easeIn)', () => {
    for (const f of FRAMES) {
      const legacy = evaluateTransform(layers, [legacyTrack({ x: 0 }, { x: 100 }, 'easeIn')], 'Sequence', 'A', f);
      const channel = evaluateTransform(layers, [channelTrack({ x: { v0: 0, v120: 100 } }, 'easeIn')], 'Sequence', 'A', f);
      expect(channel.x).toBeCloseTo(legacy.x, 4);
    }
  });

  test('9: start boundary parity (frame before first keyframe)', () => {
    const legacy = evaluateTransform(layers, [legacyTrack({ x: 0 }, { x: 100 })], 'Sequence', 'A', -10);
    const channel = evaluateTransform(layers, [channelTrack({ x: { v0: 0, v120: 100 } })], 'Sequence', 'A', -10);
    expect(channel.x).toBeCloseTo(legacy.x, 4);
    expect(channel.x).toBe(0); // clamp to first keyframe
  });

  test('10: end boundary parity (frame after last keyframe)', () => {
    const legacy = evaluateTransform(layers, [legacyTrack({ x: 0 }, { x: 100 })], 'Sequence', 'A', 200);
    const channel = evaluateTransform(layers, [channelTrack({ x: { v0: 0, v120: 100 } })], 'Sequence', 'A', 200);
    expect(channel.x).toBeCloseTo(legacy.x, 4);
    expect(channel.x).toBe(100); // clamp to last keyframe
  });

  test('11: exact-frame parity', () => {
    const legacy = evaluateTransform(layers, [legacyTrack({ x: 0 }, { x: 100 })], 'Sequence', 'A', 0);
    const channel = evaluateTransform(layers, [channelTrack({ x: { v0: 0, v120: 100 } })], 'Sequence', 'A', 0);
    expect(channel.x).toBeCloseTo(legacy.x, 4);
    expect(channel.x).toBe(0);
  });

  test('12: channel data present → legacy keyframes do not override animated channels', () => {
    // Same track: x has a channel, y only exists in legacy composite.
    const tr = makeTrack('A', [
      { id: 'kf0', frame: 0, transform: { ...BASE, x: 0, y: 0 }, easing: 'linear' } as any,
      { id: 'kf1', frame: 120, transform: { ...BASE, x: 1000, y: 1000 }, easing: 'linear' } as any,
    ]);
    (tr.channels as any).x = [
      { id: 'pk_x_0', frame: 0, value: 0, easing: 'linear' } as any,
      { id: 'pk_x_1', frame: 120, value: 100, easing: 'linear' } as any,
    ];

    const world = evaluateTransform(layers, [tr], 'Sequence', 'A', 60);
    // x comes from channel (50), y falls back to legacy composite (500)
    expect(world.x).toBeCloseTo(50, 4);
    expect(world.y).toBeCloseTo(500, 4);
  });

  test('13: legacy-only track (no channels) uses composite path', () => {
    const tr = makeTrack('A', [
      { id: 'kf0', frame: 0, transform: { ...BASE, x: 0 }, easing: 'linear' } as any,
      { id: 'kf1', frame: 120, transform: { ...BASE, x: 100 }, easing: 'linear' } as any,
    ]);
    const world = evaluateTransform(layers, [tr], 'Sequence', 'A', 60);
    expect(world.x).toBeCloseTo(50, 4);
  });

  test('14: channel-only track (no legacy keyframes) uses channel path', () => {
    const tr = channelTrack({ x: { v0: 0, v120: 100 } });
    tr.keyframes = [];
    const world = evaluateTransform(layers, [tr], 'Sequence', 'A', 60);
    expect(world.x).toBeCloseTo(50, 4);
    // y has no channel and no legacy keyframes → base transform fallback
    expect(world.y).toBe(200);
  });

  test('15: mixed channels + legacy together — channel wins per-property, legacy fills rest', () => {
    const tr = makeTrack('A', [
      { id: 'kf0', frame: 0, transform: { ...BASE, x: 0, y: 0 }, easing: 'linear' } as any,
      { id: 'kf1', frame: 120, transform: { ...BASE, x: 100, y: 200 }, easing: 'linear' } as any,
    ]);
    (tr.channels as any).x = [
      { id: 'pk_x_0', frame: 0, value: 0, easing: 'linear' } as any,
      { id: 'pk_x_1', frame: 120, value: 1000, easing: 'linear' } as any,
    ];

    const world = evaluateTransform(layers, [tr], 'Sequence', 'A', 60);
    expect(world.x).toBeCloseTo(500, 4);      // channel wins (1000/2)
    expect(world.y).toBeCloseTo(100, 4);      // legacy fills (200/2)
  });
});
