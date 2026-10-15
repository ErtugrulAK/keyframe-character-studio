import { test, expect, type Page } from '@playwright/test';

/**
 * V3.6 UI POLISH CONTRACTS — the nine manual-QA findings, pinned in the browser.
 *
 * Each block measures the OBSERVABLE behaviour the user reported, from the real
 * DOM/computed style of the running editor (never a mock):
 *
 *  1. an armed draw tool owns the stage cursor (crosshair in, default out, with
 *     Escape returning it);
 *  2. the docked chrome resolves from the one width token pair;
 *  3. the GIF panel carries no duplicate close button and no paragraph copy —
 *     the format facts live in the tooltips of the controls they qualify;
 *  4. the align band is the documented command list in the documented order and
 *     the distribute band is the single gap command per axis;
 *  5. pointer focus never leaves the browser-style white ring on a select while
 *     keyboard focus keeps the KCS teal ring;
 *  6. the mode segment has no glow, no inline paint, and an unmistakable
 *     active/inactive pair;
 *  7. the shortcut reference is dense: single-line rows, keycaps right-aligned,
 *     the full detail one hover away;
 *  8. a project restored from this browser's autosave says so, and a reset
 *     takes the statement away.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
/** The KCS keyboard-focus token `--kcs-border-focus`. */
const KCS_RING_COLOUR = 'rgb(82, 226, 199)';

const channel = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

const shape = (id: string, name: string, x: number, y: number) => ({
  id, name, type: 'custom_rect', x, y, rotation: 0, scaleX: 1, scaleY: 1, zIndex: 1,
  opacity: 1, visible: true, fillColor: '#22d3ee', strokeColor: '#101218',
  fillEnabled: true, strokeEnabled: false,
});

async function seed(page: Page, layers: Record<string, unknown>[]): Promise<void> {
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1',
    width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers, tracks: layers.map((layer) => ({ partId: layer.id as string, channels: channel() })),
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    (payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value),
    { key: STORAGE_KEY, value: scene },
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

const stage = (page: Page) => page.locator('.stage-canvas-container');
const stageCursor = (page: Page) => stage(page).evaluate((el) => getComputedStyle(el).cursor);

test('an armed primitive owns the stage cursor with a crosshair and Escape gives it back', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', 0, 0)]);
  // The Elements band of the left rail arms the rectangle draw tool.
  await page.getByRole('button', { name: 'Vector Shapes & Graphic Elements' }).click();
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await expect(stage(page)).toHaveClass(/drawing-tool/);
  expect(await stageCursor(page)).toBe('crosshair');
  // The crosshair is on the drawing surface too, not just its frame.
  expect(await page.locator('.stage-canvas-container svg').first().evaluate((el) => getComputedStyle(el).cursor)).toBe('crosshair');

  await page.keyboard.press('Escape');
  await expect(stage(page)).not.toHaveClass(/drawing-tool/);
  expect(await stageCursor(page)).toBe('default');
});

test('the docked chrome resolves from the shared width tokens', async ({ page }) => {
  await seed(page, []);
  const [rail, drawer, inspector, handleLeft] = await page.evaluate(() => {
    const width = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().width;
    const handle = document.querySelector('.left-toolbar-toggle')!.getBoundingClientRect();
    return [width('.left-sidebar-nav'), width('.left-drawer-panel'), width('.motion-design-right-sidebar'), handle.left];
  });
  // One token contract: rail 56 + drawer 304, inspector 372, and the left dock
  // handle sits on the rail+drawer boundary (not on a stale 280 assumption).
  expect(Math.round(rail)).toBe(56);
  expect(Math.round(drawer)).toBe(304);
  expect(Math.round(inspector)).toBe(372);
  expect(Math.round(handleLeft + handleLeft % 1)).toBeCloseTo(56 + 304 - 10, 0);
});

test('the GIF panel closes from its X alone and states the format in tooltips', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', 0, 0)]);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Animated GIF', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Export animated GIF' });
  await expect(panel).toBeVisible();

  // No duplicate footer Close, no explanatory paragraphs, no details fold.
  await expect(panel.locator('.gif-export-actions button')).toHaveText(['Export GIF']);
  await expect(panel.locator('.gif-export-note')).toHaveCount(0);
  await expect(panel.locator('.gif-export-format')).toHaveCount(0);
  // The header X is the close affordance and it works.
  await expect(panel.locator('.gif-export-close')).toBeVisible();

  // The readout the user needs stays visible; the two format facts moved into
  // the tooltips of the controls they qualify.
  await expect(panel.locator('.gif-export-summary dd')).toHaveText(['60', '2.00 s', '960×540']);
  await expect(panel.locator('#gif-export-fps')).toHaveAttribute('title', /at least 20 ms per frame/);
  await expect(panel.getByRole('button', { name: 'Export GIF' })).toHaveAttribute('title', /one transparent colour and no partial alpha/);

  await panel.locator('.gif-export-close').click();
  await expect(panel).toHaveCount(0);
});

