/**
 * C3 visual review: the same synthetic scene captured before/after the visual
 * pass (KCS_EVIDENCE_TAG=before|after). Toolbar, layer tree (hierarchy, mask,
 * Track Matte), Inspector mask/matte cards, rename, shortcut reference â€” at
 * 1440Ã—900 and 1024Ã—720.
 */
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { evidenceDir, imageLayer, normalizedRectPath, seedScene, track } from './fixtures';

const TAG = process.env.KCS_EVIDENCE_TAG ?? 'probe';
const OUT = evidenceDir(path.join('c3-visual', TAG));

const shape = (id: string, name: string, type: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({
  id, name, type, x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#f97316', strokeColor: '#101218', width: 120, height: 90, ...extra,
});

const scene = {
  layers: [
    shape('caption', 'Caption', 'custom_text', 0, 120, { text: 'HELLO', zIndex: 7, trackMatte: { sourceLayerId: 'logo', mode: 'alpha', sourceVisible: false } }),
    shape('logo', 'Logo', 'custom_circle', 0, 120, { zIndex: 6, fillColor: '#22d3ee' }),
    shape('square', 'Square', 'custom_rect', -260, -60, { zIndex: 5 }),
    shape('triangle', 'Triangle', 'custom_triangle', -120, -60, { zIndex: 4, parentId: 'square', fillColor: '#a3e635' }),
    shape('star', 'Star', 'custom_star', 20, -60, { zIndex: 3, parentId: 'triangle', fillColor: '#facc15' }),
    shape('circle', 'Circle', 'custom_circle', 260, -60, { zIndex: 2, fillColor: '#c084fc' }),
    imageLayer({ zIndex: 1, masks: [{ id: 'm1', name: 'Window', mode: 'add', enabled: true, feather: 0, path: normalizedRectPath(0.2, 0.2, 0.8, 0.8) }] }),
  ],
  tracks: ['caption', 'logo', 'square', 'triangle', 'star', 'circle', 'landscape'].map((id) => track(id)),
};

async function capture(page: Page, name: string, locator?: string) {
  fs.mkdirSync(OUT, { recursive: true });
  if (locator) {
    await page.locator(locator).first().screenshot({ path: path.join(OUT, `${name}.png`) });
  } else {
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  }
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 720 }]) {
  test(`visual set ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const v = `${viewport.width}`;
    await page.setViewportSize(viewport);
    await seedScene(page, scene);
    await capture(page, `${v}-editor`);
    await capture(page, `${v}-toolbar`, '.authoring-toolbar');

    // Drawing tool armed: the active-tool indicator.
    await page.getByRole('button', { name: 'Add rectangle' }).click();
    await capture(page, `${v}-toolbar-armed`, '.authoring-toolbar');
    await page.keyboard.press('Escape');

    // Layer tree with hierarchy, mask owner and Track Matte relationship.
    await page.locator('.tree-node[data-layer-id="star"]').click();
    await capture(page, `${v}-layers`, '.outliner-dock');

    // Rename in place.
    await page.locator('.tree-node[data-layer-id="circle"] .actor-name').dblclick();
    await capture(page, `${v}-rename`, '.outliner-dock');
    await page.keyboard.press('Escape');

    // Inspector: the image's masks; the caption's Track Matte.
    await page.locator('.tree-node[data-layer-id="landscape"]').click();
    const styleTab = page.getByRole('tab', { name: /style/i });
    if (await styleTab.count()) await styleTab.first().click();
    const masks = page.getByRole('button', { name: 'Expand LAYER MASKS' });
    if (await masks.count()) await masks.click();
    await capture(page, `${v}-inspector-masks`, '.details-container');
    // The Details pane scrolls: the whole window shows the open card in context.
    await page.getByRole('button', { name: 'Collapse LAYER MASKS' }).scrollIntoViewIfNeeded();
    await capture(page, `${v}-inspector-masks-window`);
    await page.locator('.tree-node[data-layer-id="caption"]').click();
    const matte = page.getByRole('button', { name: 'Expand TRACK MATTE' });
    if (await matte.count()) await matte.click();
    await capture(page, `${v}-inspector-matte`, '.details-container');
    await page.getByRole('button', { name: 'Collapse TRACK MATTE' }).scrollIntoViewIfNeeded();
    await capture(page, `${v}-inspector-matte-window`);

    // Shortcut reference.
    await page.locator('.stage-canvas-container').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog')).toBeVisible();
    await capture(page, `${v}-shortcuts`);
    await page.keyboard.press('Escape');
  });
}
