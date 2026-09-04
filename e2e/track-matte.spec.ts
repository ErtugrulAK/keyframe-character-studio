import { test, expect, type Page } from '@playwright/test';
import zlib from 'zlib';

/**
 * M13 Step 2E — Track matte REAL-BROWSER validation (Chromium).
 *
 * Seeds the scene into localStorage (AUTOSAVE key) so the app boots with the
 * desired matte state, then verifies the actual SVG DOM: clipPath/mask defs,
 * mask-type/units, target clip/mask attributes, explicit inverted region,
 * source-opacity independence, and playback-driven geometry updates.
 *
 * Screenshots are saved to test-results/matte-*.png as visual evidence
 * (compositing is analyzed separately — see the step report).
 */

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

interface MatteDom {
  clips: { id: string; d: string | null }[];
  masks: {
    id: string; type: string | null; units: string | null;
    children: { tag: string; fill: string | null; d: string | null; x: string | null; y: string | null; width: string | null; height: string | null }[];
  }[];
  layers: { clip: string | null; mask: string | null; style: string | null }[];
}

// ─── Minimal PNG decoder (RGBA 8-bit) — real pixel assertions ──────────

function decodePng(buf: Buffer): { width: number; height: number; data: Buffer; bpp: number } {
  let offset = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat: Buffer[] = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    offset += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`Unsupported PNG format: depth=${bitDepth} colorType=${colorType}`);
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let pos = 0;
  const prevLine = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prevLine[x];
      const c = x >= bpp ? prevLine[x - bpp] : 0;
      let v = line[x];
      switch (filter) {
        case 0: break;
        case 1: v += a; break;
        case 2: v += b; break;
        case 3: v += (a + b) >> 1; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`Unknown PNG filter ${filter}`);
      }
      cur[x] = v & 0xff;
    }
    prevLine.set(cur);
    pos += stride;
  }
  return { width, height, data: out, bpp };
}

type ColorClass = 'green' | 'red' | 'dark' | 'other';

function classify(r: number, g: number, b: number): ColorClass {
  if (g > 110 && g > r + 50 && g > b + 50) return 'green';   // target #00ff00
  if (r > 110 && r > g + 50 && r > b + 50) return 'red';     // source #ff0000
  if (r < 70 && g < 70 && b < 95) return 'dark';             // background
  return 'other';
}

/** World → screen pixel via the real SVG CTM, then read the pixel color
 *  from a fresh screenshot (decodePng). This asserts ACTUAL browser
 *  compositing — not just DOM structure. */
async function pixelAt(page: Page, worldX: number, worldY: number): Promise<ColorClass> {
  const buf = await page.screenshot();
  const png = decodePng(buf);
  const { x, y } = await page.evaluate(([wx, wy]: [number, number]) => {
    // The FIRST <svg> in the DOM may be a lucide icon — pick the editor stage:
    // it is the only <svg> containing the artboard-clip def (no viewBox attr).
    const svg = [...document.querySelectorAll('svg')].find(
      (s) => !!s.querySelector('#artboard-clip')
    ) ?? document.querySelector('svg')!;
    const pt = svg.createSVGPoint();
    pt.x = wx; pt.y = wy;
    const s = pt.matrixTransform(svg.getScreenCTM()!);
    return { x: Math.round(s.x), y: Math.round(s.y) };
  }, [worldX, worldY]);
  const i = (y * png.width + x) * png.bpp;
  return classify(png.data[i], png.data[i + 1], png.data[i + 2]);
}

async function maxGreenInWorldRect(page: Page, x0: number, x1: number, y0: number, y1: number): Promise<number> {
  const buf = await page.screenshot();
  const png = decodePng(buf);
  const bounds = await page.evaluate(([a, b, c, d]: [number, number, number, number]) => {
    const svg = [...document.querySelectorAll('svg')].find(
      (candidate) => !!candidate.querySelector('#artboard-clip')
    ) ?? document.querySelector('svg')!;
    const ctm = svg.getScreenCTM()!;
    const points = [
      [a, c], [b, c], [a, d], [b, d],
    ].map(([x, y]) => {
      const point = svg.createSVGPoint();
      point.x = x;
      point.y = y;
      return point.matrixTransform(ctm);
    });
    return {
      left: Math.max(0, Math.floor(Math.min(...points.map((point) => point.x)))),
      right: Math.min(innerWidth - 1, Math.ceil(Math.max(...points.map((point) => point.x)))),
      top: Math.max(0, Math.floor(Math.min(...points.map((point) => point.y)))),
      bottom: Math.min(innerHeight - 1, Math.ceil(Math.max(...points.map((point) => point.y)))),
    };
  }, [x0, x1, y0, y1]);
  let max = 0;
  for (let y = bounds.top; y <= bounds.bottom; y += 1) {
    for (let x = bounds.left; x <= bounds.right; x += 1) {
      max = Math.max(max, png.data[(y * png.width + x) * png.bpp + 1]);
    }
  }
  return max;
}

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

async function seed(page: Page, layers: Record<string, unknown>[], tracks: Record<string, unknown>[] = []): Promise<void> {
  const scene = {
    version: 1, layers, tracks,
    fps: 30, totalFrames: 90,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'Matte E2E',
  };
  // Boot the page once (fresh context), clear any stale autosave, then seed via
  // init script so the restore effect loads OUR scene on the final navigation.
  // NOTE: init-script fns run in the BROWSER — closure variables are NOT
  // available there; pass everything as serialized arguments.
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    ([key, data]: [string, string]) => { localStorage.setItem(key, data); },
    [STORAGE_KEY, JSON.stringify(scene)],
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  // Wait for the matte defs to actually exist — this only happens AFTER the
  // initial localStorage restore effect has run and re-rendered the scene.
  // waitForFunction (not waitForSelector): the latter had trouble resolving
  // the SVG-namespace attribute selector reliably.
  await page.waitForFunction(
    () => document.querySelectorAll('[id^="kcs-"]').length > 0,
    undefined,
    { timeout: 15000 },
  );
}

async function matteDom(page: Page): Promise<MatteDom> {
  return page.evaluate(() => {
    // There are TWO <defs> elements: StageCanvas's (artboard-clip, patterns,
    // filters) and StagePartLayers's (matte clips/masks). Scan them all.
    const defsList = [...document.querySelectorAll('defs')];
    // Filter out the editor's own artboard-clip — only matte defs matter here.
    const clips = defsList.flatMap((d) =>
      [...d.querySelectorAll('clipPath')]
        .filter((c) => c.id !== 'artboard-clip')
        .map((c) => ({ id: c.id, d: c.querySelector('path')?.getAttribute('d') ?? null }))
    );
    const masks = defsList.flatMap((d) =>
      [...d.querySelectorAll('mask')].map((m) => ({
        id: m.id,
        type: m.getAttribute('mask-type'),
        units: m.getAttribute('maskUnits'),
        children: [...m.children].map((ch) => ({
          tag: ch.tagName,
          fill: ch.getAttribute('fill'),
          d: ch.getAttribute('d'),
          x: ch.getAttribute('x'),
          y: ch.getAttribute('y'),
          width: ch.getAttribute('width'),
          height: ch.getAttribute('height'),
        })),
      }))
    );
    const layers = [...document.querySelectorAll('g[transform^="translate"]')].map((g) => {
      // Step 2E: matte clip/mask live on the TRANSFORM-LESS outer <g>
      // (parent of the transformed inner <g>).
      const outer = g.parentElement;
      return {
        clip: outer?.getAttribute('clip-path') ?? null,
        mask: outer?.getAttribute('mask') ?? null,
        style: g.getAttribute('style'),
      };
    });
    return { clips, masks, layers };
  });
}

test.describe('M13 track matte — real browser', () => {
  // No beforeEach: seed() handles boot + clear + init-script + navigation.
  // (A goto-then-clear in beforeEach broke the localStorage restore — the app
  //  re-writes autosave while the first page stays mounted.)

  test('T1 — clip regression: mode=clip keeps the M11 clipPath pipeline', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1 });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, matte: { sourcePartId: 'src', mode: 'clip' } });
    await seed(page, [source, target]);

    const dom = await matteDom(page);
    const clip = dom.clips.find((c) => c.id === 'kcs-clip-src');
    expect(clip).toBeTruthy();
    expect(clip!.d).toBeTruthy();
    expect(dom.masks).toHaveLength(0);
    const targetLayer = dom.layers.find((l) => l.clip === 'url(#kcs-clip-src)');
    expect(targetLayer).toBeTruthy();
    expect(targetLayer!.mask).toBeNull();
    await page.screenshot({ path: 'test-results/matte-t1-clip.png', fullPage: false });
  });

  test('T2 — alpha matte: <mask mask-type=alpha> + white path, no clipPath', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1 });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, matte: { sourcePartId: 'src', mode: 'alpha' } });
    await seed(page, [source, target]);

    const dom = await matteDom(page);
    const mask = dom.masks.find((m) => m.id === 'kcs-mask-src-alpha');
    expect(mask).toBeTruthy();
    expect(mask!.type).toBe('alpha');
    expect(mask!.units).toBe('userSpaceOnUse');
    expect(mask!.children).toHaveLength(1);
    expect(mask!.children[0].tag.toLowerCase()).toBe('path');
    expect(mask!.children[0].fill).toBe('white');
    expect(mask!.children[0].d).toBeTruthy();
    const targetLayer = dom.layers.find((l) => l.mask === 'url(#kcs-mask-src-alpha)');
    expect(targetLayer).toBeTruthy();
    expect(targetLayer!.clip).toBeNull();
    expect(dom.clips).toHaveLength(0);
    await page.screenshot({ path: 'test-results/matte-t2-alpha.png', fullPage: false });
  });

  test('T3 — luminance matte: mask-type=luminance, path fill = source fillColor', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, matte: { sourcePartId: 'src', mode: 'luminance' } });
    await seed(page, [source, target]);

    const dom = await matteDom(page);
    const mask = dom.masks.find((m) => m.id === 'kcs-mask-src-luminance');
    expect(mask).toBeTruthy();
    expect(mask!.type).toBe('luminance');
    expect(mask!.units).toBe('userSpaceOnUse');
    expect(mask!.children[0].fill).toBe('#ff0000'); // evaluated source fillColor
    expect(mask!.children[0].d).toBeTruthy();
    expect(dom.layers.some((l) => l.mask === 'url(#kcs-mask-src-luminance)')).toBe(true);
    await page.screenshot({ path: 'test-results/matte-t3-luminance.png', fullPage: false });
  });

  test('T4/T6 — inverted luminance: explicit region + white bg + black geometry', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1 });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, matte: { sourcePartId: 'src', mode: 'luminance', inverted: true } });
    await seed(page, [source, target]);

    const dom = await matteDom(page);
    const mask = dom.masks.find((m) => m.id === 'kcs-mask-src-luminance-inv');
    expect(mask).toBeTruthy();
    expect(mask!.type).toBe('luminance');
    expect(mask!.units).toBe('userSpaceOnUse');
    // Explicit artboard region: CANVAS_CENTER(300,240) ± 1920×1080/2 → (-660,-300)
    const rect = mask!.children.find((ch) => ch.tag.toLowerCase() === 'rect');
    expect(rect).toBeTruthy();
    expect(rect!.x).toBe('-660');
    expect(rect!.y).toBe('-300');
    expect(rect!.width).toBe('1920');
    expect(rect!.height).toBe('1080');
    expect(rect!.fill).toBe('white');
    const path = mask!.children.find((ch) => ch.tag.toLowerCase() === 'path');
    expect(path!.fill).toBe('black');
    expect(path!.d).toBeTruthy();
    const targetLayer = dom.layers.find((l) => l.mask === 'url(#kcs-mask-src-luminance-inv)');
    expect(targetLayer).toBeTruthy();
    expect(targetLayer!.clip).toBeNull();
    await page.screenshot({ path: 'test-results/matte-t4-luminance-inverted.png', fullPage: false });
  });

  test('T5 — alpha + inverted: SINGLE evenodd path (region contour + geometry) punches the real hole', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', matte: { sourcePartId: 'src', mode: 'alpha', inverted: true } });
    await seed(page, [source, target]);

    const dom = await matteDom(page);
    const mask = dom.masks.find((m) => m.id === 'kcs-mask-src-alpha-inv');
    expect(mask).toBeTruthy();
    expect(mask!.type).toBe('alpha');
    expect(mask!.units).toBe('userSpaceOnUse');
    // H fix: exactly ONE evenodd path = region contour + matte contour
    // (Chromium alpha masks ignore a second element — pixel-verified).
    expect(mask!.children).toHaveLength(1);
    const path = mask!.children[0];
    expect(path.tag.toLowerCase()).toBe('path');
    expect(path.fill).toBe('white');
    expect(path.d).toContain('M -660 -300 H 1260 V 780 H -660 Z'); // region contour
    const targetLayer = dom.layers.find((l) => l.mask === 'url(#kcs-mask-src-alpha-inv)');
    expect(targetLayer).toBeTruthy();
    expect(targetLayer!.clip).toBeNull();
    // Screenshot evidence for real compositing (pixel analysis in step report)
    await page.screenshot({ path: 'test-results/matte-t5-alpha-inverted.png', fullPage: false });
  });

  test('T7 — source opacity independence: alpha mask stays white when source opacity = 0.2', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, opacity: 0.2 });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, matte: { sourcePartId: 'src', mode: 'alpha' } });
    await seed(page, [source, target]);

    const dom = await matteDom(page);
    const mask = dom.masks.find((m) => m.id === 'kcs-mask-src-alpha');
    expect(mask).toBeTruthy();
    expect(mask!.children[0].fill).toBe('white'); // NOT weakened by source opacity
    // The source itself renders at opacity 0.2 (its own visual, independent of matte strength)
    const sourceLayer = dom.layers.find((l) => l.mask === null && l.clip === null && l.style?.includes('opacity: 0.2'));
    expect(sourceLayer).toBeTruthy();
    await page.screenshot({ path: 'test-results/matte-t7-source-opacity.png', fullPage: false });
  });

  test('T8 — animated source: playback updates the mask pathD (id stays stable)', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1 });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, matte: { sourcePartId: 'src', mode: 'alpha' } });
    const tracks = [
      {
        id: 't_src', partId: 'src', name: 'Source',
        channels: {
          x: [
            { id: 'k1', frame: 0, value: 0, easing: 'linear' },
            { id: 'k2', frame: 60, value: 200, easing: 'linear' },
          ],
        },
      },
    ];
    await seed(page, [source, target], tracks);

    const d0 = (await matteDom(page)).masks.find((m) => m.id === 'kcs-mask-src-alpha')!.children[0].d;
    // Drive playback through the EXISTING rAF pipeline (no new loop)
    await page.getByTitle('Play', { exact: true }).click();
    await page.waitForTimeout(1500);
    await page.getByTitle('Pause', { exact: true }).click();
    const after = await matteDom(page);
    const mask = after.masks.find((m) => m.id === 'kcs-mask-src-alpha');
    expect(mask).toBeTruthy(); // id stable across frames
    expect(mask!.children[0].d).not.toBe(d0); // world geometry followed the animated transform
    await page.screenshot({ path: 'test-results/matte-t8-animated.png', fullPage: false });
  });
});

