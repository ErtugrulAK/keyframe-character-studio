/**
 * The editor grid over the artboard: lines through the axes (the artboard
 * centre), spaced so the outermost cells are whole. A fixed 100-unit grid
 * left part cells at the edges of a 1920 x 1080 artboard (960 and 540 are
 * not multiples of 100; QA 2026-11-13).
 */

/** Major spacings tried in order of preference (stage units). */
const MAJOR_CANDIDATES = [100, 120, 80, 60, 50, 40, 150, 160, 200] as const;
const FALLBACK_MAJOR = 100;

export interface ArtboardGridSpacing {
  /** Every major line; whole cells to every edge when `fits`. */
  major: number;
  /** Half the major spacing. */
  minor: number;
  /** True when the major spacing divides both half sizes. */
  fits: boolean;
}

const divides = (step: number, length: number): boolean => Math.abs(length / step - Math.round(length / step)) < 1e-9;

/** The spacing whose cells, counted from the centre, end exactly on every edge. */
export const artboardGridSpacing = (width: number, height: number): ArtboardGridSpacing => {
  const halfW = width / 2;
  const halfH = height / 2;
  const major = MAJOR_CANDIDATES.find((step) => divides(step, halfW) && divides(step, halfH));
  const chosen = major ?? FALLBACK_MAJOR;
  return { major: chosen, minor: chosen / 2, fits: major !== undefined };
};

/**
 * Path data for the grid lines inside the artboard box (stage units):
 * `major` holds every major line, `minor` the minor lines between them.
 * Lines run through the centre and out to the edges; the edges themselves
 * are the artboard border, drawn elsewhere.
 */
export const artboardGridPaths = (
  artX: number,
  artY: number,
  width: number,
  height: number,
): { major: string; minor: string; spacing: ArtboardGridSpacing } => {
  const spacing = artboardGridSpacing(width, height);
  const centreX = artX + width / 2;
  const centreY = artY + height / 2;
  const major: string[] = [];
  const minor: string[] = [];
  const lines = (centre: number, half: number, draw: (at: number) => string) => {
    const count = Math.floor(half / spacing.minor + 1e-9);
    for (let index = -count; index <= count; index += 1) {
      const at = centre + index * spacing.minor;
      // The artboard border is drawn on its own; a line on it would double it.
      if (Math.abs(Math.abs(at - centre) - half) < 1e-9) continue;
      (index % 2 === 0 ? major : minor).push(draw(at));
    }
  };
  lines(centreX, width / 2, (x) => `M ${x} ${artY} V ${artY + height}`);
  lines(centreY, height / 2, (y) => `M ${artX} ${y} H ${artX + width}`);
  return { major: major.join(' '), minor: minor.join(' '), spacing };
};
