import { describe, expect, test } from 'vitest';
import type { SceneData, SceneLayer } from '../types/composition';
import {
  OGRAF_GRAPHICS_SCHEMA_URL,
  compileOGrafManifest,
  compileOGrafPackagePlan,
  validateSceneForOGraf,
} from '../ograf';

function makeLayer(overrides: Partial<SceneLayer> = {}): SceneLayer {
  return {
    id: 'layer-1',
    name: 'Box',
    type: 'custom_box',
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    visible: true,
    zIndex: 0,
    fillColor: '#ffffff',
    strokeColor: '#000000',
    width: 100,
    height: 50,
    ...overrides,
  };
}

function makeScene(layers: SceneLayer[] = [makeLayer()]): SceneData {
  return {
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    name: 'Demo / Graphic',
    width: 1920,
    height: 1080,
    fps: 60,
    totalFrames: 120,
    layers,
    tracks: [],
  };
}

function errorCodes(scene: SceneData, options = {}) {
  return validateSceneForOGraf(scene, options).diagnostics
    .filter((diagnostic) => diagnostic.severity === 'ERROR')
    .map((diagnostic) => diagnostic.code);
}

describe('OGraf Export V1 Phase 1', () => {
  test('compiles the required realtime manifest fields', () => {
    const { manifest } = compileOGrafManifest(makeScene());

    expect(manifest.$schema).toBe(OGRAF_GRAPHICS_SCHEMA_URL);
    expect(manifest.supportsRealTime).toBe(true);
    expect(manifest.supportsNonRealTime).toBe(false);
    expect(manifest.main).toBe('graphic.mjs');
    expect(manifest.stepCount).toBe(1);
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.renderRequirements?.[0].resolution.width.ideal).toBe(1920);
    expect(manifest.renderRequirements?.[0].resolution.height.ideal).toBe(1080);
    expect(manifest.renderRequirements?.[0].frameRate.ideal).toBe(60);
  });

  test('creates a stable sanitized portable graphic id', () => {
    const first = compileOGrafManifest(makeScene()).manifest.id;
    const second = compileOGrafManifest(makeScene()).manifest.id;

    expect(first).toBe(second);
    expect(first).toMatch(/^demo-graphic-[a-f0-9]{8}$/);
    expect(first).not.toContain('/');
  });

  test('keeps the public schema separate and empty by default', () => {
    const { manifest } = compileOGrafManifest(makeScene());

    expect(manifest.schema).toEqual({ type: 'object', properties: {} });
    expect(manifest.schema).not.toHaveProperty('layers');
    expect(manifest.schema).not.toHaveProperty('tracks');
  });

  test('represents explicit public text fields without exposing SceneData', () => {
    const { manifest } = compileOGrafManifest(makeScene(), {
      publicTextFields: [{ id: 'headline', title: 'Headline', defaultValue: 'Hello', layerId: 'layer-1' }],
    });

    expect(manifest.schema.properties).toEqual({
      headline: { type: 'string', title: 'Headline', default: 'Hello' },
    });
    expect(manifest.schema).not.toHaveProperty('layers');
  });

  test('accepts the supported baseline shape scene', () => {
    expect(errorCodes(makeScene())).toEqual([]);
  });

  test.each([
    ['custom_video', 'OGRAF_UNSUPPORTED_VIDEO'],
    ['particle_system', 'OGRAF_UNSUPPORTED_PARTICLE'],
    ['mograph_cloner', 'OGRAF_UNSUPPORTED_CLONER'],
  ] as const)('rejects %s', (type, code) => {
    expect(errorCodes(makeScene([makeLayer({ type })]))).toContain(code);
  });
  test('blocks Boolean groups instead of silently exporting stale geometry', () => {
    const result = validateSceneForOGraf(makeScene([makeLayer({
      booleanOperation: 'union',
      booleanOperandIds: ['layer-1', 'layer-2'],
    })]));
    expect(result.canCompile).toBe(false);
    expect(errorCodes(makeScene([makeLayer({ booleanOperation: 'union' })]))).toContain('OGRAF_UNSUPPORTED_BOOLEAN');
  });

  test('rejects unsupported matte modes and non-deterministic animation', () => {
    const scene = makeScene([makeLayer({
      matte: { sourcePartId: 'mask', mode: 'alpha' },
      inAnimPreset: 'shake',
    })]);

    expect(errorCodes(scene)).toEqual([
      'OGRAF_UNSUPPORTED_ALPHA_MATTE',
      'OGRAF_UNSUPPORTED_NONDETERMINISTIC_PROCEDURAL',
    ]);
  });

  test('diagnoses clip matte as conditional without rejecting it', () => {
    const result = validateSceneForOGraf(makeScene([makeLayer({ matte: { sourcePartId: 'mask', mode: 'clip' } })]));

    expect(result.canCompile).toBe(true);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'OGRAF_CONDITIONAL_CLIP_MATTE', severity: 'WARNING' }),
    ]);
  });

  test('rejects external image assets by default', () => {
    expect(errorCodes(makeScene([makeLayer({ type: 'custom_image', imageUrl: 'https://example.com/image.png' })]))).toContain('OGRAF_EXTERNAL_ASSET_REJECTED');
  });

  test('plans supported local image assets without fetching them', () => {
    const result = validateSceneForOGraf(makeScene([makeLayer({ type: 'custom_image', imageUrl: 'assets/logo.png' })]), {
      assetCatalog: { 'assets/logo.png': { kind: 'local', packagedPath: 'assets/images/logo.png' } },
    });

    expect(result.assets).toEqual([{ source: 'assets/logo.png', packagedPath: 'assets/images/logo.png', kind: 'image' }]);
  });

  test('does not mutate SceneData and emits deterministic diagnostics', () => {
    const scene = makeScene([makeLayer({ type: 'custom_video', videoUrl: 'clip.mp4' })]);
    const before = JSON.stringify(scene);
    const first = validateSceneForOGraf(scene).diagnostics;
    const second = validateSceneForOGraf(scene).diagnostics;

    expect(JSON.stringify(scene)).toBe(before);
    expect(second).toEqual(first);
  });

  test('returns an explicit incomplete package skeleton', () => {
    const plan = compileOGrafPackagePlan(makeScene());

    expect(plan.status).toBe('skeleton');
    expect(plan.isComplete).toBe(false);
    expect(plan.files).toEqual([
      expect.objectContaining({ kind: 'manifest', status: 'planned' }),
      expect.objectContaining({ path: 'scene.kcs', kind: 'scene', status: 'planned' }),
      expect.objectContaining({ path: 'graphic.mjs', kind: 'runtime', status: 'pending-phase-2' }),
    ]);
  });
});
