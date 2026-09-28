import { test, expect, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

/**
 * Astra F-06: a file dropped on the stage was stored as a `blob:` URL, which
 * belongs to the document that created it. The saved project then pointed at an
 * address that dies with the page, so the media came back broken after a reload.
 *
 * This runs the real drop handler in the real editor and reloads the page, which
 * is the only proof that the persisted document is self-contained.
 */
const PIXEL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';

async function dropImageOnStage(page: Page, fileName: string) {
  await page.locator('.stage-canvas-container').evaluate((stage, [name, base64]) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], name, { type: 'image/png' }));
    const rect = stage.getBoundingClientRect();
    stage.dispatchEvent(new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
      clientX: rect.x + rect.width / 2,
      clientY: rect.y + rect.height / 2,
    }));
  }, [fileName, PIXEL_PNG_BASE64] as const);
}

const savedImageUrls = (page: Page) =>
  page.evaluate((key) => {
    const scene = JSON.parse(localStorage.getItem(key) ?? '{}') as { layers?: { name?: string; imageUrl?: string }[] };
    return (scene.layers ?? []).map((layer) => ({ name: layer.name, imageUrl: layer.imageUrl }));
  }, STORAGE_KEY);

test('a dropped image is persisted as a self-contained source and survives a reload', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload();
  await expect(page.locator('.stage-canvas-container')).toBeVisible({ timeout: 30000 });

  await dropImageOnStage(page, 'dropped-pixel.png');

  // The drop handler reads the file asynchronously, so wait for the layer to
  // appear before inspecting what the autosave stored.
  const layerRow = page.locator('.actor-node', { hasText: 'dropped-pixel.png' });
  await expect(layerRow).toHaveCount(1, { timeout: 15000 });

  await expect.poll(async () => (await savedImageUrls(page)).find((entry) => entry.name === 'dropped-pixel.png')?.imageUrl ?? '', {
    timeout: 20000,
  }).toMatch(/^data:image\/png;base64,/);

  const saved = (await savedImageUrls(page)).find((entry) => entry.name === 'dropped-pixel.png');
  expect(saved?.imageUrl).not.toContain('blob:');

  // Reload: the document must render the media from its own bytes.
  await page.reload();
  await expect(page.locator('.stage-canvas-container')).toBeVisible({ timeout: 30000 });

  const rendered = await page.locator('.stage-svg image').first().getAttribute('href');
  expect(rendered).toMatch(/^data:image\/png;base64,/);

  const loaded = await page.evaluate(async (href) => {
    try {
      const response = await fetch(href as string);
      return { status: response.status, bytes: (await response.arrayBuffer()).byteLength };
    } catch (error) {
      return { status: 'failed', message: (error as Error).message };
    }
  }, rendered);
  expect(loaded.status).toBe(200);
  expect(loaded.bytes).toBeGreaterThan(0);
});
