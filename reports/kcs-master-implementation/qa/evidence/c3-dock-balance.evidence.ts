/**
 * C3 — right dock balance (measurement + screenshots, KCS_EVIDENCE_TAG=before|after):
 * with a masked image selected and LAYER MASKS open, is the first mask row
 * visible without scrolling the Details pane, and how many layer rows does the
 * layer list show? At 1440×900 and 1024×720.
 */
import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { evidenceDir, imageLayer, normalizedRectPath, seedScene, track } from './fixtures';

const TAG = process.env.KCS_EVIDENCE_TAG ?? 'probe';
const OUT = evidenceDir(path.join('c3-dock-balance', TAG));

const shape = (id: string, zIndex: number, extra: Record<string, unknown> = {}) => ({
  id, name: id[0].toUpperCase() + id.slice(1), type: 'custom_rect', x: zIndex * 20, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex,
  fillColor: '#f97316', strokeColor: '#000', width: 60, height: 40, ...extra,
});

test('dock balance', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const rows: Record<string, unknown>[] = [];
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 720 }]) {
    await page.setViewportSize(viewport);
    const layers = [
      imageLayer({ zIndex: 1, masks: [
        { id: 'm1', name: 'Window', mode: 'add', enabled: true, feather: 0, path: normalizedRectPath(0.2, 0.2, 0.8, 0.8) },
        { id: 'm2', name: 'Sun cut', mode: 'subtract', enabled: false, feather: 0, path: normalizedRectPath(0.7, 0.1, 0.9, 0.3) },
      ] }),
      ...['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'].map((id, index) => shape(id, index + 2, index === 2 ? { parentId: 'beta' } : {})),
    ];
    await seedScene(page, { layers, tracks: layers.map((layer) => track(layer.id as string)) });
    await page.locator('.tree-node[data-layer-id="landscape"]').click();
    const expand = page.getByRole('button', { name: 'Expand LAYER MASKS' });
    if (await expand.count()) await expand.click();
    const firstRow = page.getByRole('button', { name: '1. Window' });
    const metrics = await page.evaluate(() => {
      const pane = document.querySelector('.details-body, .details-container') as HTMLElement;
      const row = document.querySelector('.layer-mask-row') as HTMLElement | null;
      const paneBox = pane.getBoundingClientRect();
      const rowBox = row?.getBoundingClientRect();
      const tree = document.querySelector('.outliner-dock') as HTMLElement;
      const treeBox = tree.getBoundingClientRect();
      const visibleRows = [...document.querySelectorAll('.tree-node[data-layer-id]')]
        .filter((node) => { const b = node.getBoundingClientRect(); return b.top >= treeBox.top && b.bottom <= treeBox.bottom; }).length;
      return {
        outlinerHeight: Math.round(treeBox.height),
        detailsHeight: Math.round((document.querySelector('.details-dock') as HTMLElement).getBoundingClientRect().height),
        firstMaskRowVisibleWithoutScroll: Boolean(rowBox && rowBox.top >= paneBox.top && rowBox.bottom <= paneBox.bottom),
        visibleLayerRows: visibleRows,
      };
    });
    rows.push({ viewport: `${viewport.width}x${viewport.height}`, firstRowExists: await firstRow.count(), ...metrics });
    await page.screenshot({ path: path.join(OUT, `${viewport.width}-masked-image.png`) });
  }
  fs.writeFileSync(path.join(OUT, 'balance.json'), JSON.stringify(rows, null, 2));
});
