import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

function channels() {
  return { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [] };
}

async function seed(page: Page) {
  const scene = {
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    name: 'V5.1 Recovery',
    width: 800,
    height: 500,
    fps: 30,
    totalFrames: 1800,
    layers: [{
      id: 'headline', name: 'Headline', type: 'custom_text', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1,
      opacity: 1, visible: true, zIndex: 1, fillColor: '#22d3ee', strokeColor: 'none',
      textValue: 'NEW TEXT', fontSize: 120, fontFamily: 'Arial', fillEnabled: true, strokeEnabled: false,
    }],
    tracks: [{ partId: 'headline', channels: channels(), keyframes: [], visible: true, locked: false }],
  };
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify(scene)]);
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

test.describe('KCS V5.1 consolidated recovery', () => {
  test('text selection bounds follow the rendered SVG text and inspector stays compact', async ({ page }) => {
    await seed(page);
    await page.locator('.actor-node', { hasText: 'Headline' }).click();
    const geometry = await page.evaluate(() => {
      const text = [...document.querySelectorAll('.stage-svg text')].find((node) => node.textContent === 'NEW TEXT');
      const selection = [...document.querySelectorAll('.stage-svg rect[stroke="#00d2ff"]')].at(-1);
      if (!text || !selection) return null;
      const textBox = text.getBBox();
      return {
        text: { x: textBox.x, y: textBox.y, width: textBox.width, height: textBox.height },
        selection: { x: Number(selection.getAttribute('x')), y: Number(selection.getAttribute('y')), width: Number(selection.getAttribute('width')), height: Number(selection.getAttribute('height')) },
      };
    });
    expect(geometry).not.toBeNull();
    expect(Math.abs(geometry!.selection.x - geometry!.text.x)).toBeLessThan(2);
    expect(Math.abs(geometry!.selection.y - geometry!.text.y)).toBeLessThan(2);
    expect(Math.abs(geometry!.selection.width - geometry!.text.width)).toBeLessThan(2);
    expect(Math.abs(geometry!.selection.height - geometry!.text.height)).toBeLessThan(2);

    await page.getByRole('button', { name: 'Expand APPEARANCE' }).click();
    const appearance = page.locator('.panel-card').filter({ hasText: 'APPEARANCE' }).first();
    await expect(appearance).toContainText('FILL');
    await expect(appearance).toContainText('STROKE');
    await expect(appearance).not.toContainText('QUICK PALETTE');
    await expect(appearance.locator('input[type="color"]')).toHaveCount(0);
    await expect(page.getByText('Transitions', { exact: true })).toHaveCount(0);
  });

  test('ruler, playhead, and tracks share one horizontal scroll coordinate', async ({ page }) => {
    await seed(page);
    const result = await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>('.timeline-grid-container');
      const ruler = document.querySelector<HTMLElement>('.time-ruler');
      const playhead = document.querySelector<HTMLElement>('.playhead-line');
      if (!grid || !ruler || !playhead) return null;
      const before = { ruler: ruler.getBoundingClientRect().left, playhead: playhead.getBoundingClientRect().left };
      grid.scrollLeft = 420;
      const after = { ruler: ruler.getBoundingClientRect().left, playhead: playhead.getBoundingClientRect().left, scrollLeft: grid.scrollLeft };
      return { before, after, scrollWidth: grid.scrollWidth, clientWidth: grid.clientWidth };
    });
    expect(result).not.toBeNull();
    expect(result!.scrollWidth).toBeGreaterThan(result!.clientWidth);
    expect(result!.after.scrollLeft).toBe(420);
    expect(result!.after.ruler - result!.before.ruler).toBe(result!.after.playhead - result!.before.playhead);
    await page.getByRole('button', { name: 'Fit', exact: true }).click();
    await expect.poll(() => page.locator('.timeline-grid-container').evaluate((node) => node.scrollLeft)).toBe(0);
  });
});
