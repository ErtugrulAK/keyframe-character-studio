/**
 * A-01 / A-03 / A-04 / A-05 — text Boolean font identity, atomic operand
 * refusal, closed freeform sampling and SVG whitespace parity.
 */

import { describe, expect, it } from 'vitest';
import { normalizeSvgText, primaryFontFamily, canvasAcceptedFamilies } from '../utils/textOutline';
import { computeBooleanContours, inspectBooleanOperands } from '../utils/booleanGeometry';
import { sampleBezierPath } from '../utils/bezierPath';
import { normalizeClosedPoints } from '../utils/freeform';
import type { BezierPath, BezierVertex, CharacterPart } from '../types/animator';

const part = (id: string, over: Partial<CharacterPart>): CharacterPart => ({
  id, name: id, type: 'custom_box', zIndex: 1,
  fillColor: '#fff', strokeColor: '#000', pivot: { x: 0, y: 0 },
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  ...over,
} as CharacterPart);

const box = (id: string, x: number, size = 100): CharacterPart => part(id, {
  type: 'custom_box', width: size, height: size,
  baseTransform: { x, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
});

const textPart = (id: string, x: number): CharacterPart => part(id, {
  type: 'custom_text', textValue: 'O', fontSize: 90, fontFamily: "'Playfair Display', serif",
  baseTransform: { x, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
});

describe('A-01 — CSS family identity survives canvas re-serialization', () => {
  it('reads the primary family out of quoted and fallback-list forms', () => {
    expect(primaryFontFamily("'Playfair Display'")).toBe('Playfair Display');
    expect(primaryFontFamily('"Playfair Display"')).toBe('Playfair Display');
    expect(primaryFontFamily("'Playfair Display', serif")).toBe('Playfair Display');
    expect(primaryFontFamily('JetBrains Mono')).toBe('JetBrains Mono');
    expect(primaryFontFamily('Outfit')).toBe('Outfit');
  });

  it('finds the requested family in the canvas-serialized font string', () => {
    // What the browser writes back after `context.font = 'bold 96px 'Playfair Display''`.
    expect(canvasAcceptedFamilies('bold 96px "Playfair Display"')).toContain('playfair display');
    expect(canvasAcceptedFamilies('bold 96px Outfit')).toContain('outfit');
    expect(canvasAcceptedFamilies('bold 96px "JetBrains Mono"')).toContain('jetbrains mono');
    // Fallback lists survive as one serialized list.
    expect(canvasAcceptedFamilies('bold 96px "Playfair Display", serif')).toEqual(['playfair display', 'serif']);
  });

  it('matches a quoted request against the normalized canvas string', () => {
    const requested = primaryFontFamily("'Playfair Display', serif").toLowerCase();
    expect(canvasAcceptedFamilies('bold 96px "Playfair Display"').includes(requested)).toBe(true);
  });
});

describe('A-05 — the trace follows SVG whitespace semantics', () => {
  it('collapses internal runs and trims the edges like the renderer', () => {
    expect(normalizeSvgText('A  A')).toBe('A A');
    expect(normalizeSvgText('A   A')).toBe('A A');
    expect(normalizeSvgText('  A A  ')).toBe('A A');
    expect(normalizeSvgText('A\n\tA')).toBe('A A');
    expect(normalizeSvgText('   ')).toBe('');
  });

  it('maps visually identical texts to the same normalized string', () => {
    expect(normalizeSvgText('A A')).toBe(normalizeSvgText('A  A'));
    expect(normalizeSvgText(' A ')).toBe(normalizeSvgText('A'));
  });
});

describe('A-03 — a failed operand refuses the Boolean atomically', () => {
  it('reports the operand whose geometry cannot be produced', () => {
    const readiness = inspectBooleanOperands([textPart('t', -50), box('b1', 0), box('b2', 50)]);
    expect(readiness.ready).toBe(false);
    expect(readiness.unresolved.map((p) => p.id)).toEqual(['t']);
  });

  it('never drops a failed operand and runs a different operation', () => {
    const operands = [textPart('t', -50), box('b1', 0), box('b2', 50)];
    // Three operands, the first of which cannot be traced. The result must be a
    // refusal, not the two-box Subtract the old filter would have produced.
    expect(computeBooleanContours('subtract', operands)).toEqual([]);
    // The two-box Subtract alone is a real, different result.
    expect(computeBooleanContours('subtract', [box('b1', 0), box('b2', 50)]).length).toBeGreaterThan(0);
  });

  it('reports ready when every operand resolves', () => {
    expect(inspectBooleanOperands([box('b1', 0), box('b2', 50)]).ready).toBe(true);
  });
});

describe('A-04 — a closed freeform ring closes on its first point', () => {
  const vertex = (
    id: string, x: number, y: number,
    handleIn?: { x: number; y: number }, handleOut?: { x: number; y: number },
  ): BezierVertex => ({
    id, x, y, kind: 'corner',
    ...(handleIn ? { handleIn } : {}),
    ...(handleOut ? { handleOut } : {}),
  });

  const path = (points: BezierVertex[], closed: boolean): BezierPath =>
    ({ version: 1, coordinateSpace: 'local', closed, points });

  const ringArea = (points: { x: number; y: number }[]): number => {
    let area = 0;
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      area += current.x * next.y - next.x * current.y;
    }
    return Math.abs(area) / 2;
  };

  it('ends on the first vertex for a closed path and on the last for an open one', () => {
    const closed = path([vertex('a', 0, 0), vertex('b', 100, 0), vertex('c', 50, 90)], true);
    const samples = sampleBezierPath(closed, 8);
    expect(samples[samples.length - 1]).toMatchObject({ x: 0, y: 0 });

    const open = path([vertex('a', 0, 0), vertex('b', 100, 0), vertex('c', 50, 90)], false);
    const openSamples = sampleBezierPath(open, 8);
    expect(openSamples[openSamples.length - 1]).toMatchObject({ x: 50, y: 90 });
  });

  it('represents the curved closing edge, matching a high-resolution sample', () => {
    // The closing edge (last → first) bulges outward through its handles; the
    // old sampler dropped it and closed on the last vertex instead.
    const closed = path([
      vertex('a', 0, 0, { x: -60, y: -60 }),
      vertex('b', 120, 0),
      vertex('c', 60, 120, undefined, { x: 140, y: 60 }),
    ], true);
    const sampled = normalizeClosedPoints(sampleBezierPath(closed, 16));
    const reference = normalizeClosedPoints(sampleBezierPath(closed, 512));
    const area = ringArea(sampled);
    const referenceArea = ringArea(reference);
    expect(area).toBeGreaterThan(0);
    // 16 samples per segment approximate the arc with chords; the closing edge
    // must still be represented, so the area tracks the converged reference
    // instead of collapsing onto the straight triangle through the vertices.
    expect(Math.abs(area - referenceArea) / referenceArea).toBeLessThan(0.02);
    const straightTriangleArea = (120 * 120) / 2;
    expect(Math.abs(area - straightTriangleArea)).toBeGreaterThan(100);
  });

  it('keeps a straight-edged closed ring at its exact polygon area', () => {
    const closed = path([
      vertex('a', 0, 0), vertex('b', 100, 0), vertex('c', 100, 100), vertex('d', 0, 100),
    ], true);
    const samples = normalizeClosedPoints(sampleBezierPath(closed, 4));
    expect(ringArea(samples)).toBeCloseTo(10000, 3);
  });
});
