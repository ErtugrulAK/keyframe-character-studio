/**
 * Visible-content measurement for imported images.
 *
 * A PNG usually carries transparent padding, and the editor draws the whole
 * bitmap into a box sized from `naturalWidth`/`naturalHeight`. Every bounds
 * consumer (the Inspector's edge control points, the selection gizmo, the
 * resize handles, marquee hit-testing) then describes that padded rectangle, so
 * a padded image leaves empty space beside the art.
 *
 * Measuring the non-transparent content once at import and keeping it on the
 * layer fixes all of them together. The scan itself is pure so it can be pinned
 * without a canvas; only the decode step touches the browser.
 */

import type { ImageContentBounds } from '../types/animator';

/** A pixel counts as visible at or above this alpha — 1 means "any non-transparent pixel". */
export const VISIBLE_ALPHA_THRESHOLD = 1;

/** Inclusive pixel-index rectangle of the visible pixels of a bitmap. */
export interface VisibleContentRect {
  minX: number;
  minY: number;
  /** Inclusive index of the last visible column, so the extent is `maxX - minX + 1`. */
  maxX: number;
  maxY: number;
}

/**
 * Scan an alpha plane for its visible rectangle.
 *
 * Returns `null` when nothing reaches the threshold (a fully transparent
 * image), which callers treat as "no content measurement" rather than as an
 * empty rectangle.
 */
export const findVisibleBounds = (
  alpha: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number = VISIBLE_ALPHA_THRESHOLD,
): VisibleContentRect | null => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  if (alpha.length < width * height) return null;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width;
    for (let x = 0; x < width; x += 1) {
      if (alpha[rowStart + x] < threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
};

/**
 * Map a measured bitmap rectangle into a layer's local units.
 *
 * The drawn box is centred on the part origin, so a bitmap pixel maps to
 * `(pixel - natural/2) * boxScale`. A pixel with index `maxX` covers
 * `[maxX, maxX + 1)`, which is why the far edges use `maxX + 1`: the rectangle
 * then spans exactly the pixels that are visible.
 */
export const contentBoundsInLocalUnits = (
  content: VisibleContentRect,
  naturalWidth: number,
  naturalHeight: number,
  boxWidth: number,
  boxHeight: number,
): ImageContentBounds | undefined => {
  if (![naturalWidth, naturalHeight, boxWidth, boxHeight].every((value) => Number.isFinite(value) && value > 0)) return undefined;
  const scaleX = boxWidth / naturalWidth;
  const scaleY = boxHeight / naturalHeight;
  return {
    minX: (content.minX - naturalWidth / 2) * scaleX,
    maxX: (content.maxX + 1 - naturalWidth / 2) * scaleX,
    minY: (content.minY - naturalHeight / 2) * scaleY,
    maxY: (content.maxY + 1 - naturalHeight / 2) * scaleY,
  };
};

/**
 * Measure the visible rectangle of an already-decoded image.
 *
 * Canvas and image data are external boundaries: an environment without a 2D
 * context, or a raster that cannot be read, yields `null` so the layer simply
 * keeps the whole-bitmap bounds it would have had before.
 */
export const visibleContentRectOfImage = (image: HTMLImageElement): VisibleContentRect | null => {
  if (typeof document === 'undefined') return null;
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, width, height);
    const alpha = new Uint8Array(width * height);
    for (let index = 0; index < alpha.length; index += 1) alpha[index] = data[index * 4 + 3];
    return findVisibleBounds(alpha, width, height);
  } catch {
    return null;
  }
};
