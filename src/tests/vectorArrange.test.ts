import { describe, expect, it } from 'vitest';
import type { CharacterPart, Transform } from '../types/animator';
import { evaluateTransform } from '../utils/evaluateTransform';
import { getLayerWorldBounds } from '../utils/layerGrouping';
import {
  collectArrangeTargets,
  planAlign,
  planDistribute,
  planDistributeByGap,
  planFlip,
  planRotate,
  planTranslate,
  type ArrangePlan,
} from '../utils/vectorArrange';

/**
 * The vector arrange authority, measured in world space.
 *
 * `custom_rect` geometry is the shape authority's own box (−60…60 × −30…30), so
 * every number below is the real box a layer is drawn with, not a fixture.
 */
const rect = (id: string, x: number, y = 0, overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id,
  type: 'custom_rect',
  zIndex: 1,
  fillColor: '#ffffff',
  strokeColor: '#101218',
  pivot: { x: 0, y: 0 },
  baseTransform: { x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  ...overrides,
});

const worldAt = (parts: CharacterPart[], frame = 0) => (
  (partId: string): Transform => evaluateTransform(parts, [], 'Sequence', partId, frame)
);

const targetsOf = (parts: CharacterPart[], ids: string[]) => collectArrangeTargets(parts, ids, worldAt(parts));

/** The document the plan would produce if every patch landed on its layer. */
const applyPlan = (parts: CharacterPart[], plan: ArrangePlan): CharacterPart[] => parts.map((part) => (
  plan[part.id] ? { ...part, baseTransform: { ...part.baseTransform, ...plan[part.id] } } : part
));

const boxesOf = (parts: CharacterPart[], ids: string[]) => {
  const worldOf = worldAt(parts);
  return ids.map((id) => getLayerWorldBounds(parts, id, worldOf));
};

