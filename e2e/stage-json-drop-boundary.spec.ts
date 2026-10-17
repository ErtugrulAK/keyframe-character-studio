import { test, expect, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

/**
 * N3 PR-2a: the `application/json` stage drop channel is readable and
 * writable by anything with DOM access, so the drop boundary — not
 * addCustomPart — decides what reaches the document. The legitimate drawer
 * payload keeps working end-to-end; malformed and prototype-sensitive
 * payloads are refused with zero document change.
 */
async function dropJsonOnStage(page: Page, payload: string) {
  await page.locator('.stage-canvas-container').evaluate((stage, raw) => {
    const transfer = new DataTransfer();
    transfer.setData('application/json', raw);
    const rect = stage.getBoundingClientRect();
    stage.dispatchEvent(new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
      clientX: rect.x + rect.width / 2,
      clientY: rect.y + rect.height / 2,
    }));
  }, payload);
}

const layerNames = (page: Page) =>
  page.evaluate((key) => {
    const scene = JSON.parse(localStorage.getItem(key) ?? '{}') as { layers?: { name?: string }[] };
    return (scene.layers ?? []).map((layer) => layer.name);
  }, STORAGE_KEY);

async function resetToEmptyDocument(page: Page) {
  await page.goto('/');
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload();
  await expect(page.locator('.stage-canvas-container')).toBeVisible({ timeout: 30000 });
}

test('a legitimate drawer JSON drop still creates the layer', async ({ page }) => {
  await resetToEmptyDocument(page);

  await dropJsonOnStage(page, JSON.stringify({ type: 'custom_star', name: 'Dropped Star' }));

  await expect(page.locator('.actor-node', { hasText: 'Dropped Star' })).toHaveCount(1, { timeout: 15000 });
});

test('hostile JSON drops are refused without touching the document', async ({ page }) => {
  await resetToEmptyDocument(page);

  // Baseline: one accepted drop so autosave has run and the layer census is real.
  await dropJsonOnStage(page, JSON.stringify({ type: 'custom_circle', name: 'Baseline Circle' }));
  await expect(page.locator('.actor-node', { hasText: 'Baseline Circle' })).toHaveCount(1, { timeout: 15000 });
  await expect.poll(async () => (await layerNames(page)).length, { timeout: 20000 }).toBe(1);

  const hostilePayloads = [
    '{type:custom_box', // malformed JSON
    'null',
    '"custom_box"',
    '[]',
    JSON.stringify({ name: 'no type' }),
    JSON.stringify({ type: 'not_a_part_type', name: 'Impostor' }),
    JSON.stringify({ type: '__proto__', name: 'Proto Type' }),
    '{"__proto__":{"polluted":true},"type":"custom_box","name":"Proto Root"}',
    JSON.stringify({ type: 'custom_box', name: { toString: () => 'Sneaky Name' } }),
    JSON.stringify({ type: 'custom_image', name: 'Media Impostor' }),
  ];

  for (const payload of hostilePayloads) {
    await dropJsonOnStage(page, payload);
  }

  // No hostile name may exist in the document or the outliner...
  expect(await layerNames(page)).toEqual(['Baseline Circle']);
  for (const refused of ['Impostor', 'Proto Type', 'Proto Root', 'Sneaky Name', 'Media Impostor', 'custom_box']) {
    await expect(page.locator('.actor-node', { hasText: refused })).toHaveCount(0);
  }
  // ...and the page itself must not have grown any layer node.
  await expect(page.locator('.actor-node')).toHaveCount(1);
});
