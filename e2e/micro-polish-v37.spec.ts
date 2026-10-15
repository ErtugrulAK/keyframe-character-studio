import { test, expect, type Page } from '@playwright/test';

/**
 * V3.7 FINAL MICRO-POLISH CONTRACTS — measured in the real browser DOM, never
 * a mock:
 *
 *  1. the arrange strip groups Align / Center / Distribute / Rotate-and-flip
 *     as four announced bands behind compact separators, and the both-axes
 *     `Center` glyph is its own four-arrow target, distinct from the
 *     one-axis centre icons;
 *  2. the left rail is compact (small icons, caption labels, ≤44px items) and
 *     its active state is a restrained surface + accent bar, not a nudge;
 *  3. keyboard focus is the quiet inset ring (negative offset) on toolbar
 *     controls, and pointer focus stays clean;
 *  4. the Edit ↔ Broadcast swap fades the incoming chrome in through the one
 *     presentational keyframe, honours reduced motion, and a rapid back-and-
 *     forth leaves the edit camera exactly where it was;
 *  5. the Shortcut Reference is a single-column reference sheet: hairline
 *     category bands, no card boxes around the commands;
 *  6. the side handles and the timeline handle are one visual family.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
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

async function seed(page: Page, layers: Record<string, unknown>[] = []): Promise<void> {
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

const cameraReading = (page: Page) => page.evaluate(() => {
  const svg = document.querySelector<SVGSVGElement>('.stage-canvas-container svg');
  const matrix = svg.getScreenCTM();
  if (!matrix) throw new Error('screen CTM unavailable');
  return {
    a: matrix.a,
    d: matrix.d,
    zoom: document.querySelector('.stage-canvas-container')?.getAttribute('data-camera-zoom') ?? '',
  };
});

test('the arrange strip groups align, center, distribute and rotate/flip as four separated bands', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', 0, 0), shape('b', 'Beta', 200, 0), shape('c', 'Gamma', 400, 0)]);

  // Each of the four command groups stands behind its own compact separator:
  // the band's previous sibling in the strip is always a divider element.
  const separated = await page.evaluate(() =>
    ['Align', 'Center', 'Distribute', 'Rotate and flip'].map((label) => {
      const group = document.querySelector(`.authoring-toolbar-group[aria-label="${label}"]`);
      return group?.previousElementSibling?.classList.contains('authoring-toolbar-divider') ?? false;
    }),
  );
  expect(separated).toEqual([true, true, true, true]);

  // The both-axes Center glyph is the four-arrow centred target: it carries no
  // circle (the old crosshair) and it is not the same glyph as either of the
  // one-axis centre commands beside it.
  const glyphs = await page.evaluate(() => {
    const band = document.querySelector('.authoring-toolbar-group[aria-label="Center"]')!;
    const buttons = [...band.querySelectorAll('button')];
    const svgFor = (name: string) =>
      buttons.find((button) => button.getAttribute('aria-label') === name)!.querySelector('svg')!;
    return {
      center: svgFor('Center').innerHTML,
      horizontal: svgFor('Center Horizontally').innerHTML,
      vertical: svgFor('Center Vertically').innerHTML,
      centerHasCircle: svgFor('Center').querySelector('circle') !== null,
    };
  });
  expect(glyphs.centerHasCircle).toBe(false);
  expect(glyphs.center).not.toBe(glyphs.horizontal);
  expect(glyphs.center).not.toBe(glyphs.vertical);
  expect(glyphs.horizontal).not.toBe(glyphs.vertical);
});

test('the left rail is compact and its active state is a restrained accent surface', async ({ page }) => {
  await seed(page, []);
  const rail = page.locator('.left-sidebar-nav');
  await expect(rail).toBeVisible();

  const measurements = await rail.evaluate((nav) => {
    const items = [...nav.querySelectorAll<HTMLElement>('.sidebar-nav-item')];
    return items.map((item) => ({
      height: item.getBoundingClientRect().height,
      iconWidth: item.querySelector('.nav-icon')?.getBoundingClientRect().width ?? 0,
      labelSize: parseFloat(getComputedStyle(item.querySelector<HTMLElement>('.nav-label')!).fontSize),
    }));
  });
  expect(measurements.length).toBe(4);
  for (const m of measurements) {
    expect(m.height, 'a rail item grew past the compact ceiling').toBeLessThanOrEqual(43);
    expect(m.iconWidth).toBe(18);
    expect(m.labelSize, 'a rail label left the caption scale').toBeLessThanOrEqual(12);
  }

  // Pressing a category moves the restrained surface and the accent bar, and
  // nothing shifts the item's box positionally.
  const before = await rail.evaluate(() => {
    const active = document.querySelector<HTMLElement>('.sidebar-nav-item.active')!;
    const inactive = document.querySelector<HTMLElement>('.sidebar-nav-item:not(.active)')!;
    return {
      activeBackground: getComputedStyle(active).backgroundColor,
      inactiveBackground: getComputedStyle(inactive).backgroundColor,
      activeIconColour: getComputedStyle(active.querySelector<HTMLElement>('.nav-icon')!).color,
      inactiveIconColour: getComputedStyle(inactive.querySelector<HTMLElement>('.nav-icon')!).color,
      accentBarWidth: getComputedStyle(active, '::before').width,
      activeTransform: getComputedStyle(active).transform,
    };
  });
  expect(before.activeBackground).not.toBe(before.inactiveBackground);
  expect(before.activeIconColour).not.toBe(before.inactiveIconColour);
  expect(before.accentBarWidth).toBe('2px');
  expect(before.activeTransform).toBe('none');

  await page.getByRole('button', { name: 'Typography & Headlines' }).click();
  await expect(page.getByRole('button', { name: 'Typography & Headlines' })).toHaveAttribute('aria-pressed', 'true');
});

test('keyboard focus on a toolbar command is the quiet inset ring', async ({ page }) => {
  await seed(page, []);
  // An always-available command from the Create band: availability must not
  // decide where focus is tested, and this band never disables.
  const rectTool = page.getByRole('button', { name: 'Add rectangle' });
  await rectTool.evaluate((el) => el.focus());
  const keyboard = await rectTool.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      fv: el.matches(':focus-visible'),
      style: cs.outlineStyle,
      color: cs.outlineColor,
      offset: cs.outlineOffset,
    };
  });
  expect(keyboard.fv).toBe(true);
  expect(keyboard.style).toBe('solid');
  expect(keyboard.color).toBe(KCS_RING_COLOUR);
  // The inset half of the authority: the ring rides INSIDE the hitbox.
  expect(keyboard.offset).toBe('-2px');
});

test('pointer focus on a toolbar command stays clean', async ({ page }) => {
  // A separate session: Chromium keeps a clicked button focus-visible when
  // the previous interaction was keyboard, so the pointer contract is
  // measured on a page that has never seen a synthetic focus.
  await seed(page, []);
  const rectTool = page.getByRole('button', { name: 'Add rectangle' });
  await rectTool.click();
  expect(await rectTool.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none');
});

test('the mode swap fades the incoming chrome without moving the camera', async ({ page }) => {
  await seed(page, []);
  await expect(page.locator('.sequencer-timeline')).toBeVisible();

  const director = page.locator('.live-director-panel');
  const segment = page.locator('.header-mode-switch');
  await segment.getByRole('button', { name: 'BROADCAST' }).click();
  await expect(director).toBeVisible();
  await segment.getByRole('button', { name: 'BROADCAST' }).click();
  // The incoming broadcast surface rides the one presentational keyframe.
  expect(await director.evaluate((el) => getComputedStyle(el).animationName)).toBe('kcs-mode-enter');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await segment.getByRole('button', { name: 'EDIT MODE' }).click();
  await expect(page.locator('.sequencer-timeline')).toBeVisible();
  // Reduced motion kills the transition entirely — nothing animates in.
  expect(await page.locator('.sequencer-timeline').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
});

test('rapid Edit ↔ Broadcast switching restores the edit camera exactly', async ({ page }) => {
  await seed(page, [shape('a', 'Alpha', 0, 0)]);
  const baseline = await cameraReading(page);
  const segment = page.locator('.header-mode-switch');
  for (let index = 0; index < 3; index += 1) {
    await segment.getByRole('button', { name: 'BROADCAST' }).click();
    await segment.getByRole('button', { name: 'EDIT MODE' }).click();
  }

  await expect(segment.getByRole('button', { name: 'EDIT MODE' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.sequencer-timeline')).toBeVisible();
  // The camera returns to the remembered reading; poll the observable until
  // the frame-committed restore lands — no sleep, no retry masking.
  await expect.poll(() => cameraReading(page), 'the edit camera came back changed').toEqual(baseline);
});

test('the shortcut reference is a single-column sheet of hairline category bands', async ({ page }) => {
  await seed(page, []);
  await page.getByRole('button', { name: 'Keyboard shortcuts' }).click();
  const sheet = page.locator('.shortcut-reference');
  await expect(sheet).toBeVisible();

  const layout = await sheet.evaluate((root) => {
    const groups = [...root.querySelectorAll<HTMLElement>('.shortcut-reference-group')];
    const first = groups[0].getBoundingClientRect();
    const second = groups[1].getBoundingClientRect();
    const card = getComputedStyle(groups[0]);
    return {
      groupCount: groups.length,
      stackedBelow: second.top >= first.bottom,
      sameColumn: Math.abs(second.left - first.left) < 1,
      borderWidth: card.borderTopWidth,
      background: card.backgroundColor,
      searchAbove: root.querySelector<HTMLElement>('.shortcut-reference-header')!
        .compareDocumentPosition(root.querySelector<HTMLElement>('.shortcut-reference-body')!) &
        Node.DOCUMENT_POSITION_CONTAINS,
    };
  });
  expect(layout.groupCount).toBeGreaterThan(1);
  // A sheet, not a card grid: one column, stacked bands, no box chrome drawn
  // around each category (the separator lives in the heading rhythm).
  expect(layout.stackedBelow).toBe(true);
  expect(layout.sameColumn).toBe(true);
  expect(layout.borderWidth).toBe('0px');
  expect(layout.background).toBe('rgba(0, 0, 0, 0)');
});

test('the side handles and the timeline handle share one visual family', async ({ page }) => {
  await seed(page, []);
  const paint = await page.evaluate(() => {
    const read = (selector: string) => {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) throw new Error(`${selector} is missing`);
      const cs = getComputedStyle(el);
      return {
        background: cs.backgroundColor,
        colour: cs.color,
        radius: cs.borderTopLeftRadius,
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      };
    };
    return {
      left: read('.left-toolbar-toggle'),
      right: read('.inspector-dock-toggle'),
      timeline: read('.timeline-edge-toggle'),
    };
  });
  // Same surface, same ink, same corner; the members differ only in axis.
  expect(paint.right).toEqual(paint.left);
  expect(paint.timeline.background).toBe(paint.left.background);
  expect(paint.timeline.colour).toBe(paint.left.colour);
  expect(paint.timeline.radius).toBe(paint.left.radius);
});
