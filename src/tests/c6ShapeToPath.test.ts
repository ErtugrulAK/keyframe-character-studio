import { describe, expect, it } from 'vitest';
import type { CharacterPart, Track } from '../types/animator';
import { BEZIER_ARC_KAPPA, convertShapeToEditablePath, ellipseToPath, rectangleToPath, shapeToPathBlockReason } from '../utils/geometry/shapeToPath';
import { sampleBezierPath } from '../utils/geometry/bezierPath';
import { getPartBounds } from '../utils/geometry/bounds';
import { maskPathNormalizationSize } from '../utils/layers/layerMasks';

/**
 * C6 — Rectangle (and the other basic shapes) → editable path. The converted
 * layer draws the same outline in the same local space and keeps everything
 * that refers to it or that it refers to.
 */

const shape = (type: CharacterPart['type'], extra: Partial<CharacterPart> = {}): CharacterPart => ({
  id: 'r1',
  name: 'Panel',
  type,
  zIndex: 4,
  parentId: 'g1',
  fillColor: '#22d3ee',
  strokeColor: '#ff0066',
  fillEnabled: true,
  strokeEnabled: true,
  strokeWidth: 6,
  pivot: { x: 0, y: 0 },
  baseTransform: { x: 120, y: -40, rotation: 15, scaleX: 2, scaleY: 1.5, opacity: 0.8 },
  width: 200,
  height: 120,
  masks: [{ id: 'm1', name: 'Mask 1', mode: 'add', enabled: true, opacity: 1, feather: 0, expansion: 0, path: { version: 1, coordinateSpace: 'normalized', closed: true, points: [{ id: 'a', x: 0.1, y: 0.1 }, { id: 'b', x: 0.9, y: 0.1 }, { id: 'c', x: 0.5, y: 0.9 }] } }],
  trackMatte: { sourceLayerId: 'src', mode: 'alpha' },
  ...extra,
} as CharacterPart);

describe('C6 rectangle → path', () => {
  it('a plain rectangle becomes four exact corners at the drawn geometry', () => {
    const result = convertShapeToEditablePath(shape('custom_rect'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.precision).toBe('exact');
    expect(result.part.type).toBe('custom_freeform');
    expect(result.part.path?.points.map(({ x, y, kind }) => ({ x, y, kind }))).toEqual([
      { x: -60, y: -30, kind: 'corner' },
      { x: 60, y: -30, kind: 'corner' },
      { x: 60, y: 30, kind: 'corner' },
      { x: -60, y: 30, kind: 'corner' },
    ]);
    expect(result.part.path?.closed).toBe(true);
    expect(result.part.strokeLinejoin).toBe('miter');
  });

  it('keeps identity, order, hierarchy, transform, appearance, masks, matte and the mask frame', () => {
    const before = shape('custom_rect');
    const result = convertShapeToEditablePath(before);
    if (!result.ok) throw new Error(result.reason);
    const after = result.part;
    for (const key of ['id', 'name', 'zIndex', 'parentId', 'fillColor', 'strokeColor', 'fillEnabled', 'strokeEnabled', 'strokeWidth', 'baseTransform', 'masks', 'trackMatte', 'width', 'height'] as const) {
      expect(after[key], key).toEqual(before[key]);
    }
    expect(maskPathNormalizationSize(after)).toEqual(maskPathNormalizationSize(before));
    const box = getPartBounds(after);
    expect([box.halfW, box.halfH]).toEqual([60, 30]);
  });

  it('a rounded rectangle uses the SVG radius rule and κ arcs', () => {
    const path = rectangleToPath(-60, -30, 120, 60, 12);
    expect(path.points).toHaveLength(8);
    expect(path.points[0]).toMatchObject({ x: -48, y: -30, handleIn: { x: -48 - 12 * BEZIER_ARC_KAPPA, y: -30 } });
    // SVG clamps rx to half the shorter side.
    const pill = rectangleToPath(-60, -30, 120, 60, 500);
    expect(pill.points[0].x).toBe(-30);
    const converted = convertShapeToEditablePath(shape('custom_rect', { borderRadius: 12 }));
    expect(converted.ok && converted.precision).toBe('bezier-arc');
    expect(converted.ok && 'borderRadius' in converted.part).toBe(false);
  });

  it('an ellipse is four smooth anchors whose curve stays within 0.03 % of the radius', () => {
    const path = ellipseToPath(0, 0, 30, 30);
    expect(path.points.every((point) => point.kind === 'smooth')).toBe(true);
    const worst = Math.max(...sampleBezierPath(path, 64).map((point) => Math.abs(Math.hypot(point.x, point.y) - 30)));
    expect(worst / 30).toBeLessThan(0.0003);
  });

  it('polygons convert exactly; text shapes, Boolean structures and stroke reveals are refused with a reason', () => {
    const star = convertShapeToEditablePath(shape('custom_star'));
    expect(star.ok && star.part.path?.points).toHaveLength(10);
    expect(shapeToPathBlockReason(shape('custom_banner'))).toMatch(/text/);
    expect(shapeToPathBlockReason(shape('custom_rect', { booleanGroupId: 'b' }))).toMatch(/Boolean/);
    expect(shapeToPathBlockReason(shape('custom_rect', { trimPathEnabled: true }))).toMatch(/Trim Path/);
    expect(shapeToPathBlockReason(shape('custom_rect', { strokeProgress: 0.5 }))).toMatch(/Stroke progress/);
    const keyed: Track = { id: 't', partId: 'r1', name: 'Panel', color: '#fff', visible: true, locked: false, keyframes: [], channels: { trimPathEnd: [{ id: 'k', frame: 0, value: 0.5, easing: 'linear' }] } } as unknown as Track;
    expect(shapeToPathBlockReason(shape('custom_rect'), [keyed])).toMatch(/Trim Path/);
    expect(shapeToPathBlockReason(shape('custom_freeform'))).toMatch(/already/);
  });
});
