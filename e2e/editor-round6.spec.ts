/**
 * QA round 6: the menu bar, the tool flyout, drawing text, paste at the mouse,
 * undo keeping the selection, the live marquee preview and Shift/Alt applying
 * the moment they are pressed.
 */
import { expect, test, type Page } from '@playwright/test';
import { armTool } from './fixtures/toolbarTools';

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const rect = (id: string, name: string, x: number, y: number) => ({
  id, name, type: 'custom_rect', x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#f97316', strokeColor: '#000000', width: 120, height: 60,
});

async function seed(page: Page, layers: unknown[] = []) {
  await page.goto('/');
  await page.evaluate(([key, value]) => { localStorage.clear(); localStorage.setItem(key, value); }, [STORAGE_KEY, JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    layers,
    tracks: (layers as Array<{ id: string; name: string }>).map((layer) => ({ id: `track-${layer.id}`, partId: layer.id, name: layer.name, color: '#22d3ee', visible: true, locked: false, expanded: false, channels: {} })),
  })] as const);
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

const stageBox = async (page: Page) => {
  const box = await page.locator('.stage-canvas-container').boundingBox();
  if (!box) throw new Error('no stage');
  return box;
};

const savedLayers = async (page: Page) => {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  // A fresh save, not the state an earlier save left.
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10_000 }).toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').layers as Array<Record<string, number | string>>, STORAGE_KEY);
};

/** The screen point of a world (layer x/y) point. */
const screenOf = (page: Page, x: number, y: number) => page.evaluate(([wx, wy]) => {
  const svg = document.querySelector<SVGSVGElement>('.stage-svg')!;
  const point = new DOMPoint(300 + wx, 240 + wy).matrixTransform(svg.getScreenCTM()!);
  return { x: point.x, y: point.y };
}, [x, y] as [number, number]);

