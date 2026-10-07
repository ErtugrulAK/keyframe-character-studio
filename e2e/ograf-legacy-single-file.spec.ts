import { test, expect, type Page } from '@playwright/test';

/**
 * D-02 — the legacy single-file export writes ONE `.mjs`. When the graphic
 * depends on packaged assets (fonts, licenses) that download alone would be a
 * broken, unlicensed graphic, so the export must fail closed with an actionable
 * message. An asset-free graphic keeps exporting.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const channel = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const textLayer = (id: string, fontFamily: string) => ({
  id, name: 'Cinematic Title', type: 'custom_text', x: 0, y: 0, rotation: 0,
  scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#ffffff', strokeColor: 'none', width: 400, height: 200,
  textValue: 'Editable title', fontSize: 96, fontFamily,
});

const boxLayer = (id: string) => ({
  id, name: 'Box', type: 'custom_box', x: 0, y: 0, rotation: 0,
  scaleX: 3, scaleY: 3, opacity: 1, visible: true, zIndex: 0,
  fillColor: '#ff2080', strokeColor: '#101218', width: 60, height: 60,
});

async function seed(page: Page, layers: Record<string, unknown>[]): Promise<void> {
  const scene = JSON.stringify({
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    width: 1920,
    height: 1080,
    fps: 30,
    totalFrames: 60,
    layers,
    tracks: layers.map((layer) => ({ partId: layer.id as string, channels: channel() })),
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    (payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value),
    { key: STORAGE_KEY, value: scene },
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

test('the legacy single-file export is refused when the graphic needs packaged assets', async ({ page }) => {
  await seed(page, [textLayer('title', "'Playfair Display', serif")]);

  let downloaded = false;
  page.on('download', () => { downloaded = true; });

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('menuitem', { name: 'OGraf Single File (Legacy)', exact: true }).click();

  await expect(page.getByText(/single-file legacy export cannot carry/u)).toBeVisible({ timeout: 10000 });
  expect(downloaded).toBe(false);
});

test('the legacy single-file export still works for an asset-free graphic', async ({ page }) => {
  await seed(page, [boxLayer('box')]);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('menuitem', { name: 'OGraf Single File (Legacy)', exact: true }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/\.mjs$/u);
});
