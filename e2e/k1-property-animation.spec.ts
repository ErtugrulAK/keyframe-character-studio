/**
 * K1 (contract D2) — the stopwatch, end to end: animate a property at the
 * playhead, stop with confirmation, and prove what the user sees at every
 * step — the lane key count, the dialog word, the static value that survives
 * disarm (read from the autosave bytes the app itself restores from),
 * one-undo atomicity and persistence after reload.
 */
import { expect, test, type Page } from '@playwright/test';
import { openDetailsTab } from './fixtures/inspectorTabs';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const FRAME_WIDTH = 18;

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

async function seed(page: Page): Promise<void> {
  const layer = {
    id: 'alpha', name: 'Alpha', type: 'custom_rect', x: 100, y: 40, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218', fillEnabled: true, strokeEnabled: false, width: 160, height: 120,
  };
  const track = {
    id: 'track-alpha', partId: 'alpha', name: 'Alpha', color: '#22d3ee', visible: true, locked: false, expanded: true,
    channels: {
      ...emptyChannels(),
      x: [
        { id: 'kx0', frame: 0, value: 100, easing: 'linear' },
        { id: 'kx30', frame: 30, value: 700, easing: 'linear' },
      ],
    },
  };
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [layer], tracks: [track],
  });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  // One-time injection (NOT addInitScript: it re-seeds every reload and
  // would defeat the persistence check at the end of test 1).
  await page.evaluate((payload: { key: string; value: string }) => {
    localStorage.clear();
    localStorage.setItem(payload.key, payload.value);
  }, { key: STORAGE_KEY, value: scene });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  // Adopt the seeded bytes as the editor's own saved baseline: until the boot
  // document is settled, the CAS-protected manual save refuses (SAFE-01/02),
  // and m23's own save-gate shows this is the supported adoption path.
  await flushSave(page);
  await page.locator('.ue-track-row', { hasText: 'Alpha' }).first().click();
  await page.locator('.ue-expand-btn').first().click();
}

async function setFrame(page: Page, frame: number): Promise<void> {
  const grid = page.locator('.timeline-grid-container');
  const gridBox = await grid.boundingBox();
  const rulerBox = await page.locator('.time-ruler').boundingBox();
  expect(gridBox).not.toBeNull();
  expect(rulerBox).not.toBeNull();
  const scrollLeft = await grid.evaluate((node) => node.scrollLeft);
  await page.mouse.click(gridBox!.x - scrollLeft + frame * FRAME_WIDTH + 4, rulerBox!.y + rulerBox!.height / 2);
  await expect(page.locator('.playhead-frame-label')).toHaveText(String(frame));
}

/** Deterministic flush: click the header badge and wait for its timestamp. */
async function flushSave(page: Page): Promise<void> {
  const before = await page.locator('.autosave-status-badge').getAttribute('data-last-saved-at');
  await page.locator('.autosave-status-badge').click();
  await expect
    .poll(async () => Number((await page.locator('.autosave-status-badge').getAttribute('data-last-saved-at')) || '0'), { timeout: 10_000 })
    .toBeGreaterThan(Number(before || '0'));
}

/** The persisted authored value read from the autosave bytes the app restores from. */
async function persistedLayerValue(page: Page, field: 'x' | 'y'): Promise<number> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem('SEQUENCER_STUDIO_PRO_V5');
    const scene = raw ? JSON.parse(raw) : null;
    const layer = scene?.layers?.find((l: { id: string }) => l.id === 'alpha');
    return layer ? Number(layer[key]) : NaN;
  }, field);
}

const stopwatchX = (page: Page) => page.locator('button.ue-channel-stopwatch[data-property-channel="x"]');
const stopwatchY = (page: Page) => page.locator('button.ue-channel-stopwatch[data-property-channel="y"]');

async function openAnimationDataCard(page: Page): Promise<void> {
  await openDetailsTab(page, 'Layer');
  const card = page.getByRole('button', { name: /(?:Expand|Collapse) ANIMATION DATA/ });
  await expect(card).toBeVisible();
  if (await card.getAttribute('aria-expanded') === 'false') await card.click();
}

