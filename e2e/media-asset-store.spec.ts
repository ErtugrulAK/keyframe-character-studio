import { test, expect, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

/**
 * The autosave keeps media in a content-addressed IndexedDB store: the scene in
 * localStorage names a photo (`kcs-asset:sha256-…`) instead of carrying it, so
 * a few photos no longer fill the ~5 MB quota. Reloading resolves the name back
 * to the same bytes; a name whose bytes are gone keeps its layer and its name.
 */

/** Drops a noisy 96×96 PNG (a data URL far above the inline threshold). */
async function dropLargeImage(page: Page, fileName: string): Promise<string> {
  return page.locator('.stage-canvas-container').evaluate(async (stage, name) => {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const context = canvas.getContext('2d')!;
    const pixels = context.createImageData(96, 96);
    let seed = 7;
    for (let index = 0; index < pixels.data.length; index += 1) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      pixels.data[index] = index % 4 === 3 ? 255 : seed % 256;
    }
    context.putImageData(pixels, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (character) => character.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], name, { type: 'image/png' }));
    const rect = stage.getBoundingClientRect();
    stage.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 }));
    return dataUrl;
  }, fileName);
}

const savedLayer = (page: Page, name: string) => page.evaluate(([key, layerName]) => {
  const raw = localStorage.getItem(key) ?? '{}';
  const scene = JSON.parse(raw) as { layers?: { name?: string; imageUrl?: string }[] };
  return { imageUrl: scene.layers?.find((layer) => layer.name === layerName)?.imageUrl ?? '', storedLength: raw.length };
}, [STORAGE_KEY, name] as const);

async function freshEditor(page: Page) {
  await page.goto('/');
  await page.evaluate(async (key) => {
    localStorage.removeItem(key);
    await new Promise((resolve) => { const request = indexedDB.deleteDatabase('kcs-assets'); request.onsuccess = request.onerror = request.onblocked = resolve; });
  }, STORAGE_KEY);
  await page.reload();
  await expect(page.locator('.stage-canvas-container')).toBeVisible({ timeout: 30000 });
}

test('a large image is stored once and the saved scene names it; a reload brings back the same bytes', async ({ page }) => {
  await freshEditor(page);
  const dataUrl = await dropLargeImage(page, 'noise.png');
  expect(dataUrl.length).toBeGreaterThan(10000);
  await expect(page.locator('.actor-node', { hasText: 'noise.png' })).toHaveCount(1, { timeout: 15000 });

  await expect.poll(async () => (await savedLayer(page, 'noise.png')).imageUrl, { timeout: 20000 }).toMatch(/^kcs-asset:sha256-[0-9a-f]{64}$/u);
  const saved = await savedLayer(page, 'noise.png');
  // The scene no longer carries the photo.
  expect(saved.storedLength).toBeLessThan(dataUrl.length);

  await page.reload();
  await expect(page.locator('.stage-canvas-container')).toBeVisible({ timeout: 30000 });
  await expect.poll(() => page.locator('.stage-svg image').first().getAttribute('href'), { timeout: 15000 }).toBe(dataUrl);
});

test('a saved name whose bytes are gone keeps its layer and its name', async ({ page }) => {
  await freshEditor(page);
  await dropLargeImage(page, 'noise.png');
  await expect.poll(async () => (await savedLayer(page, 'noise.png')).imageUrl, { timeout: 20000 }).toMatch(/^kcs-asset:/u);
  const { imageUrl: reference } = await savedLayer(page, 'noise.png');

  // The site data for the asset store is cleared; the autosave is not.
  await page.evaluate(() => new Promise((resolve) => { const request = indexedDB.deleteDatabase('kcs-assets'); request.onsuccess = request.onerror = request.onblocked = resolve; }));
  await page.reload();
  await expect(page.locator('.stage-canvas-container')).toBeVisible({ timeout: 30000 });

  await expect(page.locator('.actor-node', { hasText: 'noise.png' })).toHaveCount(1, { timeout: 15000 });
  expect((await savedLayer(page, 'noise.png')).imageUrl).toBe(reference);
});
