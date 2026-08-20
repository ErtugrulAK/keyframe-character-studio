import { describe, expect, it } from 'vitest';
import type { SceneData } from '../types/composition';
import {
  DEFAULT_SCENE_COORDINATE_SYSTEM,
  detectSceneCoordinateSystem,
  migrateSceneCoordinates,
} from '../utils/coordinateMigration';

const makeScene = (coordinateSystem?: SceneData['coordinateSystem']): SceneData => ({
  version: 1,
  ...(coordinateSystem ? { coordinateSystem } : {}),
  width: 1920,
  height: 1080,
  fps: 60,
  totalFrames: 60,
  layers: [{
    id: 'parent',
    name: 'Parent',
    type: 'custom_rect',
    x: 30000,
    y: -15000,
    rotation: 20,
    scaleX: 2,
    scaleY: 3,
    opacity: 0.5,
    visible: true,
    zIndex: 0,
    fillColor: '#fff',
    strokeColor: '#000',
    width: 120,
    height: 60,
    points: [{ x: 12.5, y: -7.25 }],
    strokeWidth: 4,
    inAnimPreset: 'slide-left',
  }, {
    id: 'child',
    name: 'Child',
    type: 'custom_rect',
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    parentId: 'parent',
    visible: true,
    zIndex: 1,
    fillColor: '#fff',
    strokeColor: '#000',
  }],
  tracks: [{
    partId: 'parent',
    channels: {
      x: [{ id: 'x1', frame: 0, value: 30000, easing: 'linear', templateId: 'seq-a' }],
      y: [{ id: 'y1', frame: 0, value: -15000, easing: 'easeInOut' }],
      rotation: [{ id: 'r1', frame: 0, value: 20, easing: 'linear' }],
      scaleX: [{ id: 'sx1', frame: 0, value: 2, easing: 'linear' }],
      scaleY: [{ id: 'sy1', frame: 0, value: 3, easing: 'linear' }],
      opacity: [{ id: 'o1', frame: 0, value: 0.5, easing: 'linear' }],
      maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
    },
    keyframes: [{
      id: 'legacy-kf',
      frame: 0,
      transform: { x: 30000, y: -15000, rotation: 20, scaleX: 2, scaleY: 3, opacity: 0.5 },
      easing: 'linear',
    }],
  }],
});

describe('coordinate migration contract', () => {
  it('classifies explicit and untagged scenes without magnitude heuristics', () => {
    expect(detectSceneCoordinateSystem(makeScene('legacy-centi-unit'))).toBe('legacy-centi-unit');
    expect(detectSceneCoordinateSystem(makeScene('project-unit-center-v1'))).toBe('project-unit-center-v1');
    expect(detectSceneCoordinateSystem(makeScene())).toBe(DEFAULT_SCENE_COORDINATE_SYSTEM);
    expect(detectSceneCoordinateSystem({ coordinateSystem: 'future-contract' } as SceneData)).toBe('legacy-unknown');
  });

  it('converts only explicitly tagged legacy transform values', () => {
    const source = makeScene('legacy-centi-unit');
    const migrated = migrateSceneCoordinates(source);
    const layer = migrated.layers[0];
    const track = migrated.tracks[0];

    expect(migrated.coordinateSystem).toBe('project-unit-center-v1');
    expect(layer.x).toBe(300);
    expect(layer.y).toBe(-150);
    expect(track.channels.x[0].value).toBe(300);
    expect(track.channels.y[0].value).toBe(-150);
    expect(track.keyframes?.[0].transform.x).toBe(300);
    expect(track.keyframes?.[0].transform.y).toBe(-150);
    expect(track.channels.rotation[0].value).toBe(20);
    expect(track.channels.scaleX[0].value).toBe(2);
    expect(track.channels.opacity[0].value).toBe(0.5);
    expect(layer.points).toEqual([{ x: 12.5, y: -7.25 }]);
    expect(layer.strokeWidth).toBe(4);
    expect(layer.inAnimPreset).toBe('slide-left');
  });

  it('preserves zero, signs, and fractional precision', () => {
    const scene = makeScene('legacy-centi-unit');
    scene.layers[1].x = 0;
    scene.layers[1].y = 0;
    scene.tracks[0].channels.x.push({ id: 'fraction', frame: 2, value: 12.5, easing: 'linear' });
    const migrated = migrateSceneCoordinates(scene);

    expect(migrated.layers[1].x).toBe(0);
    expect(migrated.layers[1].y).toBe(0);
    expect(migrated.tracks[0].channels.x.at(-1)?.value).toBeCloseTo(0.125);
  });

  it('preserves parent relationships and keyframe metadata', () => {
    const source = makeScene('legacy-centi-unit');
    const migrated = migrateSceneCoordinates(source);
    const keyframe = migrated.tracks[0].keyframes?.[0];

    expect(migrated.layers[1].parentId).toBe('parent');
    expect(migrated.tracks[0].channels.x[0]).toMatchObject({ id: 'x1', frame: 0, easing: 'linear', templateId: 'seq-a' });
    expect(keyframe).toMatchObject({ id: 'legacy-kf', frame: 0, easing: 'linear' });
  });

  it('is idempotent and does not mutate the input', () => {
    const source = makeScene('legacy-centi-unit');
    const snapshot = structuredClone(source);
    const migrated = migrateSceneCoordinates(source);
    const migratedAgain = migrateSceneCoordinates(migrated);

    expect(source).toEqual(snapshot);
    expect(migratedAgain).toEqual(migrated);
  });

  it('leaves raw, unknown, and untagged scenes numerically unchanged', () => {
    for (const scene of [makeScene('project-unit-center-v1'), makeScene('legacy-unknown'), makeScene()]) {
      const migrated = migrateSceneCoordinates(scene);
      expect(migrated).toEqual(scene);
    }
  });
});