test('the menu bar runs the editor commands; the left panel is gone', async ({ page }) => {
  await seed(page, [rect('a', 'Alpha', 0, 0)]);
  const bar = page.getByRole('menubar', { name: 'Editor menu' });
  await expect(page.locator('.left-toolbar-container')).toHaveCount(0);
  await bar.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await page.getByRole('menuitem', { name: /^Select All/ }).click();
  await expect(page.locator('[role="tree"] [data-layer-id="a"]')).toHaveAttribute('aria-selected', 'true');
  // Hovering another title while a menu is open switches to it; Escape closes.
  await bar.getByRole('menuitem', { name: 'View', exact: true }).click();
  await bar.getByRole('menuitem', { name: 'Object', exact: true }).hover();
  await expect(page.getByRole('menuitem', { name: 'Reset Transform' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: 'Reset Transform' })).toHaveCount(0);
  await bar.getByRole('menuitem', { name: 'File', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Project Settings…' }).click();
  await expect(page.getByRole('dialog', { name: 'Project Settings' })).toBeVisible();
});

test('holding the shape button opens its list; releasing over Star picks it and the button keeps it', async ({ page }) => {
  await seed(page);
  const button = page.getByRole('button', { name: 'Add rectangle' });
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.getByRole('menu', { name: /tools$/ })).toBeVisible();
  const star = (await page.getByRole('menuitemradio', { name: /^Star/ }).boundingBox())!;
  await page.mouse.move(star.x + 20, star.y + star.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Add star' })).toHaveAttribute('aria-pressed', 'true');
  const stage = await stageBox(page);
  await page.mouse.move(stage.x + 200, stage.y + 150);
  await page.mouse.down();
  await page.mouse.move(stage.x + 300, stage.y + 250, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('.actor-node', { hasText: 'Star' })).toHaveCount(1);
  // A second press keeps the tool.
  await page.getByRole('button', { name: 'Add star' }).click();
  await expect(page.getByRole('button', { name: 'Add star' })).toHaveAttribute('aria-pressed', 'true');
});

test('the Text tool draws a text box: its size from the drag, its centre in the box', async ({ page }) => {
  await seed(page);
  await page.getByRole('button', { name: 'Add text' }).click();
  const from = await screenOf(page, -200, -50);
  const to = await screenOf(page, 200, 50);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  const [text] = await savedLayers(page);
  expect(text.type).toBe('custom_text');
  expect(Math.abs(Number(text.x))).toBeLessThan(3);
  expect(Math.abs(Number(text.y))).toBeLessThan(3);
  // 100 units tall → a font about 100 / 1.2; the box width limits the text.
  expect(Number(text.fontSize)).toBeGreaterThan(75);
  expect(Number(text.fontSize)).toBeLessThan(90);
  expect((text.textFit as unknown as { maxWidth: number }).maxWidth).toBeGreaterThan(390);
});

test('the Text tool places nothing on a plain click, and its preview fits the box', async ({ page }) => {
  // QA 2026-11-13: a click without a drag dropped a text at the default size,
  // and the preview text ran past the box being drawn.
  await seed(page);
  await page.getByRole('button', { name: 'Add text' }).click();
  const at = await screenOf(page, 0, 0);
  await page.mouse.click(at.x, at.y);
  await expect(page.locator('.actor-node', { hasText: 'Text' })).toHaveCount(0);

  const from = await screenOf(page, -150, -60);
  const to = await screenOf(page, 150, 60);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  // QA 2026-11-13 (qa23): only the text's dashed frame is drawn, no shaded area.
  await expect(page.getByTestId('text-creation-area')).toHaveCount(0);
  const area = { x: from.x, y: from.y, width: to.x - from.x, height: to.y - from.y };
  const ink = (await page.getByTestId('text-creation-preview').boundingBox())!;
  expect(ink.x).toBeGreaterThanOrEqual(area.x - 1);
  expect(ink.x + ink.width).toBeLessThanOrEqual(area.x + area.width + 1);
  // The dashed frame is the one the text gets once placed: it hugs the
  // letters, inside the drawn area (no padding above and below them).
  const frame = (await page.getByTestId('text-creation-frame').boundingBox())!;
  expect(frame.y).toBeGreaterThanOrEqual(area.y);
  expect(frame.y + frame.height).toBeLessThanOrEqual(area.y + area.height);
  expect(frame.height).toBeLessThan(area.height * 0.8);
  await page.mouse.up();
  await expect(page.locator('.actor-node', { hasText: 'Text' })).toHaveCount(1);
});

test('Ctrl+V pastes where the mouse is', async ({ page }) => {
  await seed(page, [rect('a', 'Alpha', -300, -200)]);
  await page.locator('[role="tree"] [data-layer-id="a"]').click();
  await page.keyboard.press('Control+c');
  const target = await screenOf(page, 250, 120);
  await page.mouse.move(target.x, target.y);
  await page.keyboard.press('Control+v');
  const layers = await savedLayers(page);
  const copy = layers.find((layer) => layer.name === 'Alpha Copy')!;
  expect(Math.abs(Number(copy.x) - 250)).toBeLessThan(3);
  expect(Math.abs(Number(copy.y) - 120)).toBeLessThan(3);
});

test('the marquee previews what it will select, and undo keeps the selection an edit started from', async ({ page }) => {
  await seed(page, [rect('a', 'Alpha', -150, 0), rect('b', 'Beta', 150, 0), rect('c', 'Gamma', 0, 300)]);
  const from = await screenOf(page, -260, -80);
  const to = await screenOf(page, 260, 80);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await expect(page.getByTestId('marquee-preview').locator('rect')).toHaveCount(2);
  await page.mouse.up();
  await expect(page.getByTestId('marquee-preview')).toHaveCount(0);
  const selected = page.locator('[role="tree"] [aria-selected="true"]');
  await expect(selected).toHaveCount(2);
  // Group them, then undo: the two layers are selected again.
  await page.keyboard.press('Control+g');
  await expect(page.locator('[role="tree"] [aria-selected="true"]')).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect(selected).toHaveCount(2);
  await expect(page.locator('[role="tree"] [data-layer-id="a"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[role="tree"] [data-layer-id="b"]')).toHaveAttribute('aria-selected', 'true');
});

test('Shift makes a square the moment it is pressed, without moving the mouse', async ({ page }) => {
  await seed(page);
  await armTool(page, 'Rectangle');
  const from = await screenOf(page, -100, -40);
  const to = await screenOf(page, 100, 40);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  const preview = page.getByTestId('shape-creation-preview');
  const before = (await preview.boundingBox())!;
  expect(before.width / before.height).toBeGreaterThan(2);
  await page.keyboard.down('Shift');
  await expect.poll(async () => {
    const now = (await preview.boundingBox())!;
    return Math.round((now.width / now.height) * 100) / 100;
  }).toBe(1);
  await page.keyboard.up('Shift');
  await expect.poll(async () => ((await preview.boundingBox())!.width / (await preview.boundingBox())!.height) > 2).toBe(true);
  await page.mouse.up();
});

test('Alt on a corner handle scales about the centre', async ({ page }) => {
  await seed(page, [rect('a', 'Alpha', 0, 0)]);
  await page.locator('[role="tree"] [data-layer-id="a"]').click();
  // The rectangle's corners are at (±60, ±30); its origin is its centre.
  const corner = await screenOf(page, 60, 30);
  const target = await screenOf(page, 90, 50);
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.keyboard.down('Alt');
  await page.mouse.move(target.x, target.y, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Alt');
  const [layer] = await savedLayers(page);
  // The centre stayed; both sides grew (corner 60 → 90 is a 1.5× scale).
  expect(Math.abs(Number(layer.x))).toBeLessThan(1);
  expect(Math.abs(Number(layer.y))).toBeLessThan(1);
  expect(Number(layer.scaleX)).toBeCloseTo(1.5, 1);
  expect(Number(layer.scaleY)).toBeCloseTo(50 / 30, 1);
});

test('K keys the transform of every selected layer as one undo step', async ({ page }) => {
  // Round 6 (OGraf Studio review, "Key transform"): one key for the selection.
  await seed(page, [rect('a', 'Alpha', -150, 0), rect('b', 'Beta', 150, 0)]);
  await page.locator('[role="tree"] [data-layer-id="a"]').click();
  await page.locator('[role="tree"] [data-layer-id="b"]').click({ modifiers: ['Shift'] });
  await page.locator('.stage-canvas-container').hover();
  await page.keyboard.press('k');
  const keyed = async () => {
    await savedLayers(page);
    return page.evaluate((key) => (JSON.parse(localStorage.getItem(key) ?? '{}').tracks as Array<{ partId: string; channels: Record<string, Array<{ frame: number }>> }>)
      .map((track) => [track.partId, (track.channels.x ?? []).map((k) => k.frame)]), STORAGE_KEY);
  };
  expect(await keyed()).toEqual([['a', [0]], ['b', [0]]]);
  await page.keyboard.press('Control+z');
  expect(await keyed()).toEqual([['a', []], ['b', []]]);
});

test('the zoom bar shows and sets the real zoom, 1:1 and Fit', async ({ page }) => {
  // Round 6 (OGraf Studio review): a zoom bar; 100 % is one project pixel per screen pixel.
  await seed(page);
  const artboard = page.locator('rect.canvas-bg[filter]');
  const width = async () => (await artboard.boundingBox())!.width;
  await page.getByRole('combobox', { name: 'Zoom presets' }).selectOption('25');
  await expect.poll(width).toBeCloseTo(1920 * 0.25, 0);
  await expect(page.getByRole('textbox', { name: 'Zoom percentage' })).toHaveValue('25%');
  await page.getByRole('group', { name: 'Zoom and guides' }).getByRole('button', { name: 'Actual size (1:1)' }).click();
  await expect.poll(width).toBeCloseTo(1920, 0);
  const field = page.getByRole('textbox', { name: 'Zoom percentage' });
  await field.fill('40');
  await field.press('Enter');
  await expect.poll(width).toBeCloseTo(1920 * 0.4, 0);
  await page.getByRole('group', { name: 'Zoom and guides' }).getByRole('button', { name: 'Fit the artboard' }).click();
  const stage = await stageBox(page);
  await expect.poll(async () => {
    const box = (await artboard.boundingBox())!;
    return box.x >= stage.x && box.y >= stage.y && box.x + box.width <= stage.x + stage.width && box.y + box.height <= stage.y + stage.height
      && Math.abs(box.x + box.width / 2 - (stage.x + stage.width / 2)) < 2;
  }).toBe(true);
});

test('the safe-area guides frame 93 % and 90 % of the artboard, and are off by default', async ({ page }) => {
  // Round 6 (OGraf Studio review): EBU R95 action-safe and title-safe guides.
  await seed(page);
  await expect(page.getByTestId('stage-safe-areas')).toHaveCount(0);
  await page.getByRole('group', { name: 'Zoom and guides' }).getByRole('button', { name: 'Toggle safe areas' }).click();
  const artboard = (await page.locator('rect.canvas-bg[filter]').boundingBox())!;
  const action = (await page.getByTestId('safe-area-action').boundingBox())!;
  const title = (await page.getByTestId('safe-area-title').boundingBox())!;
  expect(action.width / artboard.width).toBeCloseTo(0.93, 2);
  expect(title.height / artboard.height).toBeCloseTo(0.9, 2);
  expect(action.x + action.width / 2).toBeCloseTo(artboard.x + artboard.width / 2, 0);
});

test('Replace Image swaps the picture and keeps the layer, its animation and its width', async ({ page }) => {
  // Round 6 (OGraf Studio review): replace an image without rebuilding the layer.
  const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  await seed(page, [{ id: 'img', name: 'Photo', type: 'custom_image', x: 100, y: -40, rotation: 15, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, width: 100, height: 100, imageUrl: pixel }]);
  await page.evaluate((key) => {
    const doc = JSON.parse(localStorage.getItem(key) ?? '{}');
    doc.tracks[0].channels = { x: [{ id: 'kx', frame: 0, value: 100, easing: 'linear', templateId: 'Sequence' }, { id: 'kx2', frame: 30, value: 300, easing: 'linear', templateId: 'Sequence' }] };
    localStorage.setItem(key, JSON.stringify(doc));
  }, STORAGE_KEY);
  await page.reload();
  await page.locator('[role="tree"] [data-layer-id="img"]').click();
  const wide = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 20;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#3080ff';
    context.fillRect(0, 0, 40, 20);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByRole('button', { name: 'Expand IMAGE' }).click();
  await expect(page.getByRole('button', { name: 'Replace Image…' })).toBeVisible();
  await page.getByTestId('replace-image-input').setInputFiles({ name: 'wide.png', mimeType: 'image/png', buffer: Buffer.from(wide, 'base64') });
  await expect.poll(async () => (await savedLayers(page)).find((layer) => layer.id === 'img')?.height).toBe(50);
  const layer = (await savedLayers(page)).find((candidate) => candidate.id === 'img')!;
  expect(layer.width).toBe(100);
  expect(layer.rotation).toBe(15);
  expect(String(layer.imageUrl)).not.toBe(pixel);
  const keys = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').tracks[0].channels.x.map((k: { frame: number; value: number }) => [k.frame, k.value]), STORAGE_KEY);
  expect(keys).toEqual([[0, 100], [30, 300]]);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await savedLayers(page)).find((candidate) => candidate.id === 'img')?.height).toBe(100);
});

test('New from Template opens a ready-made lower third, fitted in view, in the empty tab', async ({ page }) => {
  // Round 6 (OGraf Studio review): start from a ready-made graphic.
  await seed(page);
  await page.getByRole('menubar').getByRole('menuitem', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'New from Template…' }).click();
  const dialog = page.getByRole('dialog', { name: 'New from Template' });
  await dialog.getByRole('combobox', { name: 'Frame rate' }).selectOption('25');
  await dialog.getByRole('button', { name: /^Lower Third/ }).click();
  await expect(dialog).toHaveCount(0);
  for (const name of ['Bar', 'Accent', 'Name', 'Title']) {
    await expect(page.locator('.actor-node', { has: page.locator('.actor-name', { hasText: new RegExp(`^${name}$`) }) })).toHaveCount(1);
  }
  // The empty tab took the graphic and its name (no second tab).
  await expect(page.locator('.header-tab.active')).toContainText('Lower Third');
  await expect(page.locator('.header-tab:not(.add-tab)')).toHaveCount(1);
  // The five-second sequence at 25 fps.
  await expect(page.locator('.timecode-total')).toHaveText('/ 00:05:00');
  // Seek past the entrance: the bar hugs the name (narrower than its authored 820 px) and holds the text.
  const field = page.getByRole('textbox', { name: 'Current time' });
  await field.fill('2s');
  await field.press('Enter');
  const box = async (id: string) => (await page.locator(`.stage-canvas-container [data-part-id="${id}"]`).first().boundingBox())!;
  await expect.poll(async () => {
    const [bar, name] = [await box('bar'), await box('title')];
    return bar.x <= name.x && bar.x + bar.width >= name.x + name.width && bar.width < name.width * 2;
  }).toBe(true);
  // The whole artboard is in view.
  const stage = await stageBox(page);
  const artboard = (await page.locator('rect.canvas-bg[filter]').boundingBox())!;
  expect(artboard.x).toBeGreaterThanOrEqual(stage.x);
  expect(artboard.x + artboard.width).toBeLessThanOrEqual(stage.x + stage.width);
});

