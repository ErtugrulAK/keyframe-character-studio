/**
 * C4 — WP-08 feasibility spike (NOT product code, writes no scene data).
 *
 * Question: can the existing SVG renderer express a mask-constrained colour
 * correction with the spec's equation
 *     C_out = (1 − w)·C + w·F(C),   A_out = A,   w = m·q
 * without the alpha error of "corrected copy source-over the original"?
 *
 * Candidate graph (inline SVG, Chromium):
 *   <g isolation:isolate>
 *     <g mask="1 − w">  original  </g>
 *     <g mask="w" style="mix-blend-mode: plus-lighter">  F(original)  </g>
 *   </g>
 * plus-lighter adds PREMULTIPLIED colour and alpha, so alpha = A(1−w) + A·w = A.
 * F = brightness offset → contrast about 0.5 → saturation (luminance mix),
 * feComponentTransfer/feColorMatrix with color-interpolation-filters="sRGB".
 * The naive source-over version is measured next to it, to show the error the
 * spec warns about. Pixels are read back from a transparent screenshot.
 */
import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { evidenceDir } from './fixtures';

const OUT = evidenceDir('c4-wp08-spike');
const W = 360;
const H = 120;

// The correction under test: brightness +0.1, contrast 1.2, saturation 0.3.
const B = 0.1;
const K = 1.2;
const S = 0.3;
const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const F = (c: number[]) => {
  // brightness, then contrast about 0.5 — clamped, as every SVG filter primitive clamps its result
  const bc = c.map((v) => clamp((v + B - 0.5) * K + 0.5));
  const l = lum(bc[0], bc[1], bc[2]);
  return bc.map((v) => clamp(l + S * (v - l)));
};

// Saturation matrix (luminance weights) and the brightness/contrast transfer: slope K, intercept (B − 0.5)K + 0.5.
const sat = [
  [0.2126 + 0.7874 * S, 0.7152 - 0.7152 * S, 0.0722 - 0.0722 * S],
  [0.2126 - 0.2126 * S, 0.7152 + 0.2848 * S, 0.0722 - 0.0722 * S],
  [0.2126 - 0.2126 * S, 0.7152 - 0.7152 * S, 0.0722 + 0.9278 * S],
];
const matrix = sat.map((row) => `${row.join(' ')} 0 0`).join(' ') + ' 0 0 0 1 0';
const intercept = (B - 0.5) * K + 0.5;

const patches = [
  { color: [0.9, 0.2, 0.1], alpha: 1 },
  { color: [0.2, 0.6, 0.9], alpha: 1 },
  { color: [0.9, 0.2, 0.1], alpha: 0.5 },
  { color: [0.2, 0.6, 0.9], alpha: 0.25 },
  { color: [0.5, 0.5, 0.5], alpha: 0.5 },
  { color: [0.0, 0.0, 0.0], alpha: 0 },
];
const PW = W / patches.length;
const rgb = (c: number[]) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;

/** Coverage m: 1 on the top half, 0 on the bottom half (hard edge, so each row is one m). */
const content = patches.map((p, i) => `<rect x="${i * PW}" y="0" width="${PW}" height="${H}" fill="${rgb(p.color)}" fill-opacity="${p.alpha}"/>`).join('');
const svg = (variant: 'plus-lighter' | 'source-over', amount: number) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block">
  <defs>
    <filter id="cc" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feComponentTransfer>
        <feFuncR type="linear" slope="${K}" intercept="${intercept}"/>
        <feFuncG type="linear" slope="${K}" intercept="${intercept}"/>
        <feFuncB type="linear" slope="${K}" intercept="${intercept}"/>
      </feComponentTransfer>
      <feColorMatrix type="matrix" values="${matrix}"/>
    </filter>
    <mask id="w" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H / 2}" fill="white" fill-opacity="${amount}"/></mask>
    <mask id="inv" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
      <rect width="${W}" height="${H}" fill="white"/>
      <rect width="${W}" height="${H / 2}" fill="black" fill-opacity="${amount}"/>
    </mask>
  </defs>
  <g style="isolation:isolate">
    ${variant === 'plus-lighter' ? `<g mask="url(#inv)">${content}</g>` : `<g>${content}</g>`}
    <g mask="url(#w)" ${variant === 'plus-lighter' ? 'style="mix-blend-mode:plus-lighter"' : ''}><g filter="url(#cc)">${content}</g></g>
  </g>
</svg>`;

test('WP-08 spike: mask-constrained correction in SVG keeps alpha and the mix equation', async ({ page }) => {
  await page.setViewportSize({ width: W + 20, height: H + 20 });
  const report: Record<string, unknown>[] = [];
  for (const variant of ['plus-lighter', 'source-over'] as const) {
    for (const amount of [1, 0.5, 0]) {
      await page.setContent(`<html><body style="margin:0;background:transparent">${svg(variant, amount)}</body></html>`);
      const shot = await page.locator('svg').screenshot({ omitBackground: true });
      const pixels = await page.evaluate(async ({ data, w, h }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const context = canvas.getContext('2d')!;
        context.drawImage(image, 0, 0);
        return Array.from(context.getImageData(0, 0, w, h).data);
      }, { data: shot.toString('base64'), w: W, h: H });
      const at = (x: number, y: number) => {
        const index = (Math.round(y) * W + Math.round(x)) * 4;
        return pixels.slice(index, index + 4).map((v) => v / 255);
      };
      let worstColor = 0;
      let worstAlpha = 0;
      const rows: Record<string, unknown>[] = [];
      patches.forEach((patch, i) => {
        for (const [y, m] of [[H * 0.25, 1], [H * 0.75, 0]] as const) {
          const w = m * amount;
          const corrected = F(patch.color);
          const expectedColor = patch.color.map((c, k) => (1 - w) * c + w * corrected[k]);
          const actual = at(i * PW + PW / 2, y);
          const alphaError = Math.abs(actual[3] - patch.alpha);
          const colorError = patch.alpha > 0 ? Math.max(...expectedColor.map((c, k) => Math.abs(actual[k] - c))) : 0;
          worstAlpha = Math.max(worstAlpha, alphaError);
          worstColor = Math.max(worstColor, colorError);
          rows.push({ patch: i, m, w, alpha: patch.alpha, expected: [...expectedColor.map((v) => +v.toFixed(3)), patch.alpha], actual: actual.map((v) => +v.toFixed(3)) });
        }
      });
      report.push({ variant, amount, worstColor: +worstColor.toFixed(4), worstAlpha: +worstAlpha.toFixed(4), rows });
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, `${variant}-q${amount}.png`), shot);
    }
  }
  fs.writeFileSync(path.join(OUT, 'spike.json'), JSON.stringify(report, null, 2));
  console.log(report.map((r) => `${r.variant} q=${r.amount}: worst colour error ${r.worstColor}, worst alpha error ${r.worstAlpha}`).join('\n'));
});