test.describe('M13 track matte — real browser COMPOSITING (pixel assertions)', () => {
  // Layout: source box 60×60 at world center (270–330), target circle scaled
  // 2× (r=60, 240–360) — box inside the circle, so:
  //   (310,240) = inside box           (350,240) = ring (box-outside, circle-inside)
  // After the Step 2E coordinate-space fix, world-space matte paths must clip
  // the transformed target correctly in the browser.

  test('V-A — clip + target transform (scale 2)', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'clip' } });
    await seed(page, [source, target]);
    expect(await pixelAt(page, 310, 240)).toBe('green'); // box region shows target
    expect(await pixelAt(page, 350, 240)).toBe('dark');  // ring clipped away
  });

  test('V-A2 — clip + inverted uses a binary alpha hole and updates the target', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', {
      zIndex: 2,
      fillColor: '#00ff00',
      scaleX: 2,
      scaleY: 2,
      matte: { sourcePartId: 'src', mode: 'clip', inverted: true },
    });
    await seed(page, [source, target]);

    const dom = await matteDom(page);
    const mask = dom.masks.find((candidate) => candidate.id === 'kcs-mask-src-alpha-inv');
    expect(mask).toBeTruthy();
    expect(mask!.type).toBe('alpha');
    expect(mask!.children).toHaveLength(1);
    expect(mask!.children[0].tag.toLowerCase()).toBe('path');
    expect(dom.clips).toHaveLength(0);
    expect(dom.layers.some((layer) => layer.mask === 'url(#kcs-mask-src-alpha-inv)')).toBe(true);

    expect(await pixelAt(page, 310, 240)).toBe('red'); // source contour is the inverse hole
    expect(await pixelAt(page, 350, 240)).toBe('green'); // target ring remains visible
  });

  test('V-A3 — Clip inverted keeps an off-target Text fully visible', async ({ page }) => {
    const source = makeLayer('src', 'Rectangle Source', 'custom_rect', {
      zIndex: 1,
      x: -400,
      fillColor: '#ffffff',
    });
    const target = makeLayer('tgt', 'NEW TEXT', 'custom_text', {
      zIndex: 2,
      fillColor: '#00ff00',
      textValue: 'NEW TEXT',
      fontSize: 120,
      fontFamily: 'Arial',
      fontWeight: '700',
      matte: { sourcePartId: 'src', mode: 'clip', inverted: true },
    });
    await seed(page, [source, target]);

    const mask = await page.locator('mask[id="kcs-mask-src-alpha-inv"]').evaluate((node) => ({
      x: node.getAttribute('x'),
      y: node.getAttribute('y'),
      width: node.getAttribute('width'),
      height: node.getAttribute('height'),
      units: node.getAttribute('maskUnits'),
      contentUnits: node.getAttribute('maskContentUnits'),
    }));
    expect(mask).toEqual({
      x: '-660',
      y: '-300',
      width: '1920',
      height: '1080',
      units: 'userSpaceOnUse',
      contentUnits: 'userSpaceOnUse',
    });
    expect(await maxGreenInWorldRect(page, 80, 250, 120, 280)).toBeGreaterThan(110);
    expect(await maxGreenInWorldRect(page, 350, 570, 120, 280)).toBeGreaterThan(110);
  });

  test('V-A4 — Clip inverted keeps both outside regions around a partial source overlap', async ({ page }) => {
    const source = makeLayer('src', 'Rectangle Source', 'custom_rect', {
      zIndex: 1,
      x: 100,
      fillColor: '#ffffff',
    });
    const target = makeLayer('tgt', 'NEW TEXT', 'custom_text', {
      zIndex: 2,
      fillColor: '#00ff00',
      textValue: 'NEW TEXT',
      fontSize: 120,
      fontFamily: 'Arial',
      fontWeight: '700',
      matte: { sourcePartId: 'src', mode: 'clip', inverted: true },
    });
    await seed(page, [source, target]);

    const maskPath = await page.locator('mask[id="kcs-mask-src-alpha-inv"] path').getAttribute('d');
    expect(maskPath).toContain('M 340 210 L 460 210 L 460 270 L 340 270 Z');
    expect(await maxGreenInWorldRect(page, 80, 280, 120, 280)).toBeGreaterThan(110);
    expect(await maxGreenInWorldRect(page, 500, 580, 120, 280)).toBeGreaterThan(110);
  });

  test('V-B3 — Alpha and Luminance use the same explicit project coverage with partial source overlap', async ({ page }) => {
    for (const mode of ['alpha', 'luminance'] as const) {
      const source = makeLayer('src', 'Rectangle Source', 'custom_rect', {
        zIndex: 1,
        x: -100,
        fillColor: '#ffffff',
      });
      const target = makeLayer('tgt', 'NEW TEXT', 'custom_text', {
        zIndex: 2,
        fillColor: '#00ff00',
        textValue: 'NEW TEXT',
        fontSize: 120,
        fontFamily: 'Arial',
        fontWeight: '700',
        matte: { sourcePartId: 'src', mode },
      });
      await seed(page, [source, target]);

      const mask = await page.locator(`mask[id="kcs-mask-src-${mode}"]`).evaluate((node) => ({
        x: node.getAttribute('x'),
        y: node.getAttribute('y'),
        width: node.getAttribute('width'),
        height: node.getAttribute('height'),
        units: node.getAttribute('maskUnits'),
        contentUnits: node.getAttribute('maskContentUnits'),
      }));
      expect(mask).toEqual({
        x: '-660',
        y: '-300',
        width: '1920',
        height: '1080',
        units: 'userSpaceOnUse',
        contentUnits: 'userSpaceOnUse',
      });
      expect(await maxGreenInWorldRect(page, 140, 260, 120, 280)).toBeGreaterThan(110);
      expect(await maxGreenInWorldRect(page, 350, 570, 120, 280)).toBeLessThan(70);
    }
  });

  test('V-B2 — alpha matte keeps source world geometry with a transformed Text target', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_rect', {
      zIndex: 1,
      x: -90,
      scaleX: 1.5,
      scaleY: 1.2,
    });
    const target = makeLayer('tgt', 'Target', 'custom_text', {
      zIndex: 2,
      x: 30,
      y: 10,
      scaleX: 1.25,
      rotation: -10,
      textValue: 'NEW TEXT',
      fontSize: 48,
      fillColor: '#00ff00',
      matte: { sourcePartId: 'src', mode: 'alpha' },
    });
    await seed(page, [source, target]);

    const mask = (await matteDom(page)).masks.find((candidate) => candidate.id === 'kcs-mask-src-alpha');
    expect(mask).toBeTruthy();
    expect(mask!.children[0].d).toBe('M 120 204 L 300 204 L 300 276 L 120 276 Z');

    const targetLayer = await page.locator('g[data-part-id="tgt"]').evaluate((node) => ({
      mask: node.getAttribute('mask'),
      transform: node.querySelector(':scope > g')?.getAttribute('transform'),
    }));
    expect(targetLayer.mask).toBe('url(#kcs-mask-src-alpha)');
    expect(targetLayer.transform).toBe('translate(330, 250) rotate(-10) scale(1.25, 1)');
  });

  test('V-B — alpha + target transform (scale 2)', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'alpha' } });
    await seed(page, [source, target]);
    expect(await pixelAt(page, 310, 240)).toBe('green');
    expect(await pixelAt(page, 350, 240)).toBe('dark');
  });

  test('V-C — luminance + target transform (scale 2, white source = full strength)', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ffffff' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'luminance' } });
    await seed(page, [source, target]);
    expect(await pixelAt(page, 310, 240)).toBe('green'); // luminance 255 → target fully visible in box
    expect(await pixelAt(page, 350, 240)).toBe('dark');
  });

  test('V-D — inverted luminance + target transform', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'luminance', inverted: true } });
    await seed(page, [source, target]);
    expect(await pixelAt(page, 310, 240)).toBe('red');   // box region = hole → source shows
    expect(await pixelAt(page, 350, 240)).toBe('green'); // ring visible
  });

  test('V-E — alpha + inverted + target transform', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'alpha', inverted: true } });
    await seed(page, [source, target]);
    expect(await pixelAt(page, 310, 240)).toBe('red');   // black path = 0-alpha hole → source shows
    expect(await pixelAt(page, 350, 240)).toBe('green');
  });

  test('V-F — luminance + inverted + target transform', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'luminance', inverted: true } });
    await seed(page, [source, target]);
    expect(await pixelAt(page, 310, 240)).toBe('red');
    expect(await pixelAt(page, 350, 240)).toBe('green');
  });

  test('V-G — animated source + target transform: mask follows the source', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'alpha' } });
    const tracks = [
      {
        id: 't_src', partId: 'src', name: 'Source',
        channels: {
          x: [
            { id: 'k1', frame: 0, value: 0, easing: 'linear' },
            { id: 'k2', frame: 60, value: 120, easing: 'linear' },
          ],
        },
      },
    ];
    await seed(page, [source, target], tracks);

    // Frame 0: mask at center → box region shows the target
    expect(await pixelAt(page, 310, 240)).toBe('green');

    // Play through the EXISTING rAF pipeline — the mask must follow the
    // source away from the center (box leaves the circle → target hidden at
    // the old spot, source visible at its new position outside the circle).
    await page.getByTitle('Play', { exact: true }).click();
    await page.waitForTimeout(1800); // ~54 frames → source x ≈ 108 → box (378–438)
    await page.getByTitle('Pause', { exact: true }).click();

    expect(await pixelAt(page, 310, 240)).toBe('dark'); // old spot: no mask → hidden
    expect(await pixelAt(page, 400, 240)).toBe('red');  // source at new spot (outside circle)
  });
});

