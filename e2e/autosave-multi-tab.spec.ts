import { test, expect, type Page } from '@playwright/test';

/**
 * SAFE-01 — cross-tab autosave data safety, real Chromium, multiple pages of
 * the SAME browser context (one shared localStorage origin = the real
 * multi-tab scenario). The 10s autosave interval is a background writer;
 * every guard below SAMPLES the shared key across more than two full
 * intervals (the probe proved the overwrite fires at mount+10s), asserting
 * the safe value held at EVERY sample — not "eventually equals", which would
 * pass before the first tick ever lands.
 *
 * The windows encode the app's OWN 10-second cadence (a documented behavior
 * window), not test tolerance: no retries, no sleeps standing in for waits.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const WINDOW_MS = 24_000; // > two full 10s autosave intervals.

function layer(id: string, x: number, zIndex: number): Record<string, unknown> {
  return {
    id, name: id, type: 'custom_rect',
    x, y: -40, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex,
    fillColor: '#3a86ff', strokeColor: '#000000',
    fillEnabled: true, strokeEnabled: false, width: 100, height: 80,
  };
}

function seedSceneJson(ids: string[]): string {
  const layers = ids.map((id, index) => layer(id, -120 + index * 140, ids.length - index));
  const tracks = layers.map((entry) => ({
    id: `t_${entry.id as string}`,
    partId: entry.id as string,
    name: entry.name as string,
    color: '#22c55e',
    visible: true,
    locked: false,
    channels: { x: [{ id: `${entry.id as string}_x0`, frame: 0, value: 0, easing: 'linear' }] },
  }));
  return JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1',
    name: 'SAFE-01', width: 1920, height: 1080, fps: 30, totalFrames: 90,
    layers, tracks,
  });
}

function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

async function putStorage(page: Page, value: string): Promise<void> {
  await page.evaluate(([key, payload]) => localStorage.setItem(key, payload), [STORAGE_KEY, value]);
}

async function readStoredLayerIds(page: Page): Promise<string[] | null> {
  return page.evaluate((key: string) => {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const doc = JSON.parse(raw) as { layers?: { id: string }[] };
    return (doc.layers ?? []).map((entry) => entry.id);
  }, STORAGE_KEY);
}

function paintedParts(page: Page): () => Promise<number> {
  return async () =>
    page.evaluate(() =>
      new Set([...document.querySelectorAll('[data-part-id]')].map((el) => el.getAttribute('data-part-id'))).size);
}

async function addRectangle(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Vector Shapes & Graphic Elements' }).first().click({ timeout: 5000 });
  await page.getByRole('button', { name: 'Rectangle', exact: true }).first().click({ timeout: 5000 });
  const stage = await page.locator('.stage-canvas-container').boundingBox() /* C7b: the visible stage; the drawing surface is window-sized */;
  if (!stage) throw new Error('stage svg is not visible');
  await page.mouse.move(stage.x + stage.width - 140, stage.y + stage.height - 110);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width - 220, stage.y + stage.height - 180);
  await page.mouse.up();
}

async function bootTab(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30_000 });
}

/** Sample the shared storage across the whole observation window (500ms cadence). */
async function sampleStorage(page: Page, ms: number = WINDOW_MS): Promise<(string[] | null)[]> {
  const samples: (string[] | null)[] = [];
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    samples.push(await readStoredLayerIds(page));
    await delay(500);
  }
  samples.push(await readStoredLayerIds(page));
  return samples;
}

