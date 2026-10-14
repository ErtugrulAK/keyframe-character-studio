import { test, expect, type Page } from '@playwright/test';

/**
 * R5-04 / R5-06 / R5-07 — the timeline's keyframe controls, in a real browser.
 *
 * R5-04: a keyframe selected with the MOUSE reads as the FILLED diamond and
 * nothing else — no extra square/ring drawn around the key's hit target — while
 * KEYBOARD focus stays visible through `:focus-visible`.
 *
 * R5-06: an endpoint arrow with nothing on its side is simply a disabled, greyed
 * control: it keeps `disabled` + its "(none)" name, and it never paints the
 * not-allowed/forbidden cursor over the timeline.
 *
 * R5-07: a property row's action strip is the NEUTRAL `[◀][+][▶]` trio — a plain
 * plus, not a coloured keyframe glyph — and the channel colour stays where the
 * keys are: the lane diamonds and the connector.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

/** The channel colour of Position X, mirrored from `timelineConstants.ts`. */
const X_CHANNEL_COLOR = 'rgb(239, 68, 68)';

async function seed(page: Page): Promise<void> {
  const layer = { id: 'alpha', name: 'Alpha', type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: '#101218', fillEnabled: true, strokeEnabled: false, width: 160, height: 120 };
  const track = {
    id: 'track-alpha', partId: 'alpha', name: 'Alpha', color: '#22d3ee', visible: true, locked: false, expanded: true,
    channels: {
      ...emptyChannels(),
      // Two keys for the layer's own pair: a previous AND a next frame exist in
      // the middle of the sequence, so the pair can be checked both ways.
      x: [
        { id: 'kx1', frame: 10, value: 0, easing: 'linear' },
        { id: 'kx2', frame: 30, value: 100, easing: 'linear' },
      ],
    },
  };
  const scene = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers: [layer],
    tracks: [track],
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript((payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value), { key: STORAGE_KEY, value: scene });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.locator('.actor-node', { hasText: 'Alpha' }).first().click();
  // The property tree (and its lanes) must be on screen: expand the layer row.
  await page.locator('.ue-expand-btn').first().click();
  await expect(page.locator('.ue-channel-lanes').first()).toBeVisible();
  await expect(page.locator('.keyframe-diamond').first()).toBeVisible();
}

test('R5-04 — a mouse-selected keyframe is the filled diamond, with no extra square', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  const diamondState = (selector: string) => page.evaluate((sel) => {
    const node = document.querySelector(sel) as HTMLElement;
    const glyph = node.querySelector('.diamond-glyph') as HTMLElement;
    const cs = getComputedStyle(node);
    const glyphStyle = getComputedStyle(glyph);
    return {
      selected: node.classList.contains('selected'),
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      boxShadow: cs.boxShadow,
      glyphBackground: glyphStyle.backgroundColor,
      focusVisible: node.matches(':focus-visible'),
    };
  }, selector);

  const laneDiamond = page.locator('.keyframe-diamond').first();
  const beforeSelect = await diamondState('.keyframe-diamond');
  expect(beforeSelect.selected).toBe(false);
  // Unselected, the key stays a hollow outline in its channel colour.
  expect(beforeSelect.glyphBackground).toBe('rgba(0, 0, 0, 0)');

  // A real pointer selection.
  await laneDiamond.click();
  // The glyph's fill is transitioned (0.12s), so let the paint settle.
  await expect.poll(async () => (await diamondState('.keyframe-diamond')).glyphBackground).not.toBe('rgba(0, 0, 0, 0)');
  const afterClick = await diamondState('.keyframe-diamond');
  expect(afterClick.selected).toBe(true);
  // The selection reads from the FILL: the glyph takes the channel colour...
  expect(afterClick.glyphBackground).not.toBe('rgba(0, 0, 0, 0)');
  // ...and the key paints no box of its own: no ring, no square, no outline.
  expect(afterClick.boxShadow, 'a selected keyframe still paints a square around its hit target').toBe('none');
  expect(afterClick.outlineStyle, 'a mouse selection painted an outline').toBe('none');
  expect(afterClick.focusVisible).toBe(false);

  // Keyboard focus keeps its own visible ring: reach the key by Tab, the way a
  // keyboard user does, and read the ring the focused key paints.
  let reachedByTab = false;
  for (let press = 0; press < 80 && !reachedByTab; press += 1) {
    await page.keyboard.press('Tab');
    reachedByTab = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.classList.contains('keyframe-diamond') === true);
  }
  expect(reachedByTab, 'Tab never reached a keyframe diamond').toBe(true);
  const keyboardFocus = await page.evaluate(() => {
    const node = document.activeElement as HTMLElement;
    const cs = getComputedStyle(node);
    return {
      focusVisible: node.matches(':focus-visible'),
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      role: node.getAttribute('role'),
      tabIndex: node.getAttribute('tabindex'),
      pressed: node.getAttribute('aria-pressed'),
      label: node.getAttribute('aria-label'),
    };
  });
  expect(keyboardFocus.focusVisible, 'a focused keyframe must stay focus-visible for the keyboard').toBe(true);
  expect(keyboardFocus.outlineStyle).not.toBe('none');
  expect(parseFloat(keyboardFocus.outlineWidth)).toBeGreaterThanOrEqual(2);
  expect(keyboardFocus.role).toBe('button');
  expect(keyboardFocus.tabIndex).toBe('0');
  expect(['true', 'false']).toContain(keyboardFocus.pressed);
  expect(keyboardFocus.label, 'the diamond lost its accessible name').toContain('Keyframe at frame');

  // The property lane's diamonds follow the same rule.
  const propertyDiamond = page.locator('.ue-prop-diamond').first();
  await expect(propertyDiamond).toBeVisible();
  await propertyDiamond.click();
  await expect.poll(async () => (await diamondState('.ue-prop-diamond')).glyphBackground).not.toBe('rgba(0, 0, 0, 0)');
  const propertyState = await diamondState('.ue-prop-diamond');
  expect(propertyState.selected).toBe(true);
  expect(propertyState.boxShadow, 'a selected property keyframe still paints a square around its hit target').toBe('none');
  expect(propertyState.glyphBackground).not.toBe('rgba(0, 0, 0, 0)');
});

