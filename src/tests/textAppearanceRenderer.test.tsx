import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { CharacterPart } from '../types/animator';
import { renderTextOrClonerPart } from '../components/Canvas/renderers/parts/TextAndClonerRenderers';

const makeText = (overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id: 'text',
  type: 'custom_text',
  name: 'Headline',
  zIndex: 1,
  textValue: 'Fade',
  fontSize: 96,
  fontFamily: 'Outfit',
  fillColor: '#22d3ee',
  strokeColor: '#101218',
  ...overrides,
} as CharacterPart);

const render = (
  overrides: Partial<CharacterPart> = {},
  { selected = false, stroke = '#00d2ff' } = {},
) => renderToString(
  renderTextOrClonerPart({
    part: makeText(overrides),
    fill: '#22d3ee',
    // The caller passes the legacy selection highlight as the stroke colour.
    stroke,
    isSelected: selected,
    currentFrame: 0,
  }) as React.ReactElement,
);

describe('native SVG text appearance rendering', () => {
  it('paints text with the authored stroke instead of the selection highlight', () => {
    const html = render({}, { selected: true });
    expect(html).toContain('fill="#22d3ee"');
    expect(html).toContain('stroke="#101218"');
    expect(html).not.toContain('#00d2ff');
  });

  it('defaults the text outline to the canonical 0.5 width', () => {
    expect(render()).toContain('stroke-width="0.5"');
    // A dormant legacy strokeWidth stays ignored until the paint is authored.
    expect(render({ strokeWidth: 6 })).toContain('stroke-width="0.5"');
    expect(render({ strokeWidth: 6, strokeEnabled: true })).toContain('stroke-width="6"');
  });

  it('honours authored stroke opacity, fill opacity, and disabled paint', () => {
    expect(render({ strokeOpacity: 0.4 })).toContain('stroke-opacity="0.4"');
    expect(render({ fillOpacity: 0.25 })).toContain('fill-opacity="0.25"');
    expect(render({ strokeEnabled: false })).toContain('stroke="none"');
    expect(render({ fillEnabled: false })).toContain('fill="none"');
  });

  it('keeps a selection highlight only while the outline is switched off', () => {
    expect(render({ strokeEnabled: false }, { selected: true })).toContain('stroke="#38bdf8"');
    expect(render({ strokeEnabled: false }, { selected: false })).toContain('stroke="none"');
  });

  it('applies the same paint to staggered text', () => {
    const html = render({ textAnimMode: 'chars', textValue: 'AB', strokeWidth: 4, strokeOpacity: 0.5 }, { selected: true });
    expect(html).toContain('stroke="#101218"');
    expect(html).toContain('stroke-width="4"');
    expect(html).toContain('stroke-opacity="0.5"');
    expect((html.match(/<tspan/g) || []).length).toBe(2);
  });
});
