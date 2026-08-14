import { test, expect, type Page } from '@playwright/test';

/**
 * M24 STEP 10D — REAL USER E2E: builtin COMBINATION presets through the REAL
 * UI (outliner row clicks, Inspector Transform tab, optgroup select, durations,
 * transport, undo, reload, broadcast).
 *
 * M24 = Option A: new builtin IDs (slide-scale-left/right, soft-pop) flowing
 * through the EXISTING procedural engine — no keyframes, no channels, no
 * second system. "Fade+Slide"/"Fade+Scale"/"Pop+Fade" are intentionally
 * absent (equivalent to existing builtins — discovery finding).
 */

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

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
    _sceneTitle: 'M24 Combos E2E',
  };
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  // marker keeps the seed from clobbering autosaved state on reload (E2E-10)
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
  const sel = page.locator('select[aria-label="Animation In Preset"]');
  await sel.waitFor({ state: 'visible', timeout: 10000 });
  await sel.selectOption(preset);
  await page.waitForTimeout(200);
}

async function setOutPreset(page: Page, preset: string): Promise<void> {
  const sel = page.locator('select[aria-label="Animation Out Preset"]');
  await sel.waitFor({ state: 'visible', timeout: 10000 });
  await sel.selectOption(preset);
  await page.waitForTimeout(200);
}

async function setInDuration(page: Page, value: string): Promise<void> {
  const input = page.locator('input[aria-label="Animation In Duration"]');
  await input.waitFor({ state: 'visible', timeout: 10000 });
  await input.click();
  await input.fill(value);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
}

