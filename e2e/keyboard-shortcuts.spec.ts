import { test, expect, type Page } from '@playwright/test';

/**
 * The shortcut system, driven in a real browser.
 *
 * Everything here goes through the ONE shortcut table: the reference dialog
 * renders it, the commands it resolves run the same authorities as the toolbar
 * and the Inspector, and the three guards hold — a blocking dialog owns the
 * keyboard, a text field owns the keyboard, and the timeline owns Delete while
 * it holds focus (so a layer is never deleted from there by accident).
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

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
  await expect(page.locator('[data-part-id="alpha"]')).toHaveCount(1);
}

const rowCount = (page: Page) => page.locator('.actor-node').count();
const selectedRowCount = (page: Page) => page.locator('.actor-node.selected').count();
/** The layers the stage paints: the live document, before any autosave. */
const paintedCount = (page: Page) => page.locator('.stage-svg [data-part-id]').count();

const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

test('the reference lists the bindings for this platform and closes on Escape', async ({ page }) => {
  await seed(page);

  // The header control is one way in.
  // (Rows are counted from the table itself: the reference is the keymap.)
  await page.getByRole('button', { name: 'Keyboard shortcuts' }).click();
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(dialog).toBeVisible();

  // The keys are the platform's own labels, and the categories are the table's.
  const expected = modifier === 'Meta' ? '⌘G' : 'Ctrl+G';
  await expect(dialog).toContainText(expected);
  for (const category of ['Tools', 'Create', 'Selection and grouping', 'Edit', 'Timeline', 'View and playback', 'Help']) {
    await expect(dialog.getByRole('region', { name: category })).toBeVisible();
  }
  // Every command in the table is on screen — count the rows rather than spot-check.
  await expect(dialog.locator('.shortcut-reference-row')).toHaveCount(24);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  // The `?` key opens the same dialog, and it is a blocking dialog: the editor's
  // commands stay inert while it is up.
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await page.keyboard.press('?');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Delete');
  await expect.poll(() => rowCount(page)).toBe(2);
  await expect.poll(() => paintedCount(page)).toBe(2);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('select all, group and ungroup run from the keyboard', async ({ page }) => {
  await seed(page);
  expect(await paintedCount(page)).toBe(2);

  await page.keyboard.press(`${modifier}+a`);
  await expect.poll(() => selectedRowCount(page)).toBe(2);

  await page.keyboard.press(`${modifier}+g`);
  await expect(page.locator('.actor-node[data-group-container="true"]')).toHaveCount(1);
  await expect.poll(() => rowCount(page)).toBe(3);

  await page.keyboard.press(`${modifier}+Shift+g`);
  await expect(page.locator('.actor-node[data-group-container="true"]')).toHaveCount(0);
  await expect.poll(() => rowCount(page)).toBe(2);
});

test('creation keys arm the same flow the toolbar does, and Escape cancels it', async ({ page }) => {
  await seed(page);
  const leftToolbar = page.locator('.left-toolbar-container');

  await expect(leftToolbar).not.toHaveClass(/tool-capturing/);

  await page.keyboard.press('r');
  await expect(leftToolbar).toHaveClass(/tool-capturing/);

  await page.keyboard.press('Escape');
  await expect(leftToolbar).not.toHaveClass(/tool-capturing/);

  // `T` adds a text layer immediately, exactly like the toolbar's text button.
  await page.keyboard.press('t');
  await expect(page.locator('.actor-node', { hasText: 'Text' })).toHaveCount(1);
  await expect.poll(() => rowCount(page)).toBe(3);
});

test('a text field owns the keyboard, so no command fires while typing', async ({ page }) => {
  await seed(page);
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await expect.poll(() => selectedRowCount(page)).toBe(1);

  // The transform card is the Inspector's own field surface (expanded first,
  // exactly as the other transform specs do).
  await page.getByRole('button', { name: 'Expand TRANSFORM', exact: true }).click();
  const positionX = page.locator('input[aria-label="Position X"]');
  await positionX.click();
  await expect(positionX).toBeFocused();

  // A tool key, a creation key and a command key are all typing, not commands.
  await page.keyboard.press('r');
  await page.keyboard.press('t');
  await page.keyboard.press(`${modifier}+a`);

  await expect(page.locator('.left-toolbar-container')).not.toHaveClass(/tool-capturing/);
  await expect.poll(() => rowCount(page)).toBe(2);
  await expect.poll(() => selectedRowCount(page)).toBe(1);
});

test('Delete from the timeline removes keyframes, never a layer', async ({ page }) => {
  await seed(page);
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await expect.poll(() => selectedRowCount(page)).toBe(1);

  // Focus a timeline control: the timeline is now the surface that owns Delete.
  await page.locator('.sequencer-timeline button').first().focus();
  await page.keyboard.press('Delete');

  // The layer is untouched (and so is the document).
  await expect.poll(() => rowCount(page)).toBe(2);
  await expect.poll(() => paintedCount(page)).toBe(2);

  // Outside the timeline the ordinary chain still deletes the selected layer.
  // Blurring is the explicit "the timeline no longer owns the keyboard" step.
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Delete');
  await expect.poll(() => rowCount(page)).toBe(1);
  await expect.poll(() => paintedCount(page)).toBe(1);
});
