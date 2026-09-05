import { describe, expect, it } from 'vitest';
import type { CharacterPart } from '../types/animator';
import { computeBooleanContours, createBooleanDisplayName, deriveBooleanGeometry, dissolveBooleanGroup, inverseTransformBooleanContours, isBooleanEligible, isGeneratedBooleanName, transformBooleanContours } from '../utils/booleanGeometry';

const part = (id: string, type: CharacterPart['type'], x: number, y: number): CharacterPart => ({
  id,
  name: id,
  type,
  zIndex: 1,
  fillColor: '#fff',
  strokeColor: '#000',
  pivot: { x: 0, y: 0 },
  baseTransform: { x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
});

describe('boolean geometry', () => {
  it('supports union and intersect for transformed closed shapes', () => {
    const a = part('a', 'custom_rect', 0, 0);
    const b = part('b', 'custom_rect', 40, 0);
    const union = computeBooleanContours('union', [a, b]);
    const intersect = computeBooleanContours('intersect', [a, b]);
    expect(union.length).toBeGreaterThan(0);
    expect(intersect.length).toBeGreaterThan(0);
  });
  it('recomputes when evaluated operand transforms change between frames', () => {
    const a = part('a', 'custom_rect', 0, 0);
    const b = part('b', 'custom_rect', 0, 0);
    const frameA = computeBooleanContours('subtract', [a, b], {
      a: { ...a.baseTransform, x: 0 },
      b: { ...b.baseTransform, x: 20 },
    });
    const frameB = computeBooleanContours('subtract', [a, b], {
      a: { ...a.baseTransform, x: 0 },
      b: { ...b.baseTransform, x: 80, rotation: 30, scaleX: 1.5 },
    });
    expect(frameA).not.toEqual(frameB);
  });

  it('keeps subtract operand order deterministic and supports exclude holes/contours', () => {
    const subject = part('subject', 'custom_box', 0, 0);
    const cutter = part('cutter', 'custom_circle', 0, 0);
    const subtract = computeBooleanContours('subtract', [subject, cutter]);
    const reverse = computeBooleanContours('subtract', [cutter, subject]);
    const exclude = computeBooleanContours('exclude', [subject, cutter]);
    expect(subtract).not.toEqual(reverse);
    expect(exclude.length).toBeGreaterThan(0);
  });

  it('accepts freeform paths, static text and the closed shapes as operands', () => {
    const path = {
      version: 1 as const,
      coordinateSpace: 'local' as const,
      closed: true,
      points: [
        { id: 'p0', x: -30, y: -20 },
        { id: 'p1', x: 30, y: -20 },
        { id: 'p2', x: 0, y: 30 },
      ],
    };

    expect(isBooleanEligible(part('shape', 'custom_rect', 0, 0))).toBe(true);
    expect(isBooleanEligible({ ...part('free', 'custom_freeform', 0, 0), path })).toBe(true);
    expect(isBooleanEligible({ ...part('text', 'custom_text', 0, 0), textValue: 'A' })).toBe(true);
    // Not geometry: no path yet, an empty text, a staggered text (its outline is
    // per character and per frame), and layers that draw no vector outline.
    expect(isBooleanEligible(part('empty-free', 'custom_freeform', 0, 0))).toBe(false);
    expect(isBooleanEligible({ ...part('empty-text', 'custom_text', 0, 0), textValue: '   ' })).toBe(false);
    expect(isBooleanEligible({ ...part('stagger', 'custom_text', 0, 0), textValue: 'AB', textAnimMode: 'chars' })).toBe(false);
    expect(isBooleanEligible(part('image', 'custom_image', 0, 0))).toBe(false);
    expect(isBooleanEligible(undefined)).toBe(false);
  });

  it('uses a freeform layer\'s own path as its operand geometry', () => {
    const box = part('box', 'custom_box', 0, 0);
    const freeform = {
      ...part('free', 'custom_freeform', 20, 0),
      path: {
        version: 1 as const,
        coordinateSpace: 'local' as const,
        closed: true,
        points: [
          { id: 'p0', x: -40, y: -40 },
          { id: 'p1', x: 40, y: -40 },
          { id: 'p2', x: 0, y: 40 },
        ],
      },
    };

    const union = computeBooleanContours('union', [box, freeform]);
    const intersect = computeBooleanContours('intersect', [box, freeform]);

    expect(union.length).toBeGreaterThan(0);
    expect(intersect.length).toBeGreaterThan(0);
    // The triangle reaches further up and down than the box it overlaps.
    const bounds = union[0].reduce(
      (box2, point) => ({
        minY: Math.min(box2.minY, point.y),
        maxY: Math.max(box2.maxY, point.y),
      }),
      { minY: Number.POSITIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY },
    );
    expect(bounds.minY).toBeLessThan(-30);
    expect(bounds.maxY).toBeGreaterThan(30);
  });

  it('produces no geometry for a text operand the environment cannot trace', () => {
    // This environment has no canvas, so the traced text outline is unavailable.
    // The contract is the honest one: no geometry rather than a guessed box, and
    // the workflow reports the empty result.
    const text = { ...part('text', 'custom_text', 0, 0), textValue: 'O' };
    const box = part('box', 'custom_rect', 0, 0);

    expect(computeBooleanContours('intersect', [text, box])).toEqual([]);
    expect(deriveBooleanGeometry('intersect', [text, box], {}, box.baseTransform).worldContours).toEqual([]);
  });

  it('applies group transforms without mutating authored contours', () => {
    const contours = [[{ x: 1, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 4 }]];
    const transformed = transformBooleanContours(contours, {
      x: 10, y: -5, rotation: 0, scaleX: 2, scaleY: 3, opacity: 1,
    });
    expect(transformed).toEqual([[
      { x: 12, y: 1 },
      { x: 16, y: 1 },
      { x: 16, y: 7 },
    ]]);
    expect(contours[0][0]).toEqual({ x: 1, y: 2 });
  });

  it('dissolves a Boolean group while preserving operand parts and tracks', () => {
    const a = { ...part('a', 'custom_rect', 0, 0), booleanGroupId: 'group' };
    const b = { ...part('b', 'custom_circle', 40, 0), booleanGroupId: 'group' };
    const group = {
      ...part('group', 'custom_freeform', 0, 0),
      booleanOperandIds: ['a', 'b'],
      booleanOperation: 'union' as const,
      booleanContours: [],
    };
    const tracks = [
      { id: 'a-track', partId: 'a', name: 'A', color: '#fff', visible: true, locked: false, channels: {} },
      { id: 'group-track', partId: 'group', name: 'Group', color: '#fff', visible: true, locked: false, channels: {} },
    ] as never[];
    const result = dissolveBooleanGroup([a, b, group], tracks, 'group');
    expect(result.parts.map((item) => item.id)).toEqual(['a', 'b']);
    expect(result.parts.every((item) => item.booleanGroupId === undefined)).toBe(true);
    expect(result.tracks.map((item) => item.partId)).toEqual(['a']);
  });

  it('rejects raster and open/freeform parts', () => {
    expect(isBooleanEligible(part('image', 'custom_image', 0, 0))).toBe(false);
    expect(isBooleanEligible(part('freeform', 'custom_freeform', 0, 0))).toBe(false);
    expect(isBooleanEligible(part('circle', 'custom_circle', 0, 0))).toBe(true);
  });
});

  it('generates compact operand-derived names and preserves custom names', () => {
    const existing = [part('group-1', 'custom_freeform', 0, 0), {
      ...part('group-2', 'custom_freeform', 0, 0),
      name: 'Boolean 1 · Union',
    }];
    expect(createBooleanDisplayName('union', existing, undefined, ['Rectangle', 'Circle'])).toBe('Rectangle + Circle · Union');
    expect(createBooleanDisplayName('intersect', existing, 'Rectangle + Circle · Union', ['Rectangle', 'Circle'])).toBe('Rectangle + Circle · Intersect');
    expect(createBooleanDisplayName('subtract', existing, 'My Composite', ['Rectangle', 'Circle'])).toBe('My Composite');
    expect(isGeneratedBooleanName('Rectangle + Circle · Union')).toBe(true);
    expect(isGeneratedBooleanName('My Composite')).toBe(false);
  });

  it('keeps the legacy numeric fallback deterministic without operand names', () => {
    const existing = [{
      ...part('group-2', 'custom_freeform', 0, 0),
      name: 'Boolean 1 · Union',
    }];
    expect(createBooleanDisplayName('subtract', existing)).toBe('Boolean 2 · Subtract');
  });

  it('derives current Boolean geometry from evaluated operand transforms', () => {
    const a = part('a', 'custom_rect', 0, 0);
    const b = part('b', 'custom_rect', 40, 0);
    const derived = deriveBooleanGeometry(
      'union',
      [a, b],
      { a: { ...a.baseTransform, x: 20 }, b: { ...b.baseTransform, x: 80 } },
      { x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    );
    expect(derived.worldContours.length).toBeGreaterThan(0);
    expect(derived.localContours).not.toEqual(derived.worldContours);
  });

  it('retains all disconnected contours for Exclude geometry', () => {
    const a = part('a', 'custom_rect', -100, 0);
    const b = part('b', 'custom_rect', 100, 0);
    const derived = deriveBooleanGeometry(
      'exclude',
      [a, b],
      { a: a.baseTransform, b: b.baseTransform },
      { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    );
    expect(derived.worldContours).toHaveLength(2);
    expect(derived.localContours).toHaveLength(2);
  });

  it('round-trips Boolean contours through a parent transform', () => {
    const local = [[{ x: -10, y: -5 }, { x: 20, y: -5 }, { x: 20, y: 10 }]];
    const parent = { x: 40, y: -25, rotation: 30, scaleX: 2, scaleY: 0.5, opacity: 1 };
    const roundTrip = inverseTransformBooleanContours(transformBooleanContours(local, parent), parent);
    expect(roundTrip[0][0].x).toBeCloseTo(-10, 10);
    expect(roundTrip[0][0].y).toBeCloseTo(-5, 10);
  });
