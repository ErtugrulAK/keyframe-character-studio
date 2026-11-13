import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, MIN_ZOOM, fitArtboardZoomLevel, zoomLevelForScale } from '../utils/geometry/viewportMath';

describe('stage zoom levels', () => {
  it('turns a screen scale into a zoom level', () => {
    expect(zoomLevelForScale(1, 2)).toBe(0.5);
    expect(zoomLevelForScale(0.25, 0.5)).toBe(0.5);
    expect(zoomLevelForScale(2, 1)).toBe(2);
  });

  it('stays inside the zoom range', () => {
    expect(zoomLevelForScale(1000, 1)).toBe(MAX_ZOOM);
    expect(zoomLevelForScale(0.0001, 1)).toBe(MIN_ZOOM);
    expect(zoomLevelForScale(1, 0)).toBe(1);
  });

  it('fits the artboard by its tighter side, with a margin', () => {
    // 1000 × 500 box, 1920 × 1080 artboard: the height binds (500 / 1080).
    expect(fitArtboardZoomLevel({ width: 1000, height: 500 }, { width: 1920, height: 1080 }, 1)).toBeCloseTo((500 / 1080) * 0.9, 6);
    // A wide box: the width binds.
    expect(fitArtboardZoomLevel({ width: 960, height: 2000 }, { width: 1920, height: 1080 }, 0.5, 1)).toBeCloseTo(1, 6);
  });
});
