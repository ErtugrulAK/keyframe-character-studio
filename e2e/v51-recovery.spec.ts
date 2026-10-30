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
    // 1200 is the policy ceiling and the value the state always applied: the
    // old 1800 was silently clamped to it, hiding accepted ≠ applied (N3 PR-1).
    totalFrames: 1200,
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
  test('text selection bounds follow the rendered SVG text', async ({ page }) => {
    await seed(page);
    await page.locator('.actor-node', { hasText: 'Headline' }).click();
    const geometry = await page.evaluate(() => {
      const text = [...document.querySelectorAll('.stage-svg text')].find((node) => node.textContent === 'NEW TEXT');
      const selection = [...document.querySelectorAll('.stage-svg rect[stroke="#4a8fe7"]')].at(-1);
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

  test('inspector hide and show uses a restrained layout transition without a gutter', async ({ page }) => {
    await seed(page);
    const sidebar = page.locator('.motion-design-right-sidebar');
    const transition = await sidebar.evaluate((node) => getComputedStyle(node).transition);
    // The dock's geometry is eased and committed frame by frame with the stage
    // camera (`useDockedPanelEdge`), so the browser must never animate the panel's
    // own box: a `transition: width` here is exactly the one-frame camera
    // compensation lag the transition contract forbids.
    // C6 — nor its transform/opacity: those CSS transitions ran a SECOND
    // animation (a fade and a 12px nudge) after the JS slide had settled. The
    // slide is the one animation; c6-dock-visual-continuity checks it per frame.
    expect(transition).not.toContain('width');
    expect(transition).not.toContain('flex-basis');
    expect(transition).not.toContain('transform');
    expect(transition).not.toContain('opacity');

    await page.getByRole('button', { name: 'Hide Inspector' }).click();
    // R3-02: the panel visibility flags and the handles they position live on the
    // editor SHELL, not on the workspace row the timeline resize changes.
    await expect(page.locator('.app-container')).toHaveClass(/inspector-hidden/u);
    await expect(page.getByRole('button', { name: 'Show Inspector' })).toBeVisible();
    // The edge travels to the collapsed width and hands the width back to the
    // stylesheet when it settles (that handback is why an inline width is only
    // ever visible while the edge is moving).
    await expect.poll(() => sidebar.evaluate((node) => Math.round(node.getBoundingClientRect().width))).toBe(0);
    await expect.poll(() => sidebar.evaluate((node) => node.style.width)).toBe('');

    await page.getByRole('button', { name: 'Show Inspector' }).click();
    await expect(page.locator('.app-container')).not.toHaveClass(/inspector-hidden/u);
    await expect(page.getByRole('button', { name: 'Hide Inspector' })).toBeVisible();
    await expect.poll(() => sidebar.evaluate((node) => Math.round(node.getBoundingClientRect().width))).toBeGreaterThan(0);
    await expect.poll(() => sidebar.evaluate((node) => node.style.width)).toBe('');
  });
});