test.describe('K1 — stopwatch journey (D2)', () => {
  test('animated at 15 -> confirm stop -> static evaluated value, one undo, persistence', async ({ page }) => {
    await seed(page);

    // The seeded X animation has a key exactly at the playhead: keyed.
    await expect(stopwatchX(page)).toHaveAttribute('data-animation-state', 'keyed');
    await expect(stopwatchX(page)).toHaveAttribute('aria-pressed', 'true');

    // Move to frame 15: animated, no key here.
    await setFrame(page, 15);
    await expect(stopwatchX(page)).toHaveAttribute('data-animation-state', 'animated');

    // Stop animating: the dialog names the property BEFORE anything mutates.
    await stopwatchX(page).click();
    const dialog = page.locator('.confirmation-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Location X');
    await expect(dialog).toContainText('keyframe');
    await expect(page.locator('.keyframe-diamond')).toHaveCount(2);

    // Cancel: zero mutation.
    await dialog.locator('.confirmation-dialog-cancel').click();
    await expect(page.locator('.keyframe-diamond')).toHaveCount(2);
    await expect(stopwatchX(page)).toHaveAttribute('data-animation-state', 'animated');

    // Confirm: keys gone; the evaluated value at 15 (linear 100→700 = 400) is
    // the static Location X now — read from the persisted document itself.
    await stopwatchX(page).click();
    await page.locator('.confirmation-dialog-confirm').click();
    await expect(page.locator('.keyframe-diamond')).toHaveCount(0);
    await expect(stopwatchX(page)).toHaveAttribute('data-animation-state', 'off');
    await flushSave(page);
    await expect.poll(() => persistedLayerValue(page, 'x')).toBe(400);

    // One undo restores BOTH the keys and the original static 100.
    await page.keyboard.press('Control+z');
    await expect(page.locator('.keyframe-diamond')).toHaveCount(2);
    await flushSave(page);
    await expect.poll(() => persistedLayerValue(page, 'x')).toBe(100);

    // Confirm again and reload: the decision survives the session.
    await stopwatchX(page).click();
    await page.locator('.confirmation-dialog-confirm').click();
    await expect(page.locator('.keyframe-diamond')).toHaveCount(0);
    await flushSave(page);
    await page.reload();
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
    await page.locator('.ue-expand-btn').first().click();
    await expect(stopwatchX(page)).toHaveAttribute('data-animation-state', 'off');
    await expect.poll(() => persistedLayerValue(page, 'x')).toBe(400);
  });

  test('arming an unanimated property keys it at the playhead with its current value', async ({ page }) => {
    await seed(page);
    await setFrame(page, 20);

    // Y is not animated: the stopwatch offers "Animate".
    await expect(stopwatchY(page)).toHaveAttribute('data-animation-state', 'off');
    await expect(stopwatchY(page)).toHaveAttribute('aria-pressed', 'false');

    await stopwatchY(page).click();
    await expect(stopwatchY(page)).toHaveAttribute('data-animation-state', 'keyed');
    // The Y key joins the aggregate frame set {0, 20, 30}: three layer-row
    // diamonds, and the authored Y (40) is untouched — arming records the
    // current value, never rewrites it.
    await expect(page.locator('.keyframe-diamond')).toHaveCount(3);
    await expect(stopwatchY(page)).toHaveAttribute('title', /Stop animating Location Y of Alpha \(1 keyframe in this sequence\)/);
    await flushSave(page);
    await expect.poll(() => persistedLayerValue(page, 'y')).toBe(40);
  });

  test('the inspector Clear Animation button asks first and cancels clean (D2)', async ({ page }) => {
    await seed(page);
    await openAnimationDataCard(page);
    await expect(page.locator('.keyframe-diamond')).toHaveCount(2);
    await page.getByRole('button', { name: 'Clear Animation', exact: true }).click();
    const dialog = page.locator('.confirmation-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('2 authored keyframes');
    await dialog.locator('.confirmation-dialog-cancel').click();
    await expect(page.locator('.keyframe-diamond')).toHaveCount(2);
    await page.getByRole('button', { name: 'Clear Animation', exact: true }).click();
    await page.locator('.confirmation-dialog-confirm').click();
    await expect(page.locator('.keyframe-diamond')).toHaveCount(0);
  });
});