describe('planAlign', () => {
  it('aligns two layers to their collective bounds and leaves the other axis alone', () => {
    const parts = [rect('a', 0, 40), rect('b', 200, 0)];
    const plan = planAlign(targetsOf(parts, ['a', 'b']), 'left');

    // The layer that already owns the left edge is not written at all.
    expect(plan).toEqual({ b: { x: 0 } });

    const aligned = applyPlan(parts, plan!);
    const [a, b] = boxesOf(aligned, ['a', 'b']);
    expect(a!.minX).toBeCloseTo(b!.minX, 6);
    // Y is untouched: the frames are still where they were vertically.
    expect(b!.minY).toBeCloseTo(0 - 30, 6);
    expect(plan!.b.y).toBeUndefined();
  });

  it('aligns right, top, bottom and the two centre edges on the collective box', () => {
    const parts = [rect('a', 0, 0), rect('b', 200, 100)];

    const right = planAlign(targetsOf(parts, ['a', 'b']), 'right');
    const rightBoxes = boxesOf(applyPlan(parts, right!), ['a', 'b']);
    expect(rightBoxes[0]!.maxX).toBeCloseTo(rightBoxes[1]!.maxX, 6);

    const top = planAlign(targetsOf(parts, ['a', 'b']), 'top');
    const topBoxes = boxesOf(applyPlan(parts, top!), ['a', 'b']);
    expect(topBoxes[0]!.minY).toBeCloseTo(topBoxes[1]!.minY, 6);

    const bottom = planAlign(targetsOf(parts, ['a', 'b']), 'bottom');
    const bottomBoxes = boxesOf(applyPlan(parts, bottom!), ['a', 'b']);
    expect(bottomBoxes[0]!.maxY).toBeCloseTo(bottomBoxes[1]!.maxY, 6);

    const centers = planAlign(targetsOf(parts, ['a', 'b']), 'horizontal-centers');
    const centerBoxes = boxesOf(applyPlan(parts, centers!), ['a', 'b']);
    expect((centerBoxes[0]!.minX + centerBoxes[0]!.maxX) / 2).toBeCloseTo((centerBoxes[1]!.minX + centerBoxes[1]!.maxX) / 2, 6);

    const vCenters = planAlign(targetsOf(parts, ['a', 'b']), 'vertical-centers');
    const vCenterBoxes = boxesOf(applyPlan(parts, vCenters!), ['a', 'b']);
    expect((vCenterBoxes[0]!.minY + vCenterBoxes[0]!.maxY) / 2).toBeCloseTo((vCenterBoxes[1]!.minY + vCenterBoxes[1]!.maxY) / 2, 6);
  });

  it('uses a rotated layer’s real world box, not its local extent', () => {
    // A 120×60 rect turned 90° occupies a 60×120 box on screen.
    const rotated = rect('a', 0, 0, { baseTransform: { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1, opacity: 1 } });
    const parts = [rotated, rect('b', 300, 0)];
    const [aBefore] = boxesOf(parts, ['a']);
    expect(aBefore!.maxX - aBefore!.minX).toBeCloseTo(60, 6);

    const plan = planAlign(targetsOf(parts, ['a', 'b']), 'left')!;
    const [a, b] = boxesOf(applyPlan(parts, plan), ['a', 'b']);
    expect(b!.minX).toBeCloseTo(a!.minX, 6);
    expect(b!.minX).toBeCloseTo(-30, 6);
  });

  it('needs two measurable layers', () => {
    expect(planAlign(targetsOf([rect('a', 0)], ['a']), 'left')).toBeNull();
  });

  it('is idempotent: aligning an aligned selection writes nothing', () => {
    const parts = [rect('a', 0, 40), rect('b', 200, 0)];
    const first = planAlign(targetsOf(parts, ['a', 'b']), 'left')!;
    const aligned = applyPlan(parts, first);
    expect(planAlign(targetsOf(aligned, ['a', 'b']), 'left')).toEqual({});
  });

  it('center aligns BOTH axes onto the collective centre in one plan', () => {
    const parts = [rect('a', 0, 0), rect('b', 200, 80), rect('c', 400, -80)];
    const plan = planAlign(targetsOf(parts, ['a', 'b', 'c']), 'center')!;
    // Union centre (200, 0): the patches carry absolute authored positions, and
    // only the axis that actually moves is written.
    expect(plan).toEqual({ a: { x: 200 }, b: { y: 0 }, c: { x: 200, y: 0 } });

    const aligned = applyPlan(parts, plan);
    for (const box of boxesOf(aligned, ['a', 'b', 'c'])) {
      expect((box!.minX + box!.maxX) / 2).toBeCloseTo(200, 6);
      expect((box!.minY + box!.maxY) / 2).toBeCloseTo(0, 6);
    }
    // Idempotent like every other align: a second run writes nothing.
    expect(planAlign(targetsOf(aligned, ['a', 'b', 'c']), 'center')).toEqual({});
  });
});

describe('planDistribute', () => {
  it('evens out three or more centres while the extremes hold the span', () => {
    const parts = [rect('a', 0), rect('b', 40), rect('c', 400)];
    const plan = planDistribute(targetsOf(parts, ['a', 'b', 'c']), 'horizontal')!;

    expect(Object.keys(plan)).toEqual(['b']);
    const distributed = applyPlan(parts, plan);
    const centres = boxesOf(distributed, ['a', 'b', 'c']).map((box) => (box!.minX + box!.maxX) / 2);
    expect(centres[1] - centres[0]).toBeCloseTo(centres[2] - centres[1], 6);
    // The span the user sees is untouched.
    expect(centres[0]).toBeCloseTo(0, 6);
    expect(centres[2]).toBeCloseTo(400, 6);
  });

  it('distributes vertically on the Y axis only', () => {
    const parts = [rect('a', 0, 0), rect('b', 0, 80), rect('c', 0, 400)];
    const plan = planDistribute(targetsOf(parts, ['a', 'b', 'c']), 'vertical')!;
    expect(plan.b).toEqual({ y: 200 });
    expect(plan.b.x).toBeUndefined();
  });

  it('is deterministic for equal centres: the tie is broken by layer id', () => {
    const parts = [rect('c', 0), rect('b', 0), rect('a', 300)];
    const first = planDistribute(targetsOf(parts, ['a', 'b', 'c']), 'horizontal');
    const second = planDistribute(targetsOf(parts, ['c', 'b', 'a']), 'horizontal');
    expect(first).toEqual(second);
  });

  it('needs three measurable layers', () => {
    expect(planDistribute(targetsOf([rect('a', 0), rect('b', 300)], ['a', 'b']), 'horizontal')).toBeNull();
  });
});