test('K1 — an idle empty tab cannot wipe the shared project another session saved', async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext();
  try {
    const idleTab = await context.newPage();
    await bootTab(idleTab); // booted on EMPTY storage, never edited: the reproduced killer
    await putStorage(idleTab, seedSceneJson(['a', 'b', 'c'])); // a legitimate save by another session

    const samples = await sampleStorage(idleTab);
    // EVERY sample across two-plus intervals must still hold the saved document.
    expect(
      samples.every((ids) => ids !== null && ids.length === 3 && ['a', 'b', 'c'].every((id) => ids.includes(id))),
      `idle tab overwrote the shared document; storage samples: ${JSON.stringify(samples)}`,
    ).toBe(true);

    // And the saved project survives a fresh tab's reload — no permanent loss.
    const lateTab = await context.newPage();
    await lateTab.goto('/');
    await expect(lateTab.locator('.ue-track-row')).toHaveCount(3, { timeout: 30_000 });
    await expect.poll(paintedParts(lateTab), { timeout: 10_000 }).toBe(3);
  } finally {
    await context.close();
  }
});

test('K2 — a stale restored tab cannot overwrite another tab\'s newer save', async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext();
  try {
    const staleTab = await context.newPage();
    await bootTab(staleTab);
    await putStorage(staleTab, seedSceneJson(['a', 'b', 'c']));
    await staleTab.reload();
    await expect(staleTab.locator('.ue-track-row')).toHaveCount(3, { timeout: 30_000 }); // stale tab holds a,b,c in memory

    await putStorage(staleTab, seedSceneJson(['a', 'b', 'c', 'newer'])); // another session saves a newer document
    const samples = await sampleStorage(staleTab);
    expect(
      samples.every((ids) => ids !== null && ids.length === 4 && ids.includes('newer')),
      `stale tab rolled back the newer document; storage samples: ${JSON.stringify(samples)}`,
    ).toBe(true);

    const lateTab = await context.newPage();
    await lateTab.goto('/');
    await expect(lateTab.locator('.ue-track-row')).toHaveCount(4, { timeout: 30_000 });
  } finally {
    await context.close();
  }
});

test('H1 — two concurrently active tabs surface a visible conflict instead of silent overwrites', async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext();
  try {
    // Both tabs restore the SAME stored document, then both edit it.
    const seedTab = await context.newPage();
    await bootTab(seedTab);
    await putStorage(seedTab, seedSceneJson(['a', 'b', 'c']));
    await seedTab.close();

    const tabA = await context.newPage();
    await bootTab(tabA);
    await expect(tabA.locator('.ue-track-row')).toHaveCount(3, { timeout: 30_000 });
    const tabB = await context.newPage();
    await bootTab(tabB);
    await expect(tabB.locator('.ue-track-row')).toHaveCount(3, { timeout: 30_000 });

    // A wins the key legitimately: it edited, and storage still held exactly what it read.
    await addRectangle(tabA);
    await expect.poll(paintedParts(tabA), { timeout: 10_000 }).toBe(4);

    // A's save must become visible in the shared storage.
    let aSavedIds: string[] = [];
    await expect
      .poll(async () => {
        const ids = await readStoredLayerIds(tabA);
        aSavedIds = ids ?? [];
        return ids !== null && ids.length === 4 && ['a', 'b', 'c'].every((id) => ids.includes(id));
      }, { timeout: WINDOW_MS, intervals: [500] })
      .toBe(true);
    const aRectId = aSavedIds.find((id) => id !== 'a' && id !== 'b' && id !== 'c');
    if (aRectId === undefined) throw new Error('tab A persisted no new layer');

    // B — holding the pre-A document in memory — now edits and starts ticking.
    await addRectangle(tabB);
    await expect.poll(paintedParts(tabB), { timeout: 10_000 }).toBe(4);
    const samples = await sampleStorage(tabB);
    // B's document (3 seeded + B's own rectangle, WITHOUT A's rectangle) must
    // NEVER reach storage: that is the silent last-writer overwrite.
    const bPushedOverA = samples.some(
      (ids) => ids !== null && ids.length === 4 && !ids.includes(aRectId),
    );
    expect(bPushedOverA, `storage samples: ${JSON.stringify(samples)}`).toBe(false);

    // The conflict is VISIBLE to the user, not silent.
    await expect(tabB.locator('.autosave-status-badge--paused')).toBeVisible({ timeout: 10_000 });
  } finally {
    await context.close();
  }
});
