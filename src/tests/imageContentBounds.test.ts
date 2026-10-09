/**
 * Visible-content measurement for imported images.
 *
 * A PNG's transparent padding must not decide where a layer's edge points and
 * gizmo sit, so the alpha scan and the bitmap→local mapping are pinned here
 * without a canvas (jsdom has none).
 */

import { describe, expect, it } from 'vitest';
import {
  VISIBLE_ALPHA_THRESHOLD,
  contentBoundsInLocalUnits,
  findVisibleBounds,
} from '../utils/imageContentBounds';

/** Build an alpha plane from rows of `#` (opaque) and `.` (transparent). */
const alphaFromRows = (rows: string[]): { alpha: Uint8Array; width: number; height: number } => {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const alpha = new Uint8Array(width * height);
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x += 1) alpha[y * width + x] = row[x] === '#' ? 255 : 0;
  });
  return { alpha, width, height };
};

describe('findVisibleBounds', () => {
  it('reports nothing for a fully transparent bitmap', () => {
    const { alpha, width, height } = alphaFromRows(['....', '....', '....']);
    expect(findVisibleBounds(alpha, width, height)).toBeNull();
  });

  it('reports the whole bitmap when nothing is transparent', () => {
    const { alpha, width, height } = alphaFromRows(['####', '####']);
    expect(findVisibleBounds(alpha, width, height)).toEqual({ minX: 0, minY: 0, maxX: 3, maxY: 1 });
  });

  it('ignores symmetric padding on every side', () => {
    const { alpha, width, height } = alphaFromRows([
      '........',
      '..####..',
      '..####..',
      '........',
    ]);
    expect(findVisibleBounds(alpha, width, height)).toEqual({ minX: 2, minY: 1, maxX: 5, maxY: 2 });
  });

  it('keeps asymmetric padding on the side that has it', () => {
    const { alpha, width, height } = alphaFromRows([
      '..........',
      '.....###..',
      '.....###..',
    ]);
    expect(findVisibleBounds(alpha, width, height)).toEqual({ minX: 5, minY: 1, maxX: 7, maxY: 2 });
  });

  it('finds a single visible pixel', () => {
    const { alpha, width, height } = alphaFromRows(['....', '..#.', '....']);
    expect(findVisibleBounds(alpha, width, height)).toEqual({ minX: 2, minY: 1, maxX: 2, maxY: 1 });
  });

  it('counts a pixel at exactly the threshold and rejects one below it', () => {
    const threshold = VISIBLE_ALPHA_THRESHOLD;
    const alpha = new Uint8Array([threshold - 1, threshold, 0, 0]);
    expect(findVisibleBounds(alpha, 2, 2, threshold)).toEqual({ minX: 1, minY: 0, maxX: 1, maxY: 0 });
  });

  it('refuses a plane too short for the declared size', () => {
    expect(findVisibleBounds(new Uint8Array(3), 4, 4)).toBeNull();
    expect(findVisibleBounds(new Uint8Array(16), 0, 4)).toBeNull();
    expect(findVisibleBounds(new Uint8Array(16), Number.NaN, 4)).toBeNull();
  });
});

describe('contentBoundsInLocalUnits', () => {
  it('maps a centred content rect symmetrically around the part origin', () => {
    // 100x100 bitmap, 20px transparent border, drawn into a 150x150 box.
    const bounds = contentBoundsInLocalUnits({ minX: 20, minY: 20, maxX: 79, maxY: 79 }, 100, 100, 150, 150);
    expect(bounds).toEqual({ minX: -45, minY: -45, maxX: 45, maxY: 45 });
  });

  it('reproduces the drawn box when the whole bitmap is visible', () => {
    const bounds = contentBoundsInLocalUnits({ minX: 0, minY: 0, maxX: 99, maxY: 99 }, 100, 100, 150, 150);
    expect(bounds).toEqual({ minX: -75, minY: -75, maxX: 75, maxY: 75 });
  });

  it('keeps an asymmetric content rect on the side it occupies', () => {
    // Content against the left edge of a 100px bitmap drawn 150px wide.
    const bounds = contentBoundsInLocalUnits({ minX: 0, minY: 0, maxX: 49, maxY: 49 }, 100, 100, 150, 150);
    expect(bounds).toEqual({ minX: -75, minY: -75, maxX: 0, maxY: 0 });
  });

  it('handles a non-uniform box without inventing content', () => {
    // 100x50 bitmap drawn into a 50x50 box: x scales by 0.5, y by 1.
    const bounds = contentBoundsInLocalUnits({ minX: 10, minY: 10, maxX: 29, maxY: 19 }, 100, 50, 50, 50);
    expect(bounds).toEqual({ minX: -20, minY: -15, maxX: -10, maxY: -5 });
  });

  it('yields nothing for a degenerate box or bitmap', () => {
    expect(contentBoundsInLocalUnits({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, 0, 100, 150, 150)).toBeUndefined();
    expect(contentBoundsInLocalUnits({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, 100, 100, 0, 150)).toBeUndefined();
    expect(contentBoundsInLocalUnits({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, 100, 100, Number.NaN, 150)).toBeUndefined();
  });
});
