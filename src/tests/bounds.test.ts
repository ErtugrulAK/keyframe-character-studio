import { describe, expect, it } from 'vitest';
import type { CharacterPart } from '../types/animator';
import { getPartBounds } from '../utils/bounds';

const makePart = (type: CharacterPart['type'] = 'custom_rect', overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id: 'bounds', type, name: type, zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  fillColor: '#fff', strokeColor: '#000',
  ...overrides,
} as CharacterPart);

describe('stroke-aware part bounds', () => {
  it('expands modern bounds by the visible non-scaling stroke extent', () => {
    const bounds = getPartBounds(makePart('custom_rect', {
      fillEnabled: false, fillOpacity: 1, strokeEnabled: true, strokeWidth: 20, strokeOpacity: 1,
    }), { scaleX: 1, scaleY: 1 });
    expect(bounds).toEqual({ halfW: 70, halfH: 40 });
  });

  it('keeps the final stage extent constant under scale', () => {
    const part = makePart('custom_rect', { fillEnabled: true, strokeEnabled: true, strokeWidth: 20, strokeOpacity: 1 });
    const bounds = getPartBounds(part, { scaleX: 2, scaleY: 4 });
    expect(bounds.halfW * 2).toBe(130);
    expect(bounds.halfH * 4).toBe(130);
  });

  it('uses the full stroke width for outside alignment bounds', () => {
    const bounds = getPartBounds(makePart('custom_rect', {
      fillEnabled: true, strokeEnabled: true, strokeWidth: 20, strokeOpacity: 1, strokeAlignment: 'outside',
    }), { scaleX: 1, scaleY: 1 });
    expect(bounds).toEqual({ halfW: 80, halfH: 50 });
  });

  it.each([
    { strokeEnabled: false, strokeOpacity: 1, strokeWidth: 20 },
    { strokeEnabled: true, strokeOpacity: 0, strokeWidth: 20 },
    { strokeEnabled: true, strokeOpacity: 1, strokeWidth: 0 },
  ])('does not expand when stroke is not visible: %o', (appearance) => {
    expect(getPartBounds(makePart('custom_rect', { fillEnabled: true, fillOpacity: 1, ...appearance }), { scaleX: 1, scaleY: 1 })).toEqual({ halfW: 60, halfH: 30 });
  });

  it('does not activate dormant legacy strokeWidth', () => {
    expect(getPartBounds(makePart('custom_rect', { strokeWidth: 20 }), { scaleX: 1, scaleY: 1 })).toEqual({ halfW: 60, halfH: 30 });
  });

  it('includes modern freeform stroke using existing point bounds', () => {
    const bounds = getPartBounds(makePart('custom_freeform', {
      points: [{ x: -40, y: -20 }, { x: 40, y: -20 }, { x: 0, y: 30 }],
      fillEnabled: false, strokeEnabled: true, strokeWidth: 8, strokeOpacity: 1,
    }), { scaleX: 1, scaleY: 1 });
    expect(bounds.halfW).toBeGreaterThan(40);
    expect(bounds.halfH).toBeGreaterThan(25);
  });

  it('keeps geometry-only callers backward compatible when no transform is supplied', () => {
    const part = makePart('custom_rect', { fillEnabled: true, strokeEnabled: true, strokeWidth: 40, strokeOpacity: 1 });
    expect(getPartBounds(part)).toEqual({ halfW: 60, halfH: 30 });
  });
});
