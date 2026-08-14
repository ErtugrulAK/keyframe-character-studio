import { test, expect, type Page } from '@playwright/test';

/**
 * M25 STEP 25D — REAL USER E2E: user-saved custom animation presets.
 *
 * Proves the FULL lifecycle through the REAL UI (outliner clicks, Inspector
 * Transform tab, preset selects, save dialog, delete button, transport,
 * undo, reload, broadcast):
 *
 *   save (library op) → Custom optgroup → apply to another part →
 *   builtin↔custom equivalence → reload persistence → delete →
 *   delete-referenced edge case → type filtering → state isolation →
 *   field preservation → undo → broadcast → schema pollution check.
 *
 * Storage under test: keyframe_custom_motion_presets (NOT AnimationProject).
 * No React state is mutated directly — everything goes through the UI.
 */

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const PRESETS_KEY = 'keyframe_custom_motion_presets';

function makeLayer(id: string, name: string, type: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, name, type,
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1,
    fillColor: '#ff2020', strokeColor: '#101218', strokeWidth: 2, borderRadius: 0,
    width: 120, height: 120,
    ...overrides,
  };
}

async function seed(page: Page, layers: Record<string, unknown>[], totalFrames = 90): Promise<void> {
  const scene = {
    version: 1, layers, tracks: [], fps: 30, totalFrames,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'M25 Presets E2E',
  };
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); });
  // marker keeps the seed from clobbering autosaved state on reload
  await page.addInitScript(
    ([key, data]: [string, string]) => {
      if (!localStorage.getItem('__KCS_E2E_SEEDED__')) {
        localStorage.setItem(key, data);
        localStorage.setItem('__KCS_E2E_SEEDED__', '1');
      }
    },
    [STORAGE_KEY, JSON.stringify(scene)],
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

async function selectPart(page: Page, name: string): Promise<void> {
  const row = page.locator('.actor-node', { has: page.locator('.actor-name', { hasText: name }) }).first();
  await row.waitFor({ state: 'visible', timeout: 10000 });
  await row.click();
  await page.waitForTimeout(250);
}

async function openTransformTab(page: Page): Promise<void> {
  const tab = page.locator('.tab-btn', { hasText: /^Transform/ }).first();
  await tab.waitFor({ state: 'visible', timeout: 10000 });
  await tab.click();
  await page.waitForTimeout(250);
}

async function setInPreset(page: Page, preset: string): Promise<void> {
  await page.locator('select[aria-label="Animation In Preset"]').selectOption(preset);
  await page.waitForTimeout(200);
}

async function setOutPreset(page: Page, preset: string): Promise<void> {
  await page.locator('select[aria-label="Animation Out Preset"]').selectOption(preset);
  await page.waitForTimeout(200);
}

async function setInDuration(page: Page, value: string): Promise<void> {
  const input = page.locator('input[aria-label="Animation In Duration"]');
  await input.click();
  await input.fill(value);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
}

async function setOutDuration(page: Page, value: string): Promise<void> {
  const input = page.locator('input[aria-label="Animation Out Duration"]');
  await input.click();
  await input.fill(value);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
}

async function stepTo(page: Page, targetFrame: number): Promise<void> {
  for (let i = 0; i < targetFrame; i++) {
    await page.locator('button[title="Step Forward"]').click();
  }
  await page.waitForTimeout(200);
}

async function saveCurrentAsPreset(page: Page, slot: 'in' | 'out', name: string): Promise<void> {
  const idx = slot === 'in' ? 0 : 1;
  await page.locator('[title="Save current animation as a custom preset"]').nth(idx).click();
  const dialog = page.getByRole('dialog', { name: 'Save Animation Preset' });
  await dialog.waitFor({ state: 'visible', timeout: 5000 });
  await dialog.getByLabel('Preset Name').fill(name);
  await dialog.getByText('Save', { exact: true }).click();
  await page.waitForTimeout(300);
}

async function deleteSelectedPreset(page: Page): Promise<void> {
  await page.locator('[aria-label="Delete Animation Preset"]').click();
  await page.waitForTimeout(300);
}

async function customOptions(page: Page, selectLabel: string): Promise<{ value: string; text: string }[]> {
  return page.evaluate((label) => {
    const sel = [...document.querySelectorAll('select')].find((s) => s.getAttribute('aria-label') === label);
    if (!sel) return [];
    const group = [...sel.querySelectorAll('optgroup')].find((g) => g.getAttribute('label') === 'Custom');
    if (!group) return [];
    return [...group.querySelectorAll('option')].map((o) => ({ value: o.value, text: o.textContent ?? '' }));
  }, selectLabel);
}

async function storedPresets(page: Page): Promise<Record<string, unknown>[]> {
  return page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    try { return JSON.parse(raw ?? '[]'); } catch { return []; }
  }, PRESETS_KEY);
}

