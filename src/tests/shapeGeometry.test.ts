/**
 * M11 Step 2A — shape geometry single-source tests.
 *
 * Verifies:
 * - Every static shape type returns the exact local geometry the renderer
 *   previously hardcoded (no behavior change).
 * - Output is deterministic.
 * - The renderer's SVG output stays consistent with the shared geometry
 *   source (behavior-level — the produced points/r match geometry values).
 */
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { getShapeGeometry, polygonPointsToString, ShapeGeometry } from '../utils/shapeGeometry';
import { renderShapePart } from '../components/Canvas/renderers/parts/ShapePartRenderers';
import type { CharacterPart } from '../types/animator';

const STATIC_SHAPES = [
  'custom_star',
  'custom_circle',
  'custom_box',
  'custom_rect',
  'custom_triangle',
  'custom_parallelogram',
  'custom_banner',
  'custom_capsule',
  'custom_diamond',
  'custom_card',
] as const;

function makePart(type: string): CharacterPart {
  return {
    id: 'p1',
    type,
    name: 'T',
    zIndex: 1,
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    fillColor: '#ff0000',
    strokeColor: '#101218',
  } as CharacterPart;
}

describe('shapeGeometry — single source', () => {
  it('provides geometry for every static shape type', () => {
    for (const type of STATIC_SHAPES) {
      const geo = getShapeGeometry(type);
      expect(geo, type).not.toBeNull();
    }
  });

  it('returns null for non-shape types (freeform is dynamic)', () => {
    expect(getShapeGeometry('custom_freeform')).toBeNull();
    expect(getShapeGeometry('custom_text')).toBeNull();
    expect(getShapeGeometry('custom_image')).toBeNull();
    expect(getShapeGeometry('custom_video')).toBeNull();
    expect(getShapeGeometry('mograph_cloner')).toBeNull();
    expect(getShapeGeometry('particle_system')).toBeNull();
  });

  it('matches the renderer legacy values for every shape (no behavior change)', () => {
    // Star — 10 points, first at (0,-35)
    const star = getShapeGeometry('custom_star') as Extract<ShapeGeometry, { kind: 'polygon' }>;
    expect(star.points).toHaveLength(10);
    expect(star.points[0]).toEqual({ x: 0, y: -35 });
    expect(polygonPointsToString(star.points)).toBe('0,-35 10,-10 35,-10 15,5 23,30 0,15 -23,30 -15,5 -35,-10 -10,-10');

    // Circle r=30
    const circle = getShapeGeometry('custom_circle') as Extract<ShapeGeometry, { kind: 'circle' }>;
    expect(circle.r).toBe(30);

    // Box 60×60, rect 120×60, banner 160×50 rx10, capsule 100×40 rx20, card 180×100 rx12
    const box = getShapeGeometry('custom_box') as Extract<ShapeGeometry, { kind: 'rect' }>;
    expect(box).toEqual({ kind: 'rect', x: -30, y: -30, width: 60, height: 60, rx: 0 });
    const rect = getShapeGeometry('custom_rect') as Extract<ShapeGeometry, { kind: 'rect' }>;
    expect(rect).toEqual({ kind: 'rect', x: -60, y: -30, width: 120, height: 60, rx: 0 });
    const banner = getShapeGeometry('custom_banner') as Extract<ShapeGeometry, { kind: 'rect' }>;
    expect(banner).toEqual({ kind: 'rect', x: -80, y: -25, width: 160, height: 50, rx: 10 });
    const capsule = getShapeGeometry('custom_capsule') as Extract<ShapeGeometry, { kind: 'rect' }>;
    expect(capsule).toEqual({ kind: 'rect', x: -50, y: -20, width: 100, height: 40, rx: 20 });
    const card = getShapeGeometry('custom_card') as Extract<ShapeGeometry, { kind: 'rect' }>;
    expect(card).toEqual({ kind: 'rect', x: -90, y: -50, width: 180, height: 100, rx: 12 });

    // Triangle / parallelogram / diamond
    const tri = getShapeGeometry('custom_triangle') as Extract<ShapeGeometry, { kind: 'polygon' }>;
    expect(polygonPointsToString(tri.points)).toBe('0,-35 35,25 -35,25');
    const para = getShapeGeometry('custom_parallelogram') as Extract<ShapeGeometry, { kind: 'polygon' }>;
    expect(polygonPointsToString(para.points)).toBe('-35,-30 85,-30 35,30 -85,30');
    const diamond = getShapeGeometry('custom_diamond') as Extract<ShapeGeometry, { kind: 'polygon' }>;
    expect(polygonPointsToString(diamond.points)).toBe('0,-35 35,0 0,35 -35,0');
  });

  it('is deterministic — repeated calls produce identical geometry', () => {
    for (const type of STATIC_SHAPES) {
      expect(getShapeGeometry(type)).toEqual(getShapeGeometry(type));
    }
  });

  it('renderer output is consistent with the shared geometry source', () => {
    // Star: rendered polygon points must equal polygonPointsToString(geometry)
    const starGeo = getShapeGeometry('custom_star') as Extract<ShapeGeometry, { kind: 'polygon' }>;
    const starHtml = renderToString(renderShapePart({ part: makePart('custom_star'), fill: '#fff', stroke: '#000', isSelected: false, isGhost: false }));
    expect(starHtml).toContain(polygonPointsToString(starGeo.points));

    // Circle: rendered radius must equal geometry radius
    const circleGeo = getShapeGeometry('custom_circle') as Extract<ShapeGeometry, { kind: 'circle' }>;
    const circleHtml = renderToString(renderShapePart({ part: makePart('custom_circle'), fill: '#fff', stroke: '#000', isSelected: false, isGhost: false }));
    expect(circleHtml).toContain(`r="${circleGeo.r}"`);

    // Box: rendered rect dims must equal geometry dims
    const boxGeo = getShapeGeometry('custom_box') as Extract<ShapeGeometry, { kind: 'rect' }>;
    const boxHtml = renderToString(renderShapePart({ part: makePart('custom_box'), fill: '#fff', stroke: '#000', isSelected: false, isGhost: false }));
    expect(boxHtml).toContain(`width="${boxGeo.width}"`);
    expect(boxHtml).toContain(`height="${boxGeo.height}"`);
  });
});
