import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';

/**
 * Export as GIF, measured in a real browser.
 *
 * The export is checked the way a viewer checks it: the file is read back with
 * an independent GIF reader (header, global colour table, per-frame delay and
 * LZW data), the frames are proved to change across the animation by locating
 * the moving rectangle's pixels in the first, middle and last frame, and the
 * browser itself decodes the file into a canvas.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

interface SeededLayer {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: string;
  [key: string]: unknown;
}

const rect = (overrides: Partial<SeededLayer> = {}): SeededLayer => ({
  id: 'mover',
  name: 'Mover',
  type: 'custom_rect',
  x: -100,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  visible: true,
  zIndex: 1,
  fillColor: '#ff0000',
  strokeColor: '#000000',
  strokeEnabled: false,
  fillEnabled: true,
  width: 40,
  height: 40,
  ...overrides,
});

/** The mover animates x from -100 to +100 over the seeded sequence. */
const moverTrack = {
  id: 'track-mover',
  partId: 'mover',
  name: 'Mover',
  color: '#fff',
  visible: true,
  locked: false,
  channels: {
    x: [
      { id: 'kx1', frame: 0, value: -100, easing: 'linear' },
      { id: 'kx2', frame: 11, value: 100, easing: 'linear' },
    ],
  },
};

const seed = async (
  page: Page,
  layers: SeededLayer[],
  tracks: unknown[],
  box: { width: number; height: number; fps: number; totalFrames: number } = { width: 320, height: 180, fps: 24, totalFrames: 12 },
): Promise<void> => {
  const scene = JSON.stringify({
    version: 1,
    coordinateSystem: 'project-unit-center-v1',
    ...box,
    layers,
    tracks,
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    (payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value),
    { key: STORAGE_KEY, value: scene },
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
};

const openGifPanel = async (page: Page) => {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Animated GIF', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Export animated GIF' });
  await expect(panel).toBeVisible();
  return panel;
};

/** An independent GIF89a reader, so the assertion is about the format, not the writer. */
interface GifFrame {
  delayCentiseconds: number;
  transparentIndex: number;
  indices: number[];
}

interface ParsedGif {
  version: string;
  width: number;
  height: number;
  palette: number[][];
  frames: GifFrame[];
}

const parseGif = (bytes: Uint8Array): ParsedGif => {
  const readUint16 = (offset: number) => bytes[offset] | (bytes[offset + 1] << 8);
  const version = String.fromCharCode(...bytes.subarray(0, 6));
  const width = readUint16(6);
  const height = readUint16(8);
  const tableSize = 2 ** ((bytes[10] & 0x07) + 1);
  const palette: number[][] = [];
  for (let slot = 0; slot < tableSize; slot += 1) {
    palette.push([bytes[13 + slot * 3], bytes[14 + slot * 3], bytes[15 + slot * 3]]);
  }
  let offset = 13 + tableSize * 3;
  const frames: GifFrame[] = [];
  while (offset < bytes.length) {
    const marker = bytes[offset];
    if (marker === 0x3B) break;
    if (marker !== 0x21) throw new Error(`Unexpected GIF marker 0x${marker.toString(16)}.`);
    const label = bytes[offset + 1];
    if (label !== 0xF9) {
      offset += 2;
      while (bytes[offset] !== 0) offset += 1 + bytes[offset];
      offset += 1;
      continue;
    }
    const packed = bytes[offset + 3];
    const delay = readUint16(offset + 4);
    const transparentIndex = bytes[offset + 6];
    offset += 8;
    if (bytes[offset] !== 0x2C) throw new Error('Expected an image descriptor.');
    const frameWidth = readUint16(offset + 5);
    const frameHeight = readUint16(offset + 7);
    offset += 10;
    const minCodeSize = bytes[offset];
    offset += 1;
    const data: number[] = [];
    while (bytes[offset] !== 0) {
      const size = bytes[offset];
      for (let index = 0; index < size; index += 1) data.push(bytes[offset + 1 + index]);
      offset += 1 + size;
    }
    offset += 1;
    frames.push({
      delayCentiseconds: delay,
      transparentIndex: (packed & 0x01) === 1 ? transparentIndex : -1,
      indices: lzwDecode(data, minCodeSize, frameWidth * frameHeight),
    });
  }
  return { version, width, height, palette, frames };
};

