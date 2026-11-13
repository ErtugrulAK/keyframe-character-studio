import { describe, expect, it } from 'vitest';
import { compareByStackingOrder, stackingOrder } from '../utils/layers/stackingOrder';

describe('stackingOrder', () => {
  it('paints ascending zIndex first, so the highest ends on top', () => {
    const parts = [{ id: 'top', zIndex: 3 }, { id: 'mid', zIndex: 2 }, { id: 'low', zIndex: 1 }];
    expect(stackingOrder(parts).map((p) => p.id)).toEqual(['low', 'mid', 'top']);
  });

  it('keeps the authored order of layers that share a zIndex', () => {
    const parts = [{ id: 'a', zIndex: 1 }, { id: 'b', zIndex: 0 }, { id: 'c', zIndex: 1 }, { id: 'd', zIndex: 1 }];
    expect(stackingOrder(parts).map((p) => p.id)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('never mutates its input', () => {
    const parts = [{ id: 'a', zIndex: 2 }, { id: 'b', zIndex: 1 }];
    const copy = stackingOrder(parts);
    expect(parts.map((p) => p.id)).toEqual(['a', 'b']);
    expect(copy).not.toBe(parts);
  });

  it('exposes the same rule as a comparator', () => {
    expect(compareByStackingOrder({ zIndex: 1 }, { zIndex: 4 })).toBeLessThan(0);
    expect(compareByStackingOrder({ zIndex: 4 }, { zIndex: 1 })).toBeGreaterThan(0);
    expect(compareByStackingOrder({ zIndex: 2 }, { zIndex: 2 })).toBe(0);
  });
});
