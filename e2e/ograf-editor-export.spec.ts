import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { test, expect } from '@playwright/test';

test('editor exports the current project as an OGraf ZIP', async ({ page }) => {
  await page.goto('/');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('menuitem', { name: 'OGraf Package', exact: true }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/\.ograf\.zip$/u);
  const path = await download.path();
  expect(path).toBeTruthy();

  // The package carries a rendered thumbnail (a real PNG) and lists it.
  const files = unzipSync(new Uint8Array(await readFile(path!)));
  const thumbnail = files['thumbnail.png'];
  expect(thumbnail).toBeDefined();
  expect(Array.from(thumbnail.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  const view = new DataView(thumbnail.buffer, thumbnail.byteOffset);
  expect([view.getUint32(16), view.getUint32(20)]).toEqual([320, 180]);
  const manifestPath = Object.keys(files).find((name) => name.endsWith('.ograf.json'))!;
  const manifest = JSON.parse(new TextDecoder().decode(files[manifestPath]));
  expect(manifest.thumbnails).toEqual([{ file: 'thumbnail.png', resolution: { width: 320, height: 180 } }]);
  expect(manifest.supportsNonRealTime).toBe(true);
});
