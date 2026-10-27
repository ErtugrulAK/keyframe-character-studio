import { expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Synthetic, disposable QA fixtures. No user scene or personal data is used. */
export const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const here = path.dirname(fileURLToPath(import.meta.url));
export const evidenceDir = (pkg: string): string => path.resolve(here, '..', '..', 'evidence', pkg);

export const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
});

/** A synthetic landscape: sky gradient, sun, hills and ground. */
export const LANDSCAPE_URI = `data:image/svg+xml;base64,${Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b6cb0"/><stop offset="1" stop-color="#bee3f8"/></linearGradient></defs>
    <rect width="480" height="270" fill="url(#sky)"/>
    <circle cx="380" cy="70" r="30" fill="#f6e05e"/>
    <path d="M0 190 Q120 120 240 180 T480 160 V270 H0 Z" fill="#2f855a"/>
    <rect y="220" width="480" height="50" fill="#744210"/>
  </svg>`,
).toString('base64')}`;

export const normalizedRectPath = (x0: number, y0: number, x1: number, y1: number) => ({
  version: 1,
  coordinateSpace: 'normalized',
  closed: true,
  points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }],
});

export const imageLayer = (overrides: Record<string, unknown> = {}) => ({
  id: 'landscape',
  name: 'Landscape',
  type: 'custom_image',
  x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 1,
  fillColor: '#ffffff', strokeColor: '#101218',
  width: 480, height: 270,
  imageUrl: LANDSCAPE_URI,
  ...overrides,
});

export const track = (partId: string, overrides: Record<string, unknown> = {}) => ({
  id: `track-${partId}`, partId, name: partId, color: '#22d3ee', visible: true, locked: false, expanded: false,
  channels: emptyChannels(),
  ...overrides,
});

export const SEQUENCES = [
  { id: 'Sequence', name: 'Sequence', type: 'in', durationFrames: 60 },
  { id: 'Intro', name: 'Intro', type: 'in', durationFrames: 60 },
];

/** Seeds a scene into a fresh, disposable origin and waits for the app shell. */
export async function seedScene(page: Page, scene: Record<string, unknown>): Promise<void> {
  const payload = JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60,
    ...scene,
  });
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate((entry: { key: string; value: string }) => {
    localStorage.clear();
    localStorage.setItem(entry.key, entry.value);
  }, { key: STORAGE_KEY, value: payload });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
}

/** Forces an autosave and returns the persisted scene JSON. */
export async function savedScene(page: Page): Promise<Record<string, any>> {
  const badge = page.locator('.autosave-status-badge');
  const before = Number((await badge.getAttribute('data-last-saved-at')) || '0');
  await badge.click();
  await expect.poll(async () => Number((await badge.getAttribute('data-last-saved-at')) || '0'), { timeout: 10000 })
    .toBeGreaterThan(before);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
}

/** Moves the edit playhead with the ruler's keyboard contract. */
export async function seekFrame(page: Page, frame: number): Promise<void> {
  const ruler = page.getByRole('slider', { name: 'Playhead position' });
  await ruler.focus();
  await page.keyboard.press('Home');
  for (let step = 0; step < Math.floor(frame / 10); step += 1) await page.keyboard.press('Shift+ArrowRight');
  for (let step = 0; step < frame % 10; step += 1) await page.keyboard.press('ArrowRight');
  await expect(ruler).toHaveAttribute('aria-valuenow', String(frame));
}

/** Collects console errors and failed requests for the report. */
export function watchPage(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => errors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ''}`));
  return { errors };
}
