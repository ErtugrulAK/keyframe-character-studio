/**
 * Step markers split a sequence into OGraf steps: each play (Next) in a
 * playout runs to the next marker and holds. Without markers a graphic is one
 * step, as before.
 */
import { describe, expect, test } from 'vitest';
import type { SceneData, SceneLayer } from '../types/composition';
import { addStepMarker, normalizeStepMarkers, removeStepMarker, sceneStepMarkers, stepEndFrames } from '../utils/animation/stepMarkers';
import { normalizeMotionTemplates } from '../utils/animation/motionTemplates';
import { compileOGrafManifest } from '../ograf/compiler';
import { compileOGrafPackage } from '../ograf/packageCompiler';

describe('step markers', () => {
  test('are whole frames inside the sequence, sorted, each once', () => {
    expect(normalizeStepMarkers([40, 20.4, 20, 0, 60, 75, -3, Number.NaN, '30'], 60)).toEqual([20, 40]);
    expect(normalizeStepMarkers(undefined, 60)).toEqual([]);
    expect(stepEndFrames([40, 20], 60)).toEqual([20, 40, 60]);
    expect(stepEndFrames([], 60)).toEqual([60]);
    expect(addStepMarker([20], 40, 60)).toEqual([20, 40]);
    expect(addStepMarker([20], 60, 60)).toEqual([20]);
    expect(removeStepMarker([20, 40], 20, 60)).toEqual([40]);
  });

  test('travel with their sequence and are cleaned when it is loaded', () => {
    const [template] = normalizeMotionTemplates([{ id: 'Sequence', name: 'Sequence', type: 'in', durationFrames: 60, stepMarkers: [50, 10, 80] }]);
    expect(template.stepMarkers).toEqual([10, 50]);
    const [plain] = normalizeMotionTemplates([{ id: 'Sequence', name: 'Sequence', type: 'in', durationFrames: 60, stepMarkers: [] }]);
    expect('stepMarkers' in plain).toBe(false);
    expect(sceneStepMarkers({ totalFrames: 60, activeTemplateId: 'B', motionTemplates: [
      { id: 'A', name: 'A', type: 'in', durationFrames: 60, stepMarkers: [10] },
      { id: 'B', name: 'B', type: 'in', durationFrames: 60, stepMarkers: [30] },
    ] })).toEqual([30]);
  });
});

const layer = (overrides: Partial<SceneLayer> = {}): SceneLayer => ({
  id: 'shape', name: 'Shape', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 0, fillColor: '#ff0000', strokeColor: '#000000', fillEnabled: true, strokeEnabled: false,
  ...overrides,
});

const scene = (stepMarkers?: number[]): SceneData => ({
  version: 1,
  coordinateSystem: 'project-unit-center-v1',
  name: 'Steps',
  width: 320,
  height: 180,
  fps: 60,
  totalFrames: 60,
  layers: [layer()],
  tracks: [{
    partId: 'shape',
    channels: { x: [{ id: 'x0', frame: 0, value: 0, easing: 'linear' }, { id: 'x60', frame: 60, value: 60, easing: 'linear' }] },
  } as SceneData['tracks'][number]],
  activeTemplateId: 'Sequence',
  motionTemplates: [{ id: 'Sequence', name: 'Sequence', type: 'in', durationFrames: 60, ...(stepMarkers ? { stepMarkers } : {}) }],
});

type GeneratedGraphic = HTMLElement & {
  _currentFrame: number;
  _currentStep: number | undefined;
  load: (params: { renderType: 'realtime' | 'non-realtime'; data?: unknown }) => Promise<Record<string, unknown>>;
  playAction: (params?: { goto?: number; delta?: number; skipAnimation?: boolean }) => Promise<Record<string, unknown>>;
  setActionsSchedule: (params: { schedule: unknown }) => Promise<Record<string, unknown>>;
  goToTime: (params: { timestamp: number }) => Promise<Record<string, unknown>>;
  dispose: () => Promise<Record<string, unknown>>;
};

let counter = 0;
const graphicOf = (data: SceneData): GeneratedGraphic => {
  const source = compileOGrafPackage(data).files.find((file) => file.path === 'graphic.mjs')?.content || '';
  const Graphic = new Function('HTMLElement', source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href'))(HTMLElement) as new () => GeneratedGraphic;
  counter += 1;
  customElements.define(`x-ograf-steps-${counter}`, Graphic);
  return document.createElement(`x-ograf-steps-${counter}`) as GeneratedGraphic;
};

describe('a graphic with step markers', () => {
  test('declares one step per marker plus one; its first play takes the first step', () => {
    const { manifest } = compileOGrafManifest(scene([20, 40]));
    expect(manifest.stepCount).toBe(3);
    expect(manifest.actionDurations[0]).toEqual({ type: 'playAction', duration: Math.round((20 / 60) * 1000) });
    expect(compileOGrafManifest(scene()).manifest.stepCount).toBe(1);
  });

  test('each play runs to the next marker and holds; past the last step it ends; goto replays a step', async () => {
    const graphic = graphicOf(scene([20, 40]));
    await graphic.load({ renderType: 'realtime', data: {} });
    const play = async (params: { goto?: number } = {}) => {
      const result = await graphic.playAction({ ...params, skipAnimation: true });
      return [graphic._currentFrame, result.currentStep];
    };
    expect(await play()).toEqual([20, 0]);
    expect(await play()).toEqual([40, 1]);
    expect(await play()).toEqual([60, 2]);
    expect(await play()).toEqual([60, undefined]);
    // From the end, a play starts over from the first frame.
    expect(await play()).toEqual([20, 0]);
    expect(await play({ goto: 2 })).toEqual([60, 2]);
    // Back to an earlier step: it plays again from that step's start.
    const back = graphic.playAction({ goto: 1 });
    expect(graphic._currentFrame).toBe(20);
    await back;
    await graphic.dispose();
  });

  test('non real time: a scheduled play holds on its marker until the next one', async () => {
    const graphic = graphicOf(scene([20, 40]));
    await graphic.load({ renderType: 'non-realtime', data: {} });
    // 60 fps: step 0 (0 -> 20) takes 333 ms; the second play starts at 1000 ms.
    await graphic.setActionsSchedule({ schedule: [
      { timestamp: 0, action: { type: 'playAction', params: {} } },
      { timestamp: 1000, action: { type: 'playAction', params: {} } },
    ] });
    const at = async (timestamp: number) => {
      await graphic.goToTime({ timestamp });
      return Math.round(graphic._currentFrame * 1000) / 1000;
    };
    expect(await at(250)).toBe(15);
    expect(await at(500)).toBe(20);
    expect(await at(900)).toBe(20);
    expect(await at(1200)).toBe(32);
    expect(await at(5000)).toBe(40);
    await graphic.dispose();
  });
});