test('R5-06 — a disabled endpoint arrow is greyed, never a forbidden cursor', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  // Frame 0: nothing before it, frame 10 and 30 ahead of it.
  const pair = await page.evaluate(() => {
    const read = (label: string) => {
      const node = document.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement;
      const cs = getComputedStyle(node);
      return { cursor: cs.cursor, opacity: cs.opacity, disabled: node.disabled, name: node.getAttribute('aria-label') };
    };
    return {
      previous: read('Previous keyframe of Alpha (none)'),
      next: read('Next keyframe of Alpha, frame 10'),
    };
  });

  expect(pair.previous.disabled).toBe(true);
  expect(pair.previous.cursor, 'a disabled keyframe arrow paints the forbidden cursor').not.toBe('not-allowed');
  expect(pair.previous.cursor).toBe('default');
  expect(parseFloat(pair.previous.opacity), 'a disabled arrow must read as greyed out').toBeLessThan(1);
  expect(pair.previous.name).toContain('(none)');

  // Enabled controls in the same strip keep their normal pointer affordance.
  expect(pair.next.disabled).toBe(false);
  expect(pair.next.cursor).not.toBe('not-allowed');
  expect(parseFloat(pair.next.opacity)).toBe(1);

  // At the last key there is nothing after it: the pair flips.
  await page.locator('.keyframe-diamond').nth(1).click();
  const atLastKey = await page.evaluate(() => {
    const node = document.querySelector('[aria-label="Next keyframe of Alpha (none)"]') as HTMLButtonElement;
    const cs = getComputedStyle(node);
    return { cursor: cs.cursor, disabled: node.disabled };
  });
  expect(atLastKey.disabled).toBe(true);
  expect(atLastKey.cursor).toBe('default');
});

test('R5-07 — the property rows use one neutral [◀][+][▶] strip', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  const strip = await page.evaluate(() => {
    const row = document.querySelector('[data-property-channel="x"]') as HTMLElement;
    const controls = row.querySelector('.ue-channel-controls') as HTMLElement;
    const buttons = Array.from(controls.querySelectorAll('button'));
    const colour = (node: Element) => getComputedStyle(node).color;
    const addButton = row.querySelector('.track-add-kf-btn') as HTMLElement;
    const lane = document.querySelector('.ue-channel-lane .ue-prop-diamond') as HTMLElement;
    return {
      buttonCount: buttons.length,
      cursors: buttons.map((button) => getComputedStyle(button).cursor),
      arrowColours: Array.from(row.querySelectorAll('.track-icon-btn')).map((node) => colour(node)),
      addColour: colour(addButton),
      addGlyph: addButton.querySelector('svg')?.getAttribute('class') ?? null,
      addGlyphStroke: addButton.querySelector('svg')?.getAttribute('stroke') ?? null,
      colouredTicks: row.querySelectorAll('.ue-channel-color-bar').length,
      labelColour: colour(row.querySelector('.ue-channel-label') as Element),
      laneDiamondColour: lane ? getComputedStyle(lane).color : null,
      addTitle: addButton.getAttribute('title'),
      addName: addButton.getAttribute('aria-label'),
    };
  });

  // The trio, in order: previous, add, next — as bare icon buttons.
  expect(strip.buttonCount).toBe(3);
  expect(strip.addGlyph).toContain('lucide-plus');
  expect(strip.addGlyph, 'the add action is still a coloured keyframe glyph').not.toContain('diamond');
  expect(strip.addGlyphStroke, 'the plus must inherit the strip colour instead of carrying its own').toBe('currentColor');

  // One neutral tone for the whole strip: the add action is not tinted by the
  // channel colour and the row carries no coloured tick.
  expect(strip.addColour).toBe(strip.arrowColours[0]);
  expect(strip.addColour).toBe(strip.arrowColours[1]);
  expect(strip.addColour, 'the add action still paints the channel colour').not.toBe(X_CHANNEL_COLOR);
  expect(strip.colouredTicks).toBe(0);

  // The channel colour still lives where the keys are: the lane diamond.
  expect(strip.laneDiamondColour).toBe(X_CHANNEL_COLOR);
  expect(strip.addTitle).toBe('Add Location X keyframe');
  expect(strip.addName).toBe('Add Location X keyframe');

  // Row/lane alignment is untouched — the tree row and its lane share one band.
  const band = await page.evaluate(() => {
    const row = document.querySelector('[data-property-channel="x"]') as HTMLElement;
    const lane = document.querySelectorAll('.ue-channel-lane')[0] as HTMLElement;
    const r = row.getBoundingClientRect();
    const l = lane.getBoundingClientRect();
    return { rowTop: r.top, rowHeight: r.height, laneTop: l.top, laneHeight: l.height };
  });
  expect(Math.abs(band.rowTop - band.laneTop)).toBeLessThanOrEqual(1);
  expect(Math.abs(band.rowHeight - band.laneHeight)).toBeLessThanOrEqual(1);
});