test.describe('M14 track matte — FEATHER (real browser pixel assertions)', () => {
  // Box edge at world x=270 (source box 270–330). Points 264/266/268 are
  // OUTSIDE the box (6/4/2 px). feather=0 → all dark (sharp). feather>0 →
  // gradual ramp (264 < 266 < 268, intermediate values).

  async function greenStrengthAt(page: Page, worldX: number, worldY: number): Promise<number> {
    const buf = await page.screenshot();
    const png = decodePng(buf);
    const { x, y } = await page.evaluate(([wx, wy]: [number, number]) => {
      const svg = [...document.querySelectorAll('svg')].find((s) => !!s.querySelector('#artboard-clip'))!;
      const pt = svg.createSVGPoint(); pt.x = wx; pt.y = wy;
      const s = pt.matrixTransform(svg.getScreenCTM()!);
      return { x: Math.round(s.x), y: Math.round(s.y) };
    }, [worldX, worldY]);
    const i = (y * png.width + x) * png.bpp;
    return png.data[i + 1]; // green channel → target visibility strength
  }

  async function edgeProbe(page: Page): Promise<number[]> {
    return Promise.all([264, 266, 268, 310].map((x) => greenStrengthAt(page, x, 240)));
  }

  test('V-H — feather 0 = sharp edge, feather 12 = gradual ramp (same fixture)', async ({ page }) => {
    // feather 0: outside edge fully hidden (sharp)
    const s0 = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const t0 = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'alpha', feather: 0 } });
    await seed(page, [s0, t0]);
    const sharp = await edgeProbe(page);
    expect(sharp[0]).toBeLessThan(45); // 264 outside → hidden
    expect(sharp[1]).toBeLessThan(45); // 266 outside → hidden
    expect(sharp[2]).toBeLessThan(45); // 268 outside → hidden
    expect(sharp[3]).toBeGreaterThan(200); // 310 inside → fully visible

    // feather 12: gradual ramp across the same points
    const s1 = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const t1 = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'alpha', feather: 12 } });
    await seed(page, [s1, t1]);
    const soft = await edgeProbe(page);
    // Monotonic ramp: 264 < 266 < 268 (approaching the edge)
    expect(soft[0]).toBeGreaterThan(45);          // already partially visible 6px out
    expect(soft[0]).toBeLessThan(soft[1]);
    expect(soft[1]).toBeLessThan(soft[2]);
    expect(soft[2]).toBeGreaterThan(soft[0] + 30); // meaningful gradient
    expect(soft[3]).toBeGreaterThan(200);          // inside still fully visible
  });

  test('V-I — feather stays world-aligned with a ROTATED target', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, rotation: 45, matte: { sourcePartId: 'src', mode: 'alpha', feather: 12 } });
    await seed(page, [source, target]);

    const soft = await edgeProbe(page);
    expect(soft[0]).toBeGreaterThan(45);
    expect(soft[0]).toBeLessThan(soft[1]);
    expect(soft[1]).toBeLessThan(soft[2]);
    expect(soft[3]).toBeGreaterThan(200);
  });

  test('V-J — animated feathered source: mask geometry follows, filter stays stable', async ({ page }) => {
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'alpha', feather: 12 } });
    const tracks = [
      {
        id: 't_src', partId: 'src', name: 'Source',
        channels: {
          x: [
            { id: 'k1', frame: 0, value: 0, easing: 'linear' },
            { id: 'k2', frame: 60, value: 120, easing: 'linear' },
          ],
        },
      },
    ];
    await seed(page, [source, target], tracks);

    const d0 = await page.evaluate(() => {
      const m = document.querySelector('mask[id="kcs-mask-src-alpha-f12"] path');
      return m?.getAttribute('d');
    });
    expect(d0).toBeTruthy();
    expect(await page.evaluate(() => document.querySelectorAll('filter[id^="kcs-matte-feather-"]').length)).toBe(1);

    await page.getByTitle('Play', { exact: true }).click();
    await page.waitForTimeout(1800);
    await page.getByTitle('Pause', { exact: true }).click();

    const d1 = await page.evaluate(() => {
      const m = document.querySelector('mask[id="kcs-mask-src-alpha-f12"] path');
      return m?.getAttribute('d');
    });
    expect(d1).not.toBe(d0); // geometry followed the animated source
    expect(await page.evaluate(() => document.querySelectorAll('filter[id^="kcs-matte-feather-"]').length)).toBe(1); // filter stable
  });

  test('V-K — INVERTED alpha + feather: evenodd hole stays a real hole with a soft transition', async ({ page }) => {
    // Source box 270–330. Inverted alpha: OUTSIDE the box visible, INSIDE hidden.
    // Feather 12 → a gradual ramp at the boundary instead of a hard edge.
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ff0000' });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'alpha', inverted: true, feather: 12 } });
    await seed(page, [source, target]);

    const inv = await Promise.all([254, 260, 264, 268, 300].map((x) => greenStrengthAt(page, x, 240)));
    expect(inv[0]).toBeGreaterThan(200); // 16px outside box → target fully visible
    expect(inv[1]).toBeGreaterThan(45);  // 10px out → ramp region
    expect(inv[1]).toBeLessThan(inv[0]); // less visible approaching the hole
    expect(inv[1]).toBeGreaterThan(inv[2]); // monotonic decrease
    expect(inv[2]).toBeGreaterThan(inv[3]);
    expect(inv[4]).toBeLessThan(45);     // inside the box → genuinely hidden (real hole)

    // DOM: the feathered evenodd single-path structure (region contour + geometry)
    // NOTE: <mask> lives inside <defs> — never "visible" to Playwright; assert
    // existence + structure via evaluate.
    const maskDom = await page.evaluate(() => {
      const m = document.querySelector('mask[id="kcs-mask-src-alpha-inv-f12"]');
      const p = m?.querySelector('path');
      return { exists: !!m, evenodd: p?.getAttribute('fill-rule') ?? null, hasFilter: !!p?.getAttribute('filter') };
    });
    expect(maskDom.exists).toBe(true);
    expect(maskDom.evenodd).toBe('evenodd');
    expect(maskDom.hasFilter).toBe(true);
  });

  test('V-L — luminance + feather: white source = full-strength soft edge (source hidden)', async ({ page }) => {
    // Luminance uses the source FILL color: white → full strength. The source
    // itself is hidden (opacity 0) so its own pixels cannot pollute the probe.
    const source = makeLayer('src', 'Source', 'custom_box', { zIndex: 1, fillColor: '#ffffff', opacity: 0 });
    const target = makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'luminance', feather: 12 } });
    await seed(page, [source, target]);

    const soft = await edgeProbe(page); // [264, 266, 268, 310] at y=240
    expect(soft[0]).toBeGreaterThan(45);      // ramp begins 6px outside the edge
    expect(soft[0]).toBeLessThan(200);        // partial, not full
    expect(soft[0]).toBeLessThan(soft[1]);    // monotonic increase toward the edge
    expect(soft[1]).toBeLessThan(soft[2]);
    expect(soft[2]).toBeLessThan(soft[3]);
    expect(soft[3]).toBeGreaterThan(200);     // inside → full strength (white luminance)

    // mask-type must be explicit luminance (never the browser default)
    const mt = await page.evaluate(() => document.querySelector('mask[id="kcs-mask-src-luminance-f12"]')?.getAttribute('mask-type'));
    expect(mt).toBe('luminance');
  });
});