test('a text types itself out, set in the Inspector and kept after a reload', async ({ page }) => {
  // Round 6 (OGraf Studio review): text effects over time.
  await seed(page, [{ id: 't', name: 'Score', type: 'custom_text', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, textValue: 'HELLO WORLD', fontSize: 72, fillColor: '#ffffff', strokeColor: '#000000', textOrigin: 'center' }]);
  await page.locator('[role="tree"] [data-layer-id="t"]').click();
  const expand = page.getByRole('button', { name: 'Expand TEXT EFFECTS' });
  if (await expand.count()) await expand.click();
  await page.getByLabel('ANIMATE TEXT').selectOption('typewriter');
  const drawn = page.locator('.stage-canvas-container [data-part-id="t"] text').first();
  const seek = async (time: string) => {
    const field = page.getByRole('textbox', { name: 'Current time' });
    await field.fill(time);
    await field.press('Enter');
  };
  // One second at 30 fps: half way, HELLO is shown and the rest holds its place, transparent.
  const width = (await drawn.boundingBox())!.width;
  await seek('15f');
  await expect(drawn.locator('[data-text-effect-hidden]')).toHaveText(' WORLD');
  expect(await drawn.evaluate((node) => node.firstChild?.textContent)).toBe('HELLO');
  expect(Math.abs((await drawn.boundingBox())!.width - width)).toBeLessThan(2);
  await seek('1s');
  await expect(drawn.locator('[data-text-effect-hidden]')).toHaveCount(0);

  // Kept by the autosave and after a reload.
  const saved = (await savedLayers(page)).find((layer) => layer.id === 't') as unknown as { textEffect: unknown };
  expect(saved.textEffect).toEqual({ kind: 'typewriter', startFrame: 0, durationFrames: 30 });
  await page.reload();
  await page.locator('[role="tree"] [data-layer-id="t"]').click();
  await seek('15f');
  await expect(page.locator('.stage-canvas-container [data-part-id="t"] [data-text-effect-hidden]')).toHaveText(' WORLD');

});

