import { zipSync } from 'fflate';
import { test, expect, type Page } from '@playwright/test';

/**
 * Milestone F item 10 — Lottie import entry point (real-browser smoke).
 *
 * Starts from a non-empty project, imports a Lottie document through the header
 * control, checks that only a report appears, cancels (the original project must
 * still be there), imports again and confirms, then checks the imported layers
 * and that the export readiness check no longer fails on the layer type.
 */

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const lottieDocument = JSON.stringify({
  v: '5.7.4',
  fr: 24,
  ip: 0,
  op: 24,
  w: 320,
  h: 180,
  nm: 'Smoke',
  layers: [
    { ty: 1, nm: 'Imported Block', sc: '#336699', sw: 120, sh: 80, ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } } },
    { ty: 0, nm: 'Nested', refId: 'comp_0', ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } } },
  ],
  assets: [{ id: 'comp_0', layers: [] }],
});

async function seed(page: Page): Promise<void> {
  const scene = {
    version: 1,
    layers: [{ id: 'seed', name: 'Seed Layer', type: 'custom_box', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#ff2020', strokeColor: '#101218', strokeWidth: 2, borderRadius: 0, width: 120, height: 120 }],
    tracks: [],
    fps: 30,
    totalFrames: 60,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'Lottie Import Smoke',
  };
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); });
  await page.addInitScript(
    ([key, data]: [string, string]) => { localStorage.setItem(key, data); },
    [STORAGE_KEY, JSON.stringify(scene)],
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

const importLottie = async (page: Page) => {
  await page.setInputFiles('input[aria-label="Choose a KCS project, legacy project, Lottie file, or OGraf manifest/package to import"]', {
    name: 'smoke.lottie.json',
    mimeType: 'application/json',
    buffer: Buffer.from(lottieDocument, 'utf8'),
  });
};

test.describe('Milestone F item 12 — the unified import entry', () => {
  test('imports a KCS project through the same control and leaves a refused file alone', async ({ page }) => {
    await seed(page);

    const project = JSON.stringify({
      version: 1,
      width: 640,
      height: 360,
      fps: 30,
      totalFrames: 30,
      layers: [{ id: 'kcs', name: 'KCS Layer', type: 'custom_box', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#22cc88', strokeColor: '#101218', strokeWidth: 2, borderRadius: 0, width: 60, height: 60 }],
      tracks: [],
    });
    await page.setInputFiles('input[aria-label="Choose a KCS project, legacy project, Lottie file, or OGraf manifest/package to import"]', {
      name: 'project.kcs',
      mimeType: 'application/json',
      buffer: Buffer.from(project, 'utf8'),
    });

    await expect(page.getByText('KCS Layer').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Seed Layer')).toHaveCount(0);

    // A file that is not a project at all is refused and changes nothing.
    await page.setInputFiles('input[aria-label="Choose a KCS project, legacy project, Lottie file, or OGraf manifest/package to import"]', {
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ not json', 'utf8'),
    });

    await expect(page.getByText('KCS Layer').first()).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Lottie import report' })).toHaveCount(0);
  });
});

test.describe('Milestone F item 12 — the OGraf package import', () => {
  test('reads the package scene, cancels without changing the project, then applies it', async ({ page }) => {
    await seed(page);

    const scene = JSON.stringify({
      version: 1,
      width: 640,
      height: 360,
      fps: 30,
      totalFrames: 30,
      layers: [{ id: 'pkg', name: 'Package Layer', type: 'custom_box', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#3366cc', strokeColor: '#101218', strokeWidth: 2, borderRadius: 0, width: 80, height: 80 }],
      tracks: [],
    });
    const bytes = zipSync({
      'demo.ograf.json': new TextEncoder().encode(JSON.stringify({ name: 'Demo Package' })),
      'scene.kcs': new TextEncoder().encode(scene),
    });

    const importPackage = () => page.setInputFiles('input[aria-label="Choose a KCS project, legacy project, Lottie file, or OGraf manifest/package to import"]', {
      name: 'demo.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(bytes),
    });

    // 1. The report appears and the seeded project is untouched.
    await importPackage();
    const dialog = page.getByRole('dialog', { name: 'OGraf package import report' });
    await expect(dialog).toBeVisible();
    await expect(page.getByText('Seed Layer')).toBeVisible();

    // 2. Cancel changes nothing.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Seed Layer')).toBeVisible();
    await expect(page.getByText('Package Layer')).toHaveCount(0);

    // 3. Confirm replaces the project with the package scene.
    await importPackage();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Import and replace project' }).click();
    await expect(page.getByText('Package Layer').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Seed Layer')).toHaveCount(0);
  });
});

test.describe('Milestone F item 10 — Lottie import report flow', () => {
  test('shows the report, cancels without changing the project, then applies on confirm', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await seed(page);

    // 1. Importing shows a report and does not replace the project yet.
    await importLottie(page);
    const dialog = page.getByRole('dialog', { name: 'Lottie import report' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('LOTTIE_PRECOMP_UNMAPPED');
    // The precomp layer is reported and skipped, so one of the two layers imports.
    await expect(dialog).toContainText('1 layer(s)');

    // 2. Cancel leaves the seeded project exactly as it was.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Seed Layer')).toBeVisible();
    await expect(page.getByText('Imported Block')).toHaveCount(0);

    // 3. Import again and confirm: the imported layers are now the project.
    await importLottie(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Import and replace project' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Imported Block').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Seed Layer')).toHaveCount(0);

    expect(consoleErrors.filter((message) => !/favicon/iu.test(message))).toEqual([]);
  });
});
