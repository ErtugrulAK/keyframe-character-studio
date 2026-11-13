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

const storedAssetCount = (page: Page) => page.evaluate(() => new Promise<number>((resolve, reject) => {
  const open = indexedDB.open('kcs-assets', 1);
  open.onupgradeneeded = () => { open.result.createObjectStore('assets'); };
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const request = open.result.transaction('assets', 'readonly').objectStore('assets').count();
    request.onsuccess = () => { open.result.close(); resolve(request.result); };
    request.onerror = () => reject(request.error);
  };
}));

/** Tabs holding an asset session (dev StrictMode mounts twice, so tabs are counted by client). */
const sessionHolders = (page: Page) => page.evaluate(async () => new Set((await navigator.locks.query()).held?.filter((lock) => lock.name === 'kcs-assets-session').map((lock) => lock.clientId)).size);

/** The saved scene stops naming the image, as after the layer was deleted and saved. */
const forgetSavedLayer = (page: Page, name: string) => page.evaluate(([key, layerName]) => {
  const scene = JSON.parse(localStorage.getItem(key) ?? '{}') as { layers?: { name?: string }[] };
  scene.layers = (scene.layers ?? []).filter((layer) => layer.name !== layerName);
  localStorage.setItem(key, JSON.stringify(scene));
}, [STORAGE_KEY, name] as const);

test('a stored image no saved scene names is deleted when the editor opens alone', async ({ page }) => {
  await freshEditor(page);
  await dropLargeImage(page, 'noise.png');
  await expect.poll(async () => (await savedLayer(page, 'noise.png')).imageUrl, { timeout: 20000 }).toMatch(/^kcs-asset:/u);
  expect(await storedAssetCount(page)).toBe(1);

  await forgetSavedLayer(page, 'noise.png');
  await page.reload();
  await expect(page.locator('.stage-canvas-container')).toBeVisible({ timeout: 30000 });
  await expect.poll(() => storedAssetCount(page), { timeout: 15000 }).toBe(0);
});

test('nothing is deleted while another editor tab is open', async ({ page, context }) => {
  await freshEditor(page);
  await dropLargeImage(page, 'noise.png');
  await expect.poll(async () => (await savedLayer(page, 'noise.png')).imageUrl, { timeout: 20000 }).toMatch(/^kcs-asset:/u);

  const other = await context.newPage();
  await other.goto('/');
  await expect(other.locator('.stage-canvas-container')).toBeVisible({ timeout: 30000 });

  await forgetSavedLayer(page, 'noise.png');
  await page.reload();
  await expect(page.locator('.stage-canvas-container')).toBeVisible({ timeout: 30000 });
  // Both tabs hold their asset session, so the reloaded tab has passed the point
  // where it would sweep; the other tab may still hold the image in its undo history.
  await expect.poll(() => sessionHolders(page), { timeout: 15000 }).toBe(2);
  expect(await storedAssetCount(page)).toBe(1);

  await other.close();
  await page.reload();
  await expect(page.locator('.stage-canvas-container')).toBeVisible({ timeout: 30000 });
  await expect.poll(() => storedAssetCount(page), { timeout: 15000 }).toBe(0);
});
