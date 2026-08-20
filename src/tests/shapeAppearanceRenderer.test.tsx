import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { BodyPartType, CharacterPart } from '../types/animator';
import { renderShapePart } from '../components/Canvas/renderers/parts/ShapePartRenderers';

const makePart = (type: BodyPartType, overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id: 'shape',
  type,
  name: type,
  zIndex: 1,
  fillColor: '#ff0000',
  strokeColor: '#ffffff',
  fillEnabled: true,
  fillOpacity: 1,
  strokeEnabled: true,
  strokeWidth: 8,
  strokeOpacity: 1,
  points: type === 'custom_freeform' ? [{ x: -40, y: -20 }, { x: 40, y: -20 }, { x: 0, y: 30 }] : undefined,
  ...overrides,
} as CharacterPart);

const render = (type: BodyPartType, overrides: Partial<CharacterPart> = {}, selected = false) =>
  renderToString(renderShapePart({ part: makePart(type, overrides), fill: '#00ff00', stroke: '#ffffff', isSelected: selected, isGhost: false }));

describe('native SVG shape appearance rendering', () => {
  it('renders modern rectangle fill and stroke on one visible geometry', () => {
    const html = render('custom_rect');
    expect(html).toContain('fill="#ff0000"');
    expect(html).toContain('fill-opacity="1"');
    expect(html).toContain('stroke="#ffffff"');
    expect(html).toContain('stroke-opacity="1"');
    expect(html).toContain('stroke-width="8"');
    expect((html.match(/<rect/g) || []).length).toBe(1);
  });

  it('supports fill-only, stroke-only, disabled stroke, and zero opacity', () => {
    expect(render('custom_rect', { strokeEnabled: false })).toContain('stroke="none"');
    expect(render('custom_rect', { fillEnabled: false })).toContain('fill="none"');
    expect(render('custom_rect', { fillOpacity: 0 })).toContain('fill-opacity="0"');
    expect(render('custom_rect', { strokeOpacity: 0 })).toContain('stroke-opacity="0"');
    expect(render('custom_rect', { strokeWidth: 0 })).toContain('stroke-width="0"');
  });

  it.each(['custom_circle', 'custom_triangle', 'custom_star', 'custom_diamond', 'custom_parallelogram', 'custom_capsule'] as BodyPartType[])('uses native appearance for %s', (type) => {
    const html = render(type);
    expect(html).toContain('stroke-width="8"');
    expect(html).toContain('vector-effect="non-scaling-stroke"');
  });

  it('renders modern freeform fill and stroke on its canonical path', () => {
    const html = render('custom_freeform');
    expect(html).toContain('<path');
    expect(html).toContain('fill="#ff0000"');
    expect(html).toContain('stroke="#ffffff"');
    expect(html).toContain('stroke-width="8"');
  });

  it('does not replace modern authored stroke when selected', () => {
    const html = render('custom_rect', { strokeColor: '#ffffff', strokeWidth: 8 }, true);
    expect(html).toContain('stroke="#ffffff"');
    expect(html).not.toContain('#38bdf8');
    expect(html).not.toContain('#00d2ff');
  });

  it('keeps legacy appearance behavior and dormant width', () => {
    const legacy = renderToString(renderShapePart({
      part: makePart('custom_rect', { fillEnabled: undefined, fillOpacity: undefined, strokeEnabled: undefined, strokeOpacity: undefined, strokeWidth: 8, strokeColor: '#101218' }),
      fill: '#00ff00', stroke: '#101218', isSelected: false, isGhost: false,
    }));
    expect(legacy).toContain('stroke-width="1.5"');
    expect(legacy).not.toContain('stroke-width="8"');
    expect(render('custom_rect', { strokeColor: '#f00', fillEnabled: undefined, fillOpacity: undefined, strokeEnabled: undefined, strokeOpacity: undefined })).toContain('stroke="none"');
  });

  it('leaves excluded banner/card rendering on the legacy path', () => {
    expect(render('custom_banner')).toContain('BANNER LABEL');
    expect(render('custom_card')).toContain('STUDIO CARD');
  });
});
