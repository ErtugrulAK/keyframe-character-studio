import { describe, expect, it } from 'vitest';
import type { CharacterPart, FreeformPoint, Transform } from '../types/animator';
import { affineOfTransform, composeAffine, worldAffineOf } from '../utils/geometry/containerMath';
import { evaluateTransform } from '../utils/animation/evaluateTransform';
import { computeBooleanContours, createBooleanDisplayName, deriveBooleanGeometry, dissolveBooleanGroup, inverseTransformBooleanContours, isBooleanEligible, isGeneratedBooleanName, partToWorldPolygons, transformBooleanContours } from '../utils/geometry/booleanGeometry';

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
});

/**
 * A Boolean operand inside a container whose nesting is not a TRS (`scale(2,1)`
 * around a 90°-rotated child) is SHEARED: the exact map is
 * `(x, y) -> (−2y − 160, x)` while the folded authored TRS reads
 * `(x, y) -> (−160 − y, 2x)`. Every world map must be the affine.
 */
describe('boolean world maps through the derived affine', () => {
  const SHAPE_TRS = (over: Partial<Transform> = {}): Transform => ({
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, ...over,
  });

  const container = (id: string, over: Partial<Transform> = {}, parentId?: string): CharacterPart => ({
    id,
    name: id,
    type: 'custom_freeform',
    zIndex: 0,
    isGroup: true,
    points: [],
    baseTransform: SHAPE_TRS(over),
    ...(parentId ? { parentId } : {}),
  } as unknown as CharacterPart);

  /** `custom_rect` local geometry is the box (−60,−30)…(60,30). */
  const rect = (id: string, parentId: string, over: Partial<Transform> = {}): CharacterPart => ({
    id,
    name: id,
    type: 'custom_rect',
    zIndex: 1,
    parentId,
    baseTransform: SHAPE_TRS(over),
  } as unknown as CharacterPart);

  /** Container with scaleX 2 holding a 90°-rotated child at local (−100, 0). */
  const stretchedChild = (id: string): CharacterPart[] => [
    container('g', { x: 40, scaleX: 2 }),
    rect(id, 'g', { x: -100, rotation: 90 }),
  ];

  const worldOf = (parts: CharacterPart[], id: string): Transform & { affine?: ReturnType<typeof worldAffineOf> } =>
    evaluateTransform(parts, [], 'Sequence', id, 0);

  const bboxOf = (contours: FreeformPoint[][]) => {
    const points = contours.flat();
    return {
      minX: Math.min(...points.map((p) => p.x)),
      maxX: Math.max(...points.map((p) => p.x)),
      minY: Math.min(...points.map((p) => p.y)),
      maxY: Math.max(...points.map((p) => p.y)),
    };
  };

  it('maps an operand\u2019s world polygons by the exact affine, not the folded TRS', () => {
    const scene = stretchedChild('r');
    const world = worldOf(scene, 'r');
    expect(world.affine).toBeDefined();

    const ring = partToWorldPolygons(scene[1], world)![0][0];
    // Exact map: (−60,−30) → (−100,−60), (60,−30) → (−100,60),
    // (60,30) → (−220,60), (−60,30) → (−220,−60).
    const exact = [[-100, -60], [-100, 60], [-220, 60], [-220, -60]];
    // Failing-before (folded TRS: rotation 90, scaleX 2 at (−160, 0)):
    // (−130,−120), (−130,120), (−190,120), (−190,−120).
    const folded = [[-130, -120], [-130, 120], [-190, 120], [-190, -120]];
    expect(ring).toHaveLength(4);
    ring.forEach(([x, y], index) => {
      expect(x).toBeCloseTo(exact[index][0], 9);
      expect(y).toBeCloseTo(exact[index][1], 9);
      expect(x).not.toBeCloseTo(folded[index][0], 3);
      expect(y).not.toBeCloseTo(folded[index][1], 3);
    });
  });

  it('derives Boolean geometry from the sheared operand maps', () => {
    // Both operands are 90°-rotated children of the stretched container, so
    // their exact images are the boxes [−220,−100]×[−60,60] and
    // [−220,−100]×[40,160]; they intersect in [−220,−100]×[40,60].
    // Under the folded reading the same two images were [−190,−130]×[−120,120]
    // and [−190,−130]×[−20,220], intersecting in [−190,−130]×[−20,120].
    const a = rect('a', 'g', { x: -100, rotation: 90 });
    const b = rect('b', 'g', { x: -100, y: 100, rotation: 90 });
    const scene = [container('g', { x: 40, scaleX: 2 }), a, b];

    const contours = computeBooleanContours('intersect', [a, b], {
      a: worldOf(scene, 'a'),
      b: worldOf(scene, 'b'),
    });
    const box = bboxOf(contours);
    expect(box.minX).toBeCloseTo(-220, 9);
    expect(box.maxX).toBeCloseTo(-100, 9);
    expect(box.minY).toBeCloseTo(40, 9);
    expect(box.maxY).toBeCloseTo(60, 9);
    expect(box.maxX).not.toBeCloseTo(-130, 3);
    expect(box.minY).not.toBeCloseTo(-20, 3);
  });

  it('inverts a derived affine exactly instead of the folded TRS inverse', () => {
    const sheared = {
      x: -160, y: 0, rotation: 90, scaleX: 2, scaleY: 1, opacity: 1,
      affine: composeAffine(
        affineOfTransform(SHAPE_TRS({ x: 40, scaleX: 2 })),
        affineOfTransform(SHAPE_TRS({ x: -100, rotation: 90 })),
      ),
    };

    const local = inverseTransformBooleanContours([[{ x: 0, y: 0 }]], sheared);
    // Exact map `(x, y) -> (−2y − 160, x)`: world (0, 0) is local (0, −80).
    // Failing-before (TRS inverse of the same world transform): (0, −160).
    expect(local[0][0].x).toBeCloseTo(0, 9);
    expect(local[0][0].y).toBeCloseTo(-80, 9);
    expect(local[0][0].y).not.toBeCloseTo(-160, 3);

    const back = transformBooleanContours(local, sheared);
    expect(back[0][0].x).toBeCloseTo(0, 9);
    expect(back[0][0].y).toBeCloseTo(0, 9);
  });

  it('puts the local contours of a Boolean group inside a sheared group\u2019s own frame', () => {
    // Outer container scaleX 2 (x 40) → group `g` rotated 90° at (−100, 0) →
    // two rect operands at group-local ±30. The group's world map is the shear
    // `(x, y) -> (−2y − 160, x)`, so the operands' own local boxes
    // (−90,−30)…(30,30) and (−30,−30)…(90,30) union to (−90,−30)…(90,30) in the
    // group's frame and to [−220,−100]×[−90,90] in the world.
    // Failing-before (folded TRS inverse) read the local box as (−45,−60)…(45,60).
    const a = rect('a', 'g', { x: -30 });
    const b = rect('b', 'g', { x: 30 });
    const scene = [container('o', { x: 40, scaleX: 2 }), container('g', { x: -100, rotation: 90 }, 'o'), a, b];
    const groupWorld = worldOf(scene, 'g');
    expect(groupWorld.affine).toBeDefined();

    const derived = deriveBooleanGeometry('union', [a, b], {
      a: worldOf(scene, 'a'),
      b: worldOf(scene, 'b'),
    }, groupWorld);

    const localBox = bboxOf(derived.localContours);
    expect(localBox.minX).toBeCloseTo(-90, 6);
    expect(localBox.maxX).toBeCloseTo(90, 6);
    expect(localBox.minY).toBeCloseTo(-30, 6);
    expect(localBox.maxY).toBeCloseTo(30, 6);
    expect(localBox.minX).not.toBeCloseTo(-45, 3);
    expect(localBox.minY).not.toBeCloseTo(-60, 3);

    const worldBox = bboxOf(derived.worldContours);
    expect(worldBox.minX).toBeCloseTo(-220, 6);
    expect(worldBox.maxX).toBeCloseTo(-100, 6);
    expect(worldBox.minY).toBeCloseTo(-90, 6);
    expect(worldBox.maxY).toBeCloseTo(90, 6);
  });
});