const lzwDecode = (data: number[], minCodeSize: number, pixelCount: number): number[] => {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const sizeFor = (tableLength: number) => Math.min(12, Math.max(minCodeSize + 1, Math.ceil(Math.log2(tableLength + 1))));
  let dictionary: number[][] = [];
  let codeSize = sizeFor(clearCode + 2);
  const reset = () => {
    dictionary = [];
    for (let index = 0; index < clearCode; index += 1) dictionary.push([index]);
    dictionary.push([], []);
    codeSize = sizeFor(dictionary.length);
  };
  reset();

  const indices: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;
  let cursor = 0;
  let previous: number[] | null = null;
  for (;;) {
    while (bitCount < codeSize && cursor < data.length) {
      bitBuffer |= data[cursor] << bitCount;
      bitCount += 8;
      cursor += 1;
    }
    if (bitCount < codeSize) break;
    const code = bitBuffer & ((1 << codeSize) - 1);
    bitBuffer >>= codeSize;
    bitCount -= codeSize;
    if (code === endCode) break;
    if (code === clearCode) {
      reset();
      previous = null;
      continue;
    }
    const entry = code < dictionary.length && dictionary[code].length > 0
      ? dictionary[code]
      : previous ? [...previous, previous[0]] : [];
    if (entry.length === 0) throw new Error(`Invalid LZW code ${code}.`);
    indices.push(...entry);
    if (previous) {
      dictionary.push([...previous, entry[0]]);
      codeSize = sizeFor(dictionary.length);
    }
    previous = entry;
    if (indices.length > pixelCount * 2) throw new Error('LZW stream is too long.');
  }
  return indices.slice(0, pixelCount);
};

/** The mean x (in pixels) of the opaque pixels of a frame: where the art is. */
const opaqueCentroidX = (gif: ParsedGif, frameIndex: number): number => {
  const frame = gif.frames[frameIndex];
  let sum = 0;
  let count = 0;
  frame.indices.forEach((slot, pixel) => {
    if (slot === frame.transparentIndex || slot === 0) return;
    sum += pixel % gif.width;
    count += 1;
  });
  return count === 0 ? -1 : sum / count;
};

const downloadBytes = async (page: Page): Promise<Uint8Array> => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export GIF', exact: true }).click();
  const download = await downloadPromise;
  // The file name is the scene's own title, sanitised by the shared path guard.
  expect(download.suggestedFilename()).toBe('Template.gif');
  const path = await download.path();
  expect(path).toBeTruthy();
  return new Uint8Array(await readFile(path!));
};

test('exports the current sequence as an animated GIF at the stage size', async ({ page }) => {
  await seed(page, [rect()], [moverTrack]);
  const panel = await openGifPanel(page);

  // The panel states what will be written, from the same plan the render uses:
  // 12 authored frames at 24 fps, exported at the project rate at 100%.
  await expect(panel).toContainText('Frames');
  await expect(panel.locator('.gif-export-summary dd').first()).toHaveText('12');
  await expect(panel.locator('.gif-export-summary dd').nth(1)).toHaveText('0.50 s');
  await expect(panel.locator('.gif-export-summary dd').nth(2)).toHaveText('320×180');
  await expect(panel.getByLabel('Frame rate')).toHaveValue('24');
  // The format's transparency rule is stated before the export, not after.
  await expect(panel).toContainText('one transparent colour and no partial alpha');

  const bytes = await downloadBytes(page);
  const gif = parseGif(bytes);

  expect(gif.version).toBe('GIF89a');
  expect([gif.width, gif.height]).toEqual([320, 180]);
  expect(gif.frames).toHaveLength(12);
  // 24 fps is 4.1666… centiseconds per frame: the delays stay whole (4, with a 5
  // where the rounding carries) and add up to the authored half second exactly.
  expect(gif.frames.every((frame) => frame.delayCentiseconds >= 4 && frame.delayCentiseconds <= 5)).toBe(true);
  expect(gif.frames.reduce((sum, frame) => sum + frame.delayCentiseconds, 0)).toBe(50);
  expect(gif.frames[0].transparentIndex).toBe(0);
  // The red rectangle is in the global palette, so the art survives exactly.
  expect(gif.palette).toContainEqual([255, 0, 0]);

  // First / middle / last: the rectangle travels from the left of the stage to
  // the right, so its pixels move with it.
  const first = opaqueCentroidX(gif, 0);
  const middle = opaqueCentroidX(gif, 6);
  const last = opaqueCentroidX(gif, 11);
  expect(first).toBeGreaterThan(0);
  expect(middle).toBeGreaterThan(first + 20);
  expect(last).toBeGreaterThan(middle + 20);
  // The last frame is the animated end of the channel, not a copy of the first.
  expect(gif.frames[11].indices).not.toEqual(gif.frames[0].indices);

  // A standard browser decodes the file: dimensions, the first frame's art and
  // the untouched transparent background around it.
  const decoded = await page.evaluate(async (payload: number[]) => {
    const image = new Image();
    image.src = URL.createObjectURL(new Blob([new Uint8Array(payload)], { type: 'image/gif' }));
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const corner = [data[0], data[1], data[2], data[3]];
    let red = 0;
    for (let pixel = 0; pixel < canvas.width * canvas.height; pixel += 1) {
      if (data[pixel * 4] > 200 && data[pixel * 4 + 1] < 40 && data[pixel * 4 + 2] < 40 && data[pixel * 4 + 3] > 200) red += 1;
    }
    return { width: image.naturalWidth, height: image.naturalHeight, corner, red };
  }, Array.from(bytes));

  expect([decoded.width, decoded.height]).toEqual([320, 180]);
  expect(decoded.corner).toEqual([0, 0, 0, 0]);
  expect(decoded.red).toBeGreaterThan(100);
});

