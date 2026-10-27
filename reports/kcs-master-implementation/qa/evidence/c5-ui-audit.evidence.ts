/**
 * C5 — UI consistency audit (measurements, not opinions).
 *
 * One synthetic scene (an image with a mask and a Track Matte, a group, a
 * parent with a child, plain shapes), the image selected. For each surface
 * (toolbar, left rail, header, layer list, Inspector, timeline header) it
 * records every visible button's height, padding, radius and icon size, its
 * accessible name, disabled buttons without a stated reason, small text whose
 * contrast is under 4.5:1, and controls whose keyboard focus is invisible.
 * Screenshots of the window and of each panel go to evidence/c5-ui/<TAG>.
 * KCS_EVIDENCE_TAG names the run (before / after).
 */
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { evidenceDir, imageLayer, LANDSCAPE_URI, normalizedRectPath, STORAGE_KEY, track } from './fixtures';

const TAG = process.env.KCS_EVIDENCE_TAG ?? 'probe';
const OUT = evidenceDir(path.join('c5-ui', TAG));

const shape = (id: string, name: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({
  id, name, type: 'custom_rect', x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 2,
  fillColor: '#f59e0b', strokeColor: '#101218', width: 140, height: 100, ...extra,
});

const scene = () => {
  const layers = [
    imageLayer({ name: 'Photo of the mountain landscape at dawn', imageUrl: LANDSCAPE_URI, masks: [{ id: 'm1', name: 'Mask 1', mode: 'add', enabled: true, opacity: 1, feather: 0, expansion: 0, path: normalizedRectPath(0.2, 0.2, 0.8, 0.8) }], trackMatte: { sourceLayerId: 'circle', mode: 'alpha', sourceVisible: true } }),
    shape('circle', 'Circle', 0, 0, { type: 'custom_circle', zIndex: 3 }),
    shape('rig', 'Rig', 0, 0, { isGroup: true, width: 10, height: 10, zIndex: 4 }),
    shape('arm', 'Arm', -260, -120, { parentId: 'rig', zIndex: 5 }),
    shape('sun', 'Sun', 260, -120, { zIndex: 6 }),
    shape('ray', 'Ray', 320, -120, { parentId: 'sun', zIndex: 7 }),
  ];
  return { version: 1, coordinateSystem: 'project-unit-center-v1', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers, tracks: layers.map((layer) => track(layer.id)) };
};

async function seed(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate((entry: { key: string; value: string }) => { localStorage.clear(); localStorage.setItem(entry.key, entry.value); }, { key: STORAGE_KEY, value: JSON.stringify(scene()) });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await page.locator('[role="tree"] [data-layer-id="landscape"]').click();
  await expect(page.locator('.details-actor-header')).toBeVisible();
}

const audit = (page: Page) => page.evaluate(() => {
  const regions: Record<string, string> = {
    header: '.header-bar',
    toolbar: '.authoring-toolbar',
    rail: '.left-sidebar-nav',
    layers: '.outliner-container',
    inspector: '.details-container',
    timeline: '.sequencer-timeline',
  };
  const parseRgb = (value: string): [number, number, number, number] | null => {
    const match = value.match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [parts[0], parts[1], parts[2], parts[3] ?? 1];
  };
  const luminance = ([r, g, b]: number[]) => {
    const channel = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const backgroundOf = (element: Element): number[] => {
    let node: Element | null = element;
    const layers: number[][] = [];
    while (node) {
      const bg = parseRgb(getComputedStyle(node).backgroundColor);
      if (bg && bg[3] > 0) {
        layers.push(bg);
        if (bg[3] >= 0.99) break;
      }
      node = node.parentElement;
    }
    let out = [11, 14, 19];
    for (const bg of layers.reverse()) out = out.map((c, i) => bg[i] * bg[3] + c * (1 - bg[3]));
    return out;
  };
  const contrast = (fg: number[], bg: number[]) => {
    const a = luminance(fg) + 0.05;
    const b = luminance(bg) + 0.05;
    return a > b ? a / b : b / a;
  };
  const visible = (element: Element) => {
    const r = element.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const style = getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.05;
  };
  const nameOf = (element: HTMLElement) => (element.getAttribute('aria-label') || element.textContent?.trim() || element.getAttribute('title') || '').replace(/\s+/g, ' ').slice(0, 60);
  const result: Record<string, unknown> = {};
  for (const [region, selector] of Object.entries(regions)) {
    const root = document.querySelector(selector);
    if (!root) { result[region] = 'missing'; continue; }
    const buttons = [...root.querySelectorAll<HTMLElement>('button, [role="button"], [role="switch"], [role="tab"]')].filter(visible);
    const sizes = new Map<string, number>();
    const unnamed: string[] = [];
    const iconOnlyNoTooltip: string[] = [];
    const disabledNoReason: string[] = [];
    for (const button of buttons) {
      const style = getComputedStyle(button);
      const r = button.getBoundingClientRect();
      const key = `${Math.round(r.height)}h/${style.borderRadius}`;
      sizes.set(key, (sizes.get(key) ?? 0) + 1);
      const name = nameOf(button);
      if (!name) unnamed.push(button.className || button.outerHTML.slice(0, 60));
      const iconOnly = !button.textContent?.trim() && button.querySelector('svg');
      if (iconOnly && !button.getAttribute('title') && !button.getAttribute('aria-describedby')) iconOnlyNoTooltip.push(name || button.className);
      const disabled = (button as HTMLButtonElement).disabled || button.getAttribute('aria-disabled') === 'true';
      if (disabled && !button.getAttribute('title') && !button.getAttribute('aria-describedby')) disabledNoReason.push(name || button.className);
    }
    const lowContrast: string[] = [];
    const texts = [...root.querySelectorAll<HTMLElement>('span, label, button, div, strong, p, h2, h3, legend')].filter((element) => (
      visible(element) && [...element.childNodes].some((child) => child.nodeType === 3 && child.textContent?.trim())
    ));
    for (const element of texts) {
      if ((element as HTMLButtonElement).disabled || element.closest('[disabled], [aria-disabled="true"], [data-locked="true"]')) continue;
      const style = getComputedStyle(element);
      const fg = parseRgb(style.color);
      if (!fg) continue;
      const ratio = contrast(fg.slice(0, 3), backgroundOf(element));
      const size = parseFloat(style.fontSize);
      const bold = Number(style.fontWeight) >= 700;
      const needed = size >= 18.66 || (size >= 14 && bold) ? 3 : 4.5;
      if (ratio < needed) lowContrast.push(`${(element.textContent ?? '').trim().slice(0, 28)} — ${ratio.toFixed(2)} (${size}px)`);
    }
    result[region] = {
      buttons: buttons.length,
      sizeClasses: Object.fromEntries([...sizes.entries()].sort((a, b) => b[1] - a[1])),
      unnamed,
      iconOnlyNoTooltip,
      disabledNoReason,
      lowContrast: [...new Set(lowContrast)].slice(0, 40),
      lowContrastCount: new Set(lowContrast).size,
    };
  }
  return result;
});

/** Tab through the editor chrome and record controls whose focus leaves no visible mark. */
const focusAudit = async (page: Page) => {
  await page.locator('.header-bar').click({ position: { x: 4, y: 4 } });
  const invisible: string[] = [];
  let checked = 0;
  for (let step = 0; step < 90; step += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      const style = getComputedStyle(element);
      const ownRing = (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || (style.boxShadow && style.boxShadow !== 'none');
      // An SVG handle shows focus with its stroke; a field may ring its wrapper box.
      const svgRing = element instanceof SVGElement && parseFloat(style.strokeWidth) >= 3;
      const wrapper = element.parentElement ? getComputedStyle(element.parentElement) : null;
      const wrapperRing = Boolean(wrapper && wrapper.boxShadow && wrapper.boxShadow !== 'none');
      const ring = ownRing || svgRing || wrapperRing;
      return { ring: Boolean(ring), name: (element.getAttribute('aria-label') || element.textContent?.trim() || element.getAttribute('title') || element.tagName).slice(0, 40) };
    });
    if (!info) continue;
    checked += 1;
    if (!info.ring) invisible.push(info.name);
  }
  return { checked, invisible: [...new Set(invisible)] };
};

test('C5 UI audit', async ({ page }) => {
  test.setTimeout(120000);
  fs.mkdirSync(OUT, { recursive: true });
  await seed(page);
  const result = await audit(page);
  await page.screenshot({ path: path.join(OUT, 'window-1440x900.png') });
  for (const [name, selector] of [['inspector', '.motion-design-right-sidebar'], ['toolbar', '.authoring-toolbar'], ['layers', '.outliner-container'], ['timeline-header', '.sequencer-timeline']] as const) {
    const box = await page.locator(selector).first().boundingBox();
    if (box) await page.screenshot({ path: path.join(OUT, `${name}.png`), clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 420) } });
  }
  // The mask path in canvas editing, for the edit-target views.
  await page.getByRole('button', { name: 'Expand LAYER MASKS' }).click();
  await page.getByRole('button', { name: 'Edit on Canvas' }).click();
  await page.screenshot({ path: path.join(OUT, 'mask-editing.png') });
  await page.keyboard.press('Escape');
  const focus = await focusAudit(page);
  fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify({ tag: TAG, regions: result, focus }, null, 2));
});

test('C5 UI audit — the whole Inspector, every card open', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await seed(page);
  await page.setViewportSize({ width: 1440, height: 3400 });
  // Give the Details pane the height, then open every collapsed card.
  for (let round = 0; round < 3; round += 1) {
    const closed = page.locator('.details-body [aria-expanded="false"]');
    const count = await closed.count();
    for (let index = count - 1; index >= 0; index -= 1) await closed.nth(index).click().catch(() => undefined);
  }
  const box = await page.locator('.details-container').boundingBox();
  if (box) await page.screenshot({ path: path.join(OUT, 'inspector-full.png'), clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 3300) } });
});
