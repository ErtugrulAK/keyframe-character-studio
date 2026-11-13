import { describe, expect, it } from 'vitest';
import { placeFloatingPanel } from '../utils/editor/floatingPanel';

const viewport = { width: 1000, height: 800 };
const panel = { width: 236, height: 320 };

describe('placeFloatingPanel', () => {
  it('opens below the anchor and right-aligns when asked', () => {
    const placement = placeFloatingPanel({ left: 700, top: 100, width: 40, height: 28 }, panel, viewport, { align: 'end' });

    expect(placement).toEqual({ left: 504, top: 134, flipped: false });
  });

  it('flips above the anchor when the space below is too small', () => {
    const placement = placeFloatingPanel({ left: 10, top: 700, width: 40, height: 28 }, panel, viewport);

    expect(placement.flipped).toBe(true);
    expect(placement.top).toBe(374);
  });

  it('keeps the panel inside the viewport when the anchor sits on an edge', () => {
    const bottomRight = placeFloatingPanel({ left: 990, top: 790, width: 10, height: 40 }, panel, viewport);
    expect(bottomRight).toEqual({ left: 756, top: 464, flipped: true });

    const topLeft = placeFloatingPanel({ left: -30, top: 2, width: 10, height: 10 }, panel, viewport);
    expect(topLeft).toEqual({ left: 8, top: 18, flipped: false });
  });

  it('opens beside the anchor when the caller asks for the left side', () => {
    const placement = placeFloatingPanel({ left: 900, top: 300, width: 40, height: 28 }, panel, viewport, { side: 'left' });

    expect(placement).toEqual({ left: 658, top: 300, flipped: false });
  });

  it('falls back below the anchor when there is no room beside it', () => {
    const placement = placeFloatingPanel({ left: 40, top: 20, width: 40, height: 28 }, panel, viewport, { side: 'left' });

    expect(placement).toEqual({ left: 40, top: 54, flipped: false });
  });

  it('pins a panel wider than the viewport to the leading margin', () => {
    const placement = placeFloatingPanel({ left: 10, top: 10, width: 10, height: 10 }, { width: 1200, height: 100 }, viewport);

    expect(placement.left).toBe(8);
  });
});
