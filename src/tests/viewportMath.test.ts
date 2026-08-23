import { describe, expect, it } from 'vitest';
import type { CharacterPart, Transform } from '../types/animator';
import { getCursorAnchoredViewport, getPartsInMarquee, getShapeCreationBounds, getShapeCreationPlacement } from '../utils/viewportMath';

const part = (id: string, overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id,
  type: 'custom_box',
  zIndex: 0,
  fillColor: '#fff',
  strokeColor: '#000',
  pivot: { x: 0, y: 0 },
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  ...overrides,
});

describe('Canvas Interaction V1 viewport math', () => {
  it('keeps the project point beneath the cursor stable during zoom', () => {
    const input = {
      rect: { left: 100, top: 40, width: 800, height: 600 },
      clientX: 520,
      clientY: 320,
      zoom: 1,
      pan: { x: 18, y: -12 },
      nextZoom: 1.5,
      viewBox: { width: 600, height: 480 },
    };
    const next = getCursorAnchoredViewport(input);
    const baseScale = Math.min(input.rect.width / 600, input.rect.height / 480);
    const viewBoxX = (input.clientX - input.rect.left - (input.rect.width - 600 * baseScale) / 2) / baseScale;
    const viewBoxY = (input.clientY - input.rect.top - (input.rect.height - 480 * baseScale) / 2) / baseScale;
    const relX = viewBoxX - 300;
    const relY = viewBoxY - 240;
    const before = { x: relX / input.zoom - input.pan.x, y: relY / input.zoom - input.pan.y };
    const after = { x: relX / next.zoom - next.pan.x, y: relY / next.zoom - next.pan.y };
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it('selects negative-scale parts when they intersect the marquee', () => {
    const parts = [part('mirrored', { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: -2, scaleY: 1, opacity: 1 } })];
    const transforms: Record<string, Transform> = { mirrored: { x: 0, y: 0, rotation: 0, scaleX: -2, scaleY: 1, opacity: 1 } };
    expect(getPartsInMarquee(parts, (id) => transforms[id], { x: 250, y: 225, w: 100, h: 100 })).toEqual(['mirrored']);
  });

  it('filters hidden or editor-invisible parts through the selection predicate', () => {
    const parts = [part('visible'), part('hidden')];
    const transform: Transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
    expect(getPartsInMarquee(parts, () => transform, { x: 250, y: 225, w: 100, h: 100 }, 300, 240, (candidate) => candidate.id === 'visible')).toEqual(['visible']);
  });
  it.each([
    [{ x: 10, y: 20 }, { x: 110, y: 220 }],
    [{ x: 110, y: 220 }, { x: 10, y: 20 }],
    [{ x: 110, y: 20 }, { x: 10, y: 220 }],
    [{ x: 10, y: 220 }, { x: 110, y: 20 }],
  ])('normalizes shape creation bounds in every drag direction', (start, current) => {
    const bounds = getShapeCreationBounds(start, current);
    expect(bounds).toMatchObject({ minX: 10, minY: 20, maxX: 110, maxY: 220, width: 100, height: 200, centerX: 60, centerY: 120 });
  });

  it('derives rectangle, circle and asymmetric polygon placement from canonical bounds', () => {
    const bounds = getShapeCreationBounds({ x: 200, y: 140 }, { x: 400, y: 340 });
    expect(getShapeCreationPlacement('custom_rect', bounds)).toEqual({ x: 0, y: 0, scaleX: 5 / 3, scaleY: 10 / 3 });
    expect(getShapeCreationPlacement('custom_circle', bounds)).toEqual({ x: 0, y: 0, scaleX: 10 / 3, scaleY: 10 / 3 });
    const parallelogram = getShapeCreationPlacement('custom_parallelogram', bounds);
    expect(parallelogram?.scaleX).toBeCloseTo(200 / 170, 8);
    expect(parallelogram?.scaleY).toBeCloseTo(200 / 60, 8);
    expect(parallelogram?.x).toBeCloseTo(0, 8);
    expect(parallelogram?.y).toBeCloseTo(0, 8);
  });
});
