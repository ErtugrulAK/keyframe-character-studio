/**
 * C10 — reads easing code people copy from elsewhere into the four control
 * values of a cubic-bezier curve:
 *   `cubic-bezier(0.25, 0.1, 0.25, 1)` (CSS), `[0.25, 0.1, 0.25, 1]`
 *   (arrays, e.g. JS/Lottie) or just `0.25, 0.1, 0.25, 1` / `.25 .1 .25 1`.
 * The CSS keywords `ease`, `ease-in`, `ease-out`, `ease-in-out` and `linear`
 * map to their defined curves. X values must lie in 0..1 (CSS requires it);
 * Y values are clamped to the editor's -1..2 range. Anything else is `null`.
 */
export type CubicBezierPoints = [number, number, number, number];

const KEYWORDS: Record<string, CubicBezierPoints> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
};

const clampY = (value: number) => Math.max(-1, Math.min(2, value));

export const parseCubicBezierText = (text: string): CubicBezierPoints | null => {
  const trimmed = text.trim().replace(/;$/, '').trim().toLowerCase();
  if (KEYWORDS[trimmed]) return [...KEYWORDS[trimmed]] as CubicBezierPoints;
  const inner = trimmed.replace(/^cubic-bezier\s*\(/, '').replace(/^\[/, '').replace(/[)\]]$/, '');
  const numbers = inner.split(/[\s,]+/).filter(Boolean).map(Number);
  if (numbers.length !== 4 || numbers.some((value) => !Number.isFinite(value))) return null;
  const [x1, y1, x2, y2] = numbers;
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return null;
  return [x1, clampY(y1), x2, clampY(y2)];
};
