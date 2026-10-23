/**
 * WP-08 — mask-constrained colour correction in a real browser, measured in
 * pixels:
 * - whole layer, then limited to an effect-only mask drawn on the canvas: the
 *   inside is corrected, the outside is untouched, the image is not cut, and
 *   the alpha (a transparent hole, a half-transparent strip) is preserved;
 * - a switched-off mask means the correction is NOT applied (with a reason);
 * - one slider drag is one undo step; Undo/Redo restore the pixels;
 * - the scene is written as version 3 only once it uses the feature, and a
 *   reload brings the same picture back;
 * - Broadcast draws the same pixels; the GIF frame carries the correction;
 * - OGraf export is blocked with the reason (not flattened, not dropped).
 */
import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const E = () => ({ x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [] });
const RED = [224, 48, 48];
const BLUE = [32, 96, 224];
/** Rec.709 luma of a colour, as the saturation-0 matrix computes it (sRGB values). */
const luma = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

async function seed(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  // A 200×100 image: red top, blue bottom, a fully transparent hole in the
  // middle and a half-transparent blue strip along the bottom.
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#e03030';
    g.fillRect(0, 0, 200, 50);
    g.fillStyle = '#2060e0';
    g.fillRect(0, 50, 200, 50);
    g.clearRect(60, 15, 20, 20);
    g.clearRect(0, 88, 200, 12);
    g.fillStyle = 'rgba(32, 96, 224, 0.5)';
    g.fillRect(0, 88, 200, 12);
    return canvas.toDataURL('image/png');
  });
  const layers = [{ id: 'photo', name: 'Photo', type: 'custom_image', imageUrl: image, x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 2, opacity: 1, visible: true, zIndex: 1, fillColor: '#ffffff', strokeColor: '#000000', width: 200, height: 100 }];
  const scene = { version: 2, coordinateSystem: 'project-unit-center-v1', width: 640, height: 360, fps: 12, totalFrames: 12, layers, tracks: [{ id: 't-photo', partId: 'photo', name: 'Photo', color: '#fff', visible: true, locked: false, channels: E() }] };
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(scene) });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  const overlay = page.getByRole('button', { name: 'Toggle coordinate overlay' });
  if (await overlay.getAttribute('aria-pressed') === 'true') await overlay.click();
  await page.locator('[role="tree"] [data-layer-id="photo"]').click();
}

const savedScene = async (page: Page) => {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
};

type Samples = Record<'leftRed' | 'rightRed' | 'leftBlue' | 'rightBlue' | 'hole' | 'leftSemi' | 'rightSemi' | 'leftBelow' | 'rightBelow', number[]>;

/** Pixels at fixed places of the image, read from a real screenshot of the stage. */
const sample = async (page: Page): Promise<Samples> => {
  // Nothing selected: no gizmo or mask outline over the pixels.
  await page.locator('.mask-path-overlay, [data-testid="mask-path-overlay"]').waitFor({ state: 'detached' }).catch(() => undefined);
  const box = await page.locator('.stage-svg g[data-part-id="photo"]').first().boundingBox();
  if (!box) throw new Error('no image on the stage');
  const shot = (await page.screenshot()).toString('base64');
  return page.evaluate(async ([data, b]) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const g = canvas.getContext('2d')!;
    g.drawImage(image, 0, 0);
    const at = (fx: number, fy: number) => Array.from(g.getImageData(Math.round(b.x + b.width * fx), Math.round(b.y + b.height * fy), 1, 1).data).slice(0, 3);
    // `*Below`: the stage just under the image, at the same x as the half-transparent samples.
    return { leftRed: at(0.2, 0.2), rightRed: at(0.8, 0.2), leftBlue: at(0.2, 0.7), rightBlue: at(0.8, 0.7), hole: at(0.35, 0.25), leftSemi: at(0.2, 0.94), rightSemi: at(0.8, 0.94), leftBelow: at(0.2, 1.03), rightBelow: at(0.8, 1.03) };
  }, [shot, box] as const) as Promise<Samples>;
};

const close = (actual: number[], expected: number[], tolerance = 4) => actual.every((value, index) => Math.abs(value - expected[index]) <= tolerance);
const gray = (value: number) => [value, value, value].map(Math.round);
const mix = (a: number[], b: number[], t: number) => a.map((value, index) => value * t + b[index] * (1 - t));

const deselect = async (page: Page) => {
  await page.keyboard.press('Escape');
  const stage = await page.locator('.stage-canvas-container').boundingBox();
  await page.mouse.click(stage!.x + 8, stage!.y + stage!.height - 8);
};