test.describe('M15 freeform matte — real browser pixel assertions', () => {
  // Freeform triangle (CENTER-RELATIVE local points — same source the
  // renderer draws via buildFreeformPath): (0,0),(60,0),(0,30) at world
  // (300,240) → spans (300,240)-(360,240)-(300,270). At y=255 the interior
  // is x ∈ (300, 330).
  const TRI = [
    { x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 30 },
  ];
  const freeformSource = (overrides: Record<string, unknown> = {}) =>
    makeLayer('src', 'Source', 'custom_freeform', { zIndex: 1, fillColor: '#ff0000', points: TRI, ...overrides });
  const greenTarget = (matte: Record<string, unknown>) =>
    makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte });

  /** Raw green channel at a world point (for feather ramp monotonicity —
   *  classify() would collapse partial visibility into 'green'). */
  async function greenAt(page: Page, worldX: number, worldY: number): Promise<number> {
    const buf = await page.screenshot();
    const png = decodePng(buf);
    const { x, y } = await page.evaluate(([wx, wy]: [number, number]) => {
      const svg = [...document.querySelectorAll('svg')].find((s) => !!s.querySelector('#artboard-clip'))!;
      const pt = svg.createSVGPoint(); pt.x = wx; pt.y = wy;
      const s = pt.matrixTransform(svg.getScreenCTM()!);
      return { x: Math.round(s.x), y: Math.round(s.y) };
    }, [worldX, worldY]);
    return png.data[(y * png.width + x) * png.bpp + 1];
  }

  test('V-M1 — freeform triangle → clip matte: target visible ONLY inside the polygon', async ({ page }) => {
    await seed(page, [freeformSource(), greenTarget({ sourcePartId: 'src', mode: 'clip' })]);

    // DOM: clipPath def carries the freeform world path
    const clipD = await page.evaluate(() => document.querySelector('clipPath[id="kcs-clip-src"] path')?.getAttribute('d'));
    expect(clipD).toBe('M 300 240 L 360 240 L 300 270 Z');
    expect(await page.evaluate(() => document.querySelectorAll('clipPath[id="kcs-clip-src"]').length)).toBe(1); // dedupe

    // PIXEL: inside triangle → green; outside triangle (inside target) → hidden
    expect(await pixelAt(page, 320, 255)).toBe('green');
    expect(await pixelAt(page, 340, 255)).toBe('dark');
  });

  test('V-M2 — freeform polygon → alpha matte: mask follows the polygon', async ({ page }) => {
    await seed(page, [freeformSource(), greenTarget({ sourcePartId: 'src', mode: 'alpha' })]);

    const m = await page.evaluate(() => {
      const mask = document.querySelector('mask[id="kcs-mask-src-alpha"]');
      return { type: mask?.getAttribute('mask-type'), d: mask?.querySelector('path')?.getAttribute('d') ?? null };
    });
    expect(m.type).toBe('alpha');
    expect(m.d).toBe('M 300 240 L 360 240 L 300 270 Z');

    expect(await pixelAt(page, 320, 255)).toBe('green');
    expect(await pixelAt(page, 340, 255)).toBe('dark');
  });

  test('V-M3 — freeform + inverted alpha: polygon interior hidden, outside visible', async ({ page }) => {
    await seed(page, [freeformSource(), greenTarget({ sourcePartId: 'src', mode: 'alpha', inverted: true })]);

    const maskDom = await page.evaluate(() => {
      const p = document.querySelector('mask[id="kcs-mask-src-alpha-inv"] path');
      return { rule: p?.getAttribute('fill-rule') ?? null, d: p?.getAttribute('d') ?? null };
    });
    expect(maskDom.rule).toBe('evenodd'); // M13 inverted-alpha structure preserved
    expect(maskDom.d).toContain('M 300 240 L 360 240 L 300 270 Z'); // freeform contour inside the region path

    expect(await pixelAt(page, 320, 255)).toBe('red');      // inside polygon → target masked out → source red
    expect(await pixelAt(page, 345, 250)).toBe('green');    // outside polygon (inside target) → visible
  });

  test('V-M4 — freeform + feather: soft ramp at the polygon edge (feGaussianBlur)', async ({ page }) => {
    await seed(page, [freeformSource(), greenTarget({ sourcePartId: 'src', mode: 'alpha', feather: 12 })]);

    // DOM: feathered mask + filter exist
    expect(await page.evaluate(() => !!document.querySelector('mask[id="kcs-mask-src-alpha-f12"]'))).toBe(true);
    expect(await page.evaluate(() => !!document.querySelector('filter[id="kcs-matte-feather-src-alpha-f12"] feGaussianBlur'))).toBe(true);

    // PIXEL: left edge x=300 (vertical) — probes 6/4/2px OUTSIDE + inside
    const a = await greenAt(page, 294, 255); // 6px outside
    const b = await greenAt(page, 296, 255); // 4px outside
    const c = await greenAt(page, 298, 255); // 2px outside
    const inside = await greenAt(page, 310, 255);
    expect(a).toBeGreaterThan(45);    // ramp already visible
    expect(a).toBeLessThan(200);      // not full
    expect(a).toBeLessThan(b);        // monotonic toward the edge
    expect(b).toBeLessThan(c);
    expect(inside).toBeGreaterThan(200);
  });

  test('V-M5 — rotated + scaled freeform source: matte follows the SOURCE transform', async ({ page }) => {
    // rotation 90 + scaleX 2 → vertices (300,240),(300,360),(270,240);
    // at y=255 interior x ∈ (273.75, 300)
    await seed(page, [
      freeformSource({ rotation: 90, scaleX: 2 }),
      greenTarget({ sourcePartId: 'src', mode: 'clip' }),
    ]);

    expect(await pixelAt(page, 285, 255)).toBe('green'); // inside rotated triangle
    expect(await pixelAt(page, 310, 255)).toBe('dark');  // outside → hidden
  });

  test('V-M6 — animated freeform source: matte path follows the animation (no stale cache)', async ({ page }) => {
    const tracks = [
      {
        id: 't_src', partId: 'src', name: 'Source',
        channels: {
          x: [
            { id: 'k1', frame: 0, value: 0, easing: 'linear' },
            { id: 'k2', frame: 60, value: 120, easing: 'linear' },
          ],
        },
      },
    ];
    await seed(page, [freeformSource(), greenTarget({ sourcePartId: 'src', mode: 'clip' })], tracks);

    const d0 = await page.evaluate(() => document.querySelector('clipPath[id="kcs-clip-src"] path')?.getAttribute('d'));
    expect(d0).toBe('M 300 240 L 360 240 L 300 270 Z');

    await page.getByTitle('Play', { exact: true }).click();
    await page.waitForTimeout(1800);
    await page.getByTitle('Pause', { exact: true }).click();

    const d1 = await page.evaluate(() => document.querySelector('clipPath[id="kcs-clip-src"] path')?.getAttribute('d'));
    expect(d1).not.toBe(d0);                    // geometry followed the animated source
    expect(d1).toMatch(/^M 4\d\d 240 L 4\d\d 240/); // moved right (x grew) — cache rebuilt from evaluated transform
    expect(await page.evaluate(() => document.querySelectorAll('clipPath[id="kcs-clip-src"]').length)).toBe(1); // still deduped
  });

  test('V-M7 — IMPORT → RENDER round-trip: freeform points + matte survive the app serialization, pixels identical', async ({ page }) => {
    await seed(page, [freeformSource(), greenTarget({ sourcePartId: 'src', mode: 'clip' })]);

    // Pixel BEFORE the round-trip
    expect(await pixelAt(page, 320, 255)).toBe('green');
    expect(await pixelAt(page, 340, 255)).toBe('dark');

    // The app's OWN autosave serializes the current scene back to localStorage —
    // wait for it, then verify freeform points + matte survived the export path.
    await page.waitForFunction(() => {
      try {
        const s = JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}');
        const l = (s.layers ?? []).find((x: any) => x.id === 'src');
        return Array.isArray(l?.points) && l.points.length >= 3;
      } catch { return false; }
    }, undefined, { timeout: 10000 });
    const autosaved = await page.evaluate(() => JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5')!));
    expect(autosaved.layers.find((l: any) => l.id === 'src').points).toEqual([
      { x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 30 },
    ]);
    expect(autosaved.layers.find((l: any) => l.id === 'tgt').matte).toEqual({ sourcePartId: 'src', mode: 'clip' });

    // IMPORT path: reload → the app restores the scene from the autosaved JSON
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('[id^="kcs-"]').length > 0, undefined, { timeout: 15000 });

    // Pixel AFTER the round-trip — identical (serialization changed nothing)
    expect(await pixelAt(page, 320, 255)).toBe('green');
    expect(await pixelAt(page, 340, 255)).toBe('dark');
    // No duplicate defs after re-import
    expect(await page.evaluate(() => document.querySelectorAll('clipPath[id="kcs-clip-src"]').length)).toBe(1);
  });

  test('V-M8 — IMPORT → RENDER round-trip: alpha + feather survive, feathered ramp identical after reload', async ({ page }) => {
    await seed(page, [freeformSource(), greenTarget({ sourcePartId: 'src', mode: 'alpha', feather: 12 })]);

    const rampBefore = [
      await greenAt(page, 294, 255),
      await greenAt(page, 298, 255),
      await greenAt(page, 310, 255),
    ];

    await page.waitForFunction(() => {
      try {
        const s = JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}');
        const l = (s.layers ?? []).find((x: any) => x.id === 'tgt');
        return l?.matte?.feather === 12;
      } catch { return false; }
    }, undefined, { timeout: 10000 });
    const autosaved = await page.evaluate(() => JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5')!));
    expect(autosaved.layers.find((l: any) => l.id === 'tgt').matte).toEqual({
      sourcePartId: 'src', mode: 'alpha', feather: 12,
    });
    expect(autosaved.layers.find((l: any) => l.id === 'src').points).toEqual([
      { x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 30 },
    ]);

    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('[id^="kcs-"]').length > 0, undefined, { timeout: 15000 });

    const rampAfter = [
      await greenAt(page, 294, 255),
      await greenAt(page, 298, 255),
      await greenAt(page, 310, 255),
    ];
    // Pixel parity: the feathered ramp is identical after the real import
    expect(rampAfter[0]).toBe(rampBefore[0]);
    expect(rampAfter[1]).toBe(rampBefore[1]);
    expect(rampAfter[2]).toBe(rampBefore[2]);
    expect(await page.evaluate(() => document.querySelectorAll('mask[id="kcs-mask-src-alpha-f12"]').length)).toBe(1);
  });
});

test.describe('M16 matte strength — real browser pixel assertions', () => {
  // Same freeform-triangle fixture as M15: polygon (300,240)-(360,240)-(300,270);
  // inside probe (320,255), outside (340,255), inverted-outside (345,250).
  const TRI = [
    { x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 30 },
  ];
  const source = (overrides: Record<string, unknown> = {}) =>
    makeLayer('src', 'Source', 'custom_freeform', { zIndex: 1, fillColor: '#ff0000', points: TRI, ...overrides });
  const greenTarget = (matte: Record<string, unknown>) =>
    makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte });

  async function greenAt(page: Page, worldX: number, worldY: number): Promise<number> {
    const buf = await page.screenshot();
    const png = decodePng(buf);
    const { x, y } = await page.evaluate(([wx, wy]: [number, number]) => {
      const svg = [...document.querySelectorAll('svg')].find((s) => !!s.querySelector('#artboard-clip'))!;
      const pt = svg.createSVGPoint(); pt.x = wx; pt.y = wy;
      const s = pt.matrixTransform(svg.getScreenCTM()!);
      return { x: Math.round(s.x), y: Math.round(s.y) };
    }, [worldX, worldY]);
    return png.data[(y * png.width + x) * png.bpp + 1];
  }

  test('V-S1 — alpha strength=1: full matte (legacy pixel behavior)', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', strength: 1 })]);
    expect(await greenAt(page, 320, 255)).toBeGreaterThan(200); // inside fully visible
    expect(await greenAt(page, 340, 255)).toBeLessThan(45);     // outside hidden
  });

  test('V-S2 — alpha strength=0.5: pixel opacity ~half of full strength', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', strength: 0.5 })]);
    const inside = await greenAt(page, 320, 255);
    expect(inside).toBeGreaterThan(45);   // partially visible
    expect(inside).toBeLessThan(200);     // NOT full strength
    expect(inside).toBeGreaterThan(80);   // meaningful half-strength signal (≈128)
    expect(await greenAt(page, 340, 255)).toBeLessThan(45); // outside still hidden
  });

  test('V-S3 — alpha strength=0: matte content opacity 0 → target invisible inside', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', strength: 0 })]);
    expect(await greenAt(page, 320, 255)).toBeLessThan(45); // source red shows, no green
    expect(await greenAt(page, 340, 255)).toBeLessThan(45);
  });

  test('V-S4 — inverted alpha + strength=0.5: hole preserved, outside at half strength', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', inverted: true, strength: 0.5 })]);
    expect(await greenAt(page, 320, 255)).toBeLessThan(45);              // inside hole → target masked out
    const outside = await greenAt(page, 345, 250);                      // outside polygon, inside target
    expect(outside).toBeGreaterThan(45);
    expect(outside).toBeLessThan(200);                                  // half strength (≈128)
  });

  test('V-S5 — feather=12 + strength=0.5: ramp preserved, total strength halved', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', feather: 12, strength: 0.5 })]);
    const a = await greenAt(page, 294, 255);
    const b = await greenAt(page, 296, 255);
    const c = await greenAt(page, 298, 255);
    const inside = await greenAt(page, 310, 255);
    expect(a).toBeGreaterThan(20);        // ramp visible
    expect(a).toBeLessThan(b);            // monotonic (feather preserved)
    expect(b).toBeLessThan(c);
    expect(inside).toBeGreaterThan(45);   // half-strength inside
    expect(inside).toBeLessThan(200);     // NOT full
  });

  test('V-S6 — strength import/reload: alpha + feather 12 + strength 0.5 survive, DOM fill-opacity visible', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', feather: 12, strength: 0.5 })]);

    // App's own autosave (export path) carries the full matte
    await page.waitForFunction(() => {
      try {
        const s = JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}');
        const l = (s.layers ?? []).find((x: any) => x.id === 'tgt');
        return l?.matte?.strength === 0.5 && l?.matte?.feather === 12;
      } catch { return false; }
    }, undefined, { timeout: 10000 });
    const autosaved = await page.evaluate(() => JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5')!));
    expect(autosaved.layers.find((l: any) => l.id === 'tgt').matte).toEqual({
      sourcePartId: 'src', mode: 'alpha', feather: 12, strength: 0.5,
    });

    // Reload → real import path
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('[id^="kcs-"]').length > 0, undefined, { timeout: 15000 });
    expect(await page.evaluate(() => document.querySelectorAll('mask[id="kcs-mask-src-alpha-f12-s0.5"]').length)).toBe(1);
    expect(await page.evaluate(() =>
      document.querySelector('mask[id="kcs-mask-src-alpha-f12-s0.5"] path')?.getAttribute('fill-opacity'))).toBe('0.5');
  });

  test('V-S7 — pixel parity after reload: strength 0.5 + feather ramp identical pre/post import', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', feather: 12, strength: 0.5 })]);

    const before = [
      await greenAt(page, 294, 255),
      await greenAt(page, 298, 255),
      await greenAt(page, 310, 255),
    ];
    expect(before[2]).toBeGreaterThan(45); // half-strength signal present

    await page.waitForFunction(() => {
      try {
        const s = JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}');
        return (s.layers ?? []).find((x: any) => x.id === 'tgt')?.matte?.strength === 0.5;
      } catch { return false; }
    }, undefined, { timeout: 10000 });
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('[id^="kcs-"]').length > 0, undefined, { timeout: 15000 });

    const after = [
      await greenAt(page, 294, 255),
      await greenAt(page, 298, 255),
      await greenAt(page, 310, 255),
    ];
    expect(after[0]).toBe(before[0]); // exact pixel parity (same fixture, same viewport)
    expect(after[1]).toBe(before[1]);
    expect(after[2]).toBe(before[2]);
  });

  test('V-S8 — inverted alpha + strength 0.5 survives reload (evenodd + fill-opacity)', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', inverted: true, strength: 0.5 })]);
    await page.waitForFunction(() => {
      try {
        const s = JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}');
        return (s.layers ?? []).find((x: any) => x.id === 'tgt')?.matte?.inverted === true;
      } catch { return false; }
    }, undefined, { timeout: 10000 });
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('[id^="kcs-"]').length > 0, undefined, { timeout: 15000 });
    // evenodd hole + strength preserved after the real import
    expect(await page.evaluate(() =>
      document.querySelector('mask[id="kcs-mask-src-alpha-inv-s0.5"] path')?.getAttribute('fill-rule'))).toBe('evenodd');
    expect(await page.evaluate(() =>
      document.querySelector('mask[id="kcs-mask-src-alpha-inv-s0.5"] path')?.getAttribute('fill-opacity'))).toBe('0.5');
    expect(await greenAt(page, 320, 255)).toBeLessThan(45);  // hole preserved (pixel)
    const outside = await greenAt(page, 345, 250);
    expect(outside).toBeGreaterThan(45);                     // half-strength outside
    expect(outside).toBeLessThan(200);
  });
});