test('the align band carries the documented commands in the documented order', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', 0, 0), shape('b', 'Beta', 200, 0), shape('c', 'Gamma', 400, 0)]);
  const labels = (group: string) => page.locator(`.authoring-toolbar-group[aria-label="${group}"] button`).evaluateAll(
    (els) => els.map((el) => el.getAttribute('aria-label')),
  );
  expect(await labels('Align')).toEqual([
    'Align Left', 'Align Right', 'Align Top', 'Align Bottom',
    'Center', 'Center Horizontally', 'Center Vertically',
  ]);
  // One distribute command per axis; the centre-spacing duplicate is gone.
  expect(await labels('Distribute')).toEqual(['Distribute Horizontally', 'Distribute Vertically']);

  // Every command is reachable with a three-layer selection — no menu hop.
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  await page.locator('.actor-node', { hasText: 'Beta' }).first().click({ modifiers: ['Control'] });
  await page.locator('.actor-node', { hasText: 'Gamma' }).first().click({ modifiers: ['Control'] });
  for (const name of ['Center', 'Center Horizontally', 'Center Vertically', 'Distribute Horizontally', 'Distribute Vertically']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeEnabled();
  }
});

test('focus rings are KCS-styled for pointer and keyboard alike — never the white browser ring', async ({ page }) => {
  await seed(page, []);
  const fpsSelect = page.locator('.header-actions select').first();

  // Chromium settles the select's focus state over the frames it needs to
  // open the popup; poll the computed ring, do not sleep for it.
  await fpsSelect.click();
  const ringAfterMouse = () => fpsSelect.evaluate((el) => {
    const cs = getComputedStyle(el);
    return `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`;
  });
  await expect.poll(ringAfterMouse, 'pointer focus must land on the KCS ring').toBe(`solid 2px ${KCS_RING_COLOUR}`);

  await fpsSelect.focus();
  const afterKeyboard = await fpsSelect.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor, fv: el.matches(':focus-visible') };
  });
  expect(afterKeyboard.fv).toBe(true);
  expect(afterKeyboard.style).toBe('solid');
  expect(afterKeyboard.color).toBe(KCS_RING_COLOUR);

  // A text input keeps the pointer-clean half of the policy: no ring on click.
  const search = page.locator('.outliner-search-box input, .search-input-wrapper input').first();
  if (await search.count()) {
    await search.click();
    expect(await search.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none');
  }
});

test('the mode segment is quiet chrome with an unmistakable pressed half', async ({ page }) => {
  await seed(page, []);
  const switchBox = page.locator('.header-mode-switch');
  await expect(switchBox).toHaveCount(1);
  expect(await switchBox.getAttribute('style')).toBeNull();

  const paint = await switchBox.evaluate((el) => {
    const active = el.querySelector('.header-mode-button.active')!;
    const inactive = el.querySelector('.header-mode-button:not(.active)')!;
    return {
      activeShadow: getComputedStyle(active).textShadow,
      inactiveShadow: getComputedStyle(inactive).textShadow,
      activeColour: getComputedStyle(active).color,
      inactiveColour: getComputedStyle(inactive).color,
      buttonInlineStyles: [...el.querySelectorAll('button')].map((b) => b.getAttribute('style')),
    };
  });
  // No glow on either half, pressed and unpressed read differently, and the
  // inline paint that used to defeat the theme is gone.
  expect(paint.activeShadow).toBe('none');
  expect(paint.inactiveShadow).toBe('none');
  expect(paint.activeColour).not.toBe(paint.inactiveColour);
  expect(paint.buttonInlineStyles).toEqual([null, null]);

  // Pressing the other half moves both the visual state and the announced state.
  await page.getByRole('button', { name: 'BROADCAST' }).click();
  await expect(page.getByRole('button', { name: 'BROADCAST' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'EDIT MODE' })).toHaveAttribute('aria-pressed', 'false');
  await expect(switchBox).toHaveClass(/is-broadcast/);
});

test('the shortcut reference is one dense row per command with the detail one hover away', async ({ page }) => {
  await seed(page, []);
  await page.getByRole('button', { name: 'Keyboard shortcuts' }).click();
  const rows = page.locator('.shortcut-reference-row');
  await expect(rows.first()).toBeVisible();

  const measurements = await rows.evaluateAll((els) => els.map((el) => {
    const name = el.querySelector('.shortcut-reference-name')!;
    return {
      height: el.getBoundingClientRect().height,
      nameWraps: Math.abs(name.getBoundingClientRect().height - parseFloat(getComputedStyle(name).lineHeight)) > 1,
      nameSingle: getComputedStyle(name).whiteSpace === 'nowrap',
      tooltip: el.getAttribute('title'),
    };
  }));
  expect(measurements.length).toBeGreaterThan(20);
  // One text line per row: the name never wraps, and a stacked detail would
  // push the row past the dense ceiling all by itself.
  for (const m of measurements) {
    expect(m.nameWraps, 'a command name wrapped').toBe(false);
    expect(m.nameSingle).toBe(true);
    expect(m.height, `row measured ${m.height}px — too tall for the dense grid`).toBeLessThanOrEqual(34);
  }
  // The full sentence is one hover away on every row.
  expect(measurements.every((m) => typeof m.tooltip === 'string' && m.tooltip.length > 0)).toBe(true);
});

test('a restored project says where it came from, and a reset stops saying it', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', 0, 0)]);
  const chip = page.locator('.restored-from-local-badge');
  await expect(chip).toBeVisible();
  await expect(chip).toContainText("Restored from this browser's autosave");

  // A reset replaces the document with the defaults, so the provenance
  // statement goes away with the restored one.
  await page.getByRole('button', { name: 'Reset Canvas Project' }).click();
  await expect(chip).toHaveCount(0);
});
