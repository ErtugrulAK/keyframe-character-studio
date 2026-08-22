/**
 * P4-S5 — Node/Environment Smoke Test
 *
 * ARCHITECTURE VALIDATION: proves the pure evaluation pipeline runs in a
 * Node/test environment without React, DOM, or SVG dependencies.
 *
 *   evaluateFrame → evaluateTransform → computeProceduralDelta → EvaluatedLayer
 *
 * This file intentionally imports ONLY pure utilities + types:
 *   - src/utils/evaluateFrame.ts
 *   - src/utils/evaluateTransform.ts
 *   - src/utils/proceduralAnimation.ts
 * It does NOT import StageCanvas, StagePartLayers, PartRenderer, or any
 * React component / hook.
 */

import { describe, test, expect } from 'vitest';
import { evaluateFrame } from '../utils/evaluateFrame';
import { evaluateTransform } from '../utils/evaluateTransform';
import type { CharacterPart, Track, Keyframe, CustomMotionPreset } from '../types/animator';
import type { RuntimeData } from '../types/composition';

// ─── Minimal fixtures (no React, no DOM) ───────────────────────────────

function makeLayer(overrides: Partial<CharacterPart> = {}): CharacterPart {
  return {
    id: 'L1',
    name: 'Smoke',
    type: 'custom_box',
    zIndex: 1,
    fillColor: '#fff',
    strokeColor: '#000',
    pivot: { x: 0, y: 0 },
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    ...overrides,
  } as CharacterPart;
}

function makeTrack(layerId: string, keyframes: Keyframe[] = []): Track {
  return {
    id: `T_${layerId}`,
    partId: layerId,
    name: 'T',
    color: '#f00',
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
const FRAME = 60;
const TOTAL = 120;

// ─── Smoke tests ────────────────────────────────────────────────────────

describe('P4-S5 — pure pipeline runs in Node environment', () => {

  test('1: base transform → deterministic evaluated output', () => {
    const layers = [makeLayer({ id: 'A', baseTransform: { x: 100, y: 50, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } })];
    const result = evaluateFrame(layers, [], TOTAL, FRAME, makeRuntime(), NO_PRESETS);

    expect(result.layers).toHaveLength(1);
    expect(result.layers[0].transform.x).toBe(100);
    expect(result.layers[0].transform.y).toBe(50);
    expect(result.layers[0].opacity).toBe(1);
    expect(result.layers[0].visible).toBe(true);
  });

  test('2: keyframe interpolation → expected transform', () => {
    const kf0: Keyframe = { id: 'k0', frame: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } };
    const kf120: Keyframe = { id: 'k1', frame: 120, transform: { x: 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } };
    const layers = [makeLayer({ id: 'A' })];
    const tracks = [makeTrack('A', [kf0, kf120])];

    const result = evaluateFrame(layers, tracks, TOTAL, 60, makeRuntime(), NO_PRESETS);
    expect(result.layers[0].transform.x).toBeCloseTo(50, 4);
  });

  test('3: canonical channel interpolation → expected transform', () => {
    const layers = [makeLayer({ id: 'A' })];
    const track = makeTrack('A', []);
    track.channels.x = [
      { id: 'p1', frame: 0, value: 0, easing: 'linear' },
      { id: 'p2', frame: 120, value: 200, easing: 'linear' },
    ];

    const result = evaluateFrame(layers, [track], TOTAL, 60, makeRuntime(), NO_PRESETS);
    expect(result.layers[0].transform.x).toBeCloseTo(100, 4);
  });

  test('4: parent-child hierarchy → world transform correct', () => {
    const parent = makeLayer({ id: 'P', baseTransform: { x: 100, y: 0, rotation: 0, scaleX: 2, scaleY: 1, opacity: 1 } });
    const child = makeLayer({ id: 'C', parentId: 'P', baseTransform: { x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } });
    const layers = [parent, child];
    // Tracks needed so evaluateTransform passes the early-return guard
    const tracks = [makeTrack('P'), makeTrack('C')];

    const result = evaluateFrame(layers, tracks, TOTAL, FRAME, makeRuntime(), NO_PRESETS);
    const childOut = result.layers.find(l => l.id === 'C')!;
    // 100 + (50 * 2) = 200
    expect(childOut.transform.x).toBeCloseTo(200, 4);
  });

  test('5: animated opacity → correct', () => {
    const kf0: Keyframe = { id: 'k0', frame: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0 } };
    const kf120: Keyframe = { id: 'k1', frame: 120, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } };
    const layers = [makeLayer({ id: 'A' })];
    const tracks = [makeTrack('A', [kf0, kf120])];

    const result = evaluateFrame(layers, tracks, TOTAL, 60, makeRuntime(), NO_PRESETS);
    expect(result.layers[0].opacity).toBeCloseTo(0.5, 4);
  });

  test('6: broadcast/procedural evaluation works in pure pipeline', () => {
    const layer = makeLayer({
      id: 'A',
      inAnimPreset: 'fade',
      inAnimDuration: 30,
    });
    const layers = [layer];
    const runtime = makeRuntime({
      appMode: 'broadcast',
      broadcast: { A: { state: 'animating_in', progress: 0.5 } },
    });

    const result = evaluateFrame(layers, [], TOTAL, FRAME, runtime, NO_PRESETS);
    // fade-in at progress 0.5: eased = 1-(1-0.5)^3 = 0.875
    expect(result.layers[0].opacity).toBeCloseTo(0.875, 4);
  });

  test('7: same input twice → identical output (deterministic)', () => {
    const kf0: Keyframe = { id: 'k0', frame: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } };
    const kf120: Keyframe = { id: 'k1', frame: 120, transform: { x: 100, y: 50, rotation: 30, scaleX: 2, scaleY: 2, opacity: 0.8 } };
    const layers = [makeLayer({ id: 'A' })];
    const tracks = [makeTrack('A', [kf0, kf120])];

    const first = evaluateFrame(layers, tracks, TOTAL, 45, makeRuntime(), NO_PRESETS);
    const second = evaluateFrame(layers, tracks, TOTAL, 45, makeRuntime(), NO_PRESETS);

    expect(second).toEqual(first);
  });

  test('8: no React/DOM/SVG dependency — pure functions callable directly', () => {
    // Direct calls to the pure chain without any React renderer.
    // evaluateTransform is invoked directly (as useMath does internally).
    const layers = [makeLayer({ id: 'A', baseTransform: { x: 7, y: 9, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } })];
    const world = evaluateTransform(layers, [], 'Sequence', 'A', 0);
    expect(world.x).toBe(7);
    expect(world.y).toBe(9);

    // And the full chain still produces an EvaluatedLayer.
    const frame = evaluateFrame(layers, [], TOTAL, 0, makeRuntime(), NO_PRESETS);
    expect(frame.layers[0].transform.x).toBe(7);
  });

  test('9: matte state remains renderer-neutral evaluated content', () => {
    const matte = {
      sourcePartId: 'M',
      mode: 'alpha' as const,
      inverted: true,
      feather: 4,
      strength: 0.5,
    };
    const source = makeLayer({ id: 'M' });
    const target = makeLayer({ id: 'T', matte });
    const frame = evaluateFrame([source, target], [], TOTAL, 0, makeRuntime(), NO_PRESETS);
    expect(frame.layers.find((layer) => layer.id === 'T')?.content.matte).toEqual(matte);
    expect(target.matte).toEqual(matte);
  });
});