test('colour correction: whole layer, effect-only mask, alpha kept, undo, v3 save/reload, Broadcast, GIF, OGraf refusal', async ({ page }) => {
  test.setTimeout(120000);
  await seed(page);
  expect((await savedScene(page)).version).toBe(2); // an untouched scene stays v2

  // ── Whole layer, saturation 0 ──
  await page.getByRole('button', { name: 'Add color correction' }).click();
  await page.getByRole('slider', { name: 'Saturation' }).fill('0');
  await deselect(page);
  let pixels = await sample(page);
  /** The hole shows the stage, never the image's own colours. */
  const transparent = (pixel: number[]) => !close(pixel, RED, 40) && !close(pixel, gray(luma(RED)), 30) && !close(pixel, BLUE, 40);
  expect(transparent(pixels.hole), `hole ${pixels.hole}`).toBe(true);
  expect(close(pixels.leftRed, gray(luma(RED))), `left red ${pixels.leftRed}`).toBe(true);
  expect(close(pixels.rightRed, gray(luma(RED))), `right red ${pixels.rightRed}`).toBe(true);
  // Half-transparent strip: half the corrected colour over the stage.
  expect(close(pixels.leftSemi, mix(gray(luma(BLUE)), pixels.leftBelow, 0.5), 6), `semi ${pixels.leftSemi} below ${pixels.leftBelow}`).toBe(true);
  const v3 = await savedScene(page);
  expect(v3.version).toBe(3);
  expect(v3.layers[0].effects).toEqual([expect.objectContaining({ type: 'colorCorrection', saturation: 0, scope: 'layer' })]);

  // ── Limited to an effect-only mask drawn on the canvas (left half) ──
  await page.locator('[role="tree"] [data-layer-id="photo"]').click();
  await page.getByRole('button', { name: 'Draw rectangle effect mask' }).click();
  const box = (await page.locator('.stage-svg g[data-part-id="photo"]').first().boundingBox())!;
  await page.mouse.move(box.x - 20, box.y - 20);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 20, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByRole('combobox', { name: 'Color correction applies to' })).toHaveValue(/.+/);
  await expect(page.getByRole('combobox', { name: 'Color correction applies to' }).locator('option:checked')).toContainText('(effect only)');
  await deselect(page);
  pixels = await sample(page);
  expect(close(pixels.leftRed, gray(luma(RED))), `left red ${pixels.leftRed}`).toBe(true);
  expect(close(pixels.rightRed, RED), `right red untouched ${pixels.rightRed}`).toBe(true);
  expect(close(pixels.rightBlue, BLUE), `right blue visible (not cut) ${pixels.rightBlue}`).toBe(true);
  expect(transparent(pixels.hole), `hole stays transparent ${pixels.hole}`).toBe(true);
  expect(close(pixels.leftSemi, mix(gray(luma(BLUE)), pixels.leftBelow, 0.5), 6), `left semi ${pixels.leftSemi} below ${pixels.leftBelow}`).toBe(true);
  expect(close(pixels.rightSemi, mix(BLUE, pixels.rightBelow, 0.5), 6), `right semi ${pixels.rightSemi} below ${pixels.rightBelow}`).toBe(true);
  const scoped = await savedScene(page);
  const effectMask = scoped.layers[0].masks.at(-1);
  expect(effectMask.affectsAlpha).toBe(false);
  expect(scoped.layers[0].effects[0]).toMatchObject({ scope: 'mask', maskId: effectMask.id });

  // ── A switched-off mask: the correction is NOT applied, and the panel says why ──
  await page.locator('[role="tree"] [data-layer-id="photo"]').click();
  const masksToggle = page.getByRole('button', { name: 'Expand LAYER MASKS' });
  if (await masksToggle.count()) await masksToggle.click();
  const maskSwitch = page.getByRole('button', { name: `Enable ${effectMask.name}` });
  await expect(maskSwitch).toHaveAttribute('aria-pressed', 'true');
  await maskSwitch.click();
  await expect(maskSwitch).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('color-correction-status')).toContainText('is off');
  await deselect(page);
  pixels = await sample(page);
  expect(close(pixels.leftRed, RED), `left red with the mask off ${pixels.leftRed}`).toBe(true);
  await page.keyboard.press('Control+z');
  await deselect(page);
  pixels = await sample(page);
  expect(close(pixels.leftRed, gray(luma(RED))), 'undo turns the mask back on').toBe(true);

  // ── One slider drag = one undo step ──
  await page.locator('[role="tree"] [data-layer-id="photo"]').click();
  const slider = page.getByRole('slider', { name: 'Saturation' });
  await slider.scrollIntoViewIfNeeded();
  const track = (await slider.boundingBox())!;
  await page.mouse.move(track.x + 6, track.y + track.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 10; step += 1) await page.mouse.move(track.x + 6 + (track.width / 2 - 6) * (step / 10), track.y + track.height / 2);
  await page.mouse.up();
  const dragged = Number(await slider.inputValue());
  expect(dragged).toBeGreaterThan(70);
  // Focus is still on the slider (a form field keeps the editor's keyboard
  // shortcuts out), so the user's Undo/Redo are the toolbar controls.
  await page.getByTitle('Undo').click();
  await expect(slider).toHaveValue('0');
  await page.getByTitle('Redo').click();
  await expect(slider).toHaveValue(String(dragged));
  await page.getByTitle('Undo').click();
  await expect(slider).toHaveValue('0');

  // ── Save / reload: the same picture ──
  const saved = await savedScene(page);
  expect(saved.version).toBe(3);
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  const overlay = page.getByRole('button', { name: 'Toggle coordinate overlay' });
  if (await overlay.getAttribute('aria-pressed') === 'true') await overlay.click();
  const reloaded = await sample(page);
  expect(close(reloaded.leftRed, gray(luma(RED)))).toBe(true);
  expect(close(reloaded.rightRed, RED)).toBe(true);

  // ── Broadcast draws the same pixels ──
  await page.getByRole('button', { name: 'BROADCAST', exact: true }).click();
  // A clean Broadcast entry is empty until the sequence is taken.
  await page.getByText('Sequence', { exact: true }).first().click();
  await expect(page.locator('.stage-svg g[data-part-id="photo"]').first()).toBeVisible();
  await expect(page.locator('.stage-svg [data-color-correction="applied"]')).toHaveCount(1);
  const broadcast = await sample(page);
  expect(close(broadcast.leftRed, gray(luma(RED))), `broadcast left ${broadcast.leftRed}`).toBe(true);
  expect(close(broadcast.rightRed, RED), `broadcast right ${broadcast.rightRed}`).toBe(true);
  await page.getByRole('button', { name: 'EDIT MODE', exact: true }).click();

  // ── GIF: the first frame carries the correction ──
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Animated GIF', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Export animated GIF' });
  await expect(panel).toBeVisible();
  const download = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Export GIF', exact: true }).click();
  const file = await (await download).path();
  const bytes = Array.from(new Uint8Array(await (await import('node:fs/promises')).readFile(file!)));
  const gif = await page.evaluate(async (payload: number[]) => {
    const image = new Image();
    image.src = URL.createObjectURL(new Blob([new Uint8Array(payload)], { type: 'image/gif' }));
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const g = canvas.getContext('2d')!;
    g.drawImage(image, 0, 0);
    // The image spans 400×200 composition units centred in 640×360.
    const at = (fx: number, fy: number) => {
      const x = Math.round(((120 + 400 * fx) / 640) * canvas.width);
      const y = Math.round(((80 + 200 * fy) / 360) * canvas.height);
      return Array.from(g.getImageData(x, y, 1, 1).data).slice(0, 3);
    };
    return { leftRed: at(0.2, 0.2), rightRed: at(0.8, 0.2) };
  }, bytes);
  expect(close(gif.leftRed, gray(luma(RED)), 10), `gif left ${gif.leftRed}`).toBe(true);
  expect(close(gif.rightRed, RED, 10), `gif right ${gif.rightRed}`).toBe(true);
  await page.keyboard.press('Escape');

  // ── OGraf: blocked, with the reason ──
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Check OGraf Export…' }).click();
  const dialog = page.getByRole('dialog', { name: 'OGraf export check' });
  await expect(dialog.locator('[data-layer-id="photo"]')).toHaveAttribute('data-capability', 'blocked');
  await expect(dialog.locator('[data-layer-id="photo"]')).toContainText(/colour correction/i);
  await expect(dialog.getByRole('button', { name: 'Export OGraf Package' })).toBeDisabled();
});