test.describe('M17 gradient matte — real browser pixel assertions', () => {
  // Freeform-triangle fixture (same as M15/M16): polygon (300,240)-(360,240)-(300,270)
  const TRI = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 30 }];
  const source = (overrides: Record<string, unknown> = {}) =>
    makeLayer('src', 'Source', 'custom_freeform', { zIndex: 1, fillColor: '#ff0000', points: TRI, ...overrides });
  const greenTarget = (matte: Record<string, unknown>) =>
    makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte });

  async function greenAt(page: Page, worldX: number, worldY: number): Promise<number> {
    const buf = await page.screenshot();
    const png = decodePng(buf);
    const { x, y } = await page.evaluate(([wx, wy]: [number, number]) => {
      const svg = [...document.querySelectorAll('svg')].find((s) => !!s.querySelector('#artboard-clip'))!;
      const pt = svg.createSVGPoint(); pt.x = wx; pt.y = wy;
      const s = pt.matrixTransform(svg.getScreenCTM()!);
      return { x: Math.round(s.x), y: Math.round(s.y) };
    }, [worldX, worldY]);
    return png.data[(y * png.width + x) * png.bpp + 1];
  }

  test('V-G1 — alpha gradient L→R: monotonic ramp inside the matte path', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 0 } })]);
    // Triangle at y=255 spans x∈(300,330); bright at x1 (~296), fading right
    const g305 = await greenAt(page, 305, 255);
    const g315 = await greenAt(page, 315, 255);
    const g325 = await greenAt(page, 325, 255);
    expect(g305).toBeGreaterThan(150);
    expect(g305).toBeGreaterThan(g315);
    expect(g315).toBeGreaterThan(g325);
    expect(g325).toBeLessThan(200);
    // DOM evidence
    const units = await page.evaluate(() => document.querySelector('linearGradient')?.getAttribute('gradientUnits'));
    const stops = await page.evaluate(() => document.querySelectorAll('linearGradient stop').length);
    expect(units).toBe('userSpaceOnUse');
    expect(stops).toBe(2);
  });

  test('V-G2 — angle 180: ramp direction reversed', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 180 } })]);
    const g305 = await greenAt(page, 305, 255);
    const g315 = await greenAt(page, 315, 255);
    const g325 = await greenAt(page, 325, 255);
    expect(g325).toBeGreaterThan(g315);
    expect(g315).toBeGreaterThan(g305); // bright end moved to the right (x2 side)
    expect(g325).toBeGreaterThan(80);   // in-triangle max ≈ 110 for a 180° span
  });

  test('V-G3 — gradient + strength 0.5: ramp amplitude halved', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', strength: 0.5, gradient: { angle: 0 } })]);
    const g315 = await greenAt(page, 315, 255);
    expect(g315).toBeGreaterThan(40);  // partial visibility
    expect(g315).toBeLessThan(130);    // NOT full strength (≈188/2 ≈ 94)
    expect(await page.evaluate(() => document.querySelector('mask path')?.getAttribute('fill-opacity'))).toBe('0.5');
  });

  test('V-G4 — gradient + feather 12: ramp monotonic + feGaussianBlur present', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', feather: 12, gradient: { angle: 0 } })]);
    const g305 = await greenAt(page, 305, 255);
    const g315 = await greenAt(page, 315, 255);
    const g325 = await greenAt(page, 325, 255);
    expect(g305).toBeGreaterThan(g315);
    expect(g315).toBeGreaterThan(g325);
    const std = await page.evaluate(() => document.querySelector('feGaussianBlur')?.getAttribute('stdDeviation'));
    expect(std).toBe('6'); // feather math untouched by gradient
  });

  test('V-G5 — freeform source: pathD unchanged + gradient ramp on the same path', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 0 } })]);
    const d = await page.evaluate(() => document.querySelector('mask[id="kcs-mask-src-alpha-g0"] path')?.getAttribute('d'));
    expect(d).toBe('M 300 240 L 360 240 L 300 270 Z'); // byte-for-byte M15 freeform world path
    expect(await greenAt(page, 310, 255)).toBeGreaterThan(150);
  });

  test('V-G6 — rotated + scaled source: gradient follows the source transform', async ({ page }) => {
    // rotation 90 + scaleX 2 → matte path (300,240),(300,360),(270,240);
    // gradient angle 0 (source-local) becomes DOWNWARD in world: (285,232)→(285,368)
    await seed(page, [source({ rotation: 90, scaleX: 2 }), greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 0 } })]);
    // Rotated triangle at x=285 spans y∈(240,270)... verify direction: same x, brightness drops with y
    const gTop = await greenAt(page, 285, 245);
    const gBottom = await greenAt(page, 285, 255);
    expect(gTop).toBeGreaterThan(gBottom);
  });

  test('V-G7 — animated source: gradient endpoints follow the movement (no stale coordinates)', async ({ page }) => {
    const tracks = [
      {
        id: 't_src', partId: 'src', name: 'Source',
        channels: {
          x: [
            { id: 'k1', frame: 0, value: 0, easing: 'linear' },
            { id: 'k2', frame: 60, value: 120, easing: 'linear' },
          ],
        },
      },
    ];
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 0 } })], tracks);
    const x1Before = await page.evaluate(() => document.querySelector('linearGradient')?.getAttribute('x1'));
    await page.getByTitle('Play', { exact: true }).click();
    await page.waitForTimeout(1800);
    await page.getByTitle('Pause', { exact: true }).click();
    const x1After = await page.evaluate(() => document.querySelector('linearGradient')?.getAttribute('x1'));
    expect(parseFloat(x1After!) - parseFloat(x1Before!)).toBeGreaterThan(40); // endpoints followed the +120 move
  });

  test('V-G8 — import/reload: gradient survives serialization, pixels identical', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 0 } })]);
    const before = [await greenAt(page, 305, 255), await greenAt(page, 315, 255)];
    await page.waitForFunction(() => {
      try {
        const s = JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}');
        return (s.layers ?? []).find((x: any) => x.id === 'tgt')?.matte?.gradient?.angle === 0;
      } catch { return false; }
    }, undefined, { timeout: 10000 });
    const autosaved = await page.evaluate(() => JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5')!));
    expect(autosaved.layers.find((l: any) => l.id === 'tgt').matte.gradient).toEqual({ angle: 0 });
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('[id^="kcs-"]').length > 0, undefined, { timeout: 15000 });
    const after = [await greenAt(page, 305, 255), await greenAt(page, 315, 255)];
    expect(after[0]).toBe(before[0]); // exact pixel parity through the real import
    expect(after[1]).toBe(before[1]);
  });

  test('V-G9 — luminance gradient white→black: monotonic mask ramp', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'luminance', gradient: { angle: 0 } })]);
    const g305 = await greenAt(page, 305, 255);
    const g315 = await greenAt(page, 315, 255);
    const g325 = await greenAt(page, 325, 255);
    expect(g305).toBeGreaterThan(g315);
    expect(g315).toBeGreaterThan(g325); // white(lum 1) → black(lum 0)
    expect(g305).toBeGreaterThan(120);
  });

  test('V-G10 — inverted luminance + gradient: hole preserved + outer ramp', async ({ page }) => {
    await seed(page, [source(), greenTarget({ sourcePartId: 'src', mode: 'luminance', inverted: true, gradient: { angle: 0 } })]);
    expect(await greenAt(page, 320, 255)).toBeLessThan(45);          // hole (black contour)
    const gLeft = await greenAt(page, 250, 255);                    // outside-left of triangle, inside target
    const gRight = await greenAt(page, 400, 255);                   // outside-right
    expect(gLeft).toBeGreaterThan(120);
    expect(gLeft).toBeGreaterThan(gRight);
  });

  test('V-G11 — negative scale: gradient direction flips WITH the source', async ({ page }) => {
    await seed(page, [source({ scaleX: -1 }), greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 0 } })]);
    // Flipped triangle (300,240),(180,240),(300,270) at y=255 spans x∈(240,300);
    // the flipped source keeps its LOCAL left→right → bright end at world RIGHT
    const gLeft = await greenAt(page, 250, 255);
    const gRight = await greenAt(page, 290, 255);
    expect(gRight).toBeGreaterThan(gLeft); // flip followed — bright end at the shape's local left
    expect(gRight).toBeGreaterThan(80);
  });

  test('V-G12 — dedupe: same source+angle → ONE gradient def; different angle → separate', async ({ page }) => {
    await seed(page, [
      source(),
      greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45 } }),
      makeLayer('tgt2', 'Target2', 'custom_circle', { zIndex: 3, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45 } } }),
      makeLayer('tgt3', 'Target3', 'custom_circle', { zIndex: 4, fillColor: '#00ff00', scaleX: 2, scaleY: 2, matte: { sourcePartId: 'src', mode: 'alpha', gradient: { angle: 90 } } }),
    ]);
    expect(await page.evaluate(() => document.querySelectorAll('linearGradient[id="kcs-mg-src-45-alpha"]').length)).toBe(1);
    expect(await page.evaluate(() => document.querySelectorAll('linearGradient[id="kcs-mg-src-90-alpha"]').length)).toBe(1);
    expect(await page.evaluate(() => document.querySelectorAll('mask[id="kcs-mask-src-alpha-g45"]').length)).toBe(1);
    expect(await page.evaluate(() => document.querySelectorAll('[mask="url(#kcs-mask-src-alpha-g45)"]').length)).toBe(2); // shared by 2 targets
  });

  test('V-G13 — angle endpoint keeps the active UI at 360° while authored data stays normalized', async ({ page }) => {
    const sourcePart = source();
    const targetPart = greenTarget({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 0 } });
    await seed(page, [sourcePart, targetPart]);

    await page.getByRole('treeitem', { name: /^Target/ }).click();
    await page.getByRole('button', { name: 'Expand MASK / TRACK MATTE' }).click();
    const angle = page.locator('input[aria-label="Gradient angle"]');
    await angle.focus();
    await angle.press('End');
    await expect.poll(async () => page.evaluate(() => {
      const raw = localStorage.getItem('SEQUENCER_STUDIO_PRO_V5');
      if (!raw) return undefined;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !('layers' in parsed) || !Array.isArray(parsed.layers)) return undefined;
      const layer = parsed.layers.find((candidate) =>
        candidate && typeof candidate === 'object' && 'id' in candidate && candidate.id === 'tgt'
      );
      if (!layer || typeof layer !== 'object' || !('matte' in layer) || !layer.matte || typeof layer.matte !== 'object') return undefined;
      if (!('gradient' in layer.matte) || !layer.matte.gradient || typeof layer.matte.gradient !== 'object') return undefined;
      return 'angle' in layer.matte.gradient && typeof layer.matte.gradient.angle === 'number'
        ? layer.matte.gradient.angle
        : undefined;
    })).toBe(0);
  });
});

