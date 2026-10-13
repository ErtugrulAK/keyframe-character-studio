import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * Manual QA Round 4 — R4-05: KEYFRAME NAVIGATION IS SCOPED.
 *
 * Observed: only the layer row carried [◀][+][▶]. Expected: every expanded
 * property row carries its own pair, scoped to THAT property's keys — resolved
 * from the same canonical channel projection the lane diamonds are painted from,
 * so an arrow is enabled only when the property really has a key on that side and
 * a jump can never land on a frame the property does not animate. The policy is
 * the per-layer one: nothing on a side disables that side, and navigation never
 * wraps.
 *
 * Runs the real editor DOM (dev server + localStorage seed).
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
/** The panned grid's px-per-frame at its default zoom, mirrored from `useTimeline`. */
const FRAME_WIDTH = 18;

const channel = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const layer = (id: string, name: string, x: number, y: number) => ({
  id, name, type: 'custom_rect', x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218',
  fillEnabled: true, strokeEnabled: false, width: 160, height: 120,
});

async function seed(page: Page): Promise<void> {
  const layers = [layer('alpha', 'Alpha', -120, -60), layer('beta', 'Beta', 140, 90)];
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1',
    width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers, tracks: layers.map((entry) => ({ partId: entry.id, channels: channel() })),
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    (payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value),
    { key: STORAGE_KEY, value: scene },
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
}

/**
 * R4-05 — every property row carries the layer row's own [◀][+][▶] navigation,
 * scoped to THAT property's keys: an arrow is enabled only when this property
 * has a key on that side, so a jump can never land on a frame the property does
 * not animate (a sibling channel's key never arms it), and it never wraps.
 */
test('R4-05 — property rows navigate their own keyframes only', async ({ page }) => {
  await seed(page);
  await page.locator('.ue-track-row').first().locator('.ue-expand-btn').click();

  const xRow = page.locator('.ue-channel-row[data-property-channel="x"]');
  const opacityRow = page.locator('.ue-channel-row[data-property-channel="opacity"]');
  await expect(xRow).toBeVisible();
  await expect(opacityRow).toBeVisible();

  const jumpTo = async (offsetFromOrigin: number) => {
    await page.locator('.time-ruler').click({ position: { x: offsetFromOrigin, y: 10 } });
  };
  const playhead = () => page.locator('.playhead-line').getAttribute('data-frame');

  // Author two X keys (frames 10 and 40) and one Opacity key (frame 50).
  await jumpTo(10 * FRAME_WIDTH);
  await xRow.getByRole('button', { name: 'Add Location X keyframe' }).click();
  await jumpTo(40 * FRAME_WIDTH);
  await xRow.getByRole('button', { name: 'Add Location X keyframe' }).click();
  await jumpTo(50 * FRAME_WIDTH);
  await opacityRow.getByRole('button', { name: 'Add Opacity keyframe' }).click();

  const previous = (row: Locator, label: string) => row.getByRole('button', { name: new RegExp(`^Previous ${label} keyframe`) });
  const next = (row: Locator, label: string) => row.getByRole('button', { name: new RegExp(`^Next ${label} keyframe`) });

  // Between the X keys: both of its own directions are reachable.
  await jumpTo(20 * FRAME_WIDTH);
  await expect(previous(xRow, 'Location X')).toBeEnabled();
  await expect(next(xRow, 'Location X')).toBeEnabled();
  // Opacity has a single key AHEAD, so only that direction is offered.
  await expect(previous(opacityRow, 'Opacity')).toBeDisabled();
  await expect(next(opacityRow, 'Opacity')).toBeEnabled();

  await next(xRow, 'Location X').click();
  expect(await playhead()).toBe('40');
  // Standing on the last X key: this property owns nothing later, even though
  // the LAYER does (its opacity key sits at frame 50).
  await expect(next(xRow, 'Location X')).toBeDisabled();
  await expect(previous(xRow, 'Location X')).toBeEnabled();

  await previous(xRow, 'Location X').click();
  expect(await playhead()).toBe('10');
  // The first X key has nothing before it: the navigation never wraps.
  await expect(previous(xRow, 'Location X')).toBeDisabled();
  await expect(next(xRow, 'Location X')).toBeEnabled();

  // The layer row's own pair still sees every channel of the layer.
  const layerRow = page.locator('.ue-track-row').first();
  await jumpTo(20 * FRAME_WIDTH);
  await expect(layerRow.getByRole('button', { name: /^Previous keyframe of Alpha/ })).toBeEnabled();
  await expect(layerRow.getByRole('button', { name: /^Next keyframe of Alpha/ })).toBeEnabled();
});
