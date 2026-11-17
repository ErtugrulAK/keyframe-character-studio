// Recreates the README gallery (docs/assets/readme/gallery/*.gif): each clip is
// a KCS scene exported by the editor's own GIF exporter, through its own UI.
//
//   npx vite --port 5311            (in another terminal)
//   node scripts/capture-readme-gallery.mjs http://127.0.0.1:5311
//
// The ready-made graphics come from the editor's New from Template recipes
// (`src/utils/editor/startRecipes.ts`, loaded from the dev server), shortened
// for a looping clip and set over a backdrop picture. It uses a fresh browser
// profile: the user's own autosave is never touched.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] ?? 'http://127.0.0.1:5311';
const ONLY = process.argv[3];
const OUT = path.resolve('docs/assets/readme/gallery');
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const W = 1280;
const H = 720;
const FPS = 25;

const svgUrl = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

/**
 * A dusk city skyline in flat colours: a picture behind the graphics, so the
 * GIF has no transparent edge. Flat fills (no gradients) keep the files small.
 */
const BACKDROP = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
<rect width="1280" height="720" fill="#1b2d45"/>
<rect width="1280" height="250" fill="#14233a"/>
<circle cx="920" cy="440" r="150" fill="#3a4a5c"/><circle cx="920" cy="440" r="95" fill="#8a6f55"/>
<path d="M0 520 H90 V430 H150 V470 H210 V380 H270 V500 H330 V410 H380 V350 H440 V460 H520 V400 H580 V480 H640 V330 H700 V450 H780 V390 H840 V470 H900 V360 H960 V440 H1040 V400 H1100 V490 H1170 V420 H1230 V470 H1280 V720 H0 Z" fill="#162436"/>
<path d="M0 600 H120 V540 H200 V580 H300 V520 H420 V590 H560 V550 H700 V600 H860 V540 H980 V590 H1120 V560 H1280 V720 H0 Z" fill="#0f1a28"/>
</svg>`);

const emptyChannels = () => ({
  x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
  maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
  matteFeather: [], matteStrength: [], matteGradientAngle: [], motionPathProgress: [],
});
const key = (id, frame, value, easing = 'easeInOut') => ({ id, frame, value, easing, templateId: 'Sequence' });
const track = (partId, channels = {}) => ({ id: `track-${partId}`, partId, name: partId, color: '#22d3ee', visible: true, locked: false, expanded: false, channels: { ...emptyChannels(), ...channels } });
const base = { rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, strokeColor: '#000000', strokeEnabled: false, fillEnabled: true };
const backdropLayer = (zIndex) => ({ ...base, id: 'backdrop', name: 'Backdrop', type: 'custom_image', x: 0, y: 0, zIndex, width: W, height: H, imageUrl: BACKDROP });

/** A scene document of `seconds`, with the backdrop under every layer. */
const withBackdrop = (scene, seconds) => {
  const frames = Math.round(FPS * seconds);
  const lowest = Math.min(...scene.layers.map((layer) => layer.zIndex ?? 0));
  return {
    ...scene,
    totalFrames: frames,
    motionTemplates: [{ id: 'Sequence', name: 'Sequence', type: 'in', durationFrames: frames }],
    activeTemplateId: 'Sequence',
    layers: [backdropLayer(lowest - 1), ...scene.layers],
    tracks: [track('backdrop'), ...scene.tracks],
  };
};

const sceneShell = (name, layers, tracks) => ({
  version: 1, coordinateSystem: 'project-unit-center-v1', name, width: W, height: H, fps: FPS, totalFrames: FPS * 3, layers, tracks,
});

/** Text over time: a headline typing itself out and a countdown clock. */
const textEffectsScene = () => sceneShell('Text effects', [
  // A rectangle is 120 x 60 units; its size is its scale (as the recipes do).
  { ...base, id: 'panel', name: 'Panel', type: 'custom_rect', x: 0, y: 0, zIndex: 1, scaleX: 760 / 120, scaleY: 300 / 60, fillColor: '#0b1320', fillOpacity: 0.85 },
  { ...base, id: 'label', name: 'Label', type: 'custom_text', x: 0, y: -80, zIndex: 2, textValue: 'BREAKING NEWS', fontSize: 30, fontFamily: 'Inter', fillColor: '#f3b26b', textOrigin: 'center',
    textEffect: { kind: 'typewriter', startFrame: 0, durationFrames: 30 } },
  { ...base, id: 'clock', name: 'Clock', type: 'custom_text', x: 0, y: 30, zIndex: 3, textValue: '00:05', fontSize: 120, fontFamily: 'Inter', fillColor: '#ffffff', textOrigin: 'center',
    textEffect: { kind: 'clock', mode: 'countdown', startFrame: 0, seconds: 5, format: 'mm:ss' } },
  { ...base, id: 'bar', name: 'Bar', type: 'custom_rect', x: 0, y: 115, zIndex: 4, scaleX: 680 / 120, scaleY: 8 / 60, fillColor: '#4a8fe7' },
], [
  track('panel', { opacity: [key('po0', 0, 0), key('po1', 10, 1)] }),
  track('label'),
  track('clock'),
  track('bar', { scaleX: [key('bx0', 0, 680 / 120, 'linear'), key('bx1', 125, 0, 'linear')] }),
]);

/** A glowing dart following a curved path, turned with the direction of travel (a triangle points up, so it starts turned 90°). */
const motionPathScene = () => sceneShell('Motion path', [
  { ...base, id: 'road', name: 'Path', type: 'custom_freeform', x: 0, y: 0, zIndex: 1, fillEnabled: false, strokeEnabled: true, strokeColor: '#8fb8ef', strokeWidth: 4, strokeOpacity: 0.5,
    path: { version: 1, coordinateSpace: 'local', closed: false, points: [
      { id: 'p0', x: -520, y: 180, kind: 'smooth', handleOut: { x: -380, y: -220 } },
      { id: 'p1', x: 0, y: 0, kind: 'smooth', handleIn: { x: -160, y: 260 }, handleOut: { x: 160, y: -260 } },
      { id: 'p2', x: 520, y: -180, kind: 'smooth', handleIn: { x: 380, y: 220 } },
    ] } },
  { ...base, id: 'arrow', name: 'Arrow', type: 'custom_triangle', x: 0, y: 0, rotation: 90, scaleX: 0.7, scaleY: 1.5, zIndex: 2, fillColor: '#f3b26b',
    glowColor: '#f3b26b', glowSize: 18, glowStrength: 0.9, motionPath: { sourcePartId: 'road', orient: true } },
], [
  track('road'),
  track('arrow', { motionPathProgress: [key('mp0', 0, 0), key('mp1', 60, 1)] }),
]);

const CLIPS = [
  { file: 'lower-third', recipe: 'lower-third', seconds: 2.4 },
  { file: 'title-card', recipe: 'title-card', seconds: 2.4 },
  { file: 'scoreboard', recipe: 'scoreboard', seconds: 2 },
  { file: 'corner-bug', recipe: 'corner-bug', seconds: 2 },
  { file: 'text-effects', build: textEffectsScene, seconds: 5 },
  { file: 'motion-path', build: motionPathScene, seconds: 3 },
];

async function exportClip(browser, clip) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  if (process.env.DEBUG) page.on('console', (message) => console.log('[page]', message.type(), message.text().slice(0, 300)));
  await page.goto(BASE);
  await page.waitForSelector('.app-container');
  const authored = clip.recipe
    ? await page.evaluate(async ([id, options]) => {
      const recipes = await import('/src/utils/editor/startRecipes.ts');
      return recipes.buildStartRecipe(id, options);
    }, [clip.recipe, { width: W, height: H, fps: FPS }])
    : clip.build();
  const scene = withBackdrop(authored, clip.seconds);
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [STORAGE_KEY, JSON.stringify(scene)]);
  await page.reload();
  await page.waitForSelector('.app-container');
  await page.evaluate(async () => { await document.fonts.ready; });

  await page.locator('.header-bar').getByRole('button', { name: /^Export/ }).first().click();
  await page.getByRole('menuitem', { name: /Animated GIF/ }).click();
  const panel = page.getByRole('dialog', { name: 'Export animated GIF' });
  await panel.locator('#gif-export-fps').selectOption(String(FPS));
  await panel.locator('#gif-export-scale').selectOption('0.5');
  const download = page.waitForEvent('download', { timeout: 180_000 });
  await panel.getByRole('button', { name: 'Export GIF' }).click();
  const file = path.join(OUT, `${clip.file}.gif`);
  await (await download).saveAs(file);
  await page.close();
  return file;
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const clip of CLIPS) {
    if (ONLY && clip.file !== ONLY) continue;
    console.log('wrote', await exportClip(browser, clip));
  }
} finally {
  await browser.close();
}