test.describe('M18 text matte — real browser pixel assertions (full 4E matrix)', () => {
  // Text source: HHH @80px bold Arial — solid crossbar band at y≈240 (4A
  // fixture); explicit Arial keeps the pixel tests font-deterministic.
  const textSource = (overrides: Record<string, unknown> = {}) =>
    makeLayer('txt', 'Source', 'custom_text', { zIndex: 1, fillColor: '#ff0000', textValue: 'HHH', fontSize: 80, fontFamily: 'Arial', ...overrides });
  // WIDE green target (scaleX 5 → world x∈(150,450)) so "outside the ink but
  // inside the target" probes exist (ink band ≈ x∈(225,415) at y=240).
  const wideTarget = (matte: Record<string, unknown>) =>
    makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 5, scaleY: 3, matte });

  const INK = { x0: 250, x1: 350, y0: 215, y1: 265 };

  async function ready(page: Page) {
    await page.evaluate(async () => { await (document as any).fonts.ready; });
  }

  async function maxGreen(page: Page, x0: number, x1: number, y0: number, y1: number): Promise<number> {
    let m = 0;
    for (let x = x0; x <= x1; x += 5) for (let y = y0; y <= y1; y += 5) {
      const px = await greenAtWorld(page, x, y);
      if (px > m) m = px;
    }
    return m;
  }

  /** Min green over the box — the inverted text hole (black strokes exist). */
  async function minGreen(page: Page, x0: number, x1: number, y0: number, y1: number): Promise<number> {
    let m = 255;
    for (let x = x0; x <= x1; x += 5) for (let y = y0; y <= y1; y += 5) {
      const px = await greenAtWorld(page, x, y);
      if (px < m) m = px;
    }
    return m;
  }

  async function avgGreenWorld(page: Page, x0: number, x1: number, y0: number, y1: number): Promise<number> {
    let sum = 0, n = 0;
    for (let x = x0; x <= x1; x += 5) for (let y = y0; y <= y1; y += 5) { sum += await greenAtWorld(page, x, y); n++; }
    return sum / n;
  }

  async function greenAtWorld(page: Page, wx: number, wy: number): Promise<number> {
    const buf = await page.screenshot();
    const png = decodePng(buf);
    const { x, y } = await page.evaluate(([a, b]: [number, number]) => {
      const svg = [...document.querySelectorAll('svg')].find((s) => !!s.querySelector('#artboard-clip'))!;
      const pt = svg.createSVGPoint(); pt.x = a; pt.y = b;
      const s = pt.matrixTransform(svg.getScreenCTM()!);
      return { x: Math.round(s.x), y: Math.round(s.y) };
    }, [wx, wy]);
    return png.data[(y * png.width + x) * png.bpp + 1];
  }

  test('V-T1 — text alpha: glyph ink visible, outside-ink (inside target) dark', async ({ page }) => {
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'alpha' })]);
    await page.evaluate(async () => { await (document as any).fonts.ready; });
    const ink = await maxGreen(page, INK.x0, INK.x1, INK.y0, INK.y1);
    expect(ink).toBeGreaterThan(150);           // crossbar ink
    expect(await greenAtWorld(page, 165, 240)).toBeLessThan(45); // outside ink, inside target → hidden
    expect(await greenAtWorld(page, 435, 240)).toBeLessThan(45);
    // DOM: the mask content is a <text>, no path
    expect(await page.evaluate(() => document.querySelector('mask[id="kcs-mask-txt-alpha"] text')?.textContent)).toBe('HHH');
    expect(await page.evaluate(() => document.querySelectorAll('mask[id="kcs-mask-txt-alpha"] path').length)).toBe(0);
  });

  test('V-T2 — text luminance: white text → luminance mask, outside masked', async ({ page }) => {
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'luminance' })]);
    await ready(page);
    expect(await maxGreen(page, INK.x0, INK.x1, INK.y0, INK.y1)).toBeGreaterThan(150);
    expect(await greenAtWorld(page, 165, 240)).toBeLessThan(45);
    expect(await page.evaluate(() => document.querySelector('mask[id="kcs-mask-txt-luminance"]')?.getAttribute('mask-type'))).toBe('luminance');
  });

  test('V-T3 — inverted LUMINANCE text: white rect + black text → deterministic hole', async ({ page }) => {
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'luminance', inverted: true })]);
    await ready(page);
    const hole = await minGreen(page, INK.x0, INK.x1, INK.y0, INK.y1);
    expect(hole).toBeLessThan(45); // black strokes punch the hole
    expect(await greenAtWorld(page, 165, 240)).toBeGreaterThan(150); // rect visible outside ink
    expect(await page.evaluate(() => document.querySelector('mask[id="kcs-mask-txt-luminance-inv"]')?.getAttribute('mask-type'))).toBe('luminance');
  });

  test('V-T3b — inverted ALPHA text falls back to the luminance structure (4A decision)', async ({ page }) => {
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'alpha', inverted: true })]);
    await ready(page);
    const hole = await minGreen(page, INK.x0, INK.x1, INK.y0, INK.y1);
    expect(hole).toBeLessThan(45); // hole exists
    expect(await greenAtWorld(page, 165, 240)).toBeGreaterThan(150); // rect visible outside ink
    expect(await page.evaluate(() => document.querySelector('mask[id="kcs-mask-txt-alpha-inv"]')?.getAttribute('mask-type'))).toBe('luminance');
  });

  test('V-T4 — text gradient: text fill=url with LOCAL endpoints → spatial ramp over the ink', async ({ page }) => {
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0 } })]);
    await ready(page);
    // Identity world → local endpoints ±100; ramp bright LEFT (x1=-100) → dark RIGHT
    const left = await avgGreenWorld(page, 250, 280, 225, 255);
    const right = await avgGreenWorld(page, 350, 380, 225, 255);
    expect(left).toBeGreaterThan(right + 25);
    expect(await page.evaluate(() => document.querySelector('linearGradient[id="kcs-mg-txt-0-alpha"]')?.getAttribute('x1'))).toBe('-100');
  });

  test('V-T5 — text + feather: filter bound, stdDeviation intact, ink preserved', async ({ page }) => {
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'alpha', feather: 12 })]);
    await ready(page);
    expect(await maxGreen(page, INK.x0, INK.x1, INK.y0, INK.y1)).toBeGreaterThan(120);
    expect(await page.evaluate(() => document.querySelector('mask[id="kcs-mask-txt-alpha-f12"] text')?.getAttribute('filter'))).toContain('kcs-matte-feather-txt-alpha-f12');
    expect(await page.evaluate(() => document.querySelector('feGaussianBlur')?.getAttribute('stdDeviation'))).toBe('6');
  });

  test('V-T6 — text + strength 0.5: ink strength approximately halved', async ({ page }) => {
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'alpha', strength: 0.5 })]);
    await ready(page);
    // NOTE: the app draws a cyan (#00d2ff) edit-mode center marker at the
    // part's pivot (300,240) — probe the crossbar band BELOW it (y 243-258)
    // for a clean 0.5-strength reading (crossbars ≈ 127).
    const half = await maxGreen(page, 235, 278, 243, 258); // H1 crossbar — AWAY from the center marker (300,240)
    const fo = await page.evaluate(() => document.querySelector('mask[id="kcs-mask-txt-alpha-s0.5"] text')?.getAttribute('fill-opacity'));
    expect(half).toBeGreaterThan(45);
    expect(half).toBeLessThan(160); // ≈127 not 255
    expect(fo).toBe('0.5');
  });

  test('V-T7 — text + gradient + feather + strength combo: ramp survives, defs clean', async ({ page }) => {
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'alpha', feather: 12, strength: 0.5, gradient: { angle: 0 } })]);
    await ready(page);
    const left = await avgGreenWorld(page, 250, 280, 225, 255);
    const right = await avgGreenWorld(page, 350, 380, 225, 255);
    expect(left).toBeGreaterThan(right + 15); // ramp survives feather
    expect(await page.evaluate(() => document.querySelectorAll('linearGradient[id^="kcs-mg-txt-"]').length)).toBe(1);
    expect(await page.evaluate(() => document.querySelectorAll('feGaussianBlur').length)).toBe(1);
  });

  test('V-T8 — text rotation 90°: ink band rotates with the source', async ({ page }) => {
    await seed(page, [textSource({ rotation: 90 }), wideTarget({ sourcePartId: 'txt', mode: 'alpha' })]);
    await ready(page);
    // Vertical scan at x=320 hits the rotated crossbar band
    let m = 0;
    for (let y = 170; y <= 310; y += 5) m = Math.max(m, await greenAtWorld(page, 320, y));
    expect(m).toBeGreaterThan(150);
    expect(await greenAtWorld(page, 320, 110)).toBeLessThan(45);
    expect(await page.evaluate(() => document.querySelector('mask[id="kcs-mask-txt-alpha"] g')?.getAttribute('transform'))).toContain('rotate(90)');
  });

  test('V-T9 — text scale 2×: ink stretches consistently (no stale bounds)', async ({ page }) => {
    await seed(page, [textSource({ scaleX: 2 }), wideTarget({ sourcePartId: 'txt', mode: 'alpha' })]);
    await ready(page);
    // H crossbars at local centers ±64 → scaled to world 320±128 → 192/320/448;
    // crossbar boxes around 192 and 448 must be inked
    expect(await maxGreen(page, 185, 235, INK.y0, INK.y1)).toBeGreaterThan(120);
    expect(await maxGreen(page, 405, 455, INK.y0, INK.y1)).toBeGreaterThan(120);
  });

  test('V-T10 — negative scale (scaleX -1): text mirrors, no NaN/Inf, ink present', async ({ page }) => {
    await seed(page, [textSource({ scaleX: -1 }), wideTarget({ sourcePartId: 'txt', mode: 'alpha' })]);
    await ready(page);
    expect(await maxGreen(page, INK.x0, INK.x1, INK.y0, INK.y1)).toBeGreaterThan(150); // H2 at center
    const t = await page.evaluate(() => document.querySelector('mask[id="kcs-mask-txt-alpha"] g')?.getAttribute('transform'));
    expect(t).toContain('scale(-1, 1)');
    expect(t).not.toContain('NaN');
    expect(t).not.toContain('Infinity');
  });

  test('V-T11 — animated text source: the mask <g> transform follows (no stale position)', async ({ page }) => {
    const tracks = [
      {
        id: 't_txt', partId: 'txt', name: 'Source',
        channels: {
          x: [
            { id: 'k1', frame: 0, value: 0, easing: 'linear' },
            { id: 'k2', frame: 60, value: 120, easing: 'linear' },
          ],
        },
      },
    ];
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'alpha' })], tracks);
    await ready(page);
    const g0 = await page.evaluate(() => document.querySelector('mask[id="kcs-mask-txt-alpha"] g')?.getAttribute('transform'));
    await page.getByTitle('Play', { exact: true }).click();
    await page.waitForTimeout(1800);
    await page.getByTitle('Pause', { exact: true }).click();
    const g1 = await page.evaluate(() => document.querySelector('mask[id="kcs-mask-txt-alpha"] g')?.getAttribute('transform'));
    expect(g0).toContain('translate(300, 240)');
    expect(g1).not.toBe(g0); // transform recomputed per frame — no stale bake
    expect(parseFloat(g1!.match(/translate\(([\d.]+)/)![1])).toBeGreaterThan(390); // moved right (+120)
  });

  test('V-T12 — dedupe: two targets + same text source → ONE mask def, two references', async ({ page }) => {
    await seed(page, [
      textSource(),
      wideTarget({ sourcePartId: 'txt', mode: 'alpha' }),
      makeLayer('tgt2', 'Target2', 'custom_circle', { zIndex: 3, fillColor: '#00ff00', scaleX: 5, scaleY: 3, matte: { sourcePartId: 'txt', mode: 'alpha' } }),
    ]);
    await ready(page);
    expect(await page.evaluate(() => document.querySelectorAll('mask[id="kcs-mask-txt-alpha"]').length)).toBe(1);
    expect(await page.evaluate(() => document.querySelectorAll('[mask="url(#kcs-mask-txt-alpha)"]').length)).toBe(2);
  });

  test('V-T13 — text + clip policy: no clipPath ever created for a text source', async ({ page }) => {
    // legacy invalid state: mode clip + text source — renderer must NOT emit a
    // clip. A shape-matte pair rides along so the seed readiness (kcs- defs)
    // resolves — the text+clip part itself produces NOTHING.
    await seed(page, [
      textSource(),
      makeLayer('shp', 'Shape', 'custom_star', { zIndex: 1, fillColor: '#ff0000' }),
      makeLayer('shapeTarget', 'ShapeTarget', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', matte: { sourcePartId: 'shp', mode: 'alpha' } }),
      wideTarget({ sourcePartId: 'txt', mode: 'clip' }),
    ]);
    await ready(page);
    // NO MATTE clipPath (kcs-clip-*) for a text source — the app's own
    // artboard clip (broadcast mode) may exist and must not count.
    expect(await page.evaluate(() => document.querySelectorAll('clipPath[id^="kcs-clip-"]').length)).toBe(0);
    expect(await page.evaluate(() => document.querySelectorAll('mask[id^="kcs-mask-txt"]').length)).toBe(0);
    // UI-level: the Clip OPTION is disabled — covered by styleMatteSection tests (4D)
  });

  test('V-T15 — text gradient + rotation: local endpoints recompute with the rotated transform', async ({ page }) => {
    await seed(page, [textSource({ rotation: 90 }), wideTarget({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0 } })]);
    await ready(page);
    // Ramp must be VISIBLE (ink strong on the bright side) and the def endpoints
    // reflect the rotated local space (y-axis aligned: y1/y2 differ from 0)
    expect(await maxGreen(page, INK.x0, INK.x1, INK.y0, INK.y1)).toBeGreaterThan(60);
    const eps = await page.evaluate(() => {
      const g = document.querySelector('linearGradient[id="kcs-mg-txt-0-alpha"]');
      return { y1: g?.getAttribute('y1'), y2: g?.getAttribute('y2') };
    });
    expect(parseFloat(eps.y1!) - parseFloat(eps.y2!)).not.toBe(0); // rotated: vertical span ≠ 0
  });

  test('V-T16 — text gradient + scale 2×: ramp stretches with the scaled ink (local endpoints stay canonical)', async ({ page }) => {
    await seed(page, [textSource({ scaleX: 2 }), wideTarget({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0 } })]);
    await ready(page);
    // Local endpoints stay ±100 (the def is expressed in the source's local
    // space; the g scale stretches the visual ramp) — bright LEFT, dark RIGHT
    const left = await avgGreenWorld(page, 170, 215, 225, 255);
    const right = await avgGreenWorld(page, 425, 470, 225, 255);
    expect(left).toBeGreaterThan(right + 20);
    expect(await page.evaluate(() => document.querySelector('linearGradient[id="kcs-mg-txt-0-alpha"]')?.getAttribute('x1'))).toBe('-100');
  });

  test('V-H1 — M19 smoke: 3-stop colored gradient paints a real ramp (not legacy defaults)', async ({ page }) => {
    // red → (white, 0.5 alpha) → blue-ish: mid stop opacity 0.4 → mid band dimmer
    const stops = [
      { offset: 0, color: '#ffffff', opacity: 1 },
      { offset: 0.5, color: '#ffffff', opacity: 0.4 },
      { offset: 1, color: '#ffffff', opacity: 0 },
    ];
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0, stops } })]);
    await ready(page);
    // Text gradient spans local ±100 → world 200..400 (frac = (x-200)/200).
    // MAX over the solid crossbar band (glyph gaps would dilute an average);
    // the mid box avoids x=300 (the app's cyan edit-mode center marker).
    const left = await maxGreen(page, 250, 280, 240, 252);   // frac 0.25-0.4 → alpha ≈0.7 → ≈178
    const mid = await maxGreen(page, 315, 340, 240, 252);    // frac 0.575-0.7 → alpha ≈0.37 → ≈94
    const right = await maxGreen(page, 350, 380, 240, 252);  // frac 0.75-0.9 → max alpha 0.25 → ≈64
    expect(left).toBeGreaterThan(150);
    expect(mid).toBeGreaterThan(80);
    expect(mid).toBeLessThan(130);
    expect(right).toBeLessThan(80);
    expect(right).toBeGreaterThan(30);
    expect(left).toBeGreaterThan(right + 50); // real ramp direction
    // DOM: hashed def id + 3 stops
    expect(await page.evaluate(() => document.querySelectorAll('linearGradient[id^="kcs-mg-txt-0-s"]').length)).toBe(1);
    expect(await page.evaluate(() => document.querySelector('linearGradient[id^="kcs-mg-txt-0-s"]')?.querySelectorAll('stop').length)).toBe(3);
  });

  test('V-H2 — M19 smoke: same source+angle DIFFERENT stops → different defs AND different visible result', async ({ page }) => {
    const rampA = [
      { offset: 0, color: '#ffffff', opacity: 1 },
      { offset: 1, color: '#ffffff', opacity: 0 },
    ];
    const rampB = [
      { offset: 0, color: '#ffffff', opacity: 0.2 },
      { offset: 1, color: '#ffffff', opacity: 1 },
    ];
    // DOM: same source+angle+DIFFERENT stops in ONE scene → 2 defs + 2 masks.
    await seed(page, [
      textSource(),
      wideTarget({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0, stops: rampA } }),
      makeLayer('tgt2', 'Target2', 'custom_circle', {
        zIndex: 3, fillColor: '#00ff00', scaleX: 5, scaleY: 3,
        matte: { sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0, stops: rampB } },
      }),
    ]);
    await ready(page);
    expect(await page.evaluate(() => document.querySelectorAll('linearGradient[id^="kcs-mg-txt-0-s"]').length)).toBe(2);
    expect(await page.evaluate(() => document.querySelectorAll('mask[id^="kcs-mask-txt-alpha-g0-s"]').length)).toBe(2);
    // Visible difference: probe the SAME left-ink box (frac ≈0.15) under EACH
    // ramp via sequential seeds — rampA (1→0) bright, rampB (0.2→1) dim.
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0, stops: rampA } })]);
    await ready(page);
    const aLeft = await maxGreen(page, 230, 250, 240, 252); // frac 0.15-0.25 → alpha ≈0.85 → ≈217
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0, stops: rampB } })]);
    await ready(page);
    const bLeft = await maxGreen(page, 230, 250, 240, 252); // frac 0.15-0.25 → alpha ≈0.32 → ≈82
    console.log(`SPIKE-H aLeft=${aLeft} bLeft=${bLeft}`);
    expect(aLeft).toBeGreaterThan(150); // rampA: near-white left
    expect(bLeft).toBeLessThan(110);    // rampB: dim left
  });

  test('V-T17 — import/reload parity: text matte pixels identical after the real autosave/reload path', async ({ page }) => {
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'alpha', feather: 6, strength: 0.7, gradient: { angle: 0 } })]);
    await ready(page);
    const before = [await maxGreen(page, INK.x0, INK.x1, INK.y0, INK.y1), await greenAtWorld(page, 165, 240)];
    await page.waitForFunction(() => {
      try {
        const s = JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}');
        return (s.layers ?? []).find((x: any) => x.id === 'tgt')?.matte?.sourcePartId === 'txt';
      } catch { return false; }
    }, undefined, { timeout: 10000 });
    const autosaved = await page.evaluate(() => JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5')!));
    expect(autosaved.layers.find((l: any) => l.id === 'tgt').matte).toMatchObject({
      sourcePartId: 'txt', mode: 'alpha', feather: 6, strength: 0.7, gradient: { angle: 0 },
    });
    expect(JSON.stringify(autosaved.layers.find((l: any) => l.id === 'tgt').matte)).not.toContain('fontSize'); // runtime data NOT persisted
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('[id^="kcs-"]').length > 0, undefined, { timeout: 15000 });
    await ready(page);
    const after = [await maxGreen(page, INK.x0, INK.x1, INK.y0, INK.y1), await greenAtWorld(page, 165, 240)];
    expect(after[0]).toBe(before[0]); // exact pixel parity through the real import
    expect(after[1]).toBe(before[1]);
    expect(await page.evaluate(() => document.querySelector('mask[id="kcs-mask-txt-alpha-f6-s0.7-g0"] text')?.textContent)).toBe('HHH');
  });
});