test('a duplicate keeps the correction pointing at the copy’s own mask', async ({ page }) => {
  await seed(page);
  await page.getByRole('button', { name: 'Add color correction' }).click();
  await page.getByRole('slider', { name: 'Saturation' }).fill('0');
  await page.getByRole('button', { name: 'Draw rectangle effect mask' }).click();
  const box = (await page.locator('.stage-svg g[data-part-id="photo"]').first().boundingBox())!;
  await page.mouse.move(box.x - 20, box.y - 20);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 20, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.press('Escape');
  await page.locator('[role="tree"] [data-layer-id="photo"]').click();
  await page.getByRole('button', { name: 'Duplicate Actor Instance' }).click();
  await expect(page.locator('.tree-node.actor-node')).toHaveCount(2);
  const doc = await savedScene(page);
  const copy = doc.layers.find((layer: any) => layer.id !== 'photo');
  expect(copy.effects).toHaveLength(1);
  expect(copy.masks.map((mask: any) => mask.id)).toContain(copy.effects[0].maskId);
  expect(copy.masks.find((mask: any) => mask.id === copy.effects[0].maskId).affectsAlpha).toBe(false);
  // Both layers draw their own correction.
  await expect(page.locator('.stage-svg [data-color-correction="applied"]')).toHaveCount(2);
  // The original is unchanged by the copy.
  const original = doc.layers.find((layer: any) => layer.id === 'photo');
  expect(original.effects[0]).toMatchObject({ scope: 'mask', saturation: 0 });
});
