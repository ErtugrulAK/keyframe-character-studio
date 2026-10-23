/**
 * C3 — the authoring strip on narrow windows: at ≤ 1200 px the Align / Center /
 * Distribute and Rotate-flip / Arrange bands fold into two menus that run the
 * same commands (mouse and keyboard, availability kept); wider windows show the
 * bands exactly as before; no width from 900 px up scrolls the strip.
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

async function open(page: Page, width: number): Promise<void> {
  const layers = ['a', 'b', 'c'].map((id, index) => ({
    id, name: id.toUpperCase(), type: 'custom_rect', x: -200 + index * 150, y: index * 30, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: index + 1,
    fillColor: '#f97316', strokeColor: '#000', width: 80, height: 60,
  }));
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers,
    tracks: layers.map((layer) => ({ id: `track-${layer.id}`, partId: layer.id, name: layer.name, color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels() })),
  });
  await page.setViewportSize({ width, height: 800 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: scene });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

async function savedScene(page: Page): Promise<Record<string, any>> {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
}

const visibleBands = (page: Page) => page.getByRole('toolbar', { name: 'Authoring tools' }).getByRole('group').evaluateAll(
  (groups) => groups.filter((group) => (group as HTMLElement).offsetParent !== null).map((group) => group.getAttribute('aria-label')),
);

test('1440 and 1280: the wide bands, unchanged, and no strip scroll', async ({ page }) => {
  for (const width of [1440, 1280]) {
    await open(page, width);
    expect(await visibleBands(page)).toEqual([
      'Canvas tools', 'Create', 'Boolean operations', 'Layer group',
      'Align', 'Center', 'Distribute', 'Rotate and flip', 'Arrange', 'Crop', 'Crop to content', 'View controls',
    ]);
    const strip = await page.locator('.authoring-toolbar').evaluate((node) => node.scrollWidth - node.clientWidth);
    expect(strip, `strip scroll at ${width}`).toBeLessThanOrEqual(0);
  }
});

test('1024: two menus replace the arrange bands; every command runs from them by mouse and keyboard', async ({ page }) => {
  await open(page, 1024);
  expect(await visibleBands(page)).toEqual([
    'Canvas tools', 'Create', 'Boolean operations', 'Layer group', 'Align and arrange', 'Crop', 'Crop to content', 'View controls',
  ]);
  expect(await page.locator('.authoring-toolbar').evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(0);

  const alignMenu = page.getByRole('button', { name: 'Align and distribute' });
  const arrangeMenu = page.getByRole('button', { name: 'Arrange and rotate' });
  // Nothing selected: both menus are unavailable and say why.
  await expect(alignMenu).toBeDisabled();
  await expect(arrangeMenu).toBeDisabled();

  // One layer: arrange works, align needs two (listed, disabled, with its reason).
  await page.locator('.ue-track-row', { hasText: 'A' }).first().click();
  await expect(arrangeMenu).toBeEnabled();
  await arrangeMenu.click();
  const menu = page.getByRole('menu', { name: 'Arrange and rotate' });
  await expect(menu.getByRole('menuitem')).toHaveText(['Rotate counter-clockwise', 'Rotate clockwise', 'Flip horizontal', 'Flip vertical', 'Bring forward', 'Send backward']);
  await expect(menu.getByRole('menuitem', { name: 'Rotate counter-clockwise' })).toBeFocused();
  await menu.getByRole('menuitem', { name: 'Rotate clockwise' }).click();
  await expect(menu).toHaveCount(0);
  await expect(arrangeMenu).toBeFocused();
  let scene = await savedScene(page);
  expect(scene.layers.find((layer: any) => layer.id === 'a').rotation).toBe(90);

  // Keyboard: open with Enter, walk with arrows, run with Enter, Esc closes.
  await arrangeMenu.focus();
  await page.keyboard.press('Enter');
  await expect(menu.getByRole('menuitem', { name: 'Rotate counter-clockwise' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(menu.getByRole('menuitem', { name: 'Send backward' })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(menu.getByRole('menuitem', { name: 'Bring forward' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(arrangeMenu).toBeFocused();

  // Three layers: align and distribute run from the other menu.
  await page.locator('.tree-node[data-layer-id="a"]').click();
  await page.locator('.tree-node[data-layer-id="b"]').click({ modifiers: ['Control'] });
  await page.locator('.tree-node[data-layer-id="c"]').click({ modifiers: ['Control'] });
  await expect(alignMenu).toBeEnabled();
  await alignMenu.click();
  const align = page.getByRole('menu', { name: 'Align and distribute' });
  await expect(align.getByRole('menuitem')).toHaveCount(9);
  await align.getByRole('menuitem', { name: 'Align Top' }).click();
  scene = await savedScene(page);
  const tops = ['a', 'b', 'c'].map((id) => scene.layers.find((layer: any) => layer.id === id).y);
  expect(new Set(tops.map((y: number) => Math.round(y * 1000))).size).toBeLessThan(3);
});