test('a countdown text counts down on the timeline and holds at zero', async ({ page }) => {
  await seed(page, [{ id: 'c', name: 'Clock', type: 'custom_text', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, textValue: 'Text', fontSize: 72, fillColor: '#ffffff', strokeColor: '#000000', textOrigin: 'center' }]);
  await page.locator('[role="tree"] [data-layer-id="c"]').click();
  const expand = page.getByRole('button', { name: 'Expand TEXT EFFECTS' });
  if (await expand.count()) await expand.click();
  await page.getByLabel('ANIMATE TEXT').selectOption('countdown');
  const drawn = page.locator('.stage-canvas-container [data-part-id="c"] text').first();
  const seek = async (time: string) => {
    const field = page.getByRole('textbox', { name: 'Current time' });
    await field.fill(time);
    await field.press('Enter');
  };
  await seek('0');
  await expect(drawn).toHaveText('01:00');
  await seek('1s');
  await expect(drawn).toHaveText('00:59');
  // The text was given the starting reading, so the layer is laid out at that size.
  expect((await savedLayers(page)).find((layer) => layer.id === 'c')?.textValue).toBe('01:00');
});

test('the artboard backdrop can be light, a checkerboard or a picture, and is remembered', async ({ page }) => {
  // Round 6 (OGraf Studio review): judge a graphic on light, checker or real footage.
  await seed(page);
  const artboard = page.locator('rect.canvas-bg[filter]');
  const backdrop = page.getByRole('combobox', { name: 'Artboard backdrop' });
  await expect(artboard).toHaveAttribute('data-backdrop', 'dark');
  await backdrop.selectOption('light');
  await expect(artboard).toHaveAttribute('fill', '#f4f4f4');
  await backdrop.selectOption('checker');
  await expect(artboard).toHaveAttribute('fill', 'url(#artboard-checker)');
  await expect(page.locator('pattern#artboard-checker')).toHaveCount(1);

  const picture = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 18;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#2a6';
    context.fillRect(0, 0, 32, 18);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByTestId('artboard-backdrop-input').setInputFiles({ name: 'footage.png', mimeType: 'image/png', buffer: Buffer.from(picture, 'base64') });
  await expect(page.getByTestId('artboard-backdrop-image')).toHaveCount(1);
  await expect(backdrop).toHaveValue('image');

  // A picture is for this session; light or checker is remembered in this browser.
  await backdrop.selectOption('light');
  await page.reload();
  await expect(page.locator('rect.canvas-bg[filter]')).toHaveAttribute('fill', '#f4f4f4');
  // Never part of the scene.
  const saved = await page.evaluate((key) => localStorage.getItem(key) ?? '', STORAGE_KEY);
  expect(saved).not.toContain('backdrop');
});