/** Autosave runs on a 10s interval — trigger the manual save first, then
 *  read localStorage deterministically (M23 pattern). */
async function saveNow(page: Page): Promise<void> {
  const badge = page.locator('.autosave-status-badge');
  if (await badge.count()) {
    await badge.click();
    await page.waitForTimeout(300);
  }
}

async function selectedPresetValue(page: Page, label: string): Promise<string> {
  return page.locator(`select[aria-label="${label}"]`).inputValue();
}

async function partX(page: Page, index = 0): Promise<number> {
  return page.evaluate((idx) => {
    const gs = [...document.querySelectorAll('svg g[transform]')];
    const t = gs[idx]?.getAttribute('transform') ?? '';
    const m = t.match(/translate\((-?\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : NaN;
  }, index);
}

async function partScaleX(page: Page, index = 0): Promise<number> {
  return page.evaluate((idx) => {
    const gs = [...document.querySelectorAll('svg g[transform]')];
    const t = gs[idx]?.getAttribute('transform') ?? '';
    const m = t.match(/scale\((-?\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : 1;
  }, index);
}

async function partOpacity(page: Page, index = 0): Promise<number> {
  return page.evaluate((idx) => {
    const gs = [...document.querySelectorAll('svg g[transform]')];
    const st = (gs[idx] as HTMLElement | undefined)?.style;
    const o = st?.opacity ?? '';
    return o === '' ? 1 : parseFloat(o);
  }, index);
}

test.describe('M25 — user-saved presets (real UI)', () => {
  test('E2E-1+13+22+23 — save is a LIBRARY op: part untouched, name validated, labels present', async ({ page }) => {
    await seed(page, [
      makeLayer('a', 'Part A', 'custom_box', { x: 40, y: -20, rotation: 15, scaleX: 1.3, scaleY: 1.3 }),
    ]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);

    // accessibility labels exist in the real DOM
    await expect(page.locator('select[aria-label="Animation In Preset"]')).toBeVisible();
    await expect(page.locator('select[aria-label="Animation Out Preset"]')).toBeVisible();

    // name validation: empty / whitespace keeps Save disabled
    await page.locator('[title="Save current animation as a custom preset"]').first().click();
    const dialog = page.getByRole('dialog', { name: 'Save Animation Preset' });
    await dialog.waitFor({ state: 'visible' });
    const saveBtn = dialog.getByText('Save', { exact: true });
    await expect(saveBtn).toBeDisabled();
    await dialog.getByLabel('Preset Name').fill('   ');
    await expect(saveBtn).toBeDisabled();
    await dialog.getByText('Cancel', { exact: true }).click();
    await page.waitForTimeout(200);

    // snapshot part BEFORE save (localStorage scene)
    const before = await page.evaluate(([key, id]) => {
      const scene = JSON.parse(localStorage.getItem(key) ?? '{}');
      return JSON.stringify((scene.layers ?? []).find((l: Record<string, unknown>) => l.id === id));
    }, [STORAGE_KEY, 'a'] as [string, string]);

    // save builtin slide-scale-left as "My Slide" (duration 18)
    await setInPreset(page, 'slide-scale-left');
    await setInDuration(page, '18');
    await saveCurrentAsPreset(page, 'in', '  My Slide  ');

    // dialog closed; Custom optgroup shows the trimmed name
    await expect(dialog).toBeHidden();
    const opts = await customOptions(page, 'Animation In Preset');
    expect(opts.map((o) => o.text)).toContain('My Slide');
    expect(opts[0].value).toMatch(/^preset_\d+$/); // generated id, not 'slide-scale-left'

    // SAVE != APPLY: the part still has the builtin selected, nothing changed
    expect(await selectedPresetValue(page, 'Animation In Preset')).toBe('slide-scale-left');
    const after = await page.evaluate(([key, id]) => {
      const scene = JSON.parse(localStorage.getItem(key) ?? '{}');
      return JSON.stringify((scene.layers ?? []).find((l: Record<string, unknown>) => l.id === id));
    }, [STORAGE_KEY, 'a'] as [string, string]);
    expect(after).toBe(before); // scene data deep-equal (x/y/rotation/scale/name/presets)
  });

  test('E2E-2+14 — apply custom IN to another part: animation runs, unrelated data preserved', async ({ page }) => {
    await seed(page, [
      makeLayer('a', 'Part A', 'custom_box'),
      makeLayer('b', 'Part B', 'custom_box', { x: 400, y: 100, rotation: 30 }),
    ]);
    // Part A: save slide-scale-left as "My Slide" (duration 18)
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-scale-left');
    await setInDuration(page, '18');
    await saveCurrentAsPreset(page, 'in', 'My Slide');

    // Part B: apply the custom preset
    await selectPart(page, 'Part B');
    await openTransformTab(page);
    const opts = await customOptions(page, 'Animation In Preset');
    const customId = opts.find((o) => o.text === 'My Slide')!.value;
    await setInPreset(page, customId);

    // B keeps its unrelated fields (x=400 world center → 700); frame 1 both
    // parts are visible (IN presets start at opacity 0 on frame 0)
    await stepTo(page, 1);
    expect(await partX(page, 1)).toBeGreaterThan(700);
    await saveNow(page);
    // stored: inAnimPreset = custom id, transform fields untouched
    const storedB = await page.evaluate(([key, id]) => {
      const scene = JSON.parse(localStorage.getItem(key) ?? '{}');
      return (scene.layers ?? []).find((l: Record<string, unknown>) => l.id === id);
    }, [STORAGE_KEY, 'b'] as [string, string]);
    expect(storedB.inAnimPreset).toBe(customId);
    expect(storedB.x).toBe(400);
    expect(storedB.y).toBe(100);
    expect(storedB.rotation).toBe(30);
    expect(storedB.name).toBe('Part B');

    // animation runs at frame 1 (slide-scale-left: x offset + scale < 1 + opacity < 1)
    expect(await partX(page, 1)).toBeGreaterThan(700);
    expect(await partScaleX(page, 1)).toBeLessThan(1);
    expect(await partOpacity(page, 1)).toBeLessThan(1);
    // Part A untouched: its preset is still the builtin (applying to B did
    // not rewrite A) — A also animates its own builtin at frame 1
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    expect(await selectedPresetValue(page, 'Animation In Preset')).toBe('slide-scale-left');
  });

  test('E2E-3 — apply custom OUT preset', async ({ page }) => {
    await seed(page, [
      makeLayer('a', 'Part A', 'custom_box'),
      makeLayer('b', 'Part B', 'custom_box'),
    ]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setOutPreset(page, 'soft-pop');
    await setOutDuration(page, '20');
    await saveCurrentAsPreset(page, 'out', 'My Soft Out');

    await selectPart(page, 'Part B');
    await openTransformTab(page);
    const opts = await customOptions(page, 'Animation Out Preset');
    const customId = opts.find((o) => o.text === 'My Soft Out')!.value;
    await setOutPreset(page, customId);

    expect(await selectedPresetValue(page, 'Animation Out Preset')).toBe(customId);
    await saveNow(page);
    const storedB = await page.evaluate(([key, id]) => {
      const scene = JSON.parse(localStorage.getItem(key) ?? '{}');
      return (scene.layers ?? []).find((l: Record<string, unknown>) => l.id === id);
    }, [STORAGE_KEY, 'b'] as [string, string]);
    expect(storedB.outAnimPreset).toBe(customId);
    // OUT semantics: near the timeline end the part animates (scale < 1)
    await stepTo(page, 76); // frame 76, remaining 14/20 → active
    expect(await partScaleX(page, 1)).toBeLessThan(1);
  });

  test('E2E-4 — builtin↔custom equivalence (slide-scale-left)', async ({ page }) => {
    await seed(page, [
      makeLayer('a', 'Part A', 'custom_box'),
      makeLayer('b', 'Part B', 'custom_box'),
    ]);
    // Part A: builtin; Part B: same behavior saved as custom
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-scale-left');
    await setInDuration(page, '18');
    await saveCurrentAsPreset(page, 'in', 'My Slide');
    await selectPart(page, 'Part B');
    await openTransformTab(page);
    const opts = await customOptions(page, 'Animation In Preset');
    await setInPreset(page, opts.find((o) => o.text === 'My Slide')!.value);
    await setInDuration(page, '18');

    // representative frames: 1 (early active), 9 (midpoint), 18 (final)
    await stepTo(page, 1);
    const xA1 = await partX(page, 0), xB1 = await partX(page, 1);
    expect(Math.abs(xB1 - xA1)).toBeLessThan(16); // piecewise-linear vs cubic — close at early frame
    const sA1 = await partScaleX(page, 0), sB1 = await partScaleX(page, 1);
    expect(Math.abs(sB1 - sA1)).toBeLessThan(0.1);
    await stepTo(page, 8); // frame 9 — exact keyframe point (0.5)
    expect(await partX(page, 1)).toBeCloseTo(await partX(page, 0), 0);
    expect(await partScaleX(page, 1)).toBeCloseTo(await partScaleX(page, 0), 2);
    await stepTo(page, 9); // frame 18 — final
    expect(await partX(page, 1)).toBeCloseTo(await partX(page, 0), 0);
    expect(await partScaleX(page, 1)).toBeCloseTo(await partScaleX(page, 0), 2);
    expect(await partOpacity(page, 1)).toBeCloseTo(await partOpacity(page, 0), 2);
  });

  test('E2E-5 — builtin↔custom equivalence (soft-pop)', async ({ page }) => {
    await seed(page, [
      makeLayer('a', 'Part A', 'custom_box'),
      makeLayer('b', 'Part B', 'custom_box'),
    ]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'soft-pop');
    await setInDuration(page, '20');
    await saveCurrentAsPreset(page, 'in', 'My Soft Pop');
    await selectPart(page, 'Part B');
    await openTransformTab(page);
    const opts = await customOptions(page, 'Animation In Preset');
    await setInPreset(page, opts.find((o) => o.text === 'My Soft Pop')!.value);
    await setInDuration(page, '20');

    await stepTo(page, 10); // midpoint — exact keyframe point
    expect(await partScaleX(page, 1)).toBeCloseTo(await partScaleX(page, 0), 2);
    expect(await partOpacity(page, 1)).toBeCloseTo(await partOpacity(page, 0), 2);
    await stepTo(page, 10); // frame 20 — final
    expect(await partScaleX(page, 1)).toBeCloseTo(await partScaleX(page, 0), 2);
    expect(await partOpacity(page, 1)).toBeCloseTo(await partOpacity(page, 0), 2);
  });

  test('E2E-6+7 — persistence across reload, apply still works', async ({ page }) => {
    await seed(page, [
      makeLayer('a', 'Part A', 'custom_box'),
      makeLayer('b', 'Part B', 'custom_box'),
    ]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-scale-left');
    await setInDuration(page, '18');
    await saveCurrentAsPreset(page, 'in', 'My Slide');
    await setOutPreset(page, 'soft-pop');
    await setOutDuration(page, '20');
    await saveCurrentAsPreset(page, 'out', 'My Soft Out');

    // reload — seed marker prevents clobbering
    await page.reload();
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

    await selectPart(page, 'Part A');
    await openTransformTab(page);
    const inOpts = await customOptions(page, 'Animation In Preset');
    const outOpts = await customOptions(page, 'Animation Out Preset');
    expect(inOpts.map((o) => o.text)).toContain('My Slide');
    expect(outOpts.map((o) => o.text)).toContain('My Soft Out');

    // apply after reload (E2E-7)
    await selectPart(page, 'Part B');
    await openTransformTab(page);
    const customId = inOpts.find((o) => o.text === 'My Slide')!.value;
    await setInPreset(page, customId);
    await stepTo(page, 1);
    expect(await partX(page, 1)).toBeGreaterThan(300);
  });

  test('E2E-8+10+26 — delete: targeted, others survive, reload keeps it deleted', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'fade');
    await setInDuration(page, '10');
    await saveCurrentAsPreset(page, 'in', 'Preset A');
    await saveCurrentAsPreset(page, 'in', 'Preset B');

    // select Preset A (custom) and delete it
    const opts = await customOptions(page, 'Animation In Preset');
    const idA = opts.find((o) => o.text === 'Preset A')!.value;
    const idB = opts.find((o) => o.text === 'Preset B')!.value;
    await setInPreset(page, idA);
    await deleteSelectedPreset(page);

    // A gone, B intact with SAME id, builtins intact
    const left = await customOptions(page, 'Animation In Preset');
    expect(left.map((o) => o.value)).not.toContain(idA);
    expect(left.map((o) => o.value)).toContain(idB);
    const allValues = await page.locator('select[aria-label="Animation In Preset"] option').allTextContents();
    expect(allValues).toContain('Fade');
    expect(allValues).toContain('Soft Pop');

    // reload → deleted stays absent
    await page.reload();
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    const afterReload = await customOptions(page, 'Animation In Preset');
    expect(afterReload.map((o) => o.value)).not.toContain(idA);
    expect(afterReload.map((o) => o.value)).toContain(idB);
  });

  test('E2E-9 — delete a preset currently referenced by a part: safe fallback, data kept', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-left');
    await setInDuration(page, '12');
    await saveCurrentAsPreset(page, 'in', 'Doomed');
    const opts = await customOptions(page, 'Animation In Preset');
    const customId = opts.find((o) => o.text === 'Doomed')!.value;
    await setInPreset(page, customId); // part now references the custom id

    await deleteSelectedPreset(page); // delete the referenced preset

    // UI: display-only fallback to None; part data preserved
    expect(await selectedPresetValue(page, 'Animation In Preset')).toBe('none');
    await saveNow(page);
    const stored = await page.evaluate(([key, id]) => {
      const scene = JSON.parse(localStorage.getItem(key) ?? '{}');
      return (scene.layers ?? []).find((l: Record<string, unknown>) => l.id === id);
    }, [STORAGE_KEY, 'a'] as [string, string]);
    expect(stored.inAnimPreset).toBe(customId); // part data untouched
    // runtime safe: playback at frame 1 does not crash, full opacity (unknown id)
    await stepTo(page, 1);
    expect(await partOpacity(page)).toBe(1);
  });

  test('E2E-11 — IN/OUT type filtering', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'fade');
    await setInDuration(page, '10');
    await saveCurrentAsPreset(page, 'in', 'My In');
    await setOutPreset(page, 'pop');
    await setOutDuration(page, '10');
    await saveCurrentAsPreset(page, 'out', 'My Out');

    const inOpts = await customOptions(page, 'Animation In Preset');
    const outOpts = await customOptions(page, 'Animation Out Preset');
    expect(inOpts.map((o) => o.text)).toContain('My In');
    expect(inOpts.map((o) => o.text)).not.toContain('My Out');
    expect(outOpts.map((o) => o.text)).toContain('My Out');
    expect(outOpts.map((o) => o.text)).not.toContain('My In');
  });

  test('E2E-12 — multiple parts: no state leak', async ({ page }) => {
    await seed(page, [
      makeLayer('a', 'Part A', 'custom_box'),
      makeLayer('b', 'Part B', 'custom_box'),
      makeLayer('c', 'Part C', 'custom_box'),
    ]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-scale-left');
    await setInDuration(page, '18');
    await saveCurrentAsPreset(page, 'in', 'My Slide');
    const opts = await customOptions(page, 'Animation In Preset');
    const customId = opts.find((o) => o.text === 'My Slide')!.value;

    await selectPart(page, 'Part B'); // B: IN → None (default), duration untouched
    await openTransformTab(page);
    expect(await selectedPresetValue(page, 'Animation In Preset')).toBe('none');

    await selectPart(page, 'Part A'); // A still has the custom preset
    await openTransformTab(page);
    expect(await selectedPresetValue(page, 'Animation In Preset')).toBe('slide-scale-left');

    await selectPart(page, 'Part C'); // C applies the custom preset independently
    await openTransformTab(page);
    await setInPreset(page, customId);
    expect(await selectedPresetValue(page, 'Animation In Preset')).toBe(customId);
  });

  test('E2E-15 — undo after apply restores None, unrelated fields kept', async ({ page }) => {
    await seed(page, [
      makeLayer('a', 'Part A', 'custom_box'),
      makeLayer('b', 'Part B', 'custom_box', { x: 400 }),
    ]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-left');
    await setInDuration(page, '12');
    await saveCurrentAsPreset(page, 'in', 'My Slide');

    await selectPart(page, 'Part B');
    await openTransformTab(page);
    const opts = await customOptions(page, 'Animation In Preset');
    await setInPreset(page, opts.find((o) => o.text === 'My Slide')!.value);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    expect(await selectedPresetValue(page, 'Animation In Preset')).toBe('none');
    expect(await partX(page, 1)).toBe(700); // transform untouched
  });

  test('E2E-16 — builtin delete protection', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    for (const builtin of ['fade', 'slide-left', 'soft-pop']) {
      await setInPreset(page, builtin);
      await expect(page.locator('[aria-label="Delete Animation Preset"]')).toHaveCount(0);
    }
    // custom preset → delete control appears
    await setInPreset(page, 'fade');
    await setInDuration(page, '10');
    await saveCurrentAsPreset(page, 'in', 'Mine');
    const opts = await customOptions(page, 'Animation In Preset');
    await setInPreset(page, opts[0].value);
    await expect(page.locator('[aria-label="Delete Animation Preset"]')).toHaveCount(1);
  });

  test('E2E-17 — custom_timeline stays hidden and untouched', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box', { inAnimPreset: 'custom_timeline' })]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    // not in any option list
    const values = await page.locator('select[aria-label="Animation In Preset"] option').allTextContents();
    expect(values.join('|')).not.toContain('custom_timeline');
    // display-only fallback (None), no mutation
    expect(await selectedPresetValue(page, 'Animation In Preset')).toBe('none');
    const stored = await page.evaluate(([key, id]) => {
      const scene = JSON.parse(localStorage.getItem(key) ?? '{}');
      return (scene.layers ?? []).find((l: Record<string, unknown>) => l.id === id);
    }, [STORAGE_KEY, 'a'] as [string, string]);
    expect(stored.inAnimPreset).toBe('custom_timeline'); // value kept
    // save/delete UI does not touch it
    await page.locator('[title="Save current animation as a custom preset"]').first().click();
    await page.getByRole('dialog', { name: 'Save Animation Preset' }).getByText('Cancel', { exact: true }).click();
    await page.waitForTimeout(200);
    const stored2 = await page.evaluate(([key, id]) => {
      const scene = JSON.parse(localStorage.getItem(key) ?? '{}');
      return (scene.layers ?? []).find((l: Record<string, unknown>) => l.id === id);
    }, [STORAGE_KEY, 'a'] as [string, string]);
    expect(stored2.inAnimPreset).toBe('custom_timeline');
  });

  test('E2E-18+19 — broadcast: custom IN/OUT resolve and animate', async ({ page }) => {
    await seed(page, [
      makeLayer('a', 'Part A', 'custom_box'),
      makeLayer('b', 'Part B', 'custom_box'),
    ]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-scale-left');
    await setInDuration(page, '18');
    await saveCurrentAsPreset(page, 'in', 'My Slide');
    await setOutPreset(page, 'soft-pop');
    await setOutDuration(page, '20');
    await saveCurrentAsPreset(page, 'out', 'My Soft Out');

    // apply both to Part B
    await selectPart(page, 'Part B');
    await openTransformTab(page);
    const inOpts = await customOptions(page, 'Animation In Preset');
    const outOpts = await customOptions(page, 'Animation Out Preset');
    await setInPreset(page, inOpts.find((o) => o.text === 'My Slide')!.value);
    await setOutPreset(page, outOpts.find((o) => o.text === 'My Soft Out')!.value);

    // broadcast: BROADCAST → Sequence → custom ids resolve → visible
    await page.getByText('BROADCAST', { exact: true }).click();
    await page.waitForTimeout(600);
    await page.getByText('Sequence', { exact: true }).first().click();
    await page.waitForTimeout(400);
    expect(await partOpacity(page, 1)).toBeGreaterThan(0); // animating_in visible
    await page.waitForTimeout(1500); // animating_in → visible
    expect(await partOpacity(page, 1)).toBeGreaterThan(0);
  });

  test('E2E-20 — custom preset data independence', async ({ page }) => {
    await seed(page, [
      makeLayer('a', 'Part A', 'custom_box'),
      makeLayer('b', 'Part B', 'custom_box'),
    ]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-scale-left');
    await setInDuration(page, '18');
    await saveCurrentAsPreset(page, 'in', 'My Slide');
    const opts = await customOptions(page, 'Animation In Preset');
    const customId = opts.find((o) => o.text === 'My Slide')!.value;
    await selectPart(page, 'Part B');
    await openTransformTab(page);
    await setInPreset(page, customId);
    await setInDuration(page, '18');

    // capture custom output at frame 9 (midpoint, exact)
    await stepTo(page, 9);
    const xCustom = await partX(page, 1);
    const sCustom = await partScaleX(page, 1);
    // change Part A to a DIFFERENT builtin — must not affect the saved preset
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'pop');
    await selectPart(page, 'Part B');
    await openTransformTab(page);
    expect(await partX(page, 1)).toBeCloseTo(xCustom, 0);
    expect(await partScaleX(page, 1)).toBeCloseTo(sCustom, 2);
  });

  test('E2E-21 — duplicate names: distinct ids, one delete keeps the other', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'fade');
    await setInDuration(page, '10');
    await saveCurrentAsPreset(page, 'in', 'My Slide');
    await saveCurrentAsPreset(page, 'in', 'My Slide');

    const opts = await customOptions(page, 'Animation In Preset');
    const dups = opts.filter((o) => o.text === 'My Slide');
    expect(dups).toHaveLength(2);
    expect(dups[0].value).not.toBe(dups[1].value);

    await setInPreset(page, dups[0].value);
    await deleteSelectedPreset(page);
    const left = await customOptions(page, 'Animation In Preset');
    expect(left.filter((o) => o.text === 'My Slide')).toHaveLength(1);
    expect(left.some((o) => o.value === dups[1].value)).toBe(true);
  });

  test('E2E-24 — Basic/Combinations regression with custom layer present', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    // create a custom preset so the Custom layer is present
    await setInPreset(page, 'fade');
    await setInDuration(page, '10');
    await saveCurrentAsPreset(page, 'in', 'Extra');

    // builtins still play
    await setInPreset(page, 'pop');
    await setInDuration(page, '10');
    await stepTo(page, 1);
    expect(await partScaleX(page)).toBeLessThan(1);
    await setInPreset(page, 'slide-scale-left');
    await stepTo(page, 1);
    expect(await partX(page)).toBeGreaterThan(300);
    await setInPreset(page, 'soft-pop');
    await stepTo(page, 1);
    expect(await partOpacity(page)).toBeLessThan(1);
  });

  test('E2E-25 — no schema pollution: presets stay OUT of AnimationProject', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-left');
    await setInDuration(page, '12');
    await saveCurrentAsPreset(page, 'in', 'My Slide');

    const project = await page.evaluate((key) => {
      const scene = JSON.parse(localStorage.getItem(key) ?? '{}');
      const raw = localStorage.getItem(key) ?? '';
      return { keys: Object.keys(scene), rawHasPreset: raw.includes('keyframes') && raw.includes('My Slide') };
    }, STORAGE_KEY);
    expect(project.keys.some((k) => k.toLowerCase().includes('preset'))).toBe(false);
    // the custom preset lives in its own key
    const presets = await storedPresets(page);
    expect(presets.some((p) => p.name === 'My Slide')).toBe(true);
  });
});
