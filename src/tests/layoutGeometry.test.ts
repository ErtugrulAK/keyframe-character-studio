import { describe, expect, it } from 'vitest';
import type { CharacterPart, Transform } from '../types/animator';
import type { PartWorldBounds } from '../utils/bounds';
import { evaluateTransform } from '../utils/evaluateTransform';
import { getLayerWorldBounds } from '../utils/layerGrouping';
import {
  collectLayerSnapCandidates,
  collectStageSnapCandidates,
  resolveSnap,
  SNAP_THRESHOLD_SCREEN_PX,
  translateWorldBounds,
  unionWorldBounds,
  worldBoundsCenter,
  type SnapLine,
} from '../utils/layoutGeometry';

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
    expect(collectStageSnapCandidates(STAGE)).toEqual([
      { axis: 'x', value: 0, kind: 'stage-edge' },
      { axis: 'x', value: 300, kind: 'stage-center' },
      { axis: 'x', value: 600, kind: 'stage-edge' },
      { axis: 'y', value: 0, kind: 'stage-edge' },
      { axis: 'y', value: 240, kind: 'stage-center' },
      { axis: 'y', value: 480, kind: 'stage-edge' },
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

  it('reports the matched line as a guide and which axes snapped', () => {
    const result = snap(moving, { x: -105, y: 122 }, stage);
    expect(result.snappedX).toBe(true);
    expect(result.snappedY).toBe(true);
    expect(result.guides).toEqual([
      { axis: 'x', value: 0, kind: 'stage-edge' },
      { axis: 'y', value: 240, kind: 'stage-center' },
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
      { axis: 'x', value: 104, kind: 'layer-edge' },
      { axis: 'x', value: 96, kind: 'layer-edge' },
    ];
    expect(snap(moving, { x: 0, y: 0 }, candidates).delta.x).toBe(4);
    expect(snap(moving, { x: 0, y: 0 }, [...candidates].reverse()).delta.x).toBe(-4);
  });
});

describe('resolveSnap — threshold is a screen radius', () => {
  const moving = box(100, 100, 160, 130);
  // A candidate 20 world units from the moving left edge.
  const candidates: SnapLine[] = [
    { axis: 'x', value: 80, kind: 'layer-edge' },
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
    // Layer b is at x = 400 with the shape box −60…60 → 340…460, centre 400.
    expect(lines).toEqual([
      { axis: 'x', value: 340, kind: 'layer-edge' },
      { axis: 'x', value: 400, kind: 'layer-center' },
      { axis: 'x', value: 460, kind: 'layer-edge' },
      { axis: 'y', value: -30, kind: 'layer-edge' },
      { axis: 'y', value: 0, kind: 'layer-center' },
      { axis: 'y', value: 30, kind: 'layer-edge' },
    ]);
  });

  it('measures a rotated layer by its evaluated world box, not its local extent', () => {
    const tilted = rect('b', 400, 0, { baseTransform: { x: 400, y: 0, rotation: 90, scaleX: 1, scaleY: 1, opacity: 1 } });
    const parts = [rect('a', 0), tilted];
    const lines = collectLayerSnapCandidates({ parts, movingIds: ['a'], worldOf: worldAt(parts), isVisible: visible });
    // 120×60 turned 90° is a 60-wide box: 370…430.
    expect(lines[0]).toEqual({ axis: 'x', value: 370, kind: 'layer-edge' });
    expect(lines[2]).toEqual({ axis: 'x', value: 430, kind: 'layer-edge' });
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