describe('groups as arrange targets', () => {
  const group = (id: string, children: CharacterPart[]): CharacterPart[] => {
    const container: CharacterPart = {
      ...rect(id, 0),
      type: 'custom_freeform',
      isGroup: true,
      points: [],
    };
    return [container, ...children.map((child) => ({ ...child, parentId: id }))];
  };

  it('measures a container by the art inside it, in world space', () => {
    const parts = group('g', [rect('c1', 0), rect('c2', 200)]);
    const [box] = boxesOf(parts, ['g']);
    expect(box).toEqual({ minX: -60, minY: -30, maxX: 260, maxY: 30 });
  });

  it('moves the container as one unit, carrying its children', () => {
    const parts = [...group('g', [rect('c1', 0), rect('c2', 200)]), rect('other', 500)];
    const plan = planAlign(targetsOf(parts, ['g', 'other']), 'right')!;
    expect(Object.keys(plan)).toEqual(['g']);

    const aligned = applyPlan(parts, plan);
    // The container moved; the children were never addressed individually and
    // keep their relationship to it.
    expect(plan.g.x).toBeDefined();
    const childBefore = worldAt(parts)('c1').x;
    const childAfter = worldAt(aligned)('c1').x;
    const groupBefore = worldAt(parts)('g').x;
    const groupAfter = worldAt(aligned)('g').x;
    expect(childAfter - childBefore).toBeCloseTo(groupAfter - groupBefore, 6);
  });

  it('drops a layer whose ancestor is also selected, so nothing moves twice', () => {
    const parts = group('g', [rect('c1', 0), rect('c2', 200)]);
    const ids = collectArrangeTargets(parts, ['g', 'c1'], worldAt(parts)).map((target) => target.id);
    expect(ids).toEqual(['g']);
    // With the child alone the child IS the target.
    expect(collectArrangeTargets(parts, ['c1'], worldAt(parts)).map((target) => target.id)).toEqual(['c1']);
  });

  it('cannot align a container with nothing measurable inside it', () => {
    const empty: CharacterPart[] = [{ ...rect('g', 0), type: 'custom_freeform', isGroup: true, points: [] }, rect('a', 100)];
    expect(collectArrangeTargets(empty, ['g'], worldAt(empty))).toEqual([]);
    expect(planAlign(collectArrangeTargets(empty, ['g', 'a'], worldAt(empty)), 'left')).toBeNull();
  });
});

