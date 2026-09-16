import { describe, expect, test } from 'vitest';
import type { SceneData, SceneLayer } from '../types/composition';
import {
  OGRAF_GRAPHICS_SCHEMA_URL,
  compileOGrafManifest,
  compileOGrafPackage,
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

  test('generates deterministic public controls from real scene content', () => {
    const { manifest } = compileOGrafManifest(makeScene());

    expect(manifest.schema.properties).toEqual({
      fill_layer_1: {
        type: 'string',
        format: 'color',
        gddType: 'color-rrggbb',
        pattern: '^#[0-9a-f]{6}$',
        title: 'Box Fill Color',
        default: '#ffffff',
      },
      stroke_layer_1: {
        type: 'string',
        format: 'color',
        gddType: 'color-rrggbb',
        pattern: '^#[0-9a-f]{6}$',
        title: 'Box Stroke Color',
        default: '#000000',
      },
    });
    expect(manifest.schema).not.toHaveProperty('layers');
    expect(manifest.schema).not.toHaveProperty('tracks');
  });

  test('preserves explicit text controls alongside generated color controls', () => {
    const { manifest } = compileOGrafManifest(makeScene(), {
      publicTextFields: [{ id: 'headline', title: 'Headline', defaultValue: 'Hello', layerId: 'layer-1' }],
    });

    expect(manifest.schema.properties).toEqual({
      headline: { type: 'string', title: 'Headline', default: 'Hello' },
      fill_layer_1: {
        type: 'string',
        format: 'color',
        gddType: 'color-rrggbb',
        pattern: '^#[0-9a-f]{6}$',
        title: 'Box Fill Color',
        default: '#ffffff',
      },
      stroke_layer_1: {
        type: 'string',
        format: 'color',
        gddType: 'color-rrggbb',
        pattern: '^#[0-9a-f]{6}$',
        title: 'Box Stroke Color',
        default: '#000000',
      },
    });
    expect(manifest.schema).not.toHaveProperty('layers');
  });

  test('accepts the supported baseline shape scene', () => {
    expect(errorCodes(makeScene())).toEqual([]);
  });
  test.each(['constructor', '__proto__', 'prototype'] as const)('blocks prototype-sensitive layer type %s', (type) => {
    const result = validateSceneForOGraf(makeScene([makeLayer({ type: type as SceneLayer['type'] })]));
    expect(result.canCompile).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.severity === 'ERROR')).toBe(true);
  });

  test.each(['constructor', '__proto__', 'prototype'] as const)('rejects prototype-sensitive imported layer id %s', (id) => {
    const result = validateSceneForOGraf(makeScene([makeLayer({ id })]));
    expect(result.canCompile).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.severity === 'ERROR')).toBe(true);
  });

  test.each(['constructor', '__proto__', 'prototype'] as const)('rejects prototype-sensitive matte, mask, and track matte IDs %s', (id) => {
    const mask = {
      id,
      name: 'Hostile mask',
      mode: 'add',
      path: { version: 1, coordinateSpace: 'world' as const, closed: true, points: [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 },
      ] },
    } as NonNullable<SceneLayer['masks']>[number];
    const scene = makeScene([
      makeLayer({ id: 'source' }),
      makeLayer({
        id: 'target',
        matte: { sourcePartId: id, mode: 'alpha' },
        masks: [mask],
        trackMatte: { sourceLayerId: id, mode: 'alpha' },
      }),
    ]);
    const result = validateSceneForOGraf(scene);
    expect(result.canCompile).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.severity === 'ERROR')).toBe(true);
  });
  test.each(['constructor', '__proto__', 'prototype'] as const)('rejects a prototype-sensitive mask id independently %s', (id) => {
    const mask = {
      id,
      name: 'Hostile mask',
      mode: 'add',
      path: { version: 1, coordinateSpace: 'world' as const, closed: true, points: [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 },
      ] },
    } as NonNullable<SceneLayer['masks']>[number];
    const result = validateSceneForOGraf(makeScene([makeLayer({ masks: [mask] })]));
    expect(result.canCompile).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.feature === 'mask-id')).toBe(true);
  });
  test.each(['constructor', '__proto__', 'prototype'] as const)('rejects a prototype-sensitive legacy matte source independently %s', (id) => {
    const result = validateSceneForOGraf(makeScene([
      makeLayer({ id: 'source' }),
      makeLayer({ id: 'target', matte: { sourcePartId: id, mode: 'alpha' } }),
    ]));
    expect(result.canCompile).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.feature === 'track-matte')).toBe(true);
  });

  test.each(['constructor', '__proto__', 'prototype'] as const)('rejects a prototype-sensitive track matte source independently %s', (id) => {
    const result = validateSceneForOGraf(makeScene([
      makeLayer({ id: 'source' }),
      makeLayer({ id: 'target', trackMatte: { sourceLayerId: id, mode: 'alpha' } }),
    ]));
    expect(result.canCompile).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.feature === 'track-matte')).toBe(true);
  });


  test.each(['constructor', '__proto__', 'prototype'] as const)('rejects prototype-sensitive public field ID %s at the schema boundary', (id) => {
    const result = validateSceneForOGraf(makeScene(), {
      publicTextFields: [{ id, title: 'Hostile', layerId: 'layer-1' }],
    });
    expect(result.canCompile).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.severity === 'ERROR')).toBe(true);
    if (id === '__proto__') {
      expect(Object.prototype.hasOwnProperty.call(result.publicStateSchema.properties, id)).toBe(false);
      expect(Object.getPrototypeOf(result.publicStateSchema.properties)).toBeNull();
    }
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

  test('supports alpha mattes while still rejecting non-deterministic animation', () => {
    const scene = makeScene([
      makeLayer({ id: 'mask' }),
      makeLayer({ id: 'target', matte: { sourcePartId: 'mask', mode: 'alpha' }, inAnimPreset: 'shake' }),
    ]);

    expect(errorCodes(scene)).toEqual([
      'OGRAF_UNSUPPORTED_NONDETERMINISTIC_PROCEDURAL',
    ]);
  });

  test('diagnoses a portable clip matte as conditional without rejecting it', () => {
    const result = validateSceneForOGraf(makeScene([
      makeLayer({ id: 'mask' }),
      makeLayer({ id: 'target', matte: { sourcePartId: 'mask', mode: 'clip' } }),
    ]));

    expect(result.canCompile).toBe(true);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'OGRAF_CONDITIONAL_CLIP_MATTE', severity: 'WARNING' }),
    ]);
  });

  test('quotes user-authored asset references without machine paths, credentials, or payloads', () => {
    const messagesFor = (imageUrl: string) => validateSceneForOGraf(makeScene([
      makeLayer({ type: 'custom_image', imageUrl }),
    ])).diagnostics.map((diagnostic) => diagnostic.message).join(' | ');

    const credentials = messagesFor("https://alice:PASS'WORD@example.test/logo.png?token=QUERY_SECRET#FRAGMENT");
    expect(credentials).toContain('https://example.test/logo.png');
    expect(credentials).not.toContain('PASS');
    expect(credentials).not.toContain('QUERY_SECRET');
    expect(credentials).not.toContain('FRAGMENT');

    const machinePath = messagesFor('C:\\Users\\alice\\private\\logo.png');
    expect(machinePath).toContain('"logo.png"');
    expect(machinePath).not.toContain('alice');

    const payload = messagesFor("Data:text/pl'ain,EMBEDDED_DATA_SECRET");
    expect(payload).toContain('(payload omitted)');
    expect(payload).not.toContain('EMBEDDED_DATA_SECRET');

    const typedlessPayload = messagesFor('data:,EMBEDDED_DATA_SECRET');
    expect(typedlessPayload).toContain('(payload omitted)');
    expect(typedlessPayload).not.toContain('EMBEDDED_DATA_SECRET');
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
  test('rejects non-finite and non-numeric layer values before compilation', () => {
    for (const value of ['0" onload="alert(1)', Number.NaN, Number.POSITIVE_INFINITY, { value: 1 }]) {
      const result = validateSceneForOGraf(makeScene([makeLayer({ x: value as SceneLayer['x'] })]));
      expect(result.canCompile).toBe(false);
      expect(compileOGrafPackage(makeScene([makeLayer({ x: value as SceneLayer['x'] })])).status).toBe('blocked');
    }
  });

  test('rejects malformed channel values and unknown mask or matte modes', () => {
    const channelScene = makeScene();
    channelScene.tracks = [{
      partId: 'layer-1',
      channels: {
        x: [{ id: 'x-1', frame: 0, value: Number.NaN, easing: 'linear' }],
      },
    } as SceneData['tracks'][number]];
    expect(errorCodes(channelScene)).toContain('OGRAF_INVALID_PROJECT');

    const invalidModes = makeScene([makeLayer({
      masks: [{ id: 'mask-1', name: 'Mask', mode: 'execute', path: { version: 1, coordinateSpace: 'local', closed: true, points: [] } } as never],
      matte: { sourcePartId: 'layer-1', mode: 'execute' as never },
    })]);
    expect(errorCodes(invalidModes)).toContain('OGRAF_INVALID_PROJECT');
  });
  test('rejects malformed legacy composite keyframe transforms', () => {
    const fields = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'] as const;
    for (const field of fields) {
      const scene = makeScene();
      scene.tracks = [{
        partId: 'layer-1',
        keyframes: [{
          id: `legacy-${field}`,
          frame: 0,
          easing: 'linear',
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, [field]: Number.NaN },
        }],
        channels: {},
      } as never];
      expect(compileOGrafPackage(scene).status).toBe('blocked');
    }
    const scene = makeScene();
    scene.tracks = [{
      partId: 'layer-1',
      keyframes: [{
        id: 'legacy-string',
        frame: 0,
        easing: 'linear',
        transform: { x: '0" onload="alert(1)', y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      }],
      channels: {},
    } as never];
    expect(compileOGrafPackage(scene).status).toBe('blocked');
  });

  test('requires complete finite scalar and mask keyframe metadata', () => {
    const invalidKeyframes = [
      { value: 1, easing: 'linear' },
      { frame: 0, easing: 'linear' },
      { frame: Number.POSITIVE_INFINITY, value: 1, easing: 'linear' },
      { frame: 0, value: 1, easing: 'linear', bezierIn: {} },
      { frame: 0, value: 1, easing: 'linear', bezierOut: { x: 0, y: Number.NaN } },
      { frame: 0, value: 1, easing: 'linear', bezierControlPoints: [0, 1, 2] },
      { frame: 0, value: 1, easing: 'linear', bezierControlPoints: [0, 1, 2, 3, 4] },
      { frame: 0, value: 1, easing: 'linear', bezierControlPoints: [0, 1, Number.NaN, 2] },
    ];
    for (const keyframe of invalidKeyframes) {
      const scene = makeScene();
      scene.tracks = [{ partId: 'layer-1', channels: { x: [keyframe] } } as never];
      expect(compileOGrafPackage(scene).status).toBe('blocked');
    }
    const maskScene = makeScene();
    maskScene.tracks = [{
      partId: 'layer-1',
      channels: {},
      maskChannels: { 'mask-1:opacity': [{ frame: 0, value: Number.NaN, easing: 'linear' }] },
    } as never];
    expect(compileOGrafPackage(maskScene).status).toBe('blocked');
  });

  test('requires complete finite mask path keyframe metadata', () => {
    const path = {
      version: 1 as const,
      coordinateSpace: 'local' as const,
      closed: true,
      points: [{ id: 'p1', x: 0, y: 0 }, { id: 'p2', x: 1, y: 1 }],
    };
    const invalidKeyframes = [
      { value: path, easing: 'linear' },
      { frame: 0, value: path, easing: 'linear', bezierIn: { x: 0 } },
      { frame: 0, value: path, easing: 'linear', bezierOut: { x: 0, y: Number.NaN } },
      { frame: 0, value: path, easing: 'linear', bezierControlPoints: [0, 1, 2, 3, 4] },
    ];
    for (const keyframe of invalidKeyframes) {
      const scene = makeScene([makeLayer({
        masks: [{ id: 'mask-1', name: 'Mask', mode: 'add', path }],
      })]);
      scene.tracks = [{
        partId: 'layer-1',
        channels: {},
        maskPathChannels: { 'mask-1:path': [keyframe] },
      } as never];
      expect(compileOGrafPackage(scene).status).toBe('blocked');
    }
  });

  test('keeps valid legacy, scalar, and mask path keyframes exportable', () => {
    const path = {
      version: 1 as const,
      coordinateSpace: 'local' as const,
      closed: true,
      points: [{ id: 'p1', x: 0, y: 0 }, { id: 'p2', x: 1, y: 1 }],
    };
    const scene = makeScene([makeLayer({
      masks: [{ id: 'mask-1', name: 'Mask', mode: 'add', path }],
    })]);
    scene.tracks = [{
      partId: 'layer-1',
      keyframes: [{
        id: 'legacy-1',
        frame: 0,
        easing: 'linear',
        transform: { x: -10, y: 0, rotation: 0, scaleX: -1, scaleY: 1, opacity: 1 },
      }],
      channels: {
        x: [{ id: 'x-1', frame: 0, value: 0, easing: 'linear' }],
      },
      maskPathChannels: {
        'mask-1:path': [{ id: 'path-1', frame: 0, value: path, easing: 'linear' }],
      },
    } as never];
    expect(compileOGrafPackage(scene).status).toBe('ready-to-materialize');
  });
  test('rejects missing and cyclic layer parents while preserving valid chains', () => {
    const self = makeLayer({ id: 'self', parentId: 'self' });
    expect(compileOGrafPackage(makeScene([self])).status).toBe('blocked');

    const a = makeLayer({ id: 'a', parentId: 'b' });
    const b = makeLayer({ id: 'b', parentId: 'a' });
    expect(compileOGrafPackage(makeScene([a, b])).status).toBe('blocked');

    const c = makeLayer({ id: 'c', parentId: 'd' });
    const d = makeLayer({ id: 'd', parentId: 'e' });
    const e = makeLayer({ id: 'e', parentId: 'c' });
    expect(compileOGrafPackage(makeScene([c, d, e])).status).toBe('blocked');
    const missing = makeLayer({ id: 'child', parentId: 'missing' });
    expect(compileOGrafPackage(makeScene([missing])).status).toBe('ready-to-materialize');

    const root = makeLayer({ id: 'root' });
    const child = makeLayer({ id: 'child', parentId: 'root' });
    const grandchild = makeLayer({ id: 'grandchild', parentId: 'child' });
    expect(compileOGrafPackage(makeScene([root, child, grandchild])).status).toBe('ready-to-materialize');
  });
});
