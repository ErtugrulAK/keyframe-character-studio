/**
 * C2 §17 — the final acceptance scenario, end to end in one synthetic scene,
 * with a screenshot per step and assertions on the persisted scene.
 *
 * Variants: 1440×900 desktop, 1024×720 narrow, and "200 % zoom" as the
 * layout-equivalent viewport (720×450 CSS px at deviceScaleFactor 2 — what a
 * 1440×900 window shows at 200 % browser zoom; headless Chromium has no
 * Ctrl+= page zoom, so this is the equivalent, not the browser's zoom UI).
 *
 * Fixture: an image covering the artboard plus Square, Triangle, Star, Circle
 * and a group "Rig" (seeded — adding them through the media picker is a file
 * upload outside this scenario). Everything else is done through the UI.
 */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { evidenceDir, emptyChannels, savedScene, STORAGE_KEY } from './fixtures';

const COVER = `data:image/svg+xml;base64,${Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e3a8a"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs><rect width="1920" height="1080" fill="url(#g)"/><circle cx="1400" cy="300" r="160" fill="#fde047"/></svg>`,
).toString('base64')}`;

const shape = (id: string, name: string, type: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({
  id, name, type, x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#f97316', strokeColor: '#101218', width: 120, height: 120, ...extra,
});

const VARIANTS = [
  { name: 'desktop-1440', viewport: { width: 1440, height: 900 }, scale: 1 },
  { name: 'narrow-1024', viewport: { width: 1024, height: 720 }, scale: 1 },
  { name: 'zoom200-equivalent', viewport: { width: 720, height: 450 }, scale: 2 },
];

for (const variant of VARIANTS) {
  test.describe(variant.name, () => {
    test.use({ viewport: variant.viewport, deviceScaleFactor: variant.scale });

    test(`C2 acceptance — ${variant.name}`, async ({ page }) => {
      test.setTimeout(240000);
      const out = evidenceDir(path.join('c2-acceptance', variant.name));
      fs.mkdirSync(out, { recursive: true });
      const log: string[] = [];
      const shot = async (name: string, note: string) => {
        await page.screenshot({ path: path.join(out, `${name}.png`) });
        log.push(`${name}: ${note}`);
      };
      const row = (id: string) => page.locator(`.tree-node[data-layer-id="${id}"]`);
      const stageBox = async () => (await page.locator('.stage-canvas-container').boundingBox())!;

      // ── 1. An image covering the canvas (fixture) ──────────────────────────
      const layers = [
        shape('cover', 'Cover Image', 'custom_image', 0, 0, { width: 1920, height: 1080, imageUrl: COVER, fillColor: '#fff', zIndex: 1 }),
        shape('square', 'Square', 'custom_rect', -500, -250, { rotation: 15 }),
        shape('triangle', 'Triangle', 'custom_triangle', -300, -250),
        shape('star', 'Star', 'custom_star', -120, -250),
        shape('circle', 'Circle', 'custom_circle', 120, -250),
        shape('rig', 'Rig', 'custom_rect', 400, -250, { isGroup: true, width: 10, height: 10 }),
        shape('rig-arm', 'Arm', 'custom_rect', 60, 0, { parentId: 'rig', width: 80, height: 30 }),
      ];
      await page.goto('/');
      await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
      await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, {
        key: STORAGE_KEY,
        value: JSON.stringify({
          version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers,
          tracks: layers.map((layer) => ({ id: `track-${layer.id}`, partId: layer.id, name: layer.name, color: '#22d3ee', visible: true, locked: false, expanded: false, channels: emptyChannels() })),
        }),
      });
      await page.reload();
      await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
      await shot('01-cover-image', 'fixture: image covering the artboard + shapes');

      // ── 2. Rectangle drawn OVER the image ──────────────────────────────────
      await row('cover').click();
      const box = await stageBox();
      const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await page.getByRole('button', { name: 'Add rectangle' }).click();
      await page.mouse.move(c.x + box.width * 0.05, c.y + box.height * 0.05);
      await page.mouse.down();
      await page.mouse.move(c.x + box.width * 0.18, c.y + box.height * 0.18, { steps: 5 });
      await page.mouse.up();
      await page.getByRole('button', { name: 'Add rectangle' }).click(); // disarm
      let scene = await savedScene(page);
      const rect = scene.layers.find((layer: any) => layer.type === 'custom_rect' && !['square', 'rig', 'rig-arm'].includes(layer.id));
      expect(rect, 'a rectangle was created over the image').toBeTruthy();
      await expect(page.locator('.tree-node.primary-selected')).toHaveAttribute('data-layer-id', rect.id);
      await shot('02-rectangle-over-image', `rectangle ${rect.id} created; image not selected`);

      // ── 3–4. Pen: multi-point draft, Undo/Redo inside the draft, finish with the mouse ──
      await page.getByRole('button', { name: 'Pen' }).click();
      const pts = [[-0.3, -0.1], [-0.15, -0.15], [-0.08, 0.05], [-0.16, 0.2], [-0.3, 0.15]];
      for (const [dx, dy] of pts) {
        await page.mouse.click(c.x + box.width * dx, c.y + box.height * dy);
      }
      await expect(page.getByTestId('freeform-draft-point')).toHaveCount(5);
      await page.keyboard.press('Control+z');
      await expect(page.getByTestId('freeform-draft-point')).toHaveCount(4);
      await page.keyboard.press('Control+Shift+z');
      await expect(page.getByTestId('freeform-draft-point')).toHaveCount(5);
      await shot('03-pen-draft-undo-redo', '5 points; Ctrl+Z → 4, Ctrl+Shift+Z → 5; no finished shape touched');
      const first = await page.getByTestId('freeform-draft-point').first().boundingBox();
      await page.mouse.click(first!.x + first!.width / 2, first!.y + first!.height / 2);
      await expect(page.getByTestId('freeform-draft-point')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true');
      scene = await savedScene(page);
      expect(scene.layers.some((layer: any) => layer.type === 'custom_freeform' && !layer.isGroup)).toBe(true);
      await shot('04-pen-finished-by-click', 'closed on the first point with the mouse; Select tool active');

      // ── 5. Mask on the image, closed on its start point ────────────────────
      await row('cover').click();
      await page.getByRole('button', { name: 'Expand LAYER MASKS' }).click();
      await page.getByRole('button', { name: 'Draw pen mask' }).click();
      const m = [[0.25, -0.25], [0.4, -0.22], [0.42, -0.05], [0.27, -0.03]];
      for (const [dx, dy] of m) await page.mouse.click(c.x + box.width * dx, c.y + box.height * dy);
      const start = await page.getByTestId('mask-draw-point').first().boundingBox();
      // A little off the exact centre: the close target is forgiving.
      await page.mouse.click(start!.x + start!.width / 2 + 4, start!.y + start!.height / 2 - 3);
      await expect(page.getByTestId('mask-edit-banner')).toBeVisible();
      scene = await savedScene(page);
      const cover = scene.layers.find((layer: any) => layer.id === 'cover');
      expect(cover.masks?.[0]?.path.points).toHaveLength(4);
      await shot('05-mask-closed-on-start', 'mask closed by clicking near its first point (4 points, no duplicate)');

      // ── 6. Corner → Smooth on one point; owner pose unchanged ──────────────
      const pose = (layer: any) => [layer.x, layer.y, layer.rotation, layer.scaleX, layer.scaleY];
      await page.getByTestId('mask-vertex').nth(1).click();
      await page.getByTestId('bezier-path-editor').getByRole('radio', { name: 'Smooth' }).click();
      scene = await savedScene(page);
      const coverAfter = scene.layers.find((layer: any) => layer.id === 'cover');
      expect(coverAfter.masks[0].path.points[1].kind).toBe('smooth');
      expect(pose(coverAfter)).toEqual(pose(cover));
      await page.keyboard.press(']');
      await expect(page.getByTestId('bezier-path-editor')).toContainText('Point 3 of 4');
      await shot('06-mask-point-smooth', 'point 2 Smooth, owner pose identical; ] selects point 3');
      await page.keyboard.press('Escape');

      // ── 7. Rename a layer and a group ──────────────────────────────────────
      await row('rig').locator('.actor-name').dblclick();
      await page.keyboard.press('Control+a');
      await page.keyboard.type('Character Rig');
      await page.keyboard.press('Enter');
      await row('circle').focus();
      await page.keyboard.press('F2');
      await page.keyboard.press('Control+a');
      await page.keyboard.type('Sun');
      await page.keyboard.press('Enter');
      await expect(row('rig')).toContainText('Character Rig');
      await expect(row('circle')).toContainText('Sun');
      await shot('07-renamed', 'group renamed by double-click, layer by F2');

      // ── 8. Square → Triangle → Star; Circle independent ────────────────────
      const centre = async (id: string) => {
        const b = await page.locator(`.stage-svg g[data-part-id="${id}"]`).first().boundingBox();
        return { x: b!.x + b!.width / 2, y: b!.y + b!.height / 2 };
      };
      const before8 = { square: await centre('square'), triangle: await centre('triangle'), star: await centre('star') };
      const zone = async (from: string, to: string) => {
        const target = await row(to).boundingBox();
        await row(from).dragTo(row(to), { targetPosition: { x: target!.width / 2, y: target!.height / 2 } });
      };
      await zone('star', 'triangle');
      await expect(row('star')).toHaveAttribute('data-parent-id', 'triangle');
      await row('triangle').focus();
      await page.keyboard.press('Alt+ArrowRight');
      await expect(row('triangle')).toHaveAttribute('data-parent-id', 'square');
      for (const id of ['square', 'triangle', 'star'] as const) {
        const now = await centre(id);
        expect(Math.hypot(now.x - before8[id].x, now.y - before8[id].y), `${id} kept its place`).toBeLessThan(0.75);
      }
      await expect(row('circle')).toHaveAttribute('data-parent-id', '');
      await shot('08-parenting', 'Star→Triangle by drag (nest), Triangle→Square by Alt+→; no layer moved');

      // ── 9. Parent and child transforms changed separately ──────────────────
      const circleBefore = await centre('circle');
      const starBefore = await centre('star');
      await row('square').click();
      const transformToggle = page.getByRole('button', { name: 'Expand TRANSFORM' });
      if (await transformToggle.count()) await transformToggle.click();
      const posX = page.getByLabel('Position X').first();
      await posX.fill(String(Number(await posX.inputValue()) + 80));
      await posX.blur();
      const starAfterParent = await centre('star');
      expect(starAfterParent.x - starBefore.x, 'the grandchild follows its grandparent').toBeGreaterThan(10);
      await row('star').click();
      const starX = page.getByLabel('Position X').first();
      await starX.fill(String(Number(await starX.inputValue()) - 40));
      await starX.blur();
      const squareAfter = await centre('square');
      const starAfterChild = await centre('star');
      expect(starAfterChild.x).toBeLessThan(starAfterParent.x - 5);
      expect(Math.hypot((await centre('square')).x - squareAfter.x, (await centre('square')).y - squareAfter.y)).toBeLessThan(0.5);
      const circleAfter = await centre('circle');
      expect(Math.hypot(circleAfter.x - circleBefore.x, circleAfter.y - circleBefore.y), 'Circle independent').toBeLessThan(0.5);
      await shot('09-parent-child-transforms', 'Square +80 moved the chain; Star −40 moved only Star; Circle untouched');

      // ── 10. Panel / layer show-hide repeated: the camera does not jump ─────
      const art = async () => {
        const b = await page.locator('.stage-svg rect.canvas-bg').first().boundingBox();
        return { x: b!.x + b!.width / 2, y: b!.y + b!.height / 2 };
      };
      const art0 = await art();
      // Layer eye first (the layer list is visible), then the docks: four
      // rounds, so every panel ends where it started.
      for (let round = 0; round < 4; round += 1) {
        await row('square').locator('.col-eye').click();
        await page.waitForTimeout(150);
      }
      for (let round = 0; round < 4; round += 1) {
        for (const label of [/^(Hide|Show) Inspector$/, /^(Hide|Show) Left Toolbar$/, /^(Collapse|Expand) timeline$/]) {
          const button = page.getByRole('button', { name: label });
          if (await button.count()) await button.first().click();
        }
        await page.waitForTimeout(350);
      }
      const art1 = await art();
      expect(Math.hypot(art1.x - art0.x, art1.y - art0.y), 'artboard did not move').toBeLessThan(0.5);
      await shot('10-show-hide', '4 layer-eye toggles, then 4 rounds of Inspector / left toolbar / timeline toggles: no artboard drift');

      // ── 11. Scrub and playback: measured frame cadence ─────────────────────
      const measure = async (run: () => Promise<void>) => {
        await page.evaluate(() => {
          const w = window as unknown as { __f: number[]; __r: boolean };
          w.__f = []; w.__r = true;
          let last = performance.now();
          const tick = (now: number) => { if (!w.__r) return; w.__f.push(now - last); last = now; requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
        });
        await run();
        return page.evaluate(() => {
          const w = window as unknown as { __f: number[]; __r: boolean };
          w.__r = false;
          const f = w.__f.slice(1).sort((a, b) => a - b);
          return { frames: f.length, p95: +f[Math.floor(f.length * 0.95)].toFixed(1) };
        });
      };
      const ruler = page.getByRole('slider', { name: 'Playhead position' });
      const scrub = await measure(async () => {
        await ruler.focus();
        await page.keyboard.press('Home');
        for (let index = 0; index < 30; index += 1) await page.keyboard.press('ArrowRight');
      });
      await page.locator('.stage-canvas-container').click({ position: { x: 4, y: 4 } });
      const playback = await measure(async () => {
        await ruler.focus();
        await page.keyboard.press('Home');
        await page.locator('.stage-canvas-container').click({ position: { x: 4, y: 4 } });
        await page.getByTitle('Play', { exact: true }).click();
        await page.waitForTimeout(1500);
        // A 60-frame sequence may already have stopped at its end.
        const pause = page.getByTitle('Pause', { exact: true });
        if (await pause.count()) await pause.click();
      });
      log.push(`11 cadence: scrub ${JSON.stringify(scrub)}, playback ${JSON.stringify(playback)}`);
      await shot('11-scrub-playback', `scrub p95 ${scrub.p95} ms, playback p95 ${playback.p95} ms (UI frame interval)`);

      // ── 12. Edit ⇄ Broadcast keeps the state ───────────────────────────────
      await row('star').click();
      const frame12 = await ruler.getAttribute('aria-valuenow');
      await page.getByRole('button', { name: 'BROADCAST', exact: true }).click();
      await expect(page.locator('.live-director-panel')).toBeVisible();
      await shot('12a-broadcast', 'broadcast surface');
      await page.getByRole('button', { name: 'EDIT MODE', exact: true }).click();
      await expect(row('star')).toHaveClass(/primary-selected/);
      await expect(ruler).toHaveAttribute('aria-valuenow', frame12!);
      await shot('12b-back-to-edit', 'selection and playhead kept');

      // ── 13. Undo/Redo, save/reload: relationships and data kept ────────────
      const beforeUndo = await savedScene(page);
      await page.getByTitle('Undo').click();
      await page.getByTitle('Redo').click();
      const afterRedo = await savedScene(page);
      expect(afterRedo.layers).toEqual(beforeUndo.layers);
      await page.reload();
      await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
      const reloaded = await savedScene(page);
      const byId = (s: any, id: string) => s.layers.find((layer: any) => layer.id === id);
      expect(byId(reloaded, 'star').parentId).toBe('triangle');
      expect(byId(reloaded, 'triangle').parentId).toBe('square');
      expect(byId(reloaded, 'circle').parentId).toBeUndefined();
      expect(byId(reloaded, 'rig').name).toBe('Character Rig');
      expect(byId(reloaded, 'circle').name).toBe('Sun');
      expect(byId(reloaded, 'cover').masks[0].path.points[1].kind).toBe('smooth');
      expect(byId(reloaded, 'rig-arm').parentId).toBe('rig');
      await shot('13-after-reload', 'hierarchy, names, mask point type and group kept after Undo/Redo and reload');

      // ── Keyboard reference at this viewport: fits, searchable, traps focus ─
      await page.locator('.stage-canvas-container').click({ position: { x: 4, y: 4 } });
      await page.keyboard.press('?');
      const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
      await expect(dialog).toBeVisible();
      const fits = await dialog.evaluate((node) => {
        const r = node.getBoundingClientRect();
        return r.left >= 0 && r.right <= window.innerWidth + 0.5 && document.documentElement.scrollWidth <= window.innerWidth + 0.5;
      });
      expect(fits, 'the reference fits the viewport without horizontal scroll').toBe(true);
      await dialog.getByRole('textbox', { name: 'Filter shortcuts' }).fill('nest');
      await expect(dialog.locator('.shortcut-reference-row')).toHaveCount(1);
      await shot('14-shortcut-reference', 'reference at this viewport, filtered by "nest"');
      for (let index = 0; index < 6; index += 1) await page.keyboard.press('Tab');
      expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);

      fs.writeFileSync(path.join(out, 'acceptance-log.txt'), `${log.join('\n')}\n`);
    });
  });
}