describe('planRotate', () => {
  it('turns the selection ±90° about the collective centre without moving it', () => {
    const parts = [rect('a', 0), rect('b', 200)];
    const before = worldAt(parts);
    const plan = planRotate(targetsOf(parts, ['a', 'b']), 'cw');

    // The collective centre is the pivot, and it stays exactly where it was.
    const rotated = applyPlan(parts, plan);
    const [aBox] = boxesOf(rotated, ['a']);
    expect(aBox!.minX + aBox!.maxX).toBeCloseTo(200, 6);
    expect(plan.a.rotation).toBe(90);
    expect(plan.b.rotation).toBe(90);

    // Rigid body: the distance between the two origins is preserved.
    const after = worldAt(rotated);
    const spanBefore = Math.hypot(before('b').x - before('a').x, before('b').y - before('a').y);
    const spanAfter = Math.hypot(after('b').x - after('a').x, after('b').y - after('a').y);
    expect(spanAfter).toBeCloseTo(spanBefore, 6);

    // Both ends of the pair are on the pivot's vertical line now.
    expect(after('a').x).toBeCloseTo(100, 6);
    expect(after('b').x).toBeCloseTo(100, 6);
    expect(after('a').y).toBeCloseTo(-100, 6);
    expect(after('b').y).toBeCloseTo(100, 6);

    const back = planRotate(targetsOf(rotated, ['a', 'b']), 'ccw');
    const restored = applyPlan(rotated, back);
    expect(worldAt(restored)('a').x).toBeCloseTo(0, 6);
    expect(worldAt(restored)('a').y).toBeCloseTo(0, 6);
    expect(worldAt(restored)('a').rotation).toBeCloseTo(0, 6);
  });

  it('pivots a rotated layer about the fixed pivot, not about its own new bounds', () => {
    const tilted = rect('a', 0, 0, { baseTransform: { x: 0, y: 0, rotation: 30, scaleX: 1, scaleY: 1, opacity: 1 } });
    const parts = [tilted, rect('b', 300, 0)];
    const plan = planRotate(targetsOf(parts, ['a', 'b']), 'cw');
    expect(plan.a.rotation).toBe(120);
    const rotated = applyPlan(parts, plan);
    // The pair turned as one: their world span is unchanged.
    const before = worldAt(parts);
    const after = worldAt(rotated);
    expect(Math.hypot(after('b').x - after('a').x, after('b').y - after('a').y))
      .toBeCloseTo(Math.hypot(before('b').x - before('a').x, before('b').y - before('a').y), 6);
  });
});

describe('planFlip', () => {
  it('flips one layer in place about its own visual centre', () => {
    const parts = [rect('a', 0, 40)];
    const plan = planFlip(targetsOf(parts, ['a']), 'horizontal')!;

    expect(plan.a).toMatchObject({ x: 0, scaleX: -1 });
    expect(plan.a.rotation).toBeCloseTo(0, 6);
    const [box] = boxesOf(applyPlan(parts, plan), ['a']);
    expect(box).toEqual({ minX: -60, minY: 10, maxX: 60, maxY: 70 });
  });

  it('mirrors a multi-selection as one picture about the collective centre', () => {
    const parts = [rect('a', 0), rect('b', 200)];
    const plan = planFlip(targetsOf(parts, ['a', 'b']), 'horizontal')!;

    // The two layers swap places, so the box the user saw is unchanged.
    const flipped = applyPlan(parts, plan);
    const after = worldAt(flipped);
    expect(after('a').x).toBeCloseTo(200, 6);
    expect(after('b').x).toBeCloseTo(0, 6);
    expect(plan.a.scaleX).toBe(-1);
    expect(plan.b.scaleX).toBe(-1);
    expect(boxesOf(flipped, ['a', 'b'])[0]).toEqual({ minX: 140, minY: -30, maxX: 260, maxY: 30 });
  });

  it('flips vertically on the Y axis, keeping the world placement', () => {
    const parts = [rect('a', 0, 40), rect('b', 0, -80)];
    const plan = planFlip(targetsOf(parts, ['a', 'b']), 'vertical')!;
    const flipped = applyPlan(parts, plan);
    const after = worldAt(flipped);
    expect(after('a').y).toBeCloseTo(-80, 6);
    expect(after('b').y).toBeCloseTo(40, 6);
    expect(plan.a).toMatchObject({ scaleY: -1, scaleX: 1 });
  });

  it('is an exact mirror for a rotated, non-uniformly scaled layer', () => {
    const layered = rect('a', 50, 0, {
      baseTransform: { x: 50, y: 0, rotation: 35, scaleX: 2, scaleY: 0.5, opacity: 1 },
    });
    const parts = [layered];
    const plan = planFlip(targetsOf(parts, ['a']), 'horizontal')!;

    expect(plan.a).toMatchObject({ rotation: -35, scaleX: -2, scaleY: 0.5 });
    // A single layer mirrors in place: the box the user sees does not move at
    // all, and the mirror is exact for the rotated, non-uniformly scaled art.
    const [before] = boxesOf(parts, ['a']);
    const [after] = boxesOf(applyPlan(parts, plan), ['a']);
    expect(after!.minX).toBeCloseTo(before!.minX, 6);
    expect(after!.maxX).toBeCloseTo(before!.maxX, 6);
    expect(after!.minY).toBeCloseTo(before!.minY, 6);
    expect(after!.maxY).toBeCloseTo(before!.maxY, 6);
  });
});

