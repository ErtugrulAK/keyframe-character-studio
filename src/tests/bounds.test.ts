import { describe, expect, it } from 'vitest';
import type { CharacterPart } from '../types/animator';
import { getPartBounds, getPartLocalBounds, getPartWorldBounds } from '../utils/bounds';

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

  it('keeps inside alignment within the authored geometry bounds', () => {
    const bounds = getPartBounds(makePart('custom_rect', {
      fillEnabled: true, strokeEnabled: true, strokeWidth: 20, strokeOpacity: 1, strokeAlignment: 'inside',
    }), { scaleX: 1, scaleY: 1 });
    expect(bounds).toEqual({ halfW: 60, halfH: 30 });
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
  it('uses renderer geometry extents for asymmetric polygon transform bounds', () => {
    expect(getPartBounds(makePart('custom_triangle'))).toEqual({ halfW: 35, halfH: 35 });
    expect(getPartBounds(makePart('custom_parallelogram'))).toEqual({ halfW: 85, halfH: 30 });
  });
});

describe('precise geometry bounds', () => {
  it('uses the actual asymmetric triangle and star extents', () => {
    const triangle = getPartLocalBounds(makePart('custom_triangle'));
    const star = getPartLocalBounds(makePart('custom_star'));

    expect(triangle).toMatchObject({ minY: -35, maxY: 25, offsetY: -5 });
    expect(star).toMatchObject({ minY: -35, maxY: 30, offsetY: -2.5 });
  });

  it('uses all Boolean contours for local bounds', () => {
    const bounds = getPartLocalBounds(makePart('custom_freeform', {
      points: [{ x: -10, y: -10 }, { x: 10, y: 10 }],
      booleanContours: [[
        { x: -100, y: -20 },
        { x: 80, y: -20 },
        { x: 80, y: 20 },
        { x: -100, y: 20 },
      ], [
        { x: 150, y: -5 },
        { x: 170, y: -5 },
        { x: 170, y: 5 },
        { x: 150, y: 5 },
      ]],
    }));

    expect(bounds).toMatchObject({ minX: -100, maxX: 170 });
  });

  it('transforms precise local bounds into world marquee bounds', () => {
    const bounds = getPartWorldBounds(makePart('custom_triangle'), {
      x: 50, y: 30, rotation: 0, scaleX: 2, scaleY: 3, opacity: 1,
    }, 300, 240);
    expect(bounds).toEqual({ minX: 280, minY: 165, maxX: 420, maxY: 345 });
  });
});
