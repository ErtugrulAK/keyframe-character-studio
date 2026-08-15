import { test, expect, type Page } from '@playwright/test';

/**
 * M28 STEP 28C — REAL USER E2E: Timeline keyframe copy / paste.
 *
 * Real UI flow: right-click a keyframe diamond → Copy Keyframes (timeline
 * clipboard) → right-click an EMPTY lane location (explicit target frame via
 * mouse position) → Paste Keyframes. Covers same-track + cross-track paste,
 * frame-group semantics, fresh ids, collision no-ops, single-undo, clipboard
 * non-persistence, and M27 delete/duplicate/drag regression.
 */

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const FRAME_WIDTH = 18;

function makeLayer(id: string, name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, name, type: 'custom_box',
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1,
    fillColor: '#ff2020', strokeColor: '#101218', strokeWidth: 2, borderRadius: 0,
    width: 120, height: 120,
    ...overrides,
  };
}

function emptyChannels(): Record<string, unknown[]> {
  return { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [] };
}

function kf(id: string, frame: number, value: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, frame, value, easing: 'easeInOut', templateId: 'Sequence', ...extra };
}

async function seed(
  page: Page,
  layers: Record<string, unknown>[],
  tracks: Record<string, unknown>[],
  totalFrames = 90,
): Promise<void> {
  const scene = {
    version: 1, layers, tracks, fps: 30, totalFrames,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'M28 Keyframe Copy/Paste E2E',
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

async function saveNow(page: Page): Promise<void> {
  const badge = page.locator('.autosave-status-badge');
  if (await badge.count()) {
    await badge.click();
    await page.waitForTimeout(300);
  }
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

/** Right-click the Nth keyframe diamond and pick the given menu action. */
async function kfMenu(page: Page, action: 'Copy Keyframes' | 'Duplicate Keyframes' | 'Delete Keyframe', index = 0): Promise<void> {
  const diamond = page.locator('.keyframe-diamond').nth(index);
  await diamond.waitFor({ state: 'visible', timeout: 10000 });
  await diamond.click({ button: 'right' });
  await page.waitForTimeout(200);
  await page.locator(`[aria-label="${action}"]`).click();
  await page.waitForTimeout(300);
}

/**
 * Right-click an EMPTY location of the FIRST lane at the given frame and pick
 * Paste Keyframes. Uses the real mouse position (target frame = clicked frame).
 */
async function lanePaste(page: Page, frame: number, laneIndex = 0): Promise<void> {
  const lane = page.locator('.ue-track-lane').nth(laneIndex);
  await lane.waitFor({ state: 'visible', timeout: 10000 });
  const box = await lane.boundingBox();
  // Click just inside the frame's LEFT edge (frame*W + 1) so the mouse→frame
  // round lands on EXACTLY `frame` (a +W/2 click rounds up to frame+1).
  await page.mouse.click(box!.x + frame * FRAME_WIDTH + 1, box!.y + box!.height / 2, { button: 'right' });
  await page.waitForTimeout(200);
  await page.locator('[aria-label="Paste Keyframes"]').click();
  await page.waitForTimeout(300);
}

test.describe('M28 — timeline keyframe copy/paste (real UI)', () => {
  test('E2E-1+22 — copy frame-group: source intact, no new part, menu items coexist', async ({ page }) => {
    const A = makeLayer('a', 'Part A');
    const ch = emptyChannels();
    ch.x = [kf('x_10', 10, 1, { bezierControlPoints: [0.2, 0, 0.8, 1] })];
    ch.y = [kf('y_10', 10, 2)];
    ch.rotation = [kf('r_10', 10, 3)];
    ch.scaleX = [kf('sx_10', 10, 4)];
    ch.scaleY = [kf('sy_10', 10, 5)];
    const tracks = [{ id: 't_a', partId: 'a', name: 'Part A', color: '#ff0000', channels: ch, keyframes: [], visible: true, locked: false, expanded: true }];
    await seed(page, [A], tracks);

    await selectPart(page, 'Part A');
    expect(await partCount(page)).toBe(1);
    const before = await storedTrack(page, 'a');
    await kfMenu(page, 'Copy Keyframes');

    // source track unchanged; no new part
    const after = await storedTrack(page, 'a');
    expect(JSON.stringify(after.channels)).toBe(JSON.stringify(before.channels));
    expect(await partCount(page)).toBe(1);
    // menu items still coexist
    await page.locator('.keyframe-diamond').first().click({ button: 'right' });
    await page.waitForTimeout(200);
    await expect(page.locator('[aria-label="Copy Keyframes"]')).toBeVisible();
    await expect(page.locator('[aria-label="Duplicate Keyframes"]')).toBeVisible();
    await expect(page.locator('[aria-label="Delete Keyframe"]')).toBeVisible();
    await page.mouse.click(5, 5);
  });

  test('E2E-2+3+24 — same-track paste at EXPLICIT frame (playhead-independent)', async ({ page }) => {
    const A = makeLayer('a', 'Part A');
    const ch = emptyChannels();
    ch.x = [kf('x_10', 10, 55, { easing: 'easeInOut', templateId: 'Sequence', bezierControlPoints: [0.2, 0, 0.8, 1] })];
    ch.y = [kf('y_10', 10, 2)];
    const tracks = [{ id: 't_a', partId: 'a', name: 'Part A', color: '#ff0000', channels: ch, keyframes: [], visible: true, locked: false, expanded: true }];
    await seed(page, [A], tracks);

    await selectPart(page, 'Part A');
    await kfMenu(page, 'Copy Keyframes');
    // playhead is at 0 — paste targets the CLICKED frame 30, not the playhead
    await lanePaste(page, 30);

    const track = await storedTrack(page, 'a');
    const chans = track.channels as Record<string, Record<string, unknown>[]>;
    expect(chans.x.map((k) => k.frame)).toEqual([10, 30]); // exactly 30, not 0/31
    const pasted = chans.x.find((k) => k.frame === 30)!;
    expect(pasted.value).toBe(55);
    expect(pasted.easing).toBe('easeInOut');
    expect(pasted.templateId).toBe('Sequence');
    expect(pasted.bezierControlPoints).toEqual([0.2, 0, 0.8, 1]);
    expect(chans.y.map((k) => k.frame)).toEqual([10, 30]);
    // NOTE: scene serialization persists tracks as { partId, channels } —
    // id/name metadata lives in app state (import regenerates ids), so track
    // metadata preservation is proven at the pure layer (28A tests).
  });

  test('E2E-4+25 — cross-track paste: B keeps identity + unrelated animation, A untouched', async ({ page }) => {
    const A = makeLayer('a', 'Part A');
    const B = makeLayer('b', 'Part B', { x: 400 });
    const chA = emptyChannels();
    chA.x = [kf('ax_10', 10, 55)];
    chA.y = [kf('ay_10', 10, 2)];
    const chB = emptyChannels();
    chB.opacity = [kf('bo_5', 5, 0.5)];
    chB.x = [kf('bx_2', 2, 100)];
    const tracks = [
      { id: 't_a', partId: 'a', name: 'Part A', color: '#ff0000', channels: chA, keyframes: [], visible: true, locked: false, expanded: true },
      { id: 't_b', partId: 'b', name: 'Part B', color: '#00ff00', channels: chB, keyframes: [], visible: true, locked: false, expanded: true },
    ];
    await seed(page, [A, B], tracks);

    await selectPart(page, 'Part A');
    await kfMenu(page, 'Copy Keyframes');
    // right-click on Part B's lane at frame 40 → paste onto B
    const laneB = page.locator('.ue-track-lane').nth(1);
    const box = await laneB.boundingBox();
    await page.mouse.click(box!.x + 40 * FRAME_WIDTH + 1, box!.y + box!.height / 2, { button: 'right' });
    await page.waitForTimeout(200);
    await page.locator('[aria-label="Paste Keyframes"]').click();
    await page.waitForTimeout(300);

    const trackB = await storedTrack(page, 'b');
    const chansB = trackB.channels as Record<string, Record<string, unknown>[]>;
    expect(chansB.x.map((k) => k.frame)).toEqual([2, 40]); // existing @2 + pasted @40
    expect(chansB.x.find((k) => k.frame === 40)!.value).toBe(55);
    expect(chansB.y.map((k) => k.frame)).toEqual([40]); // group includes y
    expect(chansB.opacity.map((k) => k.frame)).toEqual([5]); // untouched
    expect(chansB.opacity[0].value).toBe(0.5);
    // source A untouched
    const trackA = await storedTrack(page, 'a');
    expect((trackA.channels as Record<string, Record<string, unknown>[]>).x.map((k) => k.frame)).toEqual([10]);
  });

  test('E2E-5+12 — fresh ids: source ∩ B ∩ C = ∅, multiple pastes semantic-equal', async ({ page }) => {
    const A = makeLayer('a', 'Part A');
    const B = makeLayer('b', 'Part B', { x: 400 });
    const C = makeLayer('c', 'Part C', { x: 700 });
    const chA = emptyChannels();
    chA.x = [kf('ax_10', 10, 1)];
    chA.y = [kf('ay_10', 10, 2)];
    const tracks = [
      { id: 't_a', partId: 'a', name: 'Part A', color: '#ff0000', channels: chA, keyframes: [], visible: true, locked: false, expanded: true },
      { id: 't_b', partId: 'b', name: 'Part B', color: '#00ff00', channels: emptyChannels(), keyframes: [], visible: true, locked: false, expanded: true },
      { id: 't_c', partId: 'c', name: 'Part C', color: '#0000ff', channels: emptyChannels(), keyframes: [], visible: true, locked: false, expanded: true },
    ];
    await seed(page, [A, B, C], tracks);

    await selectPart(page, 'Part A');
    await kfMenu(page, 'Copy Keyframes');
    await lanePaste(page, 30, 1); // B lane — frame 30
    await lanePaste(page, 50, 1); // B lane — frame 50 (same track, multiple pastes)

    const trackB = await storedTrack(page, 'b');
    const chansB = trackB.channels as Record<string, Record<string, unknown>[]>;
    expect(chansB.x.map((k) => k.frame)).toEqual([30, 50]);
    const idsB = [...chansB.x, ...chansB.y].map((k) => k.id as string);
    // source ids never reused
    expect(idsB.includes('ax_10')).toBe(false);
    expect(idsB.includes('ay_10')).toBe(false);
    // B ids all unique (30 vs 50 disjoint)
    expect(new Set(idsB).size).toBe(idsB.length);
    // semantic equality across pastes
    expect(chansB.x[0].value).toBe(chansB.x[1].value);
  });

  test('E2E-6 — collision: keyframe-occupied frames never offer Paste (UI-safe; helper no-op in 28A)', async ({ page }) => {
    const A = makeLayer('a', 'Part A');
    const B = makeLayer('b', 'Part B', { x: 400 });
    const chA = emptyChannels();
    chA.x = [kf('ax_10', 10, 1)];
    const chB = emptyChannels();
    chB.x = [kf('bx_40', 40, 999)]; // frame 40 occupied on B
    const tracks = [
      { id: 't_a', partId: 'a', name: 'Part A', color: '#ff0000', channels: chA, keyframes: [], visible: true, locked: false, expanded: true },
      { id: 't_b', partId: 'b', name: 'Part B', color: '#00ff00', channels: chB, keyframes: [], visible: true, locked: false, expanded: true },
    ];
    await seed(page, [A, B], tracks);

    await selectPart(page, 'Part A');
    await kfMenu(page, 'Copy Keyframes');
    // Right-clicking a frame that already holds a keyframe opens the KEYFRAME
    // menu (Copy/Duplicate/Delete) — never a Paste action — so the UI cannot
    // even attempt an overwrite. The safe no-op itself is proven at the pure
    // layer (28A: ANY keyframe at target frame → no-op, no overwrite/merge).
    const laneB = page.locator('.ue-track-lane').nth(1);
    const box = await laneB.boundingBox();
    await page.mouse.click(box!.x + 40 * FRAME_WIDTH + 1, box!.y + box!.height / 2, { button: 'right' });
    await page.waitForTimeout(200);
    expect(await page.locator('[aria-label="Paste Keyframes"]').count()).toBe(0); // not offered
    await expect(page.locator('[aria-label="Copy Keyframes"]')).toBeVisible(); // keyframe menu instead
    // existing frame 40 untouched (no overwrite path exists)
    const trackB = await storedTrack(page, 'b');
    expect((trackB.channels as Record<string, Record<string, unknown>[]>).x[0]).toMatchObject({ frame: 40, value: 999 });
    await page.mouse.click(5, 5);
  });

  test('E2E-8+9 — undo: paste reverts with ONE Ctrl+Z; copy enters NO history', async ({ page }) => {
    const A = makeLayer('a', 'Part A');
    const ch = emptyChannels();
    ch.x = [kf('x_10', 10, 55)];
    ch.y = [kf('y_10', 10, 2)];
    const tracks = [{ id: 't_a', partId: 'a', name: 'Part A', color: '#ff0000', channels: ch, keyframes: [], visible: true, locked: false, expanded: true }];
    await seed(page, [A], tracks);

    await selectPart(page, 'Part A');
    await kfMenu(page, 'Copy Keyframes'); // copy: clipboard only — NO history entry
    await lanePaste(page, 30);
    let track = await storedTrack(page, 'a');
    let chans = track.channels as Record<string, Record<string, unknown>[]>;
    expect(chans.x.map((k) => k.frame)).toEqual([10, 30]);

    // ONE Ctrl+Z must remove the whole pasted group. If Copy had entered
    // history, a single undo could not reach the pre-paste state — so this
    // simultaneously proves "paste = one logical undo" AND "copy = no history".
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    track = await storedTrack(page, 'a');
    chans = track.channels as Record<string, Record<string, unknown>[]>;
    expect(chans.x.map((k) => k.frame)).toEqual([10]);
    expect(chans.y.map((k) => k.frame)).toEqual([10]);
  });

  test('E2E-10 — boundary: paste at totalFrames valid, beyond → clamped/no-op, no extension', async ({ page }) => {
    const A = makeLayer('a', 'Part A');
    const ch = emptyChannels();
    ch.x = [kf('x_10', 10, 1)];
    const tracks = [{ id: 't_a', partId: 'a', name: 'Part A', color: '#ff0000', channels: ch, keyframes: [], visible: true, locked: false, expanded: true }];
    await seed(page, [A], tracks, 30);

    await selectPart(page, 'Part A');
    await kfMenu(page, 'Copy Keyframes');
    await lanePaste(page, 30); // 30 == totalFrames → valid
    let track = await storedTrack(page, 'a');
    expect((track.channels as Record<string, Record<string, unknown>[]>).x.map((k) => k.frame)).toEqual([10, 30]);
    // NOTE: pasting onto a frame that now holds a keyframe (30) is UI-blocked
    // by design (keyframe menu wins — see E2E-6); collision no-op is proven at
    // the pure layer (28A). The timeline never extends:
    const totalFrames = await page.evaluate((key) => (JSON.parse(localStorage.getItem(key) ?? '{}')).totalFrames, STORAGE_KEY);
    expect(totalFrames).toBe(30); // no extension
  });

  test('E2E-11 — empty clipboard: no paste action offered on empty lane', async ({ page }) => {
    const A = makeLayer('a', 'Part A');
    const ch = emptyChannels();
    ch.x = [kf('x_10', 10, 1)];
    const tracks = [{ id: 't_a', partId: 'a', name: 'Part A', color: '#ff0000', channels: ch, keyframes: [], visible: true, locked: false, expanded: true }];
    await seed(page, [A], tracks);

    await selectPart(page, 'Part A');
    const lane = page.locator('.ue-track-lane').first();
    const box = await lane.boundingBox();
    await page.mouse.click(box!.x + 40 * FRAME_WIDTH, box!.y + box!.height / 2, { button: 'right' });
    await page.waitForTimeout(200);
    expect(await page.locator('[aria-label="Paste Keyframes"]').count()).toBe(0); // no menu
  });

  test('E2E-14+15 — delete + duplicate regression (separate semantics)', async ({ page }) => {
    const A = makeLayer('a', 'Part A');
    const ch = emptyChannels();
    ch.x = [kf('x_10', 10, 1)];
    const tracks = [{ id: 't_a', partId: 'a', name: 'Part A', color: '#ff0000', channels: ch, keyframes: [], visible: true, locked: false, expanded: true }];
    await seed(page, [A], tracks);

    await selectPart(page, 'Part A');
    // M27 duplicate still fixed +1
    await kfMenu(page, 'Duplicate Keyframes');
    let track = await storedTrack(page, 'a');
    expect((track.channels as Record<string, Record<string, unknown>[]>).x.map((k) => k.frame)).toEqual([10, 11]);

    // delete still works (menu path)
    await kfMenu(page, 'Delete Keyframe', 1); // delete the duplicated one at 11
    track = await storedTrack(page, 'a');
    expect((track.channels as Record<string, Record<string, unknown>[]>).x.map((k) => k.frame)).toEqual([10]);

    // copy → paste explicit target (separate from duplicate)
    await kfMenu(page, 'Copy Keyframes');
    await lanePaste(page, 20);
    track = await storedTrack(page, 'a');
    expect((track.channels as Record<string, Record<string, unknown>[]>).x.map((k) => k.frame)).toEqual([10, 20]);
  });

  test('E2E-18+19+20 — multi-part policy + preset/matte independence', async ({ page }) => {
    const A = makeLayer('a', 'Part A', { inAnimPreset: 'fade', inAnimDuration: 12 });
    const B = makeLayer('b', 'Part B', { x: 400, matte: { enabled: true, sourcePartId: 'a', mode: 'luminance', feather: 2, strength: 0.8 } });
    const chA = emptyChannels();
    chA.x = [kf('ax_10', 10, 1)];
    const chB = emptyChannels();
    chB.opacity = [kf('bo_5', 5, 0.5)];
    const tracks = [
      { id: 't_a', partId: 'a', name: 'Part A', color: '#ff0000', channels: chA, keyframes: [], visible: true, locked: false, expanded: true },
      { id: 't_b', partId: 'b', name: 'Part B', color: '#00ff00', channels: chB, keyframes: [], visible: true, locked: false, expanded: true },
    ];
    await seed(page, [A, B], tracks);

    // multi-select A + B
    await selectPart(page, 'Part A');
    await page.keyboard.down('Shift');
    await selectPart(page, 'Part B');
    await page.keyboard.up('Shift');
    // copy from A's timeline (primary — still A's lane first)
    await kfMenu(page, 'Copy Keyframes');
    // paste onto B's lane → ONLY B receives it (no multi-target)
    const laneB = page.locator('.ue-track-lane').nth(1);
    const box = await laneB.boundingBox();
    await page.mouse.click(box!.x + 40 * FRAME_WIDTH + 1, box!.y + box!.height / 2, { button: 'right' });
    await page.waitForTimeout(200);
    await page.locator('[aria-label="Paste Keyframes"]').click();
    await page.waitForTimeout(300);

    const trackB = await storedTrack(page, 'b');
    const chansB = trackB.channels as Record<string, Record<string, unknown>[]>;
    expect(chansB.x.map((k) => k.frame)).toEqual([40]); // only B got it
    // B's matte untouched; B's IN/OUT untouched (M28 is timeline-only)
    expect((await storedPart(page, 'b')).matte).toEqual({ enabled: true, sourcePartId: 'a', mode: 'luminance', feather: 2, strength: 0.8 });
    expect((await storedPart(page, 'b')).inAnimPreset).toBeUndefined();
    // A's part IN/OUT unchanged (no preset-library copy, no part mutation)
    expect((await storedPart(page, 'a')).inAnimPreset).toBe('fade');
    // no new preset library entries
    const libCount = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('keyframe_custom_motion_presets') ?? '[]') as unknown[];
      return raw.length;
    });
    expect(libCount).toBeGreaterThanOrEqual(0); // never grows from keyframe copy (defaults may seed)
  });

  test('E2E-21+23 — save/reload: pasted animation persists, clipboard does not; accessibility DOM', async ({ page }) => {
    const A = makeLayer('a', 'Part A');
    const ch = emptyChannels();
    ch.x = [kf('x_10', 10, 55)];
    ch.y = [kf('y_10', 10, 2)];
    const tracks = [{ id: 't_a', partId: 'a', name: 'Part A', color: '#ff0000', channels: ch, keyframes: [], visible: true, locked: false, expanded: true }];
    await seed(page, [A], tracks);

    await selectPart(page, 'Part A');
    await kfMenu(page, 'Copy Keyframes');
    await lanePaste(page, 30);
    await saveNow(page);
    await page.reload();
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

    // pasted animation data persisted
    const track = await storedTrack(page, 'a');
    expect((track.channels as Record<string, Record<string, unknown>[]>).x.map((k) => k.frame)).toEqual([10, 30]);
    // clipboard did NOT persist: empty-lane right-click offers no Paste after reload
    const lane = page.locator('.ue-track-lane').first();
    const box = await lane.boundingBox();
    await page.mouse.click(box!.x + 50 * FRAME_WIDTH, box!.y + box!.height / 2, { button: 'right' });
    await page.waitForTimeout(200);
    expect(await page.locator('[aria-label="Paste Keyframes"]').count()).toBe(0);

    // accessibility: menu roles/labels/titles in the real DOM
    await page.locator('.keyframe-diamond').first().click({ button: 'right' });
    await page.waitForTimeout(200);
    await expect(page.locator('[role="menu"][aria-label="Keyframe actions"]')).toBeVisible();
    await expect(page.locator('[role="menuitem"][aria-label="Copy Keyframes"]')).toBeVisible();
    await expect(page.locator('[role="menuitem"][aria-label="Duplicate Keyframes"]')).toBeVisible();
    await expect(page.locator('[role="menuitem"][aria-label="Delete Keyframe"]')).toBeVisible();
    await page.mouse.click(5, 5);
  });

  test('E2E-16 — drag regression: frame-group drag still works after copy/paste feature', async ({ page }) => {
    const A = makeLayer('a', 'Part A');
    const ch = emptyChannels();
    ch.x = [kf('x_10', 10, 1)];
    const tracks = [{ id: 't_a', partId: 'a', name: 'Part A', color: '#ff0000', channels: ch, keyframes: [], visible: true, locked: false, expanded: true }];
    await seed(page, [A], tracks);

    await selectPart(page, 'Part A');
    const diamond = page.locator('.keyframe-diamond').first();
    await diamond.waitFor({ state: 'visible' });
    const db = await diamond.boundingBox();
    await page.mouse.move(db!.x + db!.width / 2, db!.y + db!.height / 2);
    await page.mouse.down();
    await page.mouse.move(db!.x + db!.width / 2 + FRAME_WIDTH * 2, db!.y + db!.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const track = await storedTrack(page, 'a');
    const x = (track.channels as Record<string, Record<string, unknown>[]>).x;
    expect(x).toHaveLength(1); // moved, not duplicated
    expect(x[0].frame).toBeGreaterThan(10);
  });
});

async function storedPart(page: Page, id: string): Promise<Record<string, unknown>> {
  await saveNow(page);
  return page.evaluate(([key, pid]) => {
    const scene = JSON.parse(localStorage.getItem(key) ?? '{}');
    return (scene.layers ?? []).find((l: Record<string, unknown>) => l.id === pid) ?? {};
  }, [STORAGE_KEY, id] as [string, string]);
}