describe('planTranslate (arrow-key nudge)', () => {
  it('moves every target by the same world offset from its captured position', () => {
    const parts = [rect('a', 10, 5), rect('b', -40, 20)];
    const targets = targetsOf(parts, ['a', 'b']);
    expect(planTranslate(targets, 3, -10)).toEqual({ a: { x: 13, y: -5 }, b: { x: -37, y: 10 } });
    // The offset is the TOTAL since the start: a held key never compounds.
    expect(planTranslate(targets, 6, -10)).toEqual({ a: { x: 16, y: -5 }, b: { x: -34, y: 10 } });
  });

  it('writes only the axis that moves, and nothing for a zero offset', () => {
    const targets = targetsOf([rect('a', 10, 5)], ['a']);
    expect(planTranslate(targets, 1, 0)).toEqual({ a: { x: 11 } });
    expect(planTranslate(targets, 0, 0)).toEqual({});
  });
});

describe('collectArrangeTargets', () => {
  it('ignores ids that are not in the document and layers with no finite place', () => {
    const parts = [rect('a', 0)];
    expect(collectArrangeTargets(parts, ['a', 'ghost'], worldAt(parts)).map((target) => target.id)).toEqual(['a']);

    const broken = rect('b', 0, 0, { baseTransform: { x: Number.NaN, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } });
    expect(collectArrangeTargets([...parts, broken], ['a', 'b'], worldAt([...parts, broken])).map((target) => target.id)).toEqual(['a']);
  });
});

