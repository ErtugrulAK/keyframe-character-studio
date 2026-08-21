import { test, expect, type Page } from '@playwright/test';

/**
 * BUGFIX MILESTONE — FINAL REAL-USER VERIFICATION (BUG 3 / 4 / 5).
 * Exercises the real editor UI: template elements, Inspector tabs, layer
 * order buttons, Broadcast mode, Live Director sequence button, viewport
 * zoom — not just raw state.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

function makeLayer(id: string, name: string, type: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, name, type,
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1,
    fillColor: '#ff0000', strokeColor: '#101218', strokeWidth: 2, borderRadius: 0,
    width: 60, height: 60,
    ...overrides,
  };
}

async function seed(page: Page, scene: Record<string, unknown>) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(([k, d]: [string, string]) => { localStorage.setItem(k, d); }, [STORAGE_KEY, JSON.stringify(scene)]);
  await page.goto('/');
  await page.waitForFunction(() => document.querySelectorAll('g[transform^="translate"]').length >= 1, undefined, { timeout: 15000 });
}

function cowLionTigerScene() {
  const cow = makeLayer('cow', 'The Cow', 'custom_box', { zIndex: 3, fillColor: '#ff0000' });
  const lion = makeLayer('lion', 'Lion', 'custom_circle', { zIndex: 2, fillColor: '#00ff00' });
  const tiger = makeLayer('tiger', 'Tiger', 'custom_rect', { zIndex: 1, fillColor: '#0000ff' });
  const tracks = [
    {
      id: 't_cow', partId: 'cow', name: 'The Cow', color: '#3b82f6',
      channels: {
        x: [
          { id: 'cow_x_0', frame: 0, value: 0, easing: 'linear' },
          { id: 'cow_x_20', frame: 20, value: 100, easing: 'linear' },
          { id: 'cow_x_40', frame: 40, value: 200, easing: 'linear' },
        ],
        y: [
          { id: 'cow_y_0', frame: 0, value: 0, easing: 'linear' },
          { id: 'cow_y_20', frame: 20, value: 20, easing: 'linear' },
          { id: 'cow_y_40', frame: 40, value: 40, easing: 'linear' },
        ],
      },
    },
  ];
  return {
    version: 1, layers: [cow, lion, tiger], tracks,
    fps: 30, totalFrames: 90,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'Real User Verification',
  };
}

async function timelineDiamondLefts(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.keyframe-diamond')]
      .map((d) => Math.round(parseFloat(d.style.left || '0')))
      .sort((a, b) => a - b),
  );
}

async function keyframesTabFrameValues(page: Page): Promise<number[]> {
  // Keyframes tab rows render one SmartNumberInput per frame-group
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLInputElement>('.section-block input[type="number"]')]
      .map((i) => parseInt(i.value, 10))
      .filter((v) => !isNaN(v))
      .sort((a, b) => a - b),
  );
}

test('BUG 3 — layer order (Bring Forward / Send Backward) preserves keyframes', async ({ page }) => {
  await seed(page, cowLionTigerScene());

  const beforeTimeline = await timelineDiamondLefts(page);
  expect(beforeTimeline.length).toBeGreaterThanOrEqual(3); // cow frames 0/20/40

  // Select "The Cow" in the outliner (Template Elements)
  await page.getByText('The Cow', { exact: true }).first().click();
  await page.waitForTimeout(200);

  // Open the Keyframes tab
  await page.getByText('Keyframes', { exact: true }).click();
  await page.waitForTimeout(200);
  const framesBefore = await keyframesTabFrameValues(page);
  expect(framesBefore).toEqual([0, 20, 40]);

  // Layer order changes: Bring Forward ×2, Send Backward ×1
  await page.getByText('Transform', { exact: true }).first().click();
  await page.waitForTimeout(150);
  await page.getByText('Bring Forward (+1)', { exact: true }).click();
  await page.waitForTimeout(100);
  await page.getByText('Bring Forward (+1)', { exact: true }).click();
  await page.waitForTimeout(100);
  await page.getByText('Send Backward (-1)', { exact: true }).click();
  await page.waitForTimeout(200);

  // Re-select The Cow, re-open Keyframes
  await page.getByText('The Cow', { exact: true }).first().click();
  await page.waitForTimeout(200);
  await page.getByText('Keyframes', { exact: true }).click();
  await page.waitForTimeout(200);
  const framesAfter = await keyframesTabFrameValues(page);
  expect(framesAfter).toEqual([0, 20, 40]); // same frames — nothing lost

  const afterTimeline = await timelineDiamondLefts(page);
  expect(afterTimeline).toEqual(beforeTimeline); // timeline identical
});

test('BUG 4 — broadcast sequence: scene visible, edit playback untouched (real UI)', async ({ page }) => {
  // One part WITHOUT any in/out preset (default) + one with custom_timeline
  const cow = makeLayer('cow', 'The Cow', 'custom_box', { zIndex: 2, fillColor: '#ff0000' });
  const lion = makeLayer('lion', 'Lion', 'custom_circle', { zIndex: 1, fillColor: '#00ff00', inAnimPreset: 'custom_timeline', inAnimTimelineStart: 0, inAnimTimelineEnd: 60 });
  const scene = {
    version: 1, layers: [cow, lion], tracks: [],
    fps: 30, totalFrames: 90,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'Broadcast Real User',
  };
  await seed(page, scene);

  // 1. EDIT: parts visible on stage
  const editTransforms = await page.evaluate(() =>
    [...document.querySelectorAll<SVGGElement>('g[transform^="translate"]')].map((g) => g.getAttribute('transform')),
  );
  expect(editTransforms.length).toBe(2);

  const partOpacities = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<SVGGElement>('g[transform^="translate"]')].map((g) => {
        const s = g.getAttribute('style') ?? '';
        return s.match(/opacity:([\d.]+)/)?.[1] ?? '1';
      }),
    );

  // BUGFIX hardening: real visibility = opacity > 0 AND an on-screen
  // bounding box (opacity alone is not enough — a cropped/off-screen stage
  // would still report opacity 1 while looking empty to the user).
  const partVisibility = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<SVGGElement>('g[transform^="translate"]')].map((g) => {
        const r = g.getBoundingClientRect();
        const s = g.getAttribute('style') ?? '';
        const o = parseFloat(s.match(/opacity:([\d.]+)/)?.[1] ?? '1');
        return {
          opacity: o,
          onScreen: r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight,
          w: r.width, h: r.height,
        };
      }),
    );

  // 2. BROADCAST
  await page.getByText('BROADCAST', { exact: true }).click();
  await page.waitForTimeout(600);
  const op1 = await partOpacities();
  expect(op1.every((o) => parseFloat(o) > 0)).toBe(true); // not hidden
  const vis1 = await partVisibility();
  expect(vis1.every((v) => v.onScreen && v.w > 0 && v.h > 0)).toBe(true); // REAL render on stage

  // 3. Sequence click (Live Director Panel)
  await page.getByText('Sequence', { exact: true }).first().click();
  await page.waitForTimeout(400);
  const op2 = await partOpacities();
  expect(op2.every((o) => parseFloat(o) > 0)).toBe(true); // visible during animating_in
  const vis2 = await partVisibility();
  expect(vis2.every((v) => v.onScreen && v.w > 0 && v.h > 0)).toBe(true);

  // 4. After animation completes (animating_in → visible): still visible
  await page.waitForTimeout(1500);
  const op3 = await partOpacities();
  expect(op3.every((o) => parseFloat(o) > 0)).toBe(true);
  const vis3 = await partVisibility();
  expect(vis3.every((v) => v.onScreen && v.w > 0 && v.h > 0)).toBe(true);

  // 5. Edit playback untouched: the authored transform remains unchanged while
  //    Broadcast maps it through the project-space origin (currentFrame never
  //    advanced and no edit-timeline loop was triggered).
  const broadcastTransforms = await page.evaluate(() =>
    [...document.querySelectorAll<SVGGElement>('g[transform^="translate"]')].map((g) => g.getAttribute('transform')),
  );
  expect(broadcastTransforms).toEqual(
    editTransforms.map((transform) => transform?.replace('translate(300, 240)', 'translate(960, 540)')),
  );

  // 6. Exit broadcast → re-enter → sequence again: same behavior
  await page.getByText('EDIT MODE', { exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByText('BROADCAST', { exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByText('Sequence', { exact: true }).first().click();
  await page.waitForTimeout(400);
  const op4 = await partOpacities();
  expect(op4.every((o) => parseFloat(o) > 0)).toBe(true);
});

test('BUG 5 — broadcast starts FIT, does not inherit edit zoom/pan (real UI)', async ({ page }) => {
  await seed(page, cowLionTigerScene());

  // 1. EDIT: zoom in hard (5× +0.1) — svg transform reflects the zoom
  for (let i = 0; i < 5; i++) {
    await page.getByTitle('Zoom In (+)').click();
    await page.waitForTimeout(80);
  }
  const editZoom = await page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find((s) => !!s.querySelector('#artboard-clip'))!;
    return svg.getAttribute('style');
  });
  expect(editZoom).toContain('scale(1.5)'); // zoomed in

  // 2. BROADCAST: fit/contain — zoom reset to 1, pan 0
  await page.getByText('BROADCAST', { exact: true }).click();
  await page.waitForTimeout(500);
  const broadcastZoom = await page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find((s) => !!s.querySelector('#artboard-clip'))!;
    return { style: svg.getAttribute('style'), viewBox: svg.getAttribute('viewBox') };
  });
  expect(broadcastZoom.style).toContain('scale(1)');          // no inherited zoom
  expect(broadcastZoom.style).toContain('translate(0px, 0px)'); // no inherited pan
  expect(broadcastZoom.viewBox).toBe('0 0 1920 1080');

  // 3. Whole artboard fits the viewport (no crop): world corners map inside
  const corners = await page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find((s) => !!s.querySelector('#artboard-clip'))!;
    const out: Record<string, { x: number; y: number }> = {};
    for (const [key, wx, wy] of [['tl', 0, 0], ['br', 1920, 1080]] as const) {
      const pt = svg.createSVGPoint(); pt.x = wx as number; pt.y = wy as number;
      const s = pt.matrixTransform(svg.getScreenCTM()!);
      out[key] = { x: Math.round(s.x), y: Math.round(s.y) };
    }
    const vw = window.innerWidth, vh = window.innerHeight;
    return { tl: out.tl, br: out.br, vw, vh };
  });
  // top-left corner on screen, bottom-right inside the viewport → no crop
  expect(corners.tl.x).toBeGreaterThanOrEqual(0);
  expect(corners.tl.y).toBeGreaterThanOrEqual(0);
  expect(corners.br.x).toBeLessThanOrEqual(corners.vw);
  expect(corners.br.y).toBeLessThanOrEqual(corners.vh);
});