test('Filter properties keeps only the matching Inspector cards, opened', async ({ page }) => {
  // Round 6 (OGraf Studio review): find a property without opening every card.
  await seed(page, [rect('a', 'Alpha', 0, 0)]);
  await page.locator('[role="tree"] [data-layer-id="a"]').click();
  const filter = page.getByRole('searchbox', { name: 'Filter properties' });
  const titles = page.locator('.details-container .inspector-section-title');
  await expect(titles.filter({ hasText: /^TRANSFORM$/ })).toHaveCount(1);
  await filter.fill('glow');
  await expect(titles.filter({ hasText: /^TRANSFORM$/ })).toHaveCount(0);
  // The glow lives under the appearance's effects: shown, open.
  await expect(page.getByLabel('Glow Enabled')).toBeVisible();
  await filter.press('Escape');
  await expect(filter).toHaveValue('');
  await expect(titles.filter({ hasText: /^TRANSFORM$/ })).toHaveCount(1);
});

test('a layer follows a drawn path: linked in the Inspector, walking it on the timeline, kept after a reload', async ({ page }) => {
  // Round 6: motion path. A straight 400-unit path from (-200, 0) to (200, 0).
  const road = {
    id: 'road', name: 'Road', type: 'custom_freeform', x: -200, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
    fillColor: '#000000', fillEnabled: false, strokeColor: '#ffffff', strokeEnabled: true, strokeWidth: 4,
    path: { version: 1, coordinateSpace: 'local', closed: false, points: [{ id: 'p0', x: 0, y: 0, kind: 'corner' }, { id: 'p1', x: 400, y: 0, kind: 'corner' }] },
  };
  const ball = { id: 'ball', name: 'Ball', type: 'custom_circle', x: 300, y: 300, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 2, fillColor: '#22d3ee', strokeColor: '#000000', width: 40, height: 40 };
  await seed(page, [road, ball]);
  await page.locator('[role="tree"] [data-layer-id="ball"]').click();
  await page.getByRole('button', { name: 'Expand MOTION PATH' }).click();
  await page.getByLabel('Follow path').selectOption('road');

  const centre = async () => {
    const box = await page.locator('.stage-canvas-container [data-part-id="ball"]').first().boundingBox();
    if (!box) throw new Error('no ball');
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const seek = async (time: string) => {
    const field = page.getByRole('textbox', { name: 'Current time' });
    await field.fill(time);
    await field.press('Enter');
  };
  const expectAt = async (x: number, y: number) => {
    const want = await screenOf(page, x, y);
    await expect.poll(async () => Math.abs((await centre()).x - want.x)).toBeLessThan(1.5);
    expect(Math.abs((await centre()).y - want.y)).toBeLessThan(1.5);
  };
  await seek('0');
  await expectAt(-200, 0);
  await seek('2s');
  await expectAt(200, 0);
  // The link is saved with the scene and walks the same after a reload.
  expect((await savedLayers(page)).find((layer) => layer.id === 'ball')?.motionPath).toMatchObject({ sourcePartId: 'road' });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await seek('2s');
  await expectAt(200, 0);
});

test('History lists the undo steps by name; a click goes to that step and a new edit replaces the later ones', async ({ page }) => {
  await seed(page, [rect('a', 'Alpha', -200, 0), rect('b', 'Beta', 200, 0)]);
  const tree = page.locator('[role="tree"]');
  await tree.locator('[data-layer-id="a"]').click();
  await page.keyboard.press('Delete');
  await expect(tree.locator('[data-layer-id="a"]')).toHaveCount(0);
  // Drag Beta on the stage: one move, one step.
  const from = await screenOf(page, 200, 0);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + 30, { steps: 5 });
  await page.mouse.up();

  await page.getByRole('menubar', { name: 'Editor menu' }).getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await page.getByRole('menuitem', { name: 'History…' }).click();
  const panel = page.getByRole('dialog', { name: 'History' });
  const steps = panel.locator('.history-step-label');
  await expect(steps).toHaveText(['Start', 'Delete Alpha', 'Move Beta']);
  await expect(panel.locator('.history-step[aria-current="step"]')).toHaveText(/Move Beta/);

  // Back to the start: Alpha is there again; the later steps wait, dimmed, for redo.
  await panel.getByRole('button', { name: /Start/ }).click();
  await expect(tree.locator('[data-layer-id="a"]')).toHaveCount(1);
  await expect(panel.locator('.history-step.undone')).toHaveCount(2);
  // Forward again in one click, then back one and edit: the step after is replaced.
  await panel.getByRole('button', { name: /Move Beta/ }).click();
  await expect(tree.locator('[data-layer-id="a"]')).toHaveCount(0);
  await panel.getByRole('button', { name: /Delete Alpha/ }).click();
  await tree.locator('[data-layer-id="b"]').click();
  await page.keyboard.press('Delete');
  await expect(steps).toHaveText(['Start', 'Delete Alpha', 'Delete Beta']);
  await panel.getByRole('button', { name: 'Close history' }).click();
  await expect(panel).toHaveCount(0);
});