describe('planDistributeByGap (equal edge spacing)', () => {
  /** The gaps between consecutive boxes along the axis, in order. */
  const gapsOf = (parts: CharacterPart[], ids: string[], axis: 'horizontal' | 'vertical') => {
    const edges = boxesOf(parts, ids)
      .map((box) => (axis === 'horizontal'
        ? { lead: box!.minX, trail: box!.maxX }
        : { lead: box!.minY, trail: box!.maxY }))
      .sort((a, b) => a.lead - b.lead);
    const gaps: number[] = [];
    for (let index = 1; index < edges.length; index += 1) gaps.push(edges[index].lead - edges[index - 1].trail);
    return gaps;
  };

  it('evens three equal-size boxes’ edge gaps, holding the outer span', () => {
    const parts = [rect('a', 0), rect('b', 40), rect('c', 400)];
    const plan = planDistributeByGap(targetsOf(parts, ['a', 'b', 'c']), 'horizontal')!;

    // Only the middle box moves; the two extremes hold their outer edges.
    expect(Object.keys(plan)).toEqual(['b']);
    expect(plan.b).toEqual({ x: 200 });

    const distributed = applyPlan(parts, plan);
    expect(gapsOf(distributed, ['a', 'b', 'c'], 'horizontal')).toEqual([80, 80]);
    const boxes = boxesOf(distributed, ['a', 'b', 'c']);
    expect(boxes[0]!.minX).toBeCloseTo(-60, 6);
    expect(boxes[2]!.maxX).toBeCloseTo(460, 6);
  });

  it('is the right policy for DIFFERENT widths, where centre spacing is uneven', () => {
    // The outer boxes differ in width too (a is 120 wide, c is 60 wide).
    const parts = [
      rect('a', 0),
      rect('b', 100, 0, { baseTransform: { x: 100, y: 0, rotation: 0, scaleX: 0.5, scaleY: 1, opacity: 1 } }),
      rect('c', 400, 0, { baseTransform: { x: 400, y: 0, rotation: 0, scaleX: 0.5, scaleY: 1, opacity: 1 } }),
    ];

    const gapPlan = planDistributeByGap(targetsOf(parts, ['a', 'b', 'c']), 'horizontal')!;
    expect(gapPlan).toEqual({ b: { x: 215 } });
    expect(gapsOf(applyPlan(parts, gapPlan), ['a', 'b', 'c'], 'horizontal')).toEqual([125, 125]);

    // The centre policy spaces the CENTRES evenly, which leaves visually
    // different edge gaps — the two policies are genuinely different commands.
    const centrePlan = planDistribute(targetsOf(parts, ['a', 'b', 'c']), 'horizontal')!;
    expect(centrePlan).toEqual({ b: { x: 200 } });
    const centreGaps = gapsOf(applyPlan(parts, centrePlan), ['a', 'b', 'c'], 'horizontal');
    expect(centreGaps[0]).toBeCloseTo(110, 6);
    expect(centreGaps[1]).toBeCloseTo(140, 6);
  });

  it('evens vertical edge gaps for boxes of different heights', () => {
    const parts = [
      rect('a', 0, 0),
      rect('b', 0, 100, { baseTransform: { x: 0, y: 100, rotation: 0, scaleX: 1, scaleY: 0.5, opacity: 1 } }),
      rect('c', 0, 400),
    ];
    const plan = planDistributeByGap(targetsOf(parts, ['a', 'b', 'c']), 'vertical')!;
    expect(plan.b).toEqual({ y: 200 });
    expect(gapsOf(applyPlan(parts, plan), ['a', 'b', 'c'], 'vertical')).toEqual([155, 155]);
  });

  it('evens five irregularly placed boxes', () => {
    const parts = [rect('a', -300), rect('b', -90), rect('c', -20), rect('d', 210), rect('e', 500)];
    const plan = planDistributeByGap(targetsOf(parts, ['a', 'b', 'c', 'd', 'e']), 'horizontal')!;
    const gaps = gapsOf(applyPlan(parts, plan), ['a', 'b', 'c', 'd', 'e'], 'horizontal');
    expect(gaps).toHaveLength(4);
    gaps.forEach((gap) => expect(gap).toBeCloseTo(gaps[0], 6));
  });

  it('uses rotated layers’ evaluated world boxes', () => {
    const parts = [
      rect('a', 0),
      rect('b', 100),
      rect('c', 400, 0, { baseTransform: { x: 400, y: 0, rotation: 90, scaleX: 1, scaleY: 1, opacity: 1 } }),
    ];
    // c is 120 wide, turned 90° → it occupies a 60-wide world box: 370…430.
    const plan = planDistributeByGap(targetsOf(parts, ['a', 'b', 'c']), 'horizontal')!;
    expect(gapsOf(applyPlan(parts, plan), ['a', 'b', 'c'], 'horizontal')).toEqual([95, 95]);
  });

  it('treats a group as ONE item and an external layer as another', () => {
    const container: CharacterPart = { ...rect('g', 0), type: 'custom_freeform', isGroup: true, points: [] };
    const parts = [
      container,
      rect('c1', 0, 0, { parentId: 'g' }),
      rect('c2', 200, 0, { parentId: 'g' }),
      rect('d', 600),
      rect('e', 900),
    ];
    const plan = planDistributeByGap(targetsOf(parts, ['g', 'd', 'e']), 'horizontal')!;
    // The container is measured by the art inside it and moves as one unit.
    expect(Object.keys(plan)).toEqual(['d']);
    expect(plan.d).toEqual({ x: 550 });
    expect(gapsOf(applyPlan(parts, plan), ['g', 'd', 'e'], 'horizontal')).toEqual([230, 230]);
  });

  it('needs three measurable layers and writes nothing for an already-even row', () => {
    expect(planDistributeByGap(targetsOf([rect('a', 0), rect('b', 300)], ['a', 'b']), 'horizontal')).toBeNull();

    const even = [rect('a', 0), rect('b', 360), rect('c', 720)];
    const plan = planDistributeByGap(targetsOf(even, ['a', 'b', 'c']), 'horizontal')!;
    expect(plan).toEqual({});
  });
});