async function setOutDuration(page: Page, value: string): Promise<void> {
  const input = page.locator('input[aria-label="Animation Out Duration"]');
  await input.waitFor({ state: 'visible', timeout: 10000 });
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

/** World-space X of the part <g> (translate(x, y) — world center 300). */
async function partX(page: Page, index = 0): Promise<number> {
  return page.evaluate((idx) => {
    const gs = [...document.querySelectorAll('svg g[transform]')];
    const t = gs[idx]?.getAttribute('transform') ?? '';
    const m = t.match(/translate\((-?\d+)/);
    return m ? parseInt(m[1], 10) : NaN;
  }, index);
}

/** World-space scaleX of the part <g>. */
async function partScaleX(page: Page, index = 0): Promise<number> {
  return page.evaluate((idx) => {
    const gs = [...document.querySelectorAll('svg g[transform]')];
    const t = gs[idx]?.getAttribute('transform') ?? '';
    const m = t.match(/scale\((-?\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : 1;
  }, index);
}

/** Inline style opacity of the part <g> (PartRenderer uses style, not attr). */
async function partOpacity(page: Page, index = 0): Promise<string | null> {
  return page.evaluate((idx) => {
    const gs = [...document.querySelectorAll('svg g[transform]')];
    const st = (gs[idx] as HTMLElement | undefined)?.style;
    return st?.opacity || null;
  }, index);
}

/** Manual save via the HeaderBar badge + poll localStorage (autosave is 10s). */
async function saveNow(page: Page): Promise<void> {
  const badge = page.locator('.autosave-status-badge');
  if (await badge.count()) {
    await badge.click();
    await page.waitForTimeout(300);
  }
}

async function storedPart(page: Page, id: string): Promise<Record<string, unknown>> {
  return page.evaluate(([key, pid]) => {
    const scene = JSON.parse(localStorage.getItem(key) ?? '{}');
    return (scene.layers ?? []).find((l: Record<string, unknown>) => l.id === pid) ?? {};
  }, [STORAGE_KEY, id] as [string, string]);
}

async function storedExpect(page: Page, id: string, key: string, expected: unknown): Promise<void> {
  await saveNow(page);
  await expect.poll(async () => (await storedPart(page, id))[key], { timeout: 15000 }).toBe(expected);
}

async function storedChannelKeyframeCount(page: Page): Promise<number> {
  return page.evaluate((key) => {
    const scene = JSON.parse(localStorage.getItem(key) ?? '{}');
    let total = 0;
    for (const t of scene.tracks ?? []) {
      for (const ch of Object.values(t.channels ?? {})) {
        total += (ch as { keyframes?: unknown[] }).keyframes?.length ?? 0;
      }
    }
    return total;
  }, STORAGE_KEY);
}

test.describe('M24 — combination presets (real UI)', () => {
  test('E2E-1 — Slide + Scale Left IN: x/scale/opacity animate to normal', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-scale-left');
    await setInDuration(page, '15');
    // frame 1 (frame 0 is invisible — IN opacity 0): moving + scaling + fading
    await stepTo(page, 1);
    expect(await partX(page)).toBeGreaterThan(300);      // slide-left direction
    expect(await partScaleX(page)).toBeLessThan(1);       // scaling in
    expect(parseFloat((await partOpacity(page)) ?? '1')).toBeLessThan(1);
    // frame 15: complete — normal position, scale 1, opacity 1
    await stepTo(page, 14);
    expect(await partX(page)).toBe(300);
    expect(await partScaleX(page)).toBe(1);
    expect(parseFloat((await partOpacity(page)) ?? '1')).toBe(1);
    await storedExpect(page, 'a', 'inAnimPreset', 'slide-scale-left');
    await storedExpect(page, 'a', 'inAnimDuration', 15);
  });

  test('E2E-2 — Slide + Scale Right IN: existing slide-right direction', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-scale-right');
    await setInDuration(page, '15');
    await stepTo(page, 1);
    expect(await partX(page)).toBeLessThan(300); // slide-right direction
    expect(await partScaleX(page)).toBeLessThan(1);
    await stepTo(page, 14);
    expect(await partX(page)).toBe(300);
    expect(await partScaleX(page)).toBe(1);
  });

  test('E2E-3 — Soft Pop IN: 0.85→1 scale curve', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'soft-pop');
    await setInDuration(page, '15');
    await stepTo(page, 1);
    const s1 = await partScaleX(page);
    expect(s1).toBeGreaterThan(0.85);
    expect(s1).toBeLessThan(1);
    // frame 3 → eased ≈ 0.49 → scale ≈ 0.92
    await stepTo(page, 2);
    const s3 = await partScaleX(page);
    expect(Math.abs(s3 - 0.925)).toBeLessThan(0.03);
    await stepTo(page, 12); // frame 15
    expect(await partScaleX(page)).toBe(1);
    expect(parseFloat((await partOpacity(page)) ?? '1')).toBe(1);
  });

  test('E2E-4 — OUT combinations: reversed direction, shrink at the end', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')], 90);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setOutPreset(page, 'slide-scale-left');
    await setOutDuration(page, '15');
    await stepTo(page, 76); // OUT active (90-76=14 ≤ 15)
    expect(await partX(page)).toBeLessThan(300); // reversed: moving left out
    expect(await partScaleX(page)).toBeLessThan(1);
    // switch to right
    await setOutPreset(page, 'slide-scale-right');
    expect(await partX(page)).toBeGreaterThan(300); // right direction
    // soft-pop OUT: scale shrinks toward 0.85
    await setOutPreset(page, 'soft-pop');
    expect(await partScaleX(page)).toBeGreaterThan(0.85);
    expect(await partScaleX(page)).toBeLessThan(1);
  });

  test('E2E-5 — IN/OUT independence', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-scale-left');
    expect(await page.locator('select[aria-label="Animation Out Preset"]').inputValue()).toBe('none');
    await setOutPreset(page, 'soft-pop');
    expect(await page.locator('select[aria-label="Animation In Preset"]').inputValue()).toBe('slide-scale-left');
    await storedExpect(page, 'a', 'inAnimPreset', 'slide-scale-left');
    await storedExpect(page, 'a', 'outAnimPreset', 'soft-pop');
  });

  test('E2E-6 — duration reuse (IN 18 / OUT 24, independent)', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-scale-left');
    await setInDuration(page, '18');
    await setOutPreset(page, 'soft-pop');
    await setOutDuration(page, '24');
    await storedExpect(page, 'a', 'inAnimPreset', 'slide-scale-left');
    await storedExpect(page, 'a', 'inAnimDuration', 18);
    await storedExpect(page, 'a', 'outAnimPreset', 'soft-pop');
    await storedExpect(page, 'a', 'outAnimDuration', 24);
  });

  test('E2E-7 — undo restores previous IN/OUT values', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-scale-left');
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => page.locator('select[aria-label="Animation In Preset"]').inputValue(), { timeout: 5000 }).toBe('none');
    await setOutPreset(page, 'soft-pop');
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => page.locator('select[aria-label="Animation Out Preset"]').inputValue(), { timeout: 5000 }).toBe('none');
    const stored = await storedPart(page, 'a');
    expect(stored.name).toBe('Part A');
  });

  test('E2E-8 — field preservation (matte/transform untouched)', async ({ page }) => {
    await seed(page, [
      makeLayer('src', 'The Source', 'custom_star', { fillColor: '#ffffff' }),
      makeLayer('a', 'Part A', 'custom_box', {
        x: 120, y: -40, rotation: 25, scaleX: 1.5, opacity: 0.7,
        matte: { sourcePartId: 'src', mode: 'alpha', enabled: true, feather: 4 },
      }),
    ]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'soft-pop');
    await storedExpect(page, 'a', 'inAnimPreset', 'soft-pop');
    const stored = await storedPart(page, 'a');
    expect(stored.x).toBe(120);
    expect(stored.rotation).toBe(25);
    expect(stored.scaleX).toBe(1.5);
    expect(stored.opacity).toBe(0.7);
    expect((stored.matte as Record<string, unknown>).sourcePartId).toBe('src');
    expect((stored.matte as Record<string, unknown>).feather).toBe(4);
  });

  test('E2E-9 — no keyframe side effects (Option A proof)', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    const before = await storedChannelKeyframeCount(page);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-scale-left');
    await setOutPreset(page, 'soft-pop');
    const after = await storedChannelKeyframeCount(page);
    expect(after).toBe(before);
    const stored = await storedPart(page, 'a');
    expect(stored.channels).toBeUndefined();
  });

  test('E2E-10 — save / reload preserves combination presets', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-scale-left');
    await setInDuration(page, '18');
    await setOutPreset(page, 'soft-pop');
    await setOutDuration(page, '22');
    await storedExpect(page, 'a', 'inAnimPreset', 'slide-scale-left');
    await storedExpect(page, 'a', 'inAnimDuration', 18);
    await storedExpect(page, 'a', 'outAnimPreset', 'soft-pop');
    await storedExpect(page, 'a', 'outAnimDuration', 22);
    await page.reload();
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    expect(await page.locator('select[aria-label="Animation In Preset"]').inputValue()).toBe('slide-scale-left');
    expect(await page.locator('input[aria-label="Animation In Duration"]').inputValue()).toBe('18');
    expect(await page.locator('select[aria-label="Animation Out Preset"]').inputValue()).toBe('soft-pop');
    expect(await page.locator('input[aria-label="Animation Out Duration"]').inputValue()).toBe('22');
    // preview still works after reload (frame 1: scaling in)
    await stepTo(page, 1);
    expect(await partScaleX(page)).toBeLessThan(1);
  });

  test('E2E-11 — broadcast compatibility: same IDs feed the broadcast engine', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')], 90);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-scale-left');
    await setOutPreset(page, 'soft-pop');
    await storedExpect(page, 'a', 'inAnimPreset', 'slide-scale-left');
    await storedExpect(page, 'a', 'outAnimPreset', 'soft-pop');
    const bcBtn = page.locator('button', { hasText: /BROADCAST/i }).first();
    await bcBtn.waitFor({ state: 'visible', timeout: 10000 });
    await bcBtn.click();
    await page.waitForTimeout(500);
    expect(await page.locator('.app-container').count()).toBe(1); // no crash
    const editBtn = page.locator('button', { hasText: /EDIT/i }).first();
    await editBtn.click();
    await page.waitForTimeout(400);
    expect(await page.locator('svg g[transform]').count()).toBeGreaterThanOrEqual(1);
  });

  test('E2E-12 — multiple parts: per-part combinations, no leak', async ({ page }) => {
    await seed(page, [
      makeLayer('a', 'Part A', 'custom_box'),
      makeLayer('b', 'Part B', 'custom_box', { x: 400 }),
    ]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-scale-left');
    await selectPart(page, 'Part B');
    await setInPreset(page, 'soft-pop');
    await stepTo(page, 1);
    // A: slide-scale-left → x > 300 + scale < 1
    expect(await partX(page, 0)).toBeGreaterThan(300);
    expect(await partScaleX(page, 0)).toBeLessThan(1);
    // B: soft-pop → x stays 700, scale < 1
    expect(await partX(page, 1)).toBe(700);
    expect(await partScaleX(page, 1)).toBeLessThan(1);
    await storedExpect(page, 'a', 'inAnimPreset', 'slide-scale-left');
    await storedExpect(page, 'b', 'inAnimPreset', 'soft-pop');
  });

  test('E2E-13 — custom_timeline stays hidden and untouched', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box', { inAnimPreset: 'custom_timeline' })]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    const values = await page.locator('select[aria-label="Animation In Preset"] option').allTextContents();
    expect(values).not.toContain('custom_timeline');
    await storedExpect(page, 'a', 'inAnimPreset', 'custom_timeline'); // unrewritten
  });

  test('E2E-14 — no fake presets; basic options preserved', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    const values = await page.locator('select[aria-label="Animation In Preset"] option').evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value),
    );
    expect(values).not.toContain('fade-slide-left');
    expect(values).not.toContain('fade-scale');
    expect(values).not.toContain('pop-fade');
    for (const basic of ['none', 'fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'pop', 'spin']) {
      expect(values).toContain(basic);
    }
  });

  test('E2E-15 — clear preset (None) removes the combination', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box', { inAnimPreset: 'slide-scale-left', inAnimDuration: 15 })]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'none');
    await storedExpect(page, 'a', 'inAnimPreset', 'none');
    expect(await partX(page)).toBe(300); // no animation at frame 0 (visible again)
  });

  test('E2E-16 — basic preset regression (fade / slide-left / pop still work)', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'fade');
    await setInDuration(page, '10');
    await stepTo(page, 1);
    expect(parseFloat((await partOpacity(page)) ?? '1')).toBeLessThan(1);
    expect(await partX(page)).toBe(300); // fade does not move
    await setInPreset(page, 'slide-left');
    await stepTo(page, 1);
    expect(await partX(page)).toBeGreaterThan(300);
    await setInPreset(page, 'pop');
    await stepTo(page, 1);
    expect(await partScaleX(page)).toBeLessThan(1);
  });

  test('E2E-17 — accessibility: labels + optgroups on the real UI', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    expect(await page.locator('select[aria-label="Animation In Preset"]').count()).toBe(1);
    expect(await page.locator('select[aria-label="Animation Out Preset"]').count()).toBe(1);
    expect(await page.locator('input[aria-label="Animation In Duration"]').count()).toBe(1);
    expect(await page.locator('input[aria-label="Animation Out Duration"]').count()).toBe(1);
    const groups = await page.locator('select[aria-label="Animation In Preset"] optgroup').evaluateAll((gs) =>
      gs.map((g) => g.getAttribute('label')),
    );
    expect(groups).toEqual(['Basic', 'Combinations']);
  });
});