test.describe('M19 multi-stop gradient — real browser pixel assertions (5E matrix)', () => {
  // Self-contained fixtures (same HHH/80px Arial determinism as M18).
  const textSource = (overrides: Record<string, unknown> = {}) =>
    makeLayer('txt', 'Source', 'custom_text', { zIndex: 1, fillColor: '#ff0000', textValue: 'HHH', fontSize: 80, fontFamily: 'Arial', ...overrides });
  const shapeSource = (overrides: Record<string, unknown> = {}) =>
    makeLayer('shp', 'Shape', 'custom_circle', { zIndex: 1, fillColor: '#ff0000', scaleX: 2, scaleY: 2, ...overrides });
  const wideTarget = (matte: Record<string, unknown>) =>
    makeLayer('tgt', 'Target', 'custom_circle', { zIndex: 2, fillColor: '#00ff00', scaleX: 5, scaleY: 3, matte });

  const INK = { x0: 250, x1: 350, y0: 215, y1: 265 };
  const RAMP = (o: number, op: number) => ({ offset: o, color: '#ffffff', opacity: op });

  async function ready(page: Page) {
    await page.evaluate(async () => { await (document as any).fonts.ready; });
  }
  async function greenAtWorld(page: Page, wx: number, wy: number): Promise<number> {
    const buf = await page.screenshot();
    const png = decodePng(buf);
    const { x, y } = await page.evaluate(([a, b]: [number, number]) => {
      const svg = [...document.querySelectorAll('svg')].find((s) => !!s.querySelector('#artboard-clip'))!;
      const pt = svg.createSVGPoint(); pt.x = a; pt.y = b;
      const s = pt.matrixTransform(svg.getScreenCTM()!);
      return { x: Math.round(s.x), y: Math.round(s.y) };
    }, [wx, wy]);
    return png.data[(y * png.width + x) * png.bpp + 1];
  }
  async function maxGreen(page: Page, x0: number, x1: number, y0: number, y1: number): Promise<number> {
    let m = 0;
    for (let x = x0; x <= x1; x += 5) for (let y = y0; y <= y1; y += 5) {
      const px = await greenAtWorld(page, x, y);
      if (px > m) m = px;
    }
    return m;
  }
  async function minGreen(page: Page, x0: number, x1: number, y0: number, y1: number): Promise<number> {
    let m = 255;
    for (let x = x0; x <= x1; x += 5) for (let y = y0; y <= y1; y += 5) {
      const px = await greenAtWorld(page, x, y);
      if (px < m) m = px;
    }
    return m;
  }

  test('V-H3 — 4-stop gradient: 4 <stop> + monotonic 4-step ramp', async ({ page }) => {
    const stops = [RAMP(0, 1), RAMP(0.33, 0.8), RAMP(0.66, 0.4), RAMP(1, 0)];
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0, stops } })]);
    await ready(page);
    expect(await page.evaluate(() => document.querySelectorAll('linearGradient[id^="kcs-mg-txt-0-s"] stop').length)).toBe(4);
    const offsets = await page.evaluate(() => [...document.querySelectorAll('linearGradient[id^="kcs-mg-txt-0-s"] stop')].map((s) => s.getAttribute('offset')));
    expect(offsets).toEqual(['0%', '33%', '66%', '100%']);
    // Text ramp spans world 200..400: 4-segment monotonic descent
    const s1 = await maxGreen(page, 220, 240, 240, 252); // frac 0.1-0.2 → ≈0.88 → ≈224
    const s2 = await maxGreen(page, 270, 290, 240, 252); // frac 0.35-0.45 → ≈0.72 → ≈184
    const s3 = await maxGreen(page, 320, 340, 240, 252); // frac 0.6-0.7 → ≈0.48 → ≈122
    const s4 = await maxGreen(page, 370, 390, 240, 252); // frac 0.85-0.95 → ≈0.2 → ≈51
    expect(s1).toBeGreaterThan(190);
    expect(s2).toBeGreaterThan(150);
    expect(s3).toBeGreaterThan(90);
    expect(s3).toBeLessThan(150);
    expect(s4).toBeLessThan(80);
    expect(s4).toBeGreaterThan(25);
    expect(s1).toBeGreaterThan(s2);
    expect(s2).toBeGreaterThan(s3);
    expect(s3).toBeGreaterThan(s4); // monotonic ordering
  });

  test('V-H4 — mid-stop opacity: lower opacity visibly dims the mid band', async ({ page }) => {
    const bright = [RAMP(0, 1), RAMP(0.5, 0.8), RAMP(1, 0)];
    const dim = [RAMP(0, 1), RAMP(0.5, 0.2), RAMP(1, 0)];
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0, stops: bright } })]);
    await ready(page);
    const bMid = await maxGreen(page, 320, 340, 240, 252); // frac 0.6-0.7 → alpha ≈0.62 → ≈158
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0, stops: dim } })]);
    await ready(page);
    const dMid = await maxGreen(page, 320, 340, 240, 252); // frac 0.6-0.7 → alpha ≈0.42 → ≈107
    console.log(`SPIKE-5E V-H4 bright=${bMid} dim=${dMid}`);
    expect(bMid).toBeGreaterThan(130);
    expect(dMid).toBeLessThan(130);
    expect(bMid - dMid).toBeGreaterThan(30); // deterministic intensity drop
  });

  test('V-H5 — multi-stop + feather: ramp survives, filter + stdDeviation bound', async ({ page }) => {
    const stops = [RAMP(0, 1), RAMP(0.5, 0.5), RAMP(1, 0)];
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'alpha', feather: 12, gradient: { angle: 0, stops } })]);
    await ready(page);
    const left = await maxGreen(page, 250, 280, 240, 252);
    const right = await maxGreen(page, 350, 380, 240, 252);
    expect(left).toBeGreaterThan(right + 40); // ramp direction survives feather
    expect(await page.evaluate(() => document.querySelector('feGaussianBlur')?.getAttribute('stdDeviation'))).toBe('6');
    expect(await page.evaluate(() => document.querySelector('mask[id*="-f12-g0-s"] text')?.getAttribute('filter'))).toContain('kcs-matte-feather');
  });

  test('V-H6 — multi-stop + strength 0.5: fill-opacity 0.5, intensity halved', async ({ page }) => {
    const stops = [RAMP(0, 1), RAMP(1, 0)];
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0, stops } })]);
    await ready(page);
    const full = await maxGreen(page, 235, 278, 243, 258); // H1 crossbar, away from center marker
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'alpha', strength: 0.5, gradient: { angle: 0, stops } })]);
    await ready(page);
    const half = await maxGreen(page, 235, 278, 243, 258);
    console.log(`SPIKE-5E V-H6 full=${full} half=${half}`);
    expect(full).toBeGreaterThan(150);
    expect(half).toBeGreaterThan(45);
    expect(half).toBeLessThan(160); // ≈full/2
    expect(await page.evaluate(() => document.querySelector('mask[id*="-s0.5-g0-s"] text')?.getAttribute('fill-opacity'))).toBe('0.5');
  });

  test('V-H7 — SHAPE source + inverted luminance + multi-stop: hole + outer gradient visible', async ({ page }) => {
    const stops = [RAMP(0, 1), RAMP(0.5, 0.6), RAMP(1, 0)];
    await seed(page, [shapeSource(), wideTarget({ sourcePartId: 'shp', mode: 'luminance', inverted: true, gradient: { angle: 0, stops } })]);
    await ready(page);
    // circle r=30×2 → world rect 240..360 × 180..300 — the black contour = hole
    expect(await minGreen(page, 275, 325, 225, 255)).toBeLessThan(45); // hole inside the matte
    expect(await greenAtWorld(page, 165, 240)).toBeGreaterThan(150);   // outer region visible
    expect(await page.evaluate(() => document.querySelector('mask[id^="kcs-mask-shp-luminance-inv-g0-s"]')?.getAttribute('mask-type'))).toBe('luminance');
    expect(await page.evaluate(() => document.querySelectorAll('linearGradient[id*="-luminance"] stop').length)).toBe(3);
  });

  test('V-H8 — inverted TEXT + multi-stop: luminance structure + hole + black text', async ({ page }) => {
    const stops = [RAMP(0, 1), RAMP(0.5, 0.5), RAMP(1, 0)];
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'alpha', inverted: true, gradient: { angle: 0, stops } })]);
    await ready(page);
    expect(await minGreen(page, INK.x0, INK.x1, INK.y0, INK.y1)).toBeLessThan(45); // hole
    expect(await greenAtWorld(page, 165, 240)).toBeGreaterThan(150); // white region visible
    expect(await page.evaluate(() => document.querySelector('mask[id^="kcs-mask-txt-alpha-inv-g0-s"]')?.getAttribute('mask-type'))).toBe('luminance');
    expect(await page.evaluate(() => document.querySelector('mask[id^="kcs-mask-txt-alpha-inv-g0-s"] text')?.getAttribute('fill'))).toBe('black');
    expect(await page.evaluate(() => document.querySelectorAll('linearGradient[id*="-luminance"]').length)).toBe(1); // structure key luminance
  });

  test('V-H9 — multi-stop + rotation 90°: vertical ink band + baked transform', async ({ page }) => {
    const stops = [RAMP(0, 1), RAMP(0.5, 0.5), RAMP(1, 0)];
    await seed(page, [textSource({ rotation: 90 }), wideTarget({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0, stops } })]);
    await ready(page);
    let m = 0;
    for (let y = 170; y <= 310; y += 5) m = Math.max(m, await greenAtWorld(page, 320, y));
    expect(m).toBeGreaterThan(150); // rotated crossbar band
    expect(await page.evaluate(() => document.querySelector('mask[id*="-g0-s"] g')?.getAttribute('transform'))).toContain('rotate(90)');
    expect(await page.evaluate(() => document.querySelectorAll('linearGradient[id^="kcs-mg-txt-0-s"] stop').length)).toBe(3);
  });

  test('V-H10 — multi-stop + scale 2×: ink stretches, ramp direction preserved', async ({ page }) => {
    const stops = [RAMP(0, 1), RAMP(1, 0)];
    await seed(page, [textSource({ scaleX: 2 }), wideTarget({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0, stops } })]);
    await ready(page);
    // crossbars at world 192 / 448 (V-T9 pattern)
    // crossbars at world ~172 / 300 / 428 (scaleX 2). NOTE: the ramp's dark
    // end (alpha ≈0.1-0.24 at frac 0.76-0.89) dims the RIGHT crossbar by
    // design — assert ink presence, not full brightness.
    expect(await maxGreen(page, 185, 235, INK.y0, INK.y1)).toBeGreaterThan(120); // frac 0.21-0.34 → bright
    expect(await maxGreen(page, 405, 455, INK.y0, INK.y1)).toBeGreaterThan(30);  // dimmed by the ramp
    // ramp across the stretched span: bright LEFT (world 100..), dim right (world ~500)
    const left = await maxGreen(page, 170, 215, 240, 252);  // frac ≈0.18-0.29 → alpha ≈0.8
    const right = await maxGreen(page, 425, 470, 240, 252); // frac ≈0.81-0.93 → alpha ≈0.15
    expect(left).toBeGreaterThan(right + 40);
  });

  test('V-H11 — dedupe: DIFFERENT stops → 2 defs + 2 masks; SAME normalized set reversed → 1 def + 1 mask', async ({ page }) => {
    const stopsA = [RAMP(0, 1), RAMP(1, 0)];
    const stopsB = [RAMP(0, 0.2), RAMP(1, 1)];
    await seed(page, [
      textSource(),
      wideTarget({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0, stops: stopsA } }),
      makeLayer('tgt2', 'Target2', 'custom_circle', { zIndex: 3, fillColor: '#00ff00', scaleX: 5, scaleY: 3, matte: { sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0, stops: stopsB } } }),
    ]);
    await ready(page);
    const defIds = await page.evaluate(() => [...document.querySelectorAll('linearGradient[id^="kcs-mg-txt-0-s"]')].map((g) => g.id));
    const maskIds = await page.evaluate(() => [...document.querySelectorAll('mask[id^="kcs-mask-txt-alpha-g0-s"]')].map((m) => m.id));
    expect(defIds).toHaveLength(2);
    expect(maskIds).toHaveLength(2);
    expect(defIds[0]).not.toBe(defIds[1]);
    expect(maskIds[0]).not.toBe(maskIds[1]);
    // each mask references its OWN def (no collision)
    const refs = await page.evaluate(() => [...document.querySelectorAll('mask[id^="kcs-mask-txt-alpha-g0-s"] rect, mask[id^="kcs-mask-txt-alpha-g0-s"] text')].map((el) => el.getAttribute('fill')));
    expect(refs).toContain(`url(#${defIds[0]})`);
    expect(refs).toContain(`url(#${defIds[1]})`);
    // same normalized set with reversed input order → ONE def + ONE mask
    await seed(page, [
      textSource(),
      wideTarget({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0, stops: [RAMP(1, 0), RAMP(0, 1)] } }),
      makeLayer('tgt2', 'Target2', 'custom_circle', { zIndex: 3, fillColor: '#00ff00', scaleX: 5, scaleY: 3, matte: { sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0, stops: [RAMP(0, 1), RAMP(1, 0)] } } }),
    ]);
    await ready(page);
    expect(await page.evaluate(() => document.querySelectorAll('linearGradient[id^="kcs-mg-txt-0-s"]').length)).toBe(1);
    expect(await page.evaluate(() => document.querySelectorAll('mask[id^="kcs-mask-txt-alpha-g0-s"]').length)).toBe(1);
  });

  test('V-H12 — import/reload parity: stops preserved, DOM + pixel EXACT after reload', async ({ page }) => {
    const stops = [RAMP(0, 1), RAMP(0.5, 0.6), RAMP(1, 0)];
    await seed(page, [textSource(), wideTarget({ sourcePartId: 'txt', mode: 'alpha', feather: 6, strength: 0.7, gradient: { angle: 0, stops } })]);
    await ready(page);
    const before = [await maxGreen(page, INK.x0, INK.x1, INK.y0, INK.y1), await greenAtWorld(page, 165, 240)];
    await page.waitForFunction(() => {
      try {
        const s = JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5') ?? '{}');
        return (s.layers ?? []).find((x: any) => x.id === 'tgt')?.matte?.gradient?.stops?.length === 3;
      } catch { return false; }
    }, undefined, { timeout: 10000 });
    const autosaved = await page.evaluate(() => JSON.parse(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5')!));
    expect(autosaved.layers.find((l: any) => l.id === 'tgt').matte.gradient).toEqual({ angle: 0, stops });
    expect(JSON.stringify(autosaved.layers.find((l: any) => l.id === 'tgt').matte)).not.toContain('fontSize');
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('[id^="kcs-"]').length > 0, undefined, { timeout: 15000 });
    await ready(page);
    const after = [await maxGreen(page, INK.x0, INK.x1, INK.y0, INK.y1), await greenAtWorld(page, 165, 240)];
    expect(after[0]).toBe(before[0]); // exact pixel parity
    expect(after[1]).toBe(before[1]);
    expect(await page.evaluate(() => document.querySelectorAll('linearGradient[id^="kcs-mg-txt-0-s"] stop').length)).toBe(3);
  });
});
