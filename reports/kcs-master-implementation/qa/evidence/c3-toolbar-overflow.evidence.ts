/** C3 — at which widths does the authoring toolbar stop fitting? (measurement only) */
import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { evidenceDir, seedScene } from './fixtures';

const TAG = process.env.KCS_EVIDENCE_TAG ?? 'probe';

test('toolbar overflow by width', async ({ page }) => {
  const rows: string[] = [];
  for (const width of [1600, 1440, 1366, 1280, 1200, 1100, 1024, 900, 768]) {
    await page.setViewportSize({ width, height: 800 });
    await seedScene(page, { layers: [], tracks: [] });
    const m = await page.locator('.authoring-toolbar').evaluate((node) => ({ scroll: node.scrollWidth, client: node.clientWidth }));
    rows.push(`${width}: content ${m.scroll} px, visible ${m.client} px, hidden ${Math.max(0, m.scroll - m.client)} px`);
  }
  const out = evidenceDir(path.join('c3-toolbar', TAG));
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'overflow.txt'), rows.join('\n'));
});
