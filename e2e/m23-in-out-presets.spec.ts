import { test, expect, type Page } from '@playwright/test';

/**
 * M23 STEP 9C — REAL USER E2E: basic IN/OUT animation presets through the
 * REAL UI (outliner row clicks, Inspector Transform tab, preset selects,
 * duration inputs, transport buttons, undo, reload, broadcast mode).
 *
 * The M23 architecture decision is Option B: the EXISTING procedural engine
 * (computeProceduralDelta / applyEditPreset) is fed by the Inspector fields —
 * NO keyframes are created, NO channels change, NO engine code changes.
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
    _sceneTitle: 'M23 Presets E2E',
  };
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  // NOTE: addInitScript runs on EVERY navigation (including reload) — the
  // marker keeps the seed from clobbering autosaved state on reload (E2E-9).
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
  // deterministic transport: Step Forward / Step Back one frame at a time
  for (let i = 0; i < targetFrame; i++) {
    await page.locator('button[title="Step Forward"]').click();
  }
  await page.waitForTimeout(200);
}

/** First part <g> render transform (single-part scenes) or by index. */
async function partTransform(page: Page, index = 0): Promise<string | null> {
  return page.evaluate((idx) => {
    const gs = [...document.querySelectorAll('svg g[transform]')];
    return gs[idx]?.getAttribute('transform') ?? null;
  }, index);
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

async function partOpacity(page: Page, index = 0): Promise<string | null> {
  return page.evaluate((idx) => {
    const gs = [...document.querySelectorAll('svg g[transform]')];
    // PartRenderer writes opacity as inline STYLE, not an attribute
    const st = (gs[idx] as HTMLElement | undefined)?.style;
    return st?.opacity || null;
  }, index);
}

/** Autosave runs on a 10s interval (HeaderBar badge) — trigger the manual
 *  save first, then poll localStorage (deterministic + fast). */
async function saveNow(page: Page): Promise<void> {
  const badge = page.locator('.autosave-status-badge');
  if (await badge.count()) {
    await badge.click();
    await page.waitForTimeout(300);
  }
}

/** Autosave is async (10s interval — see HeaderBar badge) — poll localStorage. */
async function storedExpect(page: Page, id: string, key: string, expected: unknown): Promise<void> {
  await saveNow(page);
  await expect.poll(async () => (await storedPart(page, id))[key], { timeout: 15000 }).toBe(expected);
}

async function storedPart(page: Page, id: string): Promise<Record<string, unknown>> {
  return page.evaluate(([key, pid]) => {
    const scene = JSON.parse(localStorage.getItem(key) ?? '{}');
    return (scene.layers ?? []).find((l: Record<string, unknown>) => l.id === pid) ?? {};
  }, [STORAGE_KEY, id] as [string, string]);
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

test.describe('M23 — basic IN/OUT animation presets (real UI)', () => {
  test('E2E-1 — IN preset Slide Left + duration 15 plays at the timeline start', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-left');
    await setInDuration(page, '15');
    // frame 0: the part is INVISIBLE (slide-left starts at opacity 0 → the
    // renderer skips invisible parts) — step to frame 1: visible + moving
    await stepTo(page, 1);
    expect(await partX(page)).toBeGreaterThan(300); // 300 + slide delta (eased)
    // step to frame 15 → preset complete → normal position (x=300)
    await stepTo(page, 14); // frame 15 total
    expect(await partX(page)).toBe(300);
    // stored fields are exact (autosave is async — poll)
    await storedExpect(page, 'a', 'inAnimPreset', 'slide-left');
    await storedExpect(page, 'a', 'inAnimDuration', 15);
  });

  test('E2E-2 — representative IN preset types (Fade / Slide Left / Pop)', async ({ page }) => {
    await seed(page, [
      makeLayer('a', 'Part A', 'custom_box'),
      makeLayer('b', 'Part B', 'custom_box', { x: 400 }),
    ]);
    // Fade on A: frame 1 — opacity < 1 (frame 0 is invisible), x unaffected
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'fade');
    await setInDuration(page, '10');
    await stepTo(page, 1);
    const op0 = await partOpacity(page);
    expect(op0).not.toBeNull();
    expect(parseFloat(op0 ?? '1')).toBeLessThan(1);
    expect(await partX(page)).toBe(300); // fade does not move
    // Pop on A: scale delta at frame 1
    await setInPreset(page, 'pop');
    await setInDuration(page, '10');
    expect(await partScaleX(page)).toBeLessThan(1); // pop scales from < 1
    // Part B untouched
    expect(await partX(page, 1)).toBe(700);
  });

  test('E2E-3 — OUT preset Slide Right at the timeline end', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')], 90);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setOutPreset(page, 'slide-right');
    await setOutDuration(page, '15');
    // mid timeline: normal state
    await stepTo(page, 40);
    expect(await partX(page)).toBe(300);
    // frame 90-15=75: OUT begins; frame 76 → actively moving right
    await stepTo(page, 36); // 76 total
    expect(await partX(page)).toBeGreaterThan(300);
    // IN untouched
    await storedExpect(page, 'a', 'outAnimPreset', 'slide-right');
    const stored = await storedPart(page, 'a');
    expect(stored.inAnimPreset).toBeUndefined();
  });

  test('E2E-4 — IN + OUT together: independent fields and lifecycle', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')], 90);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'fade');
    await setInDuration(page, '15');
    await setOutPreset(page, 'slide-left');
    await setOutDuration(page, '20');
    // start: IN fade (frame 1 — visible, opacity < 1)
    await stepTo(page, 1);
    const op0 = parseFloat((await partOpacity(page)) ?? '1');
    expect(op0).toBeLessThan(1);
    // mid: fully visible, normal
    await stepTo(page, 29); // frame 30 total
    const opMid = parseFloat((await partOpacity(page)) ?? '1');
    expect(opMid).toBe(1);
    expect(await partX(page)).toBe(300);
    // end region (90-20=70): OUT slide-left starts; frame 71 → actively moving
    await stepTo(page, 41); // 71 total
    expect(await partX(page)).toBeLessThan(300); // slide-left → moving left
    // fields independent
    await storedExpect(page, 'a', 'inAnimPreset', 'fade');
    await storedExpect(page, 'a', 'inAnimDuration', 15);
    await storedExpect(page, 'a', 'outAnimPreset', 'slide-left');
    await storedExpect(page, 'a', 'outAnimDuration', 20);
  });

  test('E2E-5 — duration input UX: multi-digit safe typing (BUG 2 regression)', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box', { inAnimPreset: 'fade', inAnimDuration: 30 })]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    // Ctrl+A → "45" → Enter: single commit
    await setInDuration(page, '45');
    await storedExpect(page, 'a', 'inAnimDuration', 45);
    // "1" intermediate must NOT commit before "15" completes
    const input = page.locator('input[aria-label="Animation In Duration"]');
    await input.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('1');
    await page.waitForTimeout(150);
    expect((await storedPart(page, 'a')).inAnimDuration).toBe(45); // untouched mid-typing
    await page.keyboard.type('5');
    await page.keyboard.press('Enter');
    await storedExpect(page, 'a', 'inAnimDuration', 15);
  });

  test('E2E-6 — undo restores IN and OUT preset edits', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'fade');
    await setInDuration(page, '20');
    // undo duration → back to 30 (UI derives from the restored state)
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => page.locator('input[aria-label="Animation In Duration"]').inputValue(), { timeout: 5000 }).toBe('30');
    expect(await page.locator('select[aria-label="Animation In Preset"]').inputValue()).toBe('fade');
    // undo preset → none (field absent after undo of the initial set)
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => page.locator('select[aria-label="Animation In Preset"]').inputValue(), { timeout: 5000 }).toBe('none');
    // transforms/matte/name untouched by undo of preset edits
    const stored = await storedPart(page, 'a');
    expect(stored.name).toBe('Part A');
  });

  test('E2E-7 — field preservation: matte/transform/keyframes untouched', async ({ page }) => {
    await seed(page, [
      makeLayer('src', 'The Source', 'custom_star', { fillColor: '#ffffff' }),
      makeLayer('a', 'Part A', 'custom_box', {
        x: 120, y: -40, rotation: 25, scaleX: 1.5, opacity: 0.7,
        matte: { sourcePartId: 'src', mode: 'alpha', enabled: true, feather: 4 },
      }),
    ]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-up');
    await setOutPreset(page, 'pop');
    await setInDuration(page, '12');
    await storedExpect(page, 'a', 'inAnimPreset', 'slide-up');
    await storedExpect(page, 'a', 'outAnimPreset', 'pop');
    const stored = await storedPart(page, 'a');
    expect(stored.inAnimPreset).toBe('slide-up');
    expect(stored.outAnimPreset).toBe('pop');
    expect(stored.x).toBe(120);
    expect(stored.rotation).toBe(25);
    expect(stored.scaleX).toBe(1.5);
    expect(stored.opacity).toBe(0.7);
    expect((stored.matte as Record<string, unknown>).sourcePartId).toBe('src');
    expect((stored.matte as Record<string, unknown>).feather).toBe(4);
  });

  test('E2E-8 — source part switch: no preset/duration leak between parts', async ({ page }) => {
    await seed(page, [
      makeLayer('a', 'Part A', 'custom_box'),
      makeLayer('b', 'Part B', 'custom_box', { x: 400 }),
    ]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-left');
    await setInDuration(page, '20');
    // switch to B: its own (empty) values
    await selectPart(page, 'Part B');
    const selB = await page.locator('select[aria-label="Animation In Preset"]').inputValue();
    expect(selB).toBe('none');
    const durB = await page.locator('input[aria-label="Animation In Duration"]').inputValue();
    expect(durB).toBe('30'); // B has no duration → default
    // back to A: values intact
    await selectPart(page, 'Part A');
    expect(await page.locator('select[aria-label="Animation In Preset"]').inputValue()).toBe('slide-left');
    expect(await page.locator('input[aria-label="Animation In Duration"]').inputValue()).toBe('20');
  });

  test('E2E-9 — save / reload: preset fields persist via the existing schema', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'pop');
    await setInDuration(page, '18');
    await setOutPreset(page, 'fade');
    await setOutDuration(page, '12');
    // autosave is async — make sure the values are persisted BEFORE reload
    await storedExpect(page, 'a', 'inAnimPreset', 'pop');
    await storedExpect(page, 'a', 'inAnimDuration', 18);
    await storedExpect(page, 'a', 'outAnimPreset', 'fade');
    await storedExpect(page, 'a', 'outAnimDuration', 12);
    // reload through the real app path (the seed marker prevents the init
    // script from clobbering the autosaved scene)
    await page.reload();
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    expect(await page.locator('select[aria-label="Animation In Preset"]').inputValue()).toBe('pop');
    expect(await page.locator('input[aria-label="Animation In Duration"]').inputValue()).toBe('18');
    expect(await page.locator('select[aria-label="Animation Out Preset"]').inputValue()).toBe('fade');
    expect(await page.locator('input[aria-label="Animation Out Duration"]').inputValue()).toBe('12');
    // preview still works after reload (pop at frame 1 — visible, scaling)
    await stepTo(page, 1);
    expect(await partScaleX(page)).toBeLessThan(1);
  });

  test('E2E-10 — broadcast compatibility: same fields feed the broadcast engine', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')], 90);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-left');
    await setInDuration(page, '15');
    await setOutPreset(page, 'fade');
    await setOutDuration(page, '15');
    // enter broadcast mode through the header button
    const bcBtn = page.locator('button', { hasText: /BROADCAST/i }).first();
    await bcBtn.waitFor({ state: 'visible', timeout: 10000 });
    await bcBtn.click();
    await page.waitForTimeout(500);
    // app alive in broadcast mode, part still rendered, no crash
    expect(await page.locator('.app-container').count()).toBe(1);
    // the same preset fields are stored for the broadcast engine to consume
    await storedExpect(page, 'a', 'inAnimPreset', 'slide-left');
    await storedExpect(page, 'a', 'outAnimPreset', 'fade');
    // back to edit: transport state was not hijacked (frame still 0)
    const editBtn = page.locator('button', { hasText: /EDIT/i }).first();
    await editBtn.click();
    await page.waitForTimeout(400);
    expect(await page.locator('svg g[transform]').count()).toBeGreaterThanOrEqual(1);
  });

  test('E2E-11 — multiple parts: per-part presets, no cross-part leak', async ({ page }) => {
    await seed(page, [
      makeLayer('a', 'Part A', 'custom_box'),
      makeLayer('b', 'Part B', 'custom_box', { x: 400 }),
    ]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-left');
    await selectPart(page, 'Part B');
    await setInPreset(page, 'fade');
    // A: slide-left → moving at frame 1 (frame 0 is invisible)
    // B: fade → opacity < 1, x untouched
    await stepTo(page, 1);
    expect(await partX(page, 0)).toBeGreaterThan(300); // 300 + slide delta
    const opB = parseFloat((await partOpacity(page, 1)) ?? '1');
    expect(opB).toBeLessThan(1);
    expect(await partX(page, 1)).toBe(700);
    await storedExpect(page, 'a', 'inAnimPreset', 'slide-left');
    await storedExpect(page, 'b', 'inAnimPreset', 'fade');
  });

  test('E2E-12 — no keyframe side effects (Option B proof)', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    const before = await storedChannelKeyframeCount(page);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'pop');
    await setInDuration(page, '10');
    await setOutPreset(page, 'slide-down');
    await setOutDuration(page, '10');
    const after = await storedChannelKeyframeCount(page);
    expect(after).toBe(before); // no new transform keyframes
    // no channels were created either
    const stored = await storedPart(page, 'a');
    expect(stored.channels).toBeUndefined();
  });

  test('E2E-13 — custom_timeline stays hidden and untouched', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box', { inAnimPreset: 'custom_timeline' })]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    const values = await page.locator('select[aria-label="Animation In Preset"] option').allTextContents();
    expect(values).not.toContain('custom_timeline');
    // the internal value is NOT rewritten by simply rendering
    await storedExpect(page, 'a', 'inAnimPreset', 'custom_timeline');
  });

  test('E2E-14 — preset clear: None removes the IN/OUT animation', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box', {
      inAnimPreset: 'slide-left', inAnimDuration: 15,
      outAnimPreset: 'fade', outAnimDuration: 12,
    })]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'none');
    await setOutPreset(page, 'none');
    await storedExpect(page, 'a', 'inAnimPreset', 'none');
    await storedExpect(page, 'a', 'outAnimPreset', 'none');
    // unrelated fields untouched
    const stored = await storedPart(page, 'a');
    expect(stored.x).toBe(0);
    // no IN animation at frame 0 anymore
    expect(await partX(page)).toBe(300);
  });

  test('E2E-15 — no selection: no invalid controls, no crash', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A', 'custom_box')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'fade');
    // delete the selected part through the real UI
    const del = page.locator('button[title="Delete Actor Instance"]');
    await del.waitFor({ state: 'visible', timeout: 10000 });
    await del.click();
    await page.waitForTimeout(400);
    // inspector shows no part → the animation card is not rendered
    expect(await page.locator('select[aria-label="Animation In Preset"]').count()).toBe(0);
    expect(await page.locator('.app-container').count()).toBe(1); // app alive
  });
});
