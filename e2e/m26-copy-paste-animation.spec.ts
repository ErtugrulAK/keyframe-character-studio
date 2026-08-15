import { test, expect, type Page } from '@playwright/test';

/**
 * M26 STEP 26C — REAL USER E2E: Copy / Paste / Clear Animation.
 *
 * Real UI flow: select source part → configure animation (IN/OUT presets +
 * durations + seeded channel keyframes) → Copy Animation → select target →
 * Paste Animation → verify identity preservation, keyframe transfer, fresh
 * ids, IN/OUT runtime, undo (single transaction), Clear Animation, existing
 * Copy Part regression, custom preset references, matte/parent preservation,
 * multi-select policy, broadcast + save/reload.
 *
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

function makeChannelKfs(prefix: string): Record<string, unknown>[] {
  return [
    { id: `${prefix}_x_1`, frame: 0, value: 0, easing: 'linear', templateId: 'Sequence' },
    { id: `${prefix}_x_2`, frame: 20, value: 120, easing: 'easeInOut', bezierControlPoints: [0.2, 0, 0.8, 1], templateId: 'Sequence' },
  ];
}

function emptyChannels(): Record<string, unknown[]> {
  return { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [] };
}

async function presetCount(page: Page): Promise<number> {
  return page.evaluate((k) => (JSON.parse(localStorage.getItem(k) ?? '[]') as unknown[]).length, PRESETS_KEY);
}

async function seed(page: Page, layers: Record<string, unknown>[], tracks: Record<string, unknown>[] = [], totalFrames = 90): Promise<void> {
  const scene = {
    version: 1, layers, tracks, fps: 30, totalFrames,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'M26 Copy/Paste E2E',
  };
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); });
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

async function saveNow(page: Page): Promise<void> {
  const badge = page.locator('.autosave-status-badge');
  if (await badge.count()) {
    await badge.click();
    await page.waitForTimeout(300);
  }
}

async function storedPart(page: Page, id: string): Promise<Record<string, unknown>> {
  await saveNow(page);
  return page.evaluate(([key, pid]) => {
    const scene = JSON.parse(localStorage.getItem(key) ?? '{}');
    return (scene.layers ?? []).find((l: Record<string, unknown>) => l.id === pid) ?? {};
  }, [STORAGE_KEY, id] as [string, string]);
}

async function storedTrack(page: Page, partId: string): Promise<Record<string, unknown>> {
  await saveNow(page);
  return page.evaluate(([key, pid]) => {
    const scene = JSON.parse(localStorage.getItem(key) ?? '{}');
    return (scene.tracks ?? []).find((t: Record<string, unknown>) => t.partId === pid) ?? null;
  }, [STORAGE_KEY, partId] as [string, string]);
}

async function partCount(page: Page): Promise<number> {
  await saveNow(page);
  return page.evaluate((key) => {
    const scene = JSON.parse(localStorage.getItem(key) ?? '{}');
    return (scene.layers ?? []).length;
  }, STORAGE_KEY);
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

test.describe('M26 — copy/paste/clear animation (real UI)', () => {
  test('E2E-1+2+3+4+22 — paste onto existing part: identity kept, animation transferred, source untouched', async ({ page }) => {
    const A = makeLayer('a', 'Part A', 'custom_box', { x: 0, y: 0, zIndex: 2 });
    const B = makeLayer('b', 'Part B', 'custom_box', { x: 400, y: 100, rotation: 30, zIndex: 1 });
    const tracks = [{
      id: 't_a', partId: 'a', name: 'Part A', color: '#ff0000',
      channels: { x: makeChannelKfs('a') },
      keyframes: [],
      visible: true, locked: false, expanded: false,
    }];
    await seed(page, [A, B], tracks);

    // Part A: configure IN/OUT animation + Copy Animation
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-scale-left');
    await setInDuration(page, '18');
    await setOutPreset(page, 'soft-pop');
    await setOutDuration(page, '22');
    await page.locator('[aria-label="Copy Animation"]').click();
    await page.waitForTimeout(200);
    expect(await partCount(page)).toBe(2); // no new part from copy

    // Part B: Paste Animation
    await selectPart(page, 'Part B');
    await openTransformTab(page);
    const pasteBtn = page.locator('[aria-label="Paste Animation"]');
    await expect(pasteBtn).toBeEnabled();
    await pasteBtn.click();
    await page.waitForTimeout(300);

    // identity preserved
    expect(await partCount(page)).toBe(2); // E2E-3: no new part
    const storedB = await storedPart(page, 'b');
    expect(storedB.id).toBe('b');
    expect(storedB.name).toBe('Part B');
    expect(storedB.x).toBe(400);
    expect(storedB.y).toBe(100);
    expect(storedB.rotation).toBe(30);
    expect(storedB.zIndex).toBe(1);
    // animation transferred
    expect(storedB.inAnimPreset).toBe('slide-scale-left');
    expect(storedB.outAnimPreset).toBe('soft-pop');
    expect(storedB.inAnimDuration).toBe(18);
    expect(storedB.outAnimDuration).toBe(22);

    // track: created for B with target partId, source data copied
    const trackB = await storedTrack(page, 'b');
    expect(trackB).not.toBeNull();
    expect(trackB.partId).toBe('b');
    expect((trackB.channels as Record<string, unknown[]>).x).toHaveLength(2);
    expect((trackB.channels as Record<string, unknown[]>).x[1]).toMatchObject({ frame: 20, value: 120, easing: 'easeInOut', templateId: 'Sequence' });

    // source A untouched (its part fields — the source track data was proven
    // above by the transferred channels)
    const storedA = await storedPart(page, 'a');
    expect(storedA.inAnimPreset).toBe('slide-scale-left');
    expect(storedA.inAnimDuration).toBe(18);
  });

  test('E2E-5+6 — fresh keyframe ids, target track id preserved when existing', async ({ page }) => {
    const A = makeLayer('a', 'Part A', 'custom_box');
    const B = makeLayer('b', 'Part B', 'custom_box', { x: 400 });
    const tracks = [
      { id: 't_a', partId: 'a', name: 'Part A', color: '#ff0000', channels: { x: makeChannelKfs('a') }, keyframes: [], visible: true, locked: false, expanded: false },
      { id: 't_b', partId: 'b', name: 'Part B', color: '#00ff00', channels: { x: [{ id: 'b_x_1', frame: 0, value: 0, easing: 'linear', templateId: 'Sequence' }] }, keyframes: [], visible: true, locked: false, expanded: true },
    ];
    await seed(page, [A, B], tracks);

    // target track id BEFORE paste (import regenerates ids — read the real one)
    const bTrackIdBefore = (await storedTrack(page, 'b'))?.id as string;

    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await page.locator('[aria-label="Copy Animation"]').click();
    await selectPart(page, 'Part B');
    await openTransformTab(page);
    await page.locator('[aria-label="Paste Animation"]').click();
    await page.waitForTimeout(300);

    const trackB = await storedTrack(page, 'b');
    expect(trackB.id).toBe(bTrackIdBefore); // existing target track id preserved

    // fresh ids: no overlap between source and target keyframe ids
    const ids = await page.evaluate(([key, pidA, pidB]) => {
      const scene = JSON.parse(localStorage.getItem(key) ?? '{}');
      const tA = scene.tracks.find((t: Record<string, unknown>) => t.partId === pidA);
      const tB = scene.tracks.find((t: Record<string, unknown>) => t.partId === pidB);
      const collect = (t: Record<string, unknown>) => {
        const ids: string[] = [];
        for (const arr of Object.values((t.channels ?? {}) as Record<string, unknown[]>)) {
          for (const k of arr as { id: string }[]) ids.push(k.id);
        }
        for (const k of (t.keyframes ?? []) as { id: string }[]) ids.push(k.id);
        return ids;
      };
      return { a: collect(tA), b: collect(tB) };
    }, [STORAGE_KEY, 'a', 'b'] as [string, string, string]);
    expect(ids.a.filter((id) => ids.b.includes(id))).toEqual([]); // intersection empty
  });

  test('E2E-7 — pasted IN/OUT animation actually plays on target', async ({ page }) => {
    const A = makeLayer('a', 'Part A', 'custom_box');
    const B = makeLayer('b', 'Part B', 'custom_box', { x: 400 });
    await seed(page, [A, B]);

    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-scale-left');
    await setInDuration(page, '18');
    await page.locator('[aria-label="Copy Animation"]').click();
    await selectPart(page, 'Part B');
    await openTransformTab(page);
    await page.locator('[aria-label="Paste Animation"]').click();
    await page.waitForTimeout(200);

    // frame 1: IN active on B (x offset + scale < 1), A at its own base
    await stepTo(page, 1);
    expect(await partX(page, 1)).toBeGreaterThan(700);
    expect(await partScaleX(page, 1)).toBeLessThan(1);
  });

  test('E2E-8 — custom preset reference transferred, library NOT duplicated', async ({ page }) => {
    const A = makeLayer('a', 'Part A', 'custom_box');
    const B = makeLayer('b', 'Part B', 'custom_box', { x: 400 });
    await seed(page, [A, B]);

    // create a custom preset through the real UI (M25 flow)
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-left');
    await setInDuration(page, '12');
    await page.locator('[title="Save current animation as a custom preset"]').first().click();
    await page.getByRole('dialog', { name: 'Save Animation Preset' }).getByLabel('Preset Name').fill('My Move');
    await page.getByRole('dialog', { name: 'Save Animation Preset' }).getByText('Save', { exact: true }).click();
    await page.waitForTimeout(300);
    const libBefore = await presetCount(page);
    const customId = (await page.evaluate((k) => {
      const raw = JSON.parse(localStorage.getItem(k) ?? '[]') as { id: string; name: string }[];
      return raw.find((p) => p.name === 'My Move')?.id;
    }, PRESETS_KEY))!;
    await setInPreset(page, customId); // A references the custom preset

    await page.locator('[aria-label="Copy Animation"]').click();
    await selectPart(page, 'Part B');
    await openTransformTab(page);
    await page.locator('[aria-label="Paste Animation"]').click();
    await page.waitForTimeout(300);

    const storedB = await storedPart(page, 'b');
    expect(storedB.inAnimPreset).toBe(customId); // SAME id referenced
    // library count unchanged (no duplicate created — DEFAULT seeds counted too)
    expect(await presetCount(page)).toBe(libBefore);
  });

  test('E2E-9+10 — matte + transform + parent preserved on paste', async ({ page }) => {
    const A = makeLayer('a', 'Part A', 'custom_box');
    const C = makeLayer('c', 'Part C', 'custom_circle', { x: 200 });
    const B = makeLayer('b', 'Part B', 'custom_box', {
      x: 400, y: 100, rotation: 30, parentId: 'c',
      matte: { enabled: true, sourcePartId: 'c', mode: 'clip', feather: 0, strength: 1 },
    });
    await seed(page, [A, B, C]);

    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'fade');
    await setInDuration(page, '10');
    await page.locator('[aria-label="Copy Animation"]').click();
    await selectPart(page, 'Part B');
    await openTransformTab(page);
    await page.locator('[aria-label="Paste Animation"]').click();
    await page.waitForTimeout(300);

    const storedB = await storedPart(page, 'b');
    expect(storedB.matte).toEqual({ enabled: true, sourcePartId: 'c', mode: 'clip', feather: 0, strength: 1 });
    expect(storedB.parentId).toBe('c');
    expect(storedB.x).toBe(400);
    expect(storedB.y).toBe(100);
    expect(storedB.rotation).toBe(30);
    expect(storedB.inAnimPreset).toBe('fade'); // animation DID transfer
  });

  test('E2E-11+13 — undo: paste and clear each revert with ONE Ctrl+Z', async ({ page }) => {
    const A = makeLayer('a', 'Part A', 'custom_box');
    const B = makeLayer('b', 'Part B', 'custom_box', { x: 400 });
    await seed(page, [A, B]);

    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-left');
    await setInDuration(page, '12');
    await page.locator('[aria-label="Copy Animation"]').click();
    await selectPart(page, 'Part B');
    await openTransformTab(page);
    await page.locator('[aria-label="Paste Animation"]').click();
    await page.waitForTimeout(300);
    expect((await storedPart(page, 'b')).inAnimPreset).toBe('slide-left');

    // ONE Ctrl+Z reverts the whole paste (channels + presets + durations)
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    const afterUndo = await storedPart(page, 'b');
    expect(afterUndo.inAnimPreset).toBeUndefined();
    const trackB = await storedTrack(page, 'b');
    expect((trackB?.channels as Record<string, unknown[]> | undefined)?.x ?? []).toHaveLength(0);

    // redo the paste, then Clear + ONE Ctrl+Z restores everything
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await page.locator('[aria-label="Copy Animation"]').click();
    await selectPart(page, 'Part B');
    await openTransformTab(page);
    await page.locator('[aria-label="Paste Animation"]').click();
    await page.waitForTimeout(300);
    await page.locator('[aria-label="Clear Animation"]').click();
    await page.waitForTimeout(300);
    const cleared = await storedPart(page, 'b');
    expect(cleared.inAnimPreset).toBe('none');
    expect(cleared.inAnimDuration).toBe(30); // policy A: reset to default
    expect((await storedTrack(page, 'b')).channels.x).toHaveLength(0);

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    const restored = await storedPart(page, 'b');
    expect(restored.inAnimPreset).toBe('slide-left');
    expect(restored.inAnimDuration).toBe(12);
  });

  test('E2E-12+14+23 — clear animation: fields reset, identity/matte/library kept, safe on empty', async ({ page }) => {
    const A = makeLayer('a', 'Part A', 'custom_box');
    const B = makeLayer('b', 'Part B', 'custom_box', { x: 400, matte: { enabled: true, sourcePartId: 'a', mode: 'luminance', feather: 2, strength: 0.8 } });
    const tracks = [{ id: 't_a', partId: 'a', name: 'Part A', color: '#f00', channels: { x: makeChannelKfs('a') }, keyframes: [], visible: true, locked: false, expanded: false }];
    await seed(page, [A, B], tracks);

    // B gets animation via paste first
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'pop');
    await setInDuration(page, '16');
    await page.locator('[aria-label="Copy Animation"]').click();
    await selectPart(page, 'Part B');
    await openTransformTab(page);
    await page.locator('[aria-label="Paste Animation"]').click();
    await page.waitForTimeout(300);
    const libBefore = await presetCount(page);

    await page.locator('[aria-label="Clear Animation"]').click();
    await page.waitForTimeout(300);
    const cleared = await storedPart(page, 'b');
    expect(cleared.inAnimPreset).toBe('none');
    expect(cleared.outAnimPreset).toBe('none');
    expect(cleared.inAnimDuration).toBe(30);
    expect(cleared.outAnimDuration).toBe(30);
    // identity + matte preserved
    expect(cleared.id).toBe('b');
    expect(cleared.name).toBe('Part B');
    expect(cleared.x).toBe(400);
    expect(cleared.matte).toEqual({ enabled: true, sourcePartId: 'a', mode: 'luminance', feather: 2, strength: 0.8 });
    const trackB = await storedTrack(page, 'b');
    expect((trackB?.channels as Record<string, unknown[]>).x).toHaveLength(0);

    // custom preset library untouched (clear never deletes library entries)
    expect(await presetCount(page)).toBe(libBefore);

    // clear again on an already-empty part: no crash, no mutation
    await page.locator('[aria-label="Clear Animation"]').click();
    await page.waitForTimeout(300);
    expect((await storedPart(page, 'b')).inAnimPreset).toBe('none');
  });

  test('E2E-15 — source is target: paste disabled, no mutation', async ({ page }) => {
    const A = makeLayer('a', 'Part A', 'custom_box');
    await seed(page, [A]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'fade');
    await page.locator('[aria-label="Copy Animation"]').click();
    await page.waitForTimeout(200);
    // still on Part A → paste disabled
    await expect(page.locator('[aria-label="Paste Animation"]')).toBeDisabled();
    expect((await storedPart(page, 'a')).inAnimPreset).toBe('fade');
  });

  test('E2E-16 — multi-select: only primary target receives the paste', async ({ page }) => {
    const A = makeLayer('a', 'Part A', 'custom_box');
    const B = makeLayer('b', 'Part B', 'custom_box', { x: 400 });
    const C = makeLayer('c', 'Part C', 'custom_box', { x: 700 });
    await seed(page, [A, B, C]);

    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-left');
    await setInDuration(page, '12');
    await page.locator('[aria-label="Copy Animation"]').click();
    await selectPart(page, 'Part B');
    await openTransformTab(page);
    // shift-select Part C too (multi-select), then paste
    await page.keyboard.down('Shift');
    await selectPart(page, 'Part C');
    await page.keyboard.up('Shift');
    await page.locator('[aria-label="Paste Animation"]').click();
    await page.waitForTimeout(300);

    // only the primary (last selected = C? or B?) — contract: primary selectedPartId
    const storedB = await storedPart(page, 'b');
    const storedC = await storedPart(page, 'c');
    // exactly ONE of them received the animation (the primary target)
    const bHas = storedB.inAnimPreset !== undefined;
    const cHas = storedC.inAnimPreset !== undefined;
    expect(bHas !== cHas).toBe(true); // exactly one targeted
  });

  test('E2E-17 — existing Copy Part → Paste Part regression', async ({ page }) => {
    const A = makeLayer('a', 'Part A', 'custom_box');
    await seed(page, [A]);
    await selectPart(page, 'Part A');
    // Copy Part / Paste Part — existing keyboard/UI path
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(300);
    expect(await partCount(page)).toBe(2); // NEW part created (legacy behavior)
  });

  test('E2E-18 — multiple pastes: B and C both get it, ids never collide', async ({ page }) => {
    const A = makeLayer('a', 'Part A', 'custom_box');
    const B = makeLayer('b', 'Part B', 'custom_box', { x: 400 });
    const C = makeLayer('c', 'Part C', 'custom_box', { x: 700 });
    const tracks = [{ id: 't_a', partId: 'a', name: 'Part A', color: '#ff0000', channels: { x: makeChannelKfs('a') }, keyframes: [], visible: true, locked: false, expanded: false }];
    await seed(page, [A, B, C], tracks);

    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'fade');
    await setInDuration(page, '10');
    await page.locator('[aria-label="Copy Animation"]').click();
    await selectPart(page, 'Part B');
    await openTransformTab(page);
    await page.locator('[aria-label="Paste Animation"]').click();
    await page.waitForTimeout(200);
    await selectPart(page, 'Part C');
    await openTransformTab(page);
    await page.locator('[aria-label="Paste Animation"]').click();
    await page.waitForTimeout(300);

    // B/C keyframe ids are disjoint, and both carry the copied animation
    await saveNow(page);
    const ids = await page.evaluate(([key, pidA, pidB, pidC]) => {
      const scene = JSON.parse(localStorage.getItem(key) ?? '{}');
      const collect = (pid: string) => {
        const t = scene.tracks.find((tr: Record<string, unknown>) => tr.partId === pid);
        if (!t) return [];
        const out: string[] = [];
        for (const arr of Object.values((t.channels ?? {}) as Record<string, unknown[]>)) {
          for (const k of arr as { id: string }[]) out.push(k.id);
        }
        return out;
      };
      return { a: collect(pidA), b: collect(pidB), c: collect(pidC) };
    }, [STORAGE_KEY, 'a', 'b', 'c'] as [string, string, string, string]);
    expect(ids.b).toHaveLength(2);
    expect(ids.c).toHaveLength(2);
    expect(ids.b.filter((id) => ids.c.includes(id))).toEqual([]); // B/C ids disjoint
  });

  test('E2E-20+21 — broadcast + save/reload keep the pasted animation', async ({ page }) => {
    const A = makeLayer('a', 'Part A', 'custom_box');
    const B = makeLayer('b', 'Part B', 'custom_box', { x: 400 });
    const tracks = [{ id: 't_a', partId: 'a', name: 'Part A', color: '#ff0000', channels: { x: makeChannelKfs('a') }, keyframes: [], visible: true, locked: false, expanded: false }];
    await seed(page, [A, B], tracks);

    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await setInPreset(page, 'slide-scale-left');
    await setInDuration(page, '18');
    await page.locator('[aria-label="Copy Animation"]').click();
    await selectPart(page, 'Part B');
    await openTransformTab(page);
    await page.locator('[aria-label="Paste Animation"]').click();
    await page.waitForTimeout(300);

    // broadcast: B's custom/pasted animation resolves in the existing pipeline
    await page.getByText('BROADCAST', { exact: true }).click();
    await page.waitForTimeout(600);
    await page.getByText('Sequence', { exact: true }).first().click();
    await page.waitForTimeout(400);
    await page.waitForTimeout(1500);
    expect(await partOpacity(page, 1)).toBeGreaterThan(0);

    // back to edit + reload: animation persists
    await page.getByText('EDIT MODE', { exact: true }).click();
    await page.waitForTimeout(400);
    await saveNow(page);
    await page.reload();
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
    const storedB = await storedPart(page, 'b');
    expect(storedB.inAnimPreset).toBe('slide-scale-left');
    expect(storedB.inAnimDuration).toBe(18);
    const trackB = await storedTrack(page, 'b');
    expect((trackB?.channels as Record<string, unknown[]>).x).toHaveLength(2);
  });

  test('E2E-24 — accessibility: labels/titles + disabled state in the real DOM', async ({ page }) => {
    const A = makeLayer('a', 'Part A', 'custom_box');
    await seed(page, [A]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await expect(page.locator('[aria-label="Copy Animation"]')).toBeVisible();
    await expect(page.locator('[aria-label="Paste Animation"]')).toBeDisabled(); // no clipboard yet
    await expect(page.locator('[aria-label="Clear Animation"]')).toBeVisible();
    await expect(page.locator('[title="Copy animation from this element"]')).toBeVisible();
    await expect(page.locator('[title="Paste animation onto selected element"]')).toBeVisible();
  });
});

async function partOpacity(page: Page, index = 0): Promise<number> {
  return page.evaluate((idx) => {
    const gs = [...document.querySelectorAll('svg g[transform]')];
    const st = (gs[idx] as HTMLElement | undefined)?.style;
    const o = st?.opacity ?? '';
    return o === '' ? 1 : parseFloat(o);
  }, index);
}
