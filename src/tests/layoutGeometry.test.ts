import { describe, expect, it } from 'vitest';
import type { CharacterPart, Transform } from '../types/animator';
import type { PartWorldBounds } from '../utils/geometry/bounds';
import { evaluateTransform } from '../utils/animation/evaluateTransform';
import { getLayerWorldBounds } from '../utils/layers/layerGrouping';
import {
  collectLayerSnapCandidates,
  collectStageSnapCandidates,
  resolveSnap,
  SNAP_THRESHOLD_SCREEN_PX,
  translateWorldBounds,
  unionWorldBounds,
  worldBoundsCenter,
  type SnapLine,
} from '../utils/geometry/layoutGeometry';

/**
 * The shared layout geometry + snapping authority, measured in world space.
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

const worldAt = (parts: CharacterPart[]) => (
  (partId: string): Transform => evaluateTransform(parts, [], 'Sequence', partId, 0)
);

const box = (minX: number, minY: number, maxX: number, maxY: number): PartWorldBounds => ({ minX, minY, maxX, maxY });

/** The stage box used throughout: a 600×480 artboard centred on the camera. */
const STAGE: PartWorldBounds = { minX: 0, minY: 0, maxX: 600, maxY: 480 };

const snap = (
  movingBounds: PartWorldBounds,
  delta: { x: number; y: number },
  candidates: SnapLine[],
  options: { thresholdWorld?: number; enabled?: boolean } = {},
) => resolveSnap({
  movingBounds,
  delta,
  candidates,
  thresholdWorld: options.thresholdWorld ?? 8,
  enabled: options.enabled ?? true,
});

describe('bounds primitives', () => {
  it('unions boxes, reads centres and shifts a box by a world delta', () => {
    const union = unionWorldBounds([box(0, 0, 10, 10), box(-4, 2, 6, 30)]);
    expect(union).toEqual({ minX: -4, minY: 0, maxX: 10, maxY: 30 });
    expect(worldBoundsCenter(union)).toEqual({ x: 3, y: 15 });
    expect(translateWorldBounds(union, { x: 5, y: -2 })).toEqual({ minX: 1, minY: -2, maxX: 15, maxY: 28 });
  });

  it('builds the six stage lines: four edges and the two centre lines', () => {
    // A stage line is a reference line: `span: null` (a guide for it spans the
    // moving item, not the artboard).
    expect(collectStageSnapCandidates(STAGE)).toEqual([
      { axis: 'x', value: 0, kind: 'stage-edge', span: null },
      { axis: 'x', value: 300, kind: 'stage-center', span: null },
      { axis: 'x', value: 600, kind: 'stage-edge', span: null },
      { axis: 'y', value: 0, kind: 'stage-edge', span: null },
      { axis: 'y', value: 240, kind: 'stage-center', span: null },
      { axis: 'y', value: 480, kind: 'stage-edge', span: null },
    ]);
  });
});

describe('resolveSnap — stage targets', () => {
  const stage = collectStageSnapCandidates(STAGE);
  const moving = box(100, 100, 160, 130); // 60×30, centre (130, 115)

  it('snaps each stage edge and both centre lines', () => {
    // Left edge → x = 0.
    expect(snap(moving, { x: -105, y: 0 }, stage).delta).toEqual({ x: -100, y: 0 });
    // Right edge → x = 600.
    expect(snap(moving, { x: 435, y: 0 }, stage).delta).toEqual({ x: 440, y: 0 });
    // Top edge → y = 0.
    expect(snap(moving, { x: 0, y: -105 }, stage).delta).toEqual({ x: 0, y: -100 });
    // Bottom edge → y = 480.
    expect(snap(moving, { x: 0, y: 345 }, stage).delta).toEqual({ x: 0, y: 350 });
    // Centre X → 300.
    expect(snap(moving, { x: 165, y: 0 }, stage).delta).toEqual({ x: 170, y: 0 });
    // Centre Y → 240.
    expect(snap(moving, { x: 0, y: 120 }, stage).delta).toEqual({ x: 0, y: 125 });
  });

  it('reports the matched line as a guide, with the band it is drawn over', () => {
    const result = snap(moving, { x: -105, y: 122 }, stage);
    expect(result.snappedX).toBe(true);
    expect(result.snappedY).toBe(true);
    // The snapped delta is { x: -100, y: 125 }, i.e. the moving box is 0…60 ×
    // 225…255 there. A stage line is a reference, so each guide carries the
    // MOVING box's band on its opposite axis — never the artboard.
    expect(result.guides).toEqual([
      { axis: 'x', value: 0, kind: 'stage-edge', extent: { min: 225, max: 255 } },
      { axis: 'y', value: 240, kind: 'stage-center', extent: { min: 0, max: 60 } },
    ]);
  });

  it('locks a corner by snapping X and Y independently on one move', () => {
    const result = snap(moving, { x: -103, y: -97 }, stage);
    expect(result.delta).toEqual({ x: -100, y: -100 });
    expect(result.guides.map((guide) => guide.axis)).toEqual(['x', 'y']);
  });

  it('leaves the delta alone when nothing is within the threshold', () => {
    const result = snap(moving, { x: 40, y: 70 }, stage);
    expect(result.delta).toEqual({ x: 40, y: 70 });
    expect(result.guides).toEqual([]);
    expect(result.snappedX).toBe(false);
    expect(result.snappedY).toBe(false);
  });

  it('suspends entirely when snapping is disabled', () => {
    const result = snap(moving, { x: -105, y: 122 }, stage, { enabled: false });
    expect(result.delta).toEqual({ x: -105, y: 122 });
    expect(result.guides).toEqual([]);
  });

  it('breaks an exact tie by the candidate order, so the plan is deterministic', () => {
    // Two lines exactly 4 away on either side of the moving left edge (100).
    const candidates: SnapLine[] = [
      { axis: 'x', value: 104, kind: 'layer-edge', span: { min: 100, max: 130 } },
      { axis: 'x', value: 96, kind: 'layer-edge', span: { min: 100, max: 130 } },
    ];
    expect(snap(moving, { x: 0, y: 0 }, candidates).delta.x).toBe(4);
    expect(snap(moving, { x: 0, y: 0 }, [...candidates].reverse()).delta.x).toBe(-4);
  });
});

