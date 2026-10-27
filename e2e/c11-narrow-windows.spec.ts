/**
 * C11 #3 — phones, tablets and a resized or half-screen browser: nothing in
 * the editor chrome may be cut off, pushed past the window edge or painted
 * over another control, and the docks may never squeeze the stage to nothing.
 *
 * Measured before the fix (390×844): the stage was 0 px wide with both docks
 * open, the mode switch painted over the template tabs, Crop and View sat past
 * the right edge, and the timeline's presets ran under the transport buttons.
 */
import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

/**
 * Every header, authoring-strip and timeline-header control, plus the dock
 * handles: off the window, clipped by a scrolling/clipping ancestor, or
 * overlapping another control. Empty means the chrome fits.
 */
const chromeProblems = (page: Page) => page.evaluate(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const controls = [...document.querySelectorAll<HTMLElement>(
    '.header-bar button, .header-bar select, .authoring-toolbar button, .timeline-header button, .timeline-header input, .sidebar-handle',
  )].filter((element) => {
    const box = element.getBoundingClientRect();
    return getComputedStyle(element).visibility !== 'hidden' && box.width > 1 && box.height > 1;
  });
  const name = (element: HTMLElement) => (element.getAttribute('aria-label') || element.title || element.textContent || element.tagName).trim().slice(0, 40);
  const problems: string[] = [];
  for (const element of controls) {
    const box = element.getBoundingClientRect();
    if (box.left < -0.5 || box.right > vw + 0.5 || box.bottom > vh + 0.5) problems.push(`off-window: ${name(element)}`);
    for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      if (getComputedStyle(parent).overflowX === 'visible') continue;
      const clip = parent.getBoundingClientRect();
      if (box.right > clip.right + 1 || box.left < clip.left - 1) problems.push(`clipped: ${name(element)}`);
      break;
    }
  }
  for (let i = 0; i < controls.length; i += 1) {
    for (let j = i + 1; j < controls.length; j += 1) {
      const a = controls[i].getBoundingClientRect();
      const b = controls[j].getBoundingClientRect();
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (overlapX > 2 && overlapY > 2 && !controls[i].contains(controls[j]) && !controls[j].contains(controls[i])) {
        problems.push(`overlap: ${name(controls[i])} / ${name(controls[j])}`);
      }
    }
  }
  if (document.documentElement.scrollWidth > vw) problems.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${vw}`);
  const fps = document.querySelector<HTMLElement>('.header-actions > .select-control');
  if (fps && fps.getBoundingClientRect().width < 81) problems.push(`FPS select squeezed to ${Math.round(fps.getBoundingClientRect().width)} px`);
  return problems;
});

const stageWidth = (page: Page) => page.locator('.stage-canvas-container').evaluate((node) => node.getBoundingClientRect().width);
const leftToggle = (page: Page) => page.locator('.left-toolbar-toggle');
const inspectorToggle = (page: Page) => page.locator('.inspector-dock-toggle');

const SIZES = [
  { width: 320, height: 640, label: 'small phone' },
  { width: 390, height: 844, label: 'phone' },
  { width: 844, height: 390, label: 'phone landscape' },
  { width: 640, height: 800, label: 'a third of a 1920 px screen' },
  { width: 700, height: 800, label: 'narrow window' },
  { width: 720, height: 450, label: '200 % zoom of 1440×900' },
  { width: 768, height: 1024, label: 'tablet' },
  { width: 880, height: 800, label: 'narrow window' },
  { width: 960, height: 1040, label: 'half of a 1920 px screen' },
  { width: 1024, height: 768, label: 'tablet landscape' },
  { width: 1200, height: 800, label: 'small laptop' },
  { width: 1366, height: 768, label: 'laptop' },
];

for (const size of SIZES) {
  test(`${size.width}×${size.height} (${size.label}): no chrome control is cut off, off-window or overlapping`, async ({ page }) => {
    await open(page, size.width, size.height);
    expect(await chromeProblems(page)).toEqual([]);
    expect(await stageWidth(page)).toBeGreaterThan(Math.min(300, size.width * 0.6));
  });
}

test('a phone opens with both docks closed; a dock opens OVER the stage, not beside it', async ({ page }) => {
  await open(page, 390, 844);
  await expect(leftToggle(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(inspectorToggle(page)).toHaveAttribute('aria-expanded', 'false');
  expect(await stageWidth(page)).toBe(390);

  await inspectorToggle(page).click();
  await expect(inspectorToggle(page)).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => page.locator('#right-inspector-panel').evaluate((node) => (node as HTMLElement).style.width)).toBe('');
  const panel = await page.locator('#right-inspector-panel').boundingBox();
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(390.5);
  expect(panel!.width).toBeGreaterThan(200);
  expect(await stageWidth(page)).toBe(390);
  expect(await chromeProblems(page)).toEqual([]);

  await leftToggle(page).click();
  await expect(leftToggle(page)).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => page.locator('#left-toolbar-panel').evaluate((node) => (node as HTMLElement).style.width)).toBe('');
  const left = await page.locator('#left-toolbar-panel').boundingBox();
  expect(left!.x).toBeGreaterThanOrEqual(-0.5);
  expect(await stageWidth(page)).toBe(390);
});

test('making the window narrower closes the docks the stage no longer has room for; a dock the user reopens stays open', async ({ page }) => {
  await open(page, 1440, 900);
  await expect(leftToggle(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(inspectorToggle(page)).toHaveAttribute('aria-expanded', 'true');

  // Snapped to a third of the screen: the left dock gives the stage its room.
  await page.setViewportSize({ width: 640, height: 900 });
  await expect(leftToggle(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(inspectorToggle(page)).toHaveAttribute('aria-expanded', 'true');
  expect(await stageWidth(page)).toBeGreaterThanOrEqual(380);
  expect(await chromeProblems(page)).toEqual([]);

  // The user reopens it on purpose: nothing closes it again while they work.
  await leftToggle(page).click();
  await expect(leftToggle(page)).toHaveAttribute('aria-expanded', 'true');
  await page.setViewportSize({ width: 640, height: 700 });
  await page.getByRole('button', { name: 'Add rectangle' }).click();
  await expect(leftToggle(page)).toHaveAttribute('aria-expanded', 'true');

  // Down to phone width: both docks close and the chrome still fits.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(leftToggle(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(inspectorToggle(page)).toHaveAttribute('aria-expanded', 'false');
  expect(await stageWidth(page)).toBe(390);
  expect(await chromeProblems(page)).toEqual([]);

  // Wider again: nothing reopens on its own, and nothing is cut off.
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(leftToggle(page)).toHaveAttribute('aria-expanded', 'false');
  expect(await chromeProblems(page)).toEqual([]);
});
