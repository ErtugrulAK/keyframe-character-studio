import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import type { SceneData, SceneLayer } from '../types/composition';
import { compileOGrafPackage } from '../ograf/packageCompiler';
import { materializeOGrafPackage } from '../ograf/packageWriter';

function makeLayer(overrides: Partial<SceneLayer> = {}): SceneLayer {
  return {
    id: 'image-1',
    name: 'Image',
    type: 'custom_image',
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    visible: true,
    zIndex: 0,
    fillColor: '#ffffff',
    strokeColor: 'none',
    imageUrl: 'source/logo.png',
    width: 100,
    height: 50,
    ...overrides,
  };
}

function makeScene(layers: SceneLayer[] = [makeLayer()]): SceneData {
  return {
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    name: 'Portable Graphic',
    width: 320,
    height: 180,
    fps: 60,
    totalFrames: 60,
    layers,
    tracks: [],
  };
}

async function makeAsset(): Promise<{ root: string; sourcePath: string }> {
  const root = await mkdtemp(join(tmpdir(), 'kcs-ograf-'));
  const sourcePath = join(root, 'logo.png');
  await writeFile(sourcePath, Buffer.from([137, 80, 78, 71]));
  return { root, sourcePath };
}

describe('OGraf package and realtime Graphic Phase 2B', () => {
  test('compiles and materializes a complete package with required files and image asset', async () => {
    const fixture = await makeAsset();
    const output = join(fixture.root, 'graphic');
    try {
      const plan = compileOGrafPackage(makeScene(), {
        assetCatalog: {
          'source/logo.png': { kind: 'local', sourcePath: fixture.sourcePath, packagedPath: 'assets/images/logo.png' },
        },
      });

      expect(plan.status).toBe('ready-to-materialize');
      expect(plan.isComplete).toBe(false);
      expect(plan.files.map((file) => file.path)).toEqual([
        'portable-graphic.ograf.json',
        'scene.kcs',
        'graphic.mjs',
        'assets/images/logo.png',
      ]);
      expect(plan.files.find((file) => file.path === 'graphic.mjs')?.content).toContain('export default class Graphic');
      expect(plan.files.find((file) => file.path === 'graphic.mjs')?.content).toContain('async load');
      expect(plan.files.find((file) => file.path === 'graphic.mjs')?.content).toContain('async dispose');
      expect(plan.files.find((file) => file.path === 'graphic.mjs')?.content).toContain('async playAction');
      expect(plan.files.find((file) => file.path === 'graphic.mjs')?.content).toContain('async stopAction');
      expect(plan.files.find((file) => file.path === 'graphic.mjs')?.content).toContain('async updateAction');
      expect(plan.files.find((file) => file.path === 'graphic.mjs')?.content).toContain('async customAction');

      const materialized = await materializeOGrafPackage(plan, output);
      expect(materialized.status).toBe('complete');
      expect(materialized.isComplete).toBe(true);
      expect(await readFile(join(output, 'assets/images/logo.png'))).toEqual(Buffer.from([137, 80, 78, 71]));
      expect(await readFile(join(output, 'portable-graphic.ograf.json'), 'utf8')).toContain('supportsRealTime');

      const moduleSource = await readFile(join(output, 'graphic.mjs'), 'utf8');
      const Graphic = new Function(`${moduleSource.replace('export default class Graphic', 'return class Graphic')}`)();
      const tagName = `x-ograf-test-${Date.now()}`;
      customElements.define(tagName, Graphic);
      const graphic = document.createElement(tagName);
      expect(await graphic.load({ renderType: 'realtime', data: {} })).toEqual({ statusCode: 200 });
      expect(graphic.innerHTML).toContain('<svg');
      const activeAction = graphic.playAction({});
      const supersedingAction = graphic.stopAction({ skipAnimation: true });
      expect(await supersedingAction).toEqual({ statusCode: 200 });
      expect(await activeAction).toMatchObject({ statusCode: 200, statusMessage: 'Superseded' });
      expect(await graphic.playAction({ skipAnimation: true })).toMatchObject({ statusCode: 200, currentStep: 0 });
      expect(await graphic.stopAction({ skipAnimation: true })).toEqual({ statusCode: 200 });
      expect(await graphic.customAction({ id: 'unknown', payload: {} })).toMatchObject({ statusCode: 400 });
      expect(await graphic.dispose()).toEqual({ statusCode: 200 });
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  test('produces deterministic generated files and collision-safe asset paths', async () => {
    const scene = makeScene([
      makeLayer({ id: 'one', imageUrl: 'one/logo.png' }),
      makeLayer({ id: 'two', imageUrl: 'two/logo.png', zIndex: 1 }),
    ]);
    const first = compileOGrafPackage(scene, {
      assetCatalog: {
        'one/logo.png': { kind: 'local', sourcePath: 'one.png', packagedPath: 'assets/logo.png' },

        'two/logo.png': { kind: 'local', sourcePath: 'two.png', packagedPath: 'assets/logo.png' },
      },
    });
    const second = compileOGrafPackage(scene, {
      assetCatalog: {
        'one/logo.png': { kind: 'local', sourcePath: 'one.png', packagedPath: 'assets/logo.png' },
        'two/logo.png': { kind: 'local', sourcePath: 'two.png', packagedPath: 'assets/logo.png' },
      },
    });

    expect(first.files.map((file) => file.path)).toEqual(second.files.map((file) => file.path));
    expect(new Set(first.assets.map((asset) => asset.packagedPath)).size).toBe(2);
  });

  test('blocks missing and external assets', () => {
    expect(compileOGrafPackage(makeScene()).status).toBe('blocked');
    expect(compileOGrafPackage(makeScene(), {
      assetCatalog: { 'source/logo.png': { kind: 'external' } },
    }).status).toBe('blocked');
  });

  test('fails materialization when a declared local file is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kcs-ograf-missing-'));
    try {
      const plan = compileOGrafPackage(makeScene(), {
        assetCatalog: {
          'source/logo.png': { kind: 'local', sourcePath: join(root, 'missing.png'), packagedPath: 'assets/images/logo.png' },
        },
      });
      await expect(materializeOGrafPackage(plan, join(root, 'output'))).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('blocks package path traversal', () => {
    const plan = compileOGrafPackage(makeScene(), {
      assetCatalog: {
        'source/logo.png': { kind: 'local', sourcePath: 'logo.png', packagedPath: '../outside.png' },
      },
    });

    expect(plan.status).toBe('blocked');
    expect(plan.diagnostics.some((diagnostic) => diagnostic.message.includes('escapes'))).toBe(true);
  });

  test('loads and updates declared public text while rejecting undeclared fields', () => {
    const plan = compileOGrafPackage(makeScene([makeLayer({ type: 'custom_text', imageUrl: undefined, textValue: 'Old' })]), {
      publicTextFields: [{ id: 'headline', layerId: 'image-1' }],
    });
    const moduleSource = plan.files.find((file) => file.path === 'graphic.mjs')?.content || '';

    expect(plan.status).toBe('ready-to-materialize');
    expect(moduleSource).toContain('Unknown public field');
    expect(moduleSource).toContain('headline');
  });

  test('rejects external public image updates in the generated runtime contract', () => {
    const plan = compileOGrafPackage(makeScene(), {
      assetCatalog: {
        'source/logo.png': { kind: 'local', sourcePath: 'logo.png', packagedPath: 'assets/images/logo.png' },
      },
      publicImageFields: [{ id: 'image', layerId: 'image-1' }],
    });

    const moduleSource = plan.files.find((file) => file.path === 'graphic.mjs')?.content || '';
    expect(moduleSource).toContain('Image value is not a packaged asset');
  });
});