describe('resolveSnap — threshold is a screen radius', () => {
  const moving = box(100, 100, 160, 130);
  // A candidate 20 world units from the moving left edge.
  const candidates: SnapLine[] = [
    { axis: 'x', value: 80, kind: 'layer-edge', span: { min: 100, max: 130 } },
  ];
  const thresholdWorldAt = (zoom: number) => SNAP_THRESHOLD_SCREEN_PX / (zoom * 1);

  it('snaps from farther away when zoomed out, never when zoomed in past the radius', () => {
    // 25%: 8px is 32 world units → the 20-unit candidate reaches.
    expect(snap(moving, { x: 0, y: 0 }, candidates, { thresholdWorld: thresholdWorldAt(0.25) }).delta.x).toBe(-20);
    // 100%: 8px is 8 world units → the same candidate is out of reach.
    expect(snap(moving, { x: 0, y: 0 }, candidates, { thresholdWorld: thresholdWorldAt(1) }).delta.x).toBe(0);
    // 400%: 8px is 2 world units → still out of reach.
    expect(snap(moving, { x: 0, y: 0 }, candidates, { thresholdWorld: thresholdWorldAt(4) }).delta.x).toBe(0);
  });
});

describe('collectLayerSnapCandidates', () => {
  const visible = () => true;

  it('offers edges and centre of another layer, measured in world space', () => {
    const parts = [rect('a', 0), rect('b', 400)];
    const lines = collectLayerSnapCandidates({ parts, movingIds: ['a'], worldOf: worldAt(parts), isVisible: visible });
    // Layer b is at x = 400 with the shape box −60…60 → 340…460, centre 400. Each
    // line carries the band ITS box covers on the opposite axis (−30…30 both ways).
    expect(lines).toEqual([
      { axis: 'x', value: 340, kind: 'layer-edge', span: { min: -30, max: 30 } },
      { axis: 'x', value: 400, kind: 'layer-center', span: { min: -30, max: 30 } },
      { axis: 'x', value: 460, kind: 'layer-edge', span: { min: -30, max: 30 } },
      { axis: 'y', value: -30, kind: 'layer-edge', span: { min: 340, max: 460 } },
      { axis: 'y', value: 0, kind: 'layer-center', span: { min: 340, max: 460 } },
      { axis: 'y', value: 30, kind: 'layer-edge', span: { min: 340, max: 460 } },
    ]);
  });

  it('measures a rotated layer by its evaluated world box, not its local extent', () => {
    const tilted = rect('b', 400, 0, { baseTransform: { x: 400, y: 0, rotation: 90, scaleX: 1, scaleY: 1, opacity: 1 } });
    const parts = [rect('a', 0), tilted];
    const lines = collectLayerSnapCandidates({ parts, movingIds: ['a'], worldOf: worldAt(parts), isVisible: visible });
    // 120×60 turned 90° is a 60-wide box: 370…430.
    expect(lines[0]).toEqual({ axis: 'x', value: 370, kind: 'layer-edge', span: { min: -60, max: 60 } });
    expect(lines[2]).toEqual({ axis: 'x', value: 430, kind: 'layer-edge', span: { min: -60, max: 60 } });
  });

  it('represents a group by its aggregate box and hides its children', () => {
    const container: CharacterPart = { ...rect('g', 0), type: 'custom_freeform', isGroup: true, points: [] };
    const parts = [container, rect('c1', 0, 0, { parentId: 'g' }), rect('c2', 200, 0, { parentId: 'g' })];
    const lines = collectLayerSnapCandidates({ parts, movingIds: ['other'], worldOf: worldAt(parts), isVisible: visible });
    // One item only: the group's aggregate −60…260, centre 100.
    expect(lines.filter((line) => line.axis === 'x').map((line) => line.value)).toEqual([-60, 100, 260]);
  });

  it('never offers the moving layer, nor a descendant of a moving container', () => {
    const container: CharacterPart = { ...rect('g', 0), type: 'custom_freeform', isGroup: true, points: [] };
    const parts = [container, rect('c1', 0, 0, { parentId: 'g' }), rect('c2', 200, 0, { parentId: 'g' })];
    expect(collectLayerSnapCandidates({ parts, movingIds: ['g'], worldOf: worldAt(parts), isVisible: visible })).toEqual([]);
    expect(collectLayerSnapCandidates({ parts, movingIds: ['c1', 'c2'], worldOf: worldAt(parts), isVisible: visible })).toEqual([]);
  });

  it('skips hidden and unmeasurable layers', () => {
    const empty: CharacterPart = { ...rect('empty', 0), type: 'custom_freeform', isGroup: true, points: [] };
    const parts = [empty, rect('hidden', 400)];
    const lines = collectLayerSnapCandidates({
      parts,
      movingIds: ['other'],
      worldOf: worldAt(parts),
      isVisible: (part) => part.id !== 'hidden',
    });
    expect(lines).toEqual([]);
  });

  it('snaps a moved item to another layer edge-to-edge and centre-to-centre', () => {
    const parts = [rect('a', 0), rect('b', 400)];
    const candidates = collectLayerSnapCandidates({ parts, movingIds: ['a'], worldOf: worldAt(parts), isVisible: visible });
    const moving = getLayerWorldBounds(parts, 'a', worldAt(parts))!; // −60…60 × −30…30

    // Left edge onto the other layer's right edge (460): delta 520 lands -60+520=460.
    expect(snap(moving, { x: 522, y: 0 }, candidates).delta).toEqual({ x: 520, y: 0 });
    // Centre onto the other layer's centre (400).
    expect(snap(moving, { x: 396, y: 0 }, candidates).delta).toEqual({ x: 400, y: 0 });
    // Horizontally: the moving centre Y onto the other centre Y (0).
    expect(snap(moving, { x: 0, y: 5 }, candidates).delta).toEqual({ x: 0, y: 0 });
  });
});

