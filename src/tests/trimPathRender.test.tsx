import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PartRenderer } from '../components/Canvas/renderers/PartRenderer';
import type { CharacterPart } from '../types/animator';
import type { EvaluatedLayer } from '../types/composition';

const part = (overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id: 'trim', name: 'Trim', type: 'custom_rect', zIndex: 1,
  fillColor: '#f00', strokeColor: '#000', pivot: { x: 0.5, y: 0.5 },
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  fillEnabled: true, fillOpacity: 1, strokeEnabled: true, strokeWidth: 4, strokeOpacity: 1,
  ...overrides,
});

const render = (p: CharacterPart): string => {
  const evaluated: EvaluatedLayer = {
    id: p.id, type: p.type, transform: { ...p.baseTransform }, opacity: 1, visible: true, zIndex: 1,
    content: { fillColor: p.fillColor, strokeColor: p.strokeColor, fillEnabled: p.fillEnabled, fillOpacity: p.fillOpacity, strokeEnabled: p.strokeEnabled, strokeWidth: p.strokeWidth, strokeOpacity: p.strokeOpacity },
  };
  return renderToString(<PartRenderer part={p} evaluatedLayer={evaluated} currentFrame={0} onSelect={() => {}} onStartTranslateDrag={() => {}} />);
};

describe('Trim Path SVG rendering', () => {
  it('keeps fill complete while trimming only the stroke', () => {
    const html = render(part({ trimPathEnabled: true, trimPathStart: 0, trimPathEnd: 0.5 }));
    expect(html).toContain('fill="#f00"');
    expect(html).toContain('pathLength="1"');
    expect(html).toContain('stroke-dasharray="0.5 0.5"');
  });

  it('disabled Trim Path renders a full authored stroke without dash attributes', () => {
    const html = render(part({ trimPathEnabled: false, trimPathStart: 0.25, trimPathEnd: 0.5 }));
    expect(html).toContain('stroke="#000"');
    expect(html).not.toContain('pathLength="1"');
    expect(html).not.toContain('stroke-dasharray="0.5 0.5"');
  });

  it('preserves legacy strokeProgress rendering when modern fields are absent', () => {
    const html = render(part({ strokeColor: '#101218', fillEnabled: undefined, fillOpacity: undefined, strokeEnabled: undefined, strokeWidth: undefined, strokeOpacity: undefined, strokeProgress: 0.5 }));
    expect(html).toContain('stroke-dasharray="360"');
    expect(html).not.toContain('pathLength="1"');
  });

  it('renders outside stroke through a geometry mask while keeping fill geometry separate', () => {
    const html = render(part({ strokeAlignment: 'outside', trimPathEnabled: true, trimPathStart: 0, trimPathEnd: 0.5 }));
    expect(html).toContain('mask="url(#outside-stroke-trim)"');
    expect(html).toContain('fill="#f00"');
    expect(html).toContain('stroke-dasharray="0.5 0.5"');
  });

  it('keeps outside stroke visible when fill is disabled', () => {
    const html = render(part({ fillEnabled: false, strokeAlignment: 'outside' }));
    expect(html).toContain('fill="none"');
    expect(html).toContain('stroke="#000"');
    expect(html).toContain('mask="url(#outside-stroke-trim)"');
  });
});
