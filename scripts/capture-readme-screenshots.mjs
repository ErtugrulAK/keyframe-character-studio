// Recreates the README screenshots (docs/assets/readme/*.png) from a running
// editor, so they can be refreshed whenever the UI changes:
//
//   npx vite --port 5311            (in another terminal)
//   node scripts/capture-readme-screenshots.mjs http://127.0.0.1:5311
//
// It uses a fresh browser profile: the user's own autosave is never touched.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] ?? 'http://127.0.0.1:5311';
const OUT = path.resolve('docs/assets/readme');
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

const LANDSCAPE = `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#20364f"/><stop offset="1" stop-color="#4a6a7a"/></linearGradient></defs>
<rect width="960" height="540" fill="url(#sky)"/><circle cx="700" cy="140" r="70" fill="#e9c27e"/>
<path d="M0 420 L240 150 L420 360 L560 230 L760 420 L960 300 L960 540 L0 540 Z" fill="#3d5966"/>
<path d="M0 470 L180 330 L330 450 L520 300 L700 470 L960 380 L960 540 L0 540 Z" fill="#2f4752"/></svg>`).toString('base64')}`;

const channels = () => ({ x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [], trimPathStart: [], trimPathEnd: [], trimPathOffset: [] });
const key = (id, frame, value, easing = 'easeInOut') => ({ id, frame, value, easing, templateId: 'Sequence' });
const base = { rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, strokeColor: '#101218', strokeEnabled: false, fillEnabled: true };
const track = (partId, name, extra = {}) => ({ id: `track-${partId}`, partId, name, color: '#4a8fe7', visible: true, locked: false, expanded: false, channels: channels(), ...extra });

const scene = {
  version: 1, coordinateSystem: 'project-unit-center-v1', width: 1280, height: 720, fps: 30, totalFrames: 90, name: 'Lower third demo',
  layers: [
    { ...base, id: 'landscape', name: 'Landscape', type: 'custom_image', x: 0, y: -80, zIndex: 1, width: 640, height: 360, imageUrl: LANDSCAPE,
      masks: [{ id: 'win', name: 'Window', mode: 'add', path: { version: 1, coordinateSpace: 'normalized', closed: true, points: [
        { x: 0.04, y: 0.06, handleOut: { x: 0.2, y: 0.02 } }, { x: 0.96, y: 0.04 }, { x: 0.98, y: 0.94, handleIn: { x: 1, y: 0.7 } }, { x: 0.03, y: 0.97 },
      ] } }] },
    { ...base, id: 'orbit', name: 'Orbit', type: 'custom_circle', x: -427, y: -240, zIndex: 2, fillColor: '#38a8f0' },
    { ...base, id: 'star', name: 'Star', type: 'custom_star', x: 427, y: -253, rotation: 18, zIndex: 3, scaleX: 1.3, scaleY: 1.3, fillColor: '#f2b84b' },
    { ...base, id: 'panel', name: 'Lower third', type: 'custom_rect', x: 0, y: 220, zIndex: 4, scaleX: 4.8, scaleY: 1.35, fillColor: '#11161d', fillOpacity: 0.92 },
    { ...base, id: 'accent', name: 'Accent', type: 'custom_rect', x: -284, y: 220, zIndex: 5, scaleX: 0.07, scaleY: 1.35, fillColor: '#4a8fe7' },
    { ...base, id: 'title', name: 'Title', type: 'custom_text', x: 0, y: 208, zIndex: 6, textValue: 'KEYFRAME STUDIO', fontSize: 35, fontFamily: 'Inter', fillColor: '#ffffff', textOrigin: 'center' },
    { ...base, id: 'subtitle', name: 'Subtitle', type: 'custom_text', x: 0, y: 241, zIndex: 7, textValue: 'motion design in the browser', fontSize: 17, fontFamily: 'Inter', fillColor: '#8fb8ef', textOrigin: 'center' },
  ],
  tracks: [
    track('landscape', 'Landscape', { channels: { ...channels(), opacity: [key('lo0', 0, 0), key('lo1', 18, 1)] } }),
    track('orbit', 'Orbit', { channels: { ...channels(), x: [key('ox0', 0, -427), key('ox1', 45, 180)], y: [key('oy0', 0, -240), key('oy1', 45, -250)] } }),
    track('star', 'Star', { channels: { ...channels(), rotation: [key('sr0', 0, 0, 'linear'), key('sr1', 90, 360, 'linear')] } }),
    track('panel', 'Lower third', { expanded: true, channels: { ...channels(), x: [key('px0', 6, -933, 'overshoot'), key('px1', 30, 0)], y: [key('py0', 6, 220), key('py1', 30, 220)] } }),
    track('accent', 'Accent'),
    track('title', 'Title', { channels: { ...channels(), opacity: [key('to0', 20, 0), key('to1', 34, 1)] } }),
    track('subtitle', 'Subtitle', { channels: { ...channels(), opacity: [key('so0', 26, 0), key('so1', 40, 1)] } }),
  ],
};

async function open(browser, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await page.goto(BASE);
  await page.waitForSelector('.app-container');
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [STORAGE_KEY, JSON.stringify(scene)]);
  await page.reload();
  await page.waitForSelector('.app-container');
  await page.evaluate(async () => { await document.fonts.ready; });
  // Rectangles are sized by scale (their base is 120 × 60). The camera opens at
  // 1:1; step out until the artboard is about as wide as the free stage area.
  const artWidth = () => page.evaluate(() => document.querySelector('.stage-svg rect[filter="url(#artboard-shadow)"]')?.getBoundingClientRect().width ?? 0);
  const target = viewport.width * (viewport.width > 900 ? 0.62 : 0.95);
  for (let step = 0; step < 12 && (await artWidth()) > target; step += 1) {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('canvas-viewport-command', { detail: { type: 'zoom-out' } })));
    await page.waitForTimeout(120);
  }
  // The Media drawer opens beside a scene with an image; the shots show the stage.
  if (viewport.width > 900 && await page.locator('.left-toolbar-toggle[aria-expanded="true"]').count()) {
    await page.locator('.left-toolbar-toggle').click();
  }
  return page;
}

const seek = async (page, frame) => {
  const ruler = page.getByRole('slider', { name: 'Playhead position' });
  await ruler.focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < frame; i += 1) await page.keyboard.press('ArrowRight');
};

const settle = (page) => page.waitForTimeout(400);

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  // The editor: a selected star, the lower third's channels open, mid-animation.
  let page = await open(browser, { width: 1600, height: 900 });
  await seek(page, 60);
  await page.locator('.actor-node', { hasText: 'Star' }).first().click();
  await settle(page);
  await page.screenshot({ path: path.join(OUT, 'editor.png') });

  // Mask editing on the canvas.
  await page.locator('.actor-node', { hasText: 'Landscape' }).first().click();
  await page.getByRole('tab', { name: /^Masks/ }).click();
  await page.getByRole('button', { name: 'Expand LAYER MASKS' }).click();
  await page.getByRole('button', { name: 'Edit on Canvas' }).click();
  await page.getByTestId('mask-path-overlay').waitFor();
  await settle(page);
  await page.screenshot({ path: path.join(OUT, 'masks.png') });
  await page.close();

  // The Motion Curve Editor on the lower third's slide-in.
  page = await open(browser, { width: 1600, height: 900 });
  await page.locator('.actor-node', { hasText: 'Lower third' }).first().click();
  await page.locator('.ue-lane-group[data-owner-part-id="panel"] .keyframe-diamond').last().click();
  await page.getByRole('button', { name: /Motion Curves/ }).first().click();
  await page.getByRole('dialog', { name: 'Motion Curve Editor' }).waitFor();
  await settle(page);
  await page.screenshot({ path: path.join(OUT, 'curves.png') });
  await page.close();

  // Broadcast mode.
  page = await open(browser, { width: 1600, height: 900 });
  await page.getByRole('button', { name: 'BROADCAST', exact: true }).click();
  await page.locator('.live-director-panel').waitFor();
  // Play the sequence on air and let it land.
  await page.locator('.live-director-panel').getByRole('button', { name: /Sequence/ }).first().click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, 'broadcast.png') });
  await page.close();

  // The phone layout.
  page = await open(browser, { width: 390, height: 844 });
  await seek(page, 45);
  await settle(page);
  await page.screenshot({ path: path.join(OUT, 'phone.png') });
  await page.close();
} finally {
  await browser.close();
}
console.log(`README screenshots written to ${OUT}`);
