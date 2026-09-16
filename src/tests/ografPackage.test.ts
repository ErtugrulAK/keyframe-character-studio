import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import type { SceneData, SceneLayer } from '../types/composition';
import type { OGrafGeneratedPackage } from '../ograf/types';
import { compileOGrafPackage } from '../ograf/packageCompiler';
import { OGrafPackageWriteError } from '../ograf/diagnostics';
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
/** Runs materialization and returns the coded failure it must raise. */
async function materializationFailure(plan: OGrafGeneratedPackage, outputDirectory: string): Promise<OGrafPackageWriteError> {
  const failure = await materializeOGrafPackage(plan, outputDirectory).catch((reason: unknown) => reason);
  expect(failure).toBeInstanceOf(OGrafPackageWriteError);
  return failure as OGrafPackageWriteError;
}

async function tryCreateSymlink(target: string, path: string, type: 'file' | 'dir' | 'junction' = 'file'): Promise<boolean> {
  try {
    await symlink(target, path, type);
    return true;
  } catch {
    return false;
  }
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
      const Graphic = new Function(`${moduleSource.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href')}`)();
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
      expect(await graphic.playAction({ skipAnimation: true })).toMatchObject({ statusCode: 200, currentStep: undefined });
      expect(await graphic.stopAction({ skipAnimation: true })).toEqual({ statusCode: 200 });
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

  test('deduplicates repeated references while keeping distinct path collisions deterministic', () => {
    const scene = makeScene([
      makeLayer({ id: 'one', imageUrl: 'same/logo.png' }),
      makeLayer({ id: 'two', imageUrl: 'same/logo.png', zIndex: 1 }),
      makeLayer({ id: 'three', imageUrl: 'other/logo.png', zIndex: 2 }),
    ]);
    const options = {
      assetCatalog: {
        'same/logo.png': { kind: 'local' as const, sourcePath: 'same.png', packagedPath: 'assets/logo.png' },
        'other/logo.png': { kind: 'local' as const, sourcePath: 'other.png', packagedPath: 'assets/logo.png' },
      },
    };
    const plan = compileOGrafPackage(scene, options);
    const repeat = compileOGrafPackage(scene, options);

    expect(plan.status).toBe('ready-to-materialize');
    expect(plan.assets.map((asset) => asset.packagedPath)).toEqual([
      'assets/logo.png',
      expect.stringMatching(/^assets\/logo-[0-9a-f]{8}\.png$/u),
    ]);
    expect(plan.files.filter((file) => file.kind === 'asset')).toHaveLength(2);
    expect(plan.files.map((file) => file.path)).toEqual(repeat.files.map((file) => file.path));
  });

  test('rejects an unsafe manifest main path before generating package files', () => {
    const plan = compileOGrafPackage(makeScene(), {
      main: '../runtime.mjs',
      assetCatalog: {
        'source/logo.png': { kind: 'local', sourcePath: 'logo.png', packagedPath: 'assets/logo.png' },
      },
    });

    expect(plan.status).toBe('blocked');
    expect(plan.diagnostics.some((diagnostic) => diagnostic.code === 'OGRAF_INVALID_MAIN')).toBe(true);
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
      const failure = await materializationFailure(plan, join(root, 'output'));
      expect(failure.code).toBe('OGRAF_PACKAGE_SOURCE_UNREADABLE');
      expect(failure.message).toBe('Local asset source could not be read (ENOENT).');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  test('rejects local asset sources that are not regular files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kcs-ograf-source-dir-'));
    try {
      const plan = compileOGrafPackage(makeScene(), {
        assetCatalog: {
          'source/logo.png': { kind: 'local', sourcePath: root, packagedPath: 'assets/images/logo.png' },
        },
      });
      await expect(materializeOGrafPackage(plan, join(root, 'output'))).rejects.toThrow(/Unsafe local asset source/u);
      const failure = await materializationFailure(plan, join(root, 'output'));
      expect(failure.code).toBe('OGRAF_UNSAFE_ASSET_SOURCE');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test.each(['portable-graphic.ograf.json', 'scene.kcs', 'graphic.mjs'])('rejects missing text content for %s', async (path) => {
    const root = await mkdtemp(join(tmpdir(), 'kcs-ograf-content-'));
    try {
      const plan = compileOGrafPackage(makeScene(), {
        assetCatalog: {
          'source/logo.png': { kind: 'local', sourcePath: join(root, 'logo.png'), packagedPath: 'assets/images/logo.png' },
        },
      });
      const malformedPlan = {
        ...plan,
        files: plan.files.map((file) => file.path === path ? { ...file, content: undefined } : file),
      };

      await expect(materializeOGrafPackage(malformedPlan, join(root, 'output'))).rejects.toThrow(`Missing text content for packaged file: ${path}`);
      const failure = await materializationFailure(malformedPlan, join(root, 'output'));
      expect(failure.code).toBe('OGRAF_MISSING_PACKAGE_SOURCE');
      await expect(readFile(join(root, 'output', path), 'utf8')).rejects.toThrow();
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
  test('rejects URL-encoded package traversal', () => {
    const plan = compileOGrafPackage(makeScene(), {
      assetCatalog: {
        'source/logo.png': { kind: 'local', sourcePath: 'logo.png', packagedPath: 'assets/images/%2e%2e/logo.png' },
      },
    });

    expect(plan.status).toBe('blocked');
    expect(plan.diagnostics.some((diagnostic) => diagnostic.code === 'OGRAF_MISSING_ASSET')).toBe(true);
  });
  test('rejects absolute, drive-relative, directory, and reserved package paths', () => {
    for (const main of ['/runtime.mjs', 'C:runtime.mjs', 'runtime/', '.']) {
      const plan = compileOGrafPackage(makeScene(), { main });
      expect(plan.status).toBe('blocked');
      expect(plan.diagnostics.some((diagnostic) => diagnostic.code === 'OGRAF_INVALID_MAIN')).toBe(true);
    }
    const collision = compileOGrafPackage(makeScene(), {
      assetCatalog: {
        'source/logo.png': { kind: 'local', sourcePath: 'logo.png', packagedPath: 'scene.kcs' },
      },
    });
    expect(collision.status).toBe('blocked');
    expect(collision.diagnostics.some((diagnostic) => diagnostic.message.includes('duplicated'))).toBe(true);
  });
  test('rejects prototype-sensitive packaged asset paths', () => {
    const plan = compileOGrafPackage(makeScene(), {
      assetCatalog: {
        'source/logo.png': {
          kind: 'local',
          packagedPath: '__proto__',
          binaryContent: new Uint8Array([1, 2, 3]),
        },
      },
    });
    expect(plan.status).toBe('blocked');
    expect(plan.files.some((file) => file.path === '__proto__')).toBe(false);
  });

  test('sanitizes reserved graphic names without changing the package contract', () => {
    const plan = compileOGrafPackage({ ...makeScene(), name: 'CON' }, {
      assetCatalog: {
        'source/logo.png': { kind: 'local', sourcePath: 'logo.png', packagedPath: 'assets/images/logo.png' },
      },
    });

    expect(plan.status).toBe('ready-to-materialize');
    expect(plan.files[0]?.path).toBe('graphic.ograf.json');
    expect(plan.files.map((file) => file.path)).toContain('scene.kcs');
  });

  test('blocks reserved asset entries and resolves case-insensitive collisions', () => {
    const blocked = compileOGrafPackage(makeScene(), {
      assetCatalog: {
        'source/logo.png': { kind: 'local', sourcePath: 'logo.png', packagedPath: 'assets/images/CON.png' },
      },
    });
    expect(blocked.status).toBe('blocked');
    expect(blocked.diagnostics.some((diagnostic) => diagnostic.code === 'OGRAF_MISSING_ASSET')).toBe(true);

    const collision = compileOGrafPackage(makeScene([
      makeLayer({ id: 'one', imageUrl: 'one.png' }),
      makeLayer({ id: 'two', imageUrl: 'two.png', zIndex: 1 }),
    ]), {
      assetCatalog: {
        'one.png': { kind: 'local', sourcePath: 'one.png', packagedPath: 'assets/images/Logo.png' },
        'two.png': { kind: 'local', sourcePath: 'two.png', packagedPath: 'assets/images/logo.PNG' },
      },
    });
    expect(collision.status).toBe('ready-to-materialize');
    expect(new Set(collision.assets.map((asset) => asset.packagedPath.toLowerCase())).size).toBe(2);
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
  test('rejects symlinked local asset sources when the platform permits links', async () => {
    const fixture = await makeAsset();
    const sourceLink = join(fixture.root, 'source-link.png');
    try {
      if (!await tryCreateSymlink(fixture.sourcePath, sourceLink)) return;
      const plan = compileOGrafPackage(makeScene(), {
        assetCatalog: {
          'source/logo.png': { kind: 'local', sourcePath: sourceLink, packagedPath: 'assets/images/logo.png' },
        },
      });
      await expect(materializeOGrafPackage(plan, join(fixture.root, 'output'))).rejects.toThrow(/Unsafe local asset source/u);
      const failure = await materializationFailure(plan, join(fixture.root, 'output'));
      expect(failure.code).toBe('OGRAF_UNSAFE_ASSET_SOURCE');
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  test('rejects symlinked output roots and nested ancestors when the platform permits links', async () => {
    const fixture = await makeAsset();
    const realOutput = join(fixture.root, 'real-output');
    const rootLink = join(fixture.root, 'output-link');
    const nestedLink = join(fixture.root, 'nested-link');
    try {
      await mkdir(realOutput);
      const linkType = process.platform === 'win32' ? 'junction' : 'dir';
      if (!await tryCreateSymlink(realOutput, rootLink, linkType)) return;
      const plan = compileOGrafPackage(makeScene(), {
        assetCatalog: {
          'source/logo.png': { kind: 'local', sourcePath: fixture.sourcePath, packagedPath: 'assets/images/logo.png' },
        },
      });
      await expect(materializeOGrafPackage(plan, rootLink)).rejects.toThrow(/Unsafe output directory/u);
      const rootFailure = await materializationFailure(plan, rootLink);
      expect(rootFailure.code).toBe('OGRAF_UNSAFE_OUTPUT_DIRECTORY');

      if (!await tryCreateSymlink(realOutput, nestedLink, linkType)) return;
      await expect(materializeOGrafPackage(plan, join(nestedLink, 'package'))).rejects.toThrow(/Unsafe output directory/u);
      const nestedFailure = await materializationFailure(plan, join(nestedLink, 'package'));
      expect(nestedFailure.code).toBe('OGRAF_UNSAFE_OUTPUT_DIRECTORY');
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  test('rejects symlinked output targets when the platform permits links', async () => {
    const fixture = await makeAsset();
    const output = join(fixture.root, 'output');
    const target = join(fixture.root, 'target.json');
    const targetLink = join(output, 'portable-graphic.ograf.json');
    try {
      await mkdir(output);
      await writeFile(target, 'existing');
      if (!await tryCreateSymlink(target, targetLink)) return;
      const plan = compileOGrafPackage(makeScene(), {
        assetCatalog: {
          'source/logo.png': { kind: 'local', sourcePath: fixture.sourcePath, packagedPath: 'assets/images/logo.png' },
        },
      });
      await expect(materializeOGrafPackage(plan, output)).rejects.toThrow(/Unsafe output target/u);
      const failure = await materializationFailure(plan, output);
      expect(failure.code).toBe('OGRAF_UNSAFE_OUTPUT_TARGET');
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
});
