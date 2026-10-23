/**
 * WP-06 layout probe: the same fixture at 1440×900, 1280×800, 1024×720 and
 * 768×720, in layer mode and in mask editing. Records which interactive
 * controls are clipped or overlap, and saves screenshots. Run with
 * KCS_EVIDENCE_TAG=before / after to keep both sets side by side.
 */
import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { evidenceDir, imageLayer, normalizedRectPath, seedScene, track } from './fixtures';

const TAG = process.env.KCS_EVIDENCE_TAG ?? 'probe';
const OUT = evidenceDir(path.join('wp06', TAG));

/** Buttons that are rendered but not fully inside the viewport, or covered at their centre. */
const clippedControls = (page: Page) => page.evaluate(() => {
  const issues: string[] = [];
  const width = window.innerWidth;
  const height = window.innerHeight;
  for (const element of document.querySelectorAll<HTMLElement>('button, [role="button"], input, select')) {
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    const style = getComputedStyle(element);
    if (style.visibility === 'hidden') continue;
    const label = element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent?.trim() || element.tagName;
    // Scrollable ancestors legitimately clip; report only the page viewport.
    if (box.right > width + 1 || box.left < -1) issues.push(`offscreen-x: ${label}`);
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    if (cx < 0 || cy < 0 || cx > width || cy > height) continue;
    const top = document.elementFromPoint(cx, cy);
    if (top && top !== element && !element.contains(top) && !top.contains(element)) {
      const owner = top.closest('button, [role="button"], input, select');
      if (owner && owner !== element) issues.push(`covered: ${label} by ${owner.getAttribute('aria-label') || owner.getAttribute('title') || owner.textContent?.trim()}`);
    }
  }
  return issues;
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1024, height: 720 }, { width: 768, height: 720 }]) {
  test(`WP-06 layout probe ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await seedScene(page, {
      layers: [imageLayer({ masks: [{ id: 'm1', name: 'Window', mode: 'add', enabled: true, path: normalizedRectPath(0.2, 0.2, 0.8, 0.8) }] })],
      tracks: [track('landscape')],
    });
    await page.locator('.ue-track-row', { hasText: 'Landscape' }).first().click();
    const report: Record<string, string[]> = {};
    report.layerMode = await clippedControls(page);
    await page.screenshot({ path: path.join(OUT, `${viewport.width}_layer_mode.png`) });
    const expand = page.getByRole('button', { name: 'Expand LAYER MASKS' });
    if (await expand.count()) {
      await expand.scrollIntoViewIfNeeded();
      await expand.click();
      const edit = page.getByRole('button', { name: 'Edit on Canvas' });
      if (await edit.count()) {
        await edit.scrollIntoViewIfNeeded();
        await edit.click();
        report.maskMode = await clippedControls(page);
        await page.screenshot({ path: path.join(OUT, `${viewport.width}_mask_mode.png`) });
      }
    }
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, `${viewport.width}_issues.json`), JSON.stringify(report, null, 2));
  });
}