test('a cancelled export writes nothing', async ({ page }) => {
  // A 1080p / 120-frame sequence so the export is long enough to cancel in.
  await seed(page, [rect({ width: 400, height: 400 })], [{
    ...moverTrack,
    channels: { x: [ { id: 'kx1', frame: 0, value: -800, easing: 'linear' }, { id: 'kx2', frame: 119, value: 800, easing: 'linear' } ] },
  }], { width: 1920, height: 1080, fps: 60, totalFrames: 120 });
  await openGifPanel(page);
  await expect(page.getByLabel('Frame rate')).toHaveValue('60');

  await page.getByRole('button', { name: 'Export GIF', exact: true }).click();
  const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
  await expect(cancel).toBeVisible();
  await cancel.click();

  await expect(page.getByText('GIF export cancelled. Nothing was written.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export GIF', exact: true })).toBeVisible();
});

test('a scene the frames cannot draw is refused before anything is rendered', async ({ page }) => {
  await seed(page, [
    rect(),
    rect({ id: 'clip', name: 'Clip', type: 'custom_video', videoUrl: 'data:video/mp4;base64,AAAA', width: 100, height: 60 }),
  ], [moverTrack]);
  const panel = await openGifPanel(page);

  await expect(panel.getByRole('alert')).toContainText('cannot be drawn frame by frame');
  await expect(page.getByRole('button', { name: 'Export GIF', exact: true })).toBeDisabled();
});

test('GIF panel keeps inside clicks open and dismisses on outside click or Escape', async ({ page }) => {
  await seed(page, [rect()], [moverTrack]);
  const panel = await openGifPanel(page);
  await panel.getByRole('heading', { name: 'Export as GIF' }).click();
  await expect(panel).toBeVisible();
  await page.locator('.stage-canvas-container').click({ position: { x: 100, y: 100 } });
  await expect(panel).toBeHidden();
  await openGifPanel(page);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

test('120 FPS GIF sampling preserves the encoded half-second duration without zero delays', async ({ page }) => {
  await seed(page, [rect()], [moverTrack]);
  const panel = await openGifPanel(page);
  await expect(panel.getByLabel('Frame rate').locator('option[value="120"]')).toHaveCount(1);
  await panel.getByLabel('Frame rate').selectOption('120');
  const gif = parseGif(await downloadBytes(page));
  expect(gif.frames.reduce((sum, frame) => sum + frame.delayCentiseconds, 0)).toBe(50);
  expect(gif.frames.every((frame) => frame.delayCentiseconds >= 2)).toBe(true);
  expect(opaqueCentroidX(gif, gif.frames.length - 1)).toBeGreaterThan(opaqueCentroidX(gif, 0) + 100);
});
