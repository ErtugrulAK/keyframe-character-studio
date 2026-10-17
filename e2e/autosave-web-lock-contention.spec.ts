import { test, expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * SAFE-02 — real two-tab Web Locks contention.
 *
 * The autosave interval is a cooperative writer; SAFE-02 wraps its
 * read-compare-write in the Web Lock named after the shared key. These specs
 * drive TWO real tabs and hold the lock open from the second tab via
 * `navigator.locks.request` (no production test seams — the contender is the
 * browser's own lock manager), then assert:
 *   W1 an autosave tick against a busy lock is SKIPPED: the shared key stays
 *      byte-identical while the foreign holder runs, no conflict badge appears
 *      (a busy lock is not an ownership conflict), and the retry after release
 *      persists the edit exactly once.
 *   W2 a manual save queues FIFO, times out its bounded wait, reports "not
 *      completed", keeps the edits and the badge clean, and the next tick
 *      completes the write after the holder releases.
 *
 * The lock name mirrors src/utils/constants.ts AUTOSAVE_LOCK_NAME; the string
 * is inlined here because the browser-side holder must name it without
 * importing app modules.
 */

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const LOCK_NAME = 'kcs-autosave:SEQUENCER_STUDIO_PRO_V5';

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
    name: 'SAFE-02', width: 1920, height: 1080, fps: 30, totalFrames: 90,
    layers, tracks,
  });
}

async function readIds(page: Page): Promise<string[] | null> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  if (raw === null) return null;
  return ((JSON.parse(raw) as { layers?: { id: string }[] }).layers ?? []).map((entry) => entry.id);
}

async function addRectangle(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Vector Shapes & Graphic Elements' }).first().click({ timeout: 5000 });
  await page.getByRole('button', { name: 'Rectangle', exact: true }).first().click({ timeout: 5000 });
  const stage = await page.locator('.stage-svg').boundingBox();
  if (!stage) throw new Error('stage svg is not visible');
  await page.mouse.move(stage.x + stage.width - 140, stage.y + stage.height - 110);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width - 220, stage.y + stage.height - 180);
  await page.mouse.up();
}

/**
 * Hold the autosave lock from `page` until the page itself releases the gate
 * (window.__kcsReleaseLock). Resolves only after `navigator.locks.query()`
 * confirms the held state — deterministic, no sleep.
 */
async function holdLock(page: Page): Promise<void> {
  await page.evaluate(async (name) => {
    const gate = new Promise<void>((resolve) => {
      (window as unknown as { __kcsReleaseLock: () => void }).__kcsReleaseLock = () => resolve();
    });
    void navigator.locks.request(name, async () => {
      await gate;
    });
  }, LOCK_NAME);
  await expect
    .poll(async () => page.evaluate(async (name) => {
      const state = await navigator.locks.query();
      return (state.held ?? []).some((lock) => lock.name === name);
    }, LOCK_NAME), { timeout: 5_000, intervals: [100] })
    .toBe(true);
}

async function releaseLock(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __kcsReleaseLock: () => void }).__kcsReleaseLock();
  });
  await expect
    .poll(async () => page.evaluate(async (name) => {
      const state = await navigator.locks.query();
      return (state.held ?? []).some((lock) => lock.name === name);
    }, LOCK_NAME), { timeout: 5_000, intervals: [100] })
    .toBe(false);
}

async function bootSeedAndSecondTab(context: BrowserContext) {
  const seedTab = await context.newPage();
  await seedTab.goto('/');
  await expect(seedTab.locator('.app-container')).toBeVisible({ timeout: 30_000 });
  await seedTab.evaluate(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, seedSceneJson(['a', 'b', 'c'])] as [string, string]);
  await seedTab.close();

  const writer = await context.newPage();
  await writer.goto('/');
  await expect(writer.locator('.ue-track-row')).toHaveCount(3, { timeout: 30_000 });
  const holder = await context.newPage();
  await holder.goto('/');
  await expect(holder.locator('.ue-track-row')).toHaveCount(3, { timeout: 30_000 });
  return { writer, holder };
}

test('W1 — a busy lock skips the autosave tick and the retry persists the edit', async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext();
  try {
    const { writer, holder } = await bootSeedAndSecondTab(context);
    await holdLock(holder);

    await addRectangle(writer);
    await expect
      .poll(async () => writer.evaluate(() => document.querySelectorAll('[data-part-id]').length), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(4);

    // Cross the next interval tick while the foreign holder keeps the lock.
    await writer.waitForTimeout(11_500);
    expect(await readIds(writer)).toEqual(['a', 'b', 'c']);
    await expect(writer.locator('.autosave-status-badge--paused')).toHaveCount(0);

    await releaseLock(holder);
    await expect
      .poll(async () => {
        const ids = await readIds(writer);
        return ids !== null && ids.length === 4 && ['a', 'b', 'c'].every((id) => ids.includes(id));
      }, { timeout: 25_000, intervals: [500] })
      .toBe(true);
    await expect(writer.locator('.autosave-status-badge--paused')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('W2 — a manual save against a busy lock times out truthfully and the tick completes the write', async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext();
  try {
    const { writer, holder } = await bootSeedAndSecondTab(context);
    await addRectangle(writer);
    await expect
      .poll(async () => writer.evaluate(() => document.querySelectorAll('[data-part-id]').length), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(4);
    await holdLock(holder);

    await writer.locator('.autosave-status-badge').click();

    // The bounded wait expires well inside the 10s interval: a truthful
    // "not completed" notice, and NO write attempted while the holder runs.
    await expect(writer.getByText(/not completed/i)).toBeVisible({ timeout: 4_000 });
    expect(await readIds(writer)).toEqual(['a', 'b', 'c']);
    await expect(writer.locator('.autosave-status-badge--paused')).toHaveCount(0);

    await releaseLock(holder);
    await expect
      .poll(async () => {
        const ids = await readIds(writer);
        return ids !== null && ids.length === 4 && ['a', 'b', 'c'].every((id) => ids.includes(id));
      }, { timeout: 25_000, intervals: [500] })
      .toBe(true);
  } finally {
    await context.close();
  }
});