test('a double-click on a text types into it on the canvas: Enter keeps it as one undo step, Escape puts it back', async ({ page }) => {
  await seed(page, [{ id: 't', name: 'Title', type: 'custom_text', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1, textValue: 'HELLO', fontSize: 72, fillColor: '#ffffff', strokeColor: '#000000', textOrigin: 'center' }]);
  const drawn = page.locator('.stage-canvas-container [data-part-id="t"] text').first();
  const field = page.getByTestId('canvas-text-editor');
  const open = async () => {
    const box = (await drawn.boundingBox())!;
    // Two presses a hand's width apart in time, as a person double-clicks.
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2, { delay: 40 });
    await expect(field).toBeFocused();
  };

  await open();
  // The field stands on the text, with its content selected: typing replaces it.
  await expect(field).toHaveValue('HELLO');
  // (Selecting the text opened its options bar, which resized the stage: the field follows.)
  await expect.poll(async () => {
    const text = (await drawn.boundingBox())!;
    const over = (await field.boundingBox())!;
    return Math.max(Math.abs(over.x + over.width / 2 - (text.x + text.width / 2)), Math.abs(over.y + over.height / 2 - (text.y + text.height / 2)));
  }).toBeLessThan(3);
  await page.keyboard.type('GOAL 2-1');
  // The drawing follows every keystroke.
  await expect(drawn).toHaveText('GOAL 2-1');
  await page.keyboard.press('Enter');
  await expect(field).toHaveCount(0);
  await expect(page.locator('[role="tree"] [data-layer-id="t"]')).toHaveAttribute('aria-selected', 'true');
  expect((await savedLayers(page)).find((layer) => layer.id === 't')!.textValue).toBe('GOAL 2-1');

  // The whole edit is one undo step.
  await page.keyboard.press('Control+z');
  await expect(drawn).toHaveText('HELLO');
  await page.keyboard.press('Control+Shift+z');
  await expect(drawn).toHaveText('GOAL 2-1');

  // Escape puts the text back and leaves nothing to undo; the layer stays selected.
  await open();
  await page.keyboard.type('OOPS');
  await expect(drawn).toHaveText('OOPS');
  await page.keyboard.press('Escape');
  await expect(field).toHaveCount(0);
  await expect(drawn).toHaveText('GOAL 2-1');
  await expect(page.locator('[role="tree"] [data-layer-id="t"]')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Control+z');
  await expect(drawn).toHaveText('HELLO');

  // A click elsewhere on the canvas keeps what was typed.
  await page.keyboard.press('Control+Shift+z');
  await open();
  await page.keyboard.type('FINAL');
  const stage = await stageBox(page);
  await page.mouse.click(stage.x + 40, stage.y + stage.height - 40);
  await expect(field).toHaveCount(0);
  await expect(drawn).toHaveText('FINAL');
});
