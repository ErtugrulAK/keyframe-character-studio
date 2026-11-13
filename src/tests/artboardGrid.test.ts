import { describe, expect, it } from 'vitest';
import { artboardGridPaths, artboardGridSpacing } from '../utils/geometry/artboardGrid';

/** QA 2026-11-13: the outermost grid cells of a 1920 x 1080 artboard were cut in half. */
describe('artboard grid', () => {
  it.each([
    [1920, 1080, 60],
    [1080, 1920, 60],
    [1280, 720, 40],
    [3840, 2160, 120],
    [1000, 1000, 100],
  ])('%i x %i gets whole cells to every edge (major %i)', (width, height, major) => {
    const spacing = artboardGridSpacing(width, height);
    expect(spacing).toEqual({ major, minor: major / 2, fits: true });
    expect((width / 2) % major).toBe(0);
    expect((height / 2) % major).toBe(0);
  });

  it('falls back to 100 when no spacing fits', () => {
    expect(artboardGridSpacing(1001, 777)).toEqual({ major: 100, minor: 50, fits: false });
  });

  it('draws a major line through each axis and none on the border', () => {
    // A 240 x 120 artboard centred on (0, 0): major 60 -> x = -60, 0, 60 (±120 is the border).
    const { major, minor } = artboardGridPaths(-120, -60, 240, 120);
    expect(major).toContain('M 0 -60 V 60');
    expect(major).toContain('M -120 0 H 120');
    expect(major).not.toContain('M 120 ');
    expect(major).not.toContain('M -120 -60 V');
    // Minor lines sit halfway between: x = ±30, ±90 and y = ±30.
    expect(minor.split('M').filter(Boolean)).toHaveLength(6);
    expect(minor).toContain('M 90 -60 V 60');
  });
});
