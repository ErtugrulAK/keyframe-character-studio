import { test, expect, type Page } from '@playwright/test';

/**
 * M22 STEP 8C — REAL USER E2E: outliner matte relationship visibility (8A)
 * + matte cycle/self-reference integrity (8B) through the REAL UI:
 * outliner row clicks, Inspector STYLE tab, matte source selects, delete
 * button, visibility/reorder — no state injection, no React internals.
 */

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

function makeLayer(id: string, name: string, type: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, name, type,
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1,
    fillColor: '#ff0000', strokeColor: '#101218', strokeWidth: 2, borderRadius: 0,
    width: 60, height: 60,
    ...overrides,
  };
}

const FIX_BLACK = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect x="0" y="0" width="200" height="100" fill="black"/></svg>');

async function seed(page: Page, layers: Record<string, unknown>[]): Promise<void> {
  const scene = {
    version: 1, layers, tracks: [], fps: 30, totalFrames: 90,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'M22 Relationship E2E',
  };
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    ([key, data]: [string, string]) => { localStorage.setItem(key, data); },
    [STORAGE_KEY, JSON.stringify(scene)],
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.waitForFunction(() => {
    try { return JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}').layers?.length >= 1; } catch { return false; }
  }, undefined, { timeout: 10000 });
}

/** Select a part by clicking its OUTLINER row (real user path).
 *  NOTE: match on the .actor-name span only — a row's matte indicator may
 *  contain ANOTHER part's name (cross-row hasText false positives). */
async function selectPart(page: Page, name: string): Promise<void> {
  const row = page.locator('.actor-node', { has: page.locator('.actor-name', { hasText: name }) }).first();
  await row.waitFor({ state: 'visible', timeout: 10000 });
  await row.click();
  await page.waitForTimeout(300);
}

/** Open the Inspector STYLE tab (the TRACK MATTE card lives there). */
async function openStyleTab(page: Page): Promise<void> {
  const styleTab = page.locator('button', { hasText: /^Style$/ }).first();
  if (await styleTab.count()) {
    await styleTab.click();
    await page.waitForTimeout(300);
  }
}

/** Set the matte source via the Inspector's MATTE SOURCE select. */
async function setMatteSource(page: Page, sourceId: string): Promise<void> {
  await openStyleTab(page);
  // the matte source select is the select containing the eligible sources
  const select = page.locator(`select.select-control:has(option[value="${sourceId}"])`);
  await select.waitFor({ state: 'visible', timeout: 10000 });
  await select.selectOption(sourceId);
  await page.waitForTimeout(300);
}

async function matteIndicator(page: Page, label: string): Promise<boolean> {
  return (await page.locator(`[aria-label="${label}"]`).count()) > 0;
}