describe('guide extents', () => {
  // The moving layer is the 120×60 shape box at the origin (−60…60 × −30…30).
  // The other layer is 200 wide (scaleX 5/3) and twice as tall (scaleY 2) at
  // (500, 100): its box is 400…600 × 40…160. Its height differs from the moving
  // box's, so an edge lock and a centre lock never coincide.
  const parts = [rect('a', 0), rect('b', 500, 100, {
    baseTransform: { x: 500, y: 100, rotation: 0, scaleX: 5 / 3, scaleY: 2, opacity: 1 },
  })];
  const candidates = collectLayerSnapCandidates({
    parts,
    movingIds: ['a'],
    worldOf: worldAt(parts),
    isVisible: () => true,
  });
  const moving = getLayerWorldBounds(parts, 'a', worldAt(parts))!;

  it('bridges the moving box and the matched box, and stops at both', () => {
    // The moving left edge, 2 units short of 400, lands on the other layer's LEFT
    // edge: delta 460. The band runs from the moving box's top (−30) to the matched
    // box's bottom (160) — the relation, not the canvas.
    const horizontally = snap(moving, { x: 458, y: 0 }, candidates);
    expect(horizontally.delta).toEqual({ x: 460, y: 0 });
    expect(horizontally.guides).toEqual([
      { axis: 'x', value: 400, kind: 'layer-edge', extent: { min: -30, max: 160 } },
    ]);

    // The same rule on the other axis: the moving box's own band (−60…60) widened
    // to the matched box's band (400…600).
    const vertically = snap(moving, { x: 0, y: 103 }, candidates);
    expect(vertically.delta).toEqual({ x: 0, y: 100 });
    expect(vertically.guides).toEqual([
      { axis: 'y', value: 100, kind: 'layer-center', extent: { min: -60, max: 600 } },
    ]);
  });

  it('measures the band from the box the snap COMMITS, not from the pointer delta', () => {
    // A 300-tall moving box (−150…150) whose centre line is 8 units from the
    // target's, so BOTH axes snap on one move: X by +2 onto 400, Y by +8. The X
    // guide's band has to cover the moving box where it is DRAWN (−142…158), not
    // where the raw pointer delta would have put it (−150…150).
    const parts2 = [
      rect('a2', 0, 0, { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 5, opacity: 1 } }),
      rect('b2', 400, 158, {
        baseTransform: { x: 400, y: 158, rotation: 0, scaleX: 5 / 3, scaleY: 1, opacity: 1 },
      }),
    ];
    const candidates2 = collectLayerSnapCandidates({
      parts: parts2,
      movingIds: ['a2'],
      worldOf: worldAt(parts2),
      isVisible: () => true,
    });
    const moving2 = getLayerWorldBounds(parts2, 'a2', worldAt(parts2))!;

    const result = snap(moving2, { x: 402, y: 0 }, candidates2);
    expect(result.delta).toEqual({ x: 400, y: 8 });
    expect(result.guides).toEqual([
      { axis: 'x', value: 400, kind: 'layer-center', extent: { min: -142, max: 188 } },
      { axis: 'y', value: 158, kind: 'layer-center', extent: { min: 300, max: 500 } },
    ]);
  });
});