test.describe('M22 — outliner matte relationship + validation (real UI)', () => {
  test('E2E-1 — valid matte relationship: indicator + CharacterPart.name in the outliner', async ({ page }) => {
    await seed(page, [
      makeLayer('cow', 'The Cow', 'custom_star', { fillColor: '#ffffff' }),
      makeLayer('logo', 'The Logo', 'custom_box'),
    ]);
    await selectPart(page, 'The Logo');
    await setMatteSource(page, 'cow');
    // outliner: target row shows the relationship with the SOURCE PART name
    expect(await matteIndicator(page, 'Matte source: The Cow')).toBe(true);
    const tooltip = await page.locator('[aria-label="Matte source: The Cow"]').getAttribute('title');
    expect(tooltip).toBe('Matte source: The Cow');
    // the row that carries it is the Logo row (not the Cow row)
    const logoRow = page.locator('.actor-node', { has: page.locator('.actor-name', { hasText: 'The Logo' }) }).first();
    expect(await logoRow.locator('[aria-label="Matte source: The Cow"]').count()).toBe(1);
    // no "Missing" anywhere
    expect(await matteIndicator(page, 'Missing matte source')).toBe(false);
  });

  test('E2E-2 — missing source: delete the source via the real UI → warning state, no crash', async ({ page }) => {
    await seed(page, [
      makeLayer('cow', 'The Cow', 'custom_star', { fillColor: '#ffffff' }),
      makeLayer('logo', 'The Logo', 'custom_box', { matte: { sourcePartId: 'cow', mode: 'alpha', enabled: true } }),
    ]);
    expect(await matteIndicator(page, 'Matte source: The Cow')).toBe(true);
    // delete the SOURCE part through the Inspector delete button (real path)
    await selectPart(page, 'The Cow');
    await openStyleTab(page);
    const del = page.locator('button[title="Delete Actor Instance"]');
    await del.waitFor({ state: 'visible', timeout: 10000 });
    await del.click();
    await page.waitForTimeout(400);
    // outliner: the Logo row now shows the warning state; app still alive
    expect(await matteIndicator(page, 'Missing matte source')).toBe(true);
    expect(await page.locator('.actor-node', { hasText: 'The Logo' }).count()).toBe(1);
    const missingLabel = await page.locator('[aria-label="Missing matte source"]').getAttribute('title');
    expect(missingLabel).toContain('Missing matte source');
    // the relationship indicator text is "Missing" (never blank)
    const logoRow = page.locator('.actor-node', { hasText: 'The Logo' }).first();
    expect(await logoRow.locator('text=Missing').count()).toBeGreaterThanOrEqual(1);
  });

  test('E2E-3 — self reference: UI prevents it; imported self-ref scene stays healthy', async ({ page }) => {
    await seed(page, [
      makeLayer('logo', 'The Logo', 'custom_box'),
    ]);
    await selectPart(page, 'The Logo');
    await openStyleTab(page);
    // the source selector must NOT offer the part itself (UI guard)
    const select = page.locator('select.select-control').filter({ has: page.locator('option[value="logo"]') });
    expect(await select.count()).toBe(0);
    // imported self-referencing scene (real app load path): no crash, the
    // relationship resolves to itself, no missing warning
    await seed(page, [makeLayer('logo', 'The Logo', 'custom_box', { matte: { sourcePartId: 'logo', mode: 'alpha', enabled: true } })]);
    expect(await matteIndicator(page, 'Matte source: The Logo')).toBe(true);
    expect(await matteIndicator(page, 'Missing matte source')).toBe(false);
    expect(await page.locator('.actor-node').count()).toBe(1);
  });

  test('E2E-4 — direct cycle A→B, B→A: both indicators visible, no missing, no crash', async ({ page }) => {
    await seed(page, [
      makeLayer('a', 'Part A', 'custom_circle'),
      makeLayer('b', 'Part B', 'custom_circle'),
    ]);
    await selectPart(page, 'Part A');
    await setMatteSource(page, 'b');
    await selectPart(page, 'Part B');
    await setMatteSource(page, 'a');
    // both relationships visible, neither missing (both sources exist)
    expect(await matteIndicator(page, 'Matte source: Part B')).toBe(true);
    expect(await matteIndicator(page, 'Matte source: Part A')).toBe(true);
    expect(await matteIndicator(page, 'Missing matte source')).toBe(false);
    // renderer keeps working: a fresh matte assignment defaults to CLIP mode
    // (the UI contract) → the clipPath pipeline emits defs for both parts
    expect(await page.locator('clipPath[id^="kcs-clip"]').count()).toBeGreaterThanOrEqual(2);
    expect(await page.locator('.actor-node').count()).toBe(2);
  });

  test('E2E-5 — valid chain A→B, B→C, C→nothing: no false positives', async ({ page }) => {
    await seed(page, [
      makeLayer('a', 'Part A', 'custom_circle'),
      makeLayer('b', 'Part B', 'custom_circle'),
      makeLayer('c', 'Part C', 'custom_circle'),
    ]);
    await selectPart(page, 'Part B');
    await setMatteSource(page, 'a');
    await selectPart(page, 'Part C');
    await setMatteSource(page, 'b');
    expect(await matteIndicator(page, 'Matte source: Part A')).toBe(true);
    expect(await matteIndicator(page, 'Matte source: Part B')).toBe(true);
    expect(await matteIndicator(page, 'Missing matte source')).toBe(false);
    expect(await page.locator('.actor-node').count()).toBe(3);
  });

  test('E2E-6 — shape / text / image sources: relationship UI is type-agnostic', async ({ page }) => {
    await seed(page, [
      makeLayer('shp', 'Star Src', 'custom_star', { fillColor: '#ffffff' }),
      makeLayer('txt', 'Title Src', 'custom_text', { textValue: 'HHH', fontSize: 80, fontFamily: 'Arial', fillColor: '#ffffff' }),
      makeLayer('img', 'Logo Src', 'custom_image', { imageUrl: FIX_BLACK, width: 200, height: 150 }),
      makeLayer('t1', 'T One', 'custom_box'),
      makeLayer('t2', 'T Two', 'custom_box'),
      makeLayer('t3', 'T Three', 'custom_box'),
    ]);
    await selectPart(page, 'T One');
    await setMatteSource(page, 'shp');
    await selectPart(page, 'T Two');
    await setMatteSource(page, 'txt');
    await selectPart(page, 'T Three');
    await setMatteSource(page, 'img');
    expect(await matteIndicator(page, 'Matte source: Star Src')).toBe(true);
    expect(await matteIndicator(page, 'Matte source: Title Src')).toBe(true);
    expect(await matteIndicator(page, 'Matte source: Logo Src')).toBe(true);
    expect(await matteIndicator(page, 'Missing matte source')).toBe(false);
  });

  test('E2E-7 — source switch The Cow → The Lion: outliner updates, settings + selection kept', async ({ page }) => {
    await seed(page, [
      makeLayer('cow', 'The Cow', 'custom_star', { fillColor: '#ffffff' }),
      makeLayer('lion', 'The Lion', 'custom_circle'),
      makeLayer('logo', 'The Logo', 'custom_box', { matte: { sourcePartId: 'cow', mode: 'alpha', enabled: true, feather: 8 } }),
    ]);
    expect(await matteIndicator(page, 'Matte source: The Cow')).toBe(true);
    await selectPart(page, 'The Logo');
    await setMatteSource(page, 'lion');
    expect(await matteIndicator(page, 'Matte source: The Lion')).toBe(true);
    expect(await matteIndicator(page, 'Matte source: The Cow')).toBe(false);
    // selection survived the switch (The Logo row is still primary-selected)
    const logoRow = page.locator('.actor-node', { hasText: 'The Logo' }).first();
    expect(await logoRow.getAttribute('class')).toContain('primary-selected');
    // matte settings survived: feather still on the mask identity
    expect(await page.locator('mask[id*="-f8"]').count()).toBeGreaterThanOrEqual(1);
  });

  test('E2E-8 — source delete → missing → restore (reload valid scene) → relationship returns', async ({ page }) => {
    await seed(page, [
      makeLayer('cow', 'The Cow', 'custom_star', { fillColor: '#ffffff' }),
      makeLayer('logo', 'The Logo', 'custom_box', { matte: { sourcePartId: 'cow', mode: 'alpha', enabled: true } }),
    ]);
    expect(await matteIndicator(page, 'Matte source: The Cow')).toBe(true);
    await selectPart(page, 'The Cow');
    await openStyleTab(page);
    await page.locator('button[title="Delete Actor Instance"]').click();
    await page.waitForTimeout(400);
    expect(await matteIndicator(page, 'Missing matte source')).toBe(true);
    // restore: reload the valid scene through the real app path (same ids)
    await seed(page, [
      makeLayer('cow', 'The Cow', 'custom_star', { fillColor: '#ffffff' }),
      makeLayer('logo', 'The Logo', 'custom_box', { matte: { sourcePartId: 'cow', mode: 'alpha', enabled: true } }),
    ]);
    expect(await matteIndicator(page, 'Matte source: The Cow')).toBe(true);
    expect(await matteIndicator(page, 'Missing matte source')).toBe(false);
  });

  test('E2E-9 — outliner interaction regression: selection/visibility/reorder keep the indicator', async ({ page }) => {
    await seed(page, [
      makeLayer('cow', 'The Cow', 'custom_star', { fillColor: '#ffffff' }),
      makeLayer('mid', 'The Middle', 'custom_box'),
      makeLayer('logo', 'The Logo', 'custom_box', { matte: { sourcePartId: 'cow', mode: 'alpha', enabled: true } }),
    ]);
    const logoRow = page.locator('.actor-node', { has: page.locator('.actor-name', { hasText: 'The Logo' }) }).first();
    expect(await logoRow.locator('[aria-label="Matte source: The Cow"]').count()).toBe(1);
    // visibility toggle on the logo row (eye column)
    await logoRow.locator('.col-eye').click();
    await page.waitForTimeout(200);
    // reorder: move Logo up (it is the last row) via the chevron button
    await logoRow.locator('button[title="Move Layer Up (Bring Forward)"]').click();
    await page.waitForTimeout(300);
    // reselect the logo row
    await selectPart(page, 'The Logo');
    const logoRow2 = page.locator('.actor-node', { has: page.locator('.actor-name', { hasText: 'The Logo' }) }).first();
    expect(await logoRow2.getAttribute('class')).toContain('primary-selected');
    expect(await logoRow2.locator('[aria-label="Matte source: The Cow"]').count()).toBe(1);
  });

  test('E2E-10 — validation regression: matte cycle vs missing stay distinct in the real app', async ({ page }) => {
    // imported scene: A→B / B→A cycle + C→ghost missing + D plain
    await seed(page, [
      makeLayer('a', 'Cycle A', 'custom_circle', { matte: { sourcePartId: 'b', mode: 'alpha', enabled: true } }),
      makeLayer('b', 'Cycle B', 'custom_circle', { matte: { sourcePartId: 'a', mode: 'alpha', enabled: true } }),
      makeLayer('c', 'Dangle C', 'custom_box', { matte: { sourcePartId: 'ghost', mode: 'alpha', enabled: true } }),
      makeLayer('d', 'Plain D', 'custom_box'),
    ]);
    // cycle members: both sources EXIST → "Matte source:" labels (NOT missing)
    expect(await matteIndicator(page, 'Matte source: Cycle B')).toBe(true);
    expect(await matteIndicator(page, 'Matte source: Cycle A')).toBe(true);
    // the dangling one is the ONLY missing state
    expect(await matteIndicator(page, 'Missing matte source')).toBe(true);
    const missingCount = await page.locator('[aria-label="Missing matte source"]').count();
    expect(missingCount).toBe(1);
    // app stays alive: all four rows render
    expect(await page.locator('.actor-node').count()).toBe(4);
    // renderer still emits masks for the cycle members (recoverable — no crash)
    expect(await page.locator('mask').count()).toBeGreaterThanOrEqual(2);
  });
});
