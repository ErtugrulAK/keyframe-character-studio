import { describe, it, expect } from 'vitest';
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import type { CharacterPart, Track, Transform } from '../types/animator';
import { evaluateTransform } from '../utils/evaluateTransform';
import { getGroupAggregateBounds } from '../utils/layerGrouping';
import { getPartLocalBounds, getPartWorldBounds } from '../utils/bounds';
import { resolveCornerResize, resolveEdgeResize, type CornerBounds } from '../utils/cornerResize';
import { affineOfTransform, affineSvgTransform, applyAffine, composeWorldTransform, worldAffineOf, type WorldAffine } from '../utils/containerMath';
import { useInspector } from '../hooks/useInspector';
import { useHistory, type HistoryDocumentState } from '../hooks/useHistory';

/**
 * GROUP RESIZE — the reported failure, and the contract that must hold.
 *
 * Repro (user): a group holding a rectangle rotated 90°, one rotated 30° and one
 * unrotated. Dragging the group frame's right edge mapped the frame correctly but
 * stretched the content along each child's OWN axis — the 90° child grew
 * vertically ("upward stretch"), the 30° child along its own diagonal.
 *
 * Cause: the ancestor's anisotropic scale was folded into the child's local axes
 * (rotation adds, scales multiply). The exact nesting `R(θg)·S(sg)·R(θc)·S(sc)`
 * is a general 2×2 (sheared), carried as the DERIVED world affine.
 *
 * The contract asserted here, for every handle and every child rotation: the
 * content is mapped by the frame's own affine — old content box in the group's
 * frame → new content box, opposite edge exactly fixed, each child's authored
 * rotation/TRS left untouched (the shear is derived at evaluation, never written).
 */

const TRS = (over: Partial<Transform> = {}): Transform => ({
  x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, ...over,
});

const rect = (id: string, parentId: string, over: Partial<Transform>): CharacterPart => ({
  id,
  type: 'custom_rect',
  name: id,
  zIndex: 1,
  width: 100,
  height: 60,
  baseTransform: TRS(over),
  parentId,
} as unknown as CharacterPart);

const container = (id: string, parentId?: string, over: Partial<Transform> = {}): CharacterPart => ({
  id,
  type: 'custom_freeform',
  name: id,
  zIndex: 0,
  isGroup: true,
  points: [],
  baseTransform: TRS(over),
  ...(parentId ? { parentId } : {}),
} as unknown as CharacterPart);

/** The user's repro scene, plus the reported 90°/30° rotations. */
const SCENE: CharacterPart[] = [
  container('g'),
  rect('r90', 'g', { x: -120, rotation: 90 }),
  rect('r30', 'g', { x: 0, rotation: 30 }),
  rect('r0', 'g', { x: 120, rotation: 0 }),
];

const worldOf = (parts: CharacterPart[], id: string): Transform =>
  evaluateTransform(parts, [], 'Sequence', id, 0) as Transform;

const groupLocalBounds = (parts: CharacterPart[], groupId: string): CornerBounds =>
  getGroupAggregateBounds(parts, groupId, (id) => worldOf(parts, id))!;

const contentAabb = (parts: CharacterPart[], ids: string[]) => {
  const boxes = ids.map((id) => getPartWorldBounds(parts.find((p) => p.id === id)!, worldOf(parts, id), 0, 0));
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
};

const aabbOfMappedBox = (affine: WorldAffine, box: CornerBounds) => {
  const corners = [
    { x: box.minX, y: box.minY }, { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY }, { x: box.minX, y: box.maxY },
  ].map((corner) => applyAffine(affine, corner));
  return {
    minX: Math.min(...corners.map((c) => c.x)),
    maxX: Math.max(...corners.map((c) => c.x)),
    minY: Math.min(...corners.map((c) => c.y)),
    maxY: Math.max(...corners.map((c) => c.y)),
  };
};

/** The write authority's own contract: a root container takes the patch as its authored TRS. */
const applyContainerPatch = (parts: CharacterPart[], groupId: string, patch: Partial<Transform>): CharacterPart[] =>
  parts.map((part) => (part.id === groupId ? { ...part, baseTransform: { ...part.baseTransform, ...patch } } : part));

/** Exact affine mapping, compared within float tolerance on both sides. */
const expectBoxClose = (
  actual: { minX: number; maxX: number; minY: number; maxY: number },
  expected: { minX: number; maxX: number; minY: number; maxY: number },
) => {
  expect(actual.minX).toBeCloseTo(expected.minX, 6);
  expect(actual.maxX).toBeCloseTo(expected.maxX, 6);
  expect(actual.minY).toBeCloseTo(expected.minY, 6);
  expect(actual.maxY).toBeCloseTo(expected.maxY, 6);
};

const edgeDrag = (
  parts: CharacterPart[],
  groupId: string,
  edge: 'right' | 'left' | 'top' | 'bottom',
  travel: number,
  axis: 'x' | 'y',
) => {
  const bounds = groupLocalBounds(parts, groupId);
  const groupWorld = worldOf(parts, groupId);
  const start = {
    x: groupWorld.x + ((edge === 'left' ? bounds.minX : edge === 'right' ? bounds.maxX : (bounds.minX + bounds.maxX) / 2)),
    y: groupWorld.y + ((edge === 'top' ? bounds.minY : edge === 'bottom' ? bounds.maxY : (bounds.minY + bounds.maxY) / 2)),
  };
  const pointer = { x: start.x + (axis === 'x' ? travel : 0), y: start.y + (axis === 'y' ? travel : 0) };
  return resolveEdgeResize({ transform: groupWorld, bounds, edge, startPointer: start, pointer });
};

const cornerDrag = (parts: CharacterPart[], groupId: string, corner: 'tl' | 'tr' | 'bl' | 'br', dx: number, dy: number) => {
  const bounds = groupLocalBounds(parts, groupId);
  const groupWorld = worldOf(parts, groupId);
  const isLeft = corner === 'tl' || corner === 'bl';
  const isTop = corner === 'tl' || corner === 'tr';
  const start = {
    x: groupWorld.x + (isLeft ? bounds.minX : bounds.maxX),
    y: groupWorld.y + (isTop ? bounds.minY : bounds.maxY),
  };
  return resolveCornerResize({
    transform: groupWorld,
    bounds,
    corner,
    startPointer: start,
    pointer: { x: start.x + dx, y: start.y + dy },
  });
};

const CHILD_IDS = ['r90', 'r30', 'r0'];

describe('group resize — content follows the frame affine for every handle', () => {
  it('right-edge drag maps the reported 90° and 30° children onto the new box, never upward', () => {
    const before = contentAabb(SCENE, CHILD_IDS);
    const frameBefore = groupLocalBounds(SCENE, 'g');
    expect(before).toEqual({ minX: -150, maxX: 180, minY: -60, maxY: 60 });

    const patch = edgeDrag(SCENE, 'g', 'right', 100, 'x');
    const after = applyContainerPatch(SCENE, 'g', patch);
    const groupAfter = worldOf(after, 'g');
    const expected = aabbOfMappedBox(worldAffineOf(groupAfter), frameBefore);

    expectBoxClose(contentAabb(after, CHILD_IDS), expected);
    // The drag asked for +100 of frame width, with the opposite (left) edge fixed.
    expect(expected.maxX - expected.minX).toBeCloseTo(330 + 100, 6);
    expect(expected.minX).toBeCloseTo(-150, 9);
    // The reported symptom: the content must NOT grow vertically.
    expect(expected.maxY - expected.minY).toBeCloseTo(120, 9);
    expectBoxClose(contentAabb(after, CHILD_IDS), { minX: -150, maxX: 280, minY: -60, maxY: 60 });
  });

  it.each([
    ['left', 'x' as const, -100],
    ['right', 'x' as const, 100],
    ['top', 'y' as const, -80],
    ['bottom', 'y' as const, 80],
  ] as const)('%s edge drag keeps the opposite edge fixed and maps the content exactly', (edge, axis, travel) => {
    const frameBefore = groupLocalBounds(SCENE, 'g');
    const before = contentAabb(SCENE, CHILD_IDS);
    const groupBefore = worldOf(SCENE, 'g');
    const oppositeBefore = axis === 'x'
      ? (edge === 'left' ? before.maxX : before.minX)
      : (edge === 'top' ? before.maxY : before.minY);

    const after = applyContainerPatch(SCENE, 'g', edgeDrag(SCENE, 'g', edge, travel, axis));
    const expected = aabbOfMappedBox(worldAffineOf(worldOf(after, 'g')), frameBefore);
    expectBoxClose(contentAabb(after, CHILD_IDS), expected);

    const oppositeAfter = axis === 'x'
      ? (edge === 'left' ? expected.maxX : expected.minX)
      : (edge === 'top' ? expected.maxY : expected.minY);
    expect(oppositeAfter).toBeCloseTo(oppositeBefore, 9);
    // The dragged edge really moved by the pointer travel (no both-sides growth).
    const spanBefore = axis === 'x' ? before.maxX - before.minX : before.maxY - before.minY;
    const spanAfter = axis === 'x' ? expected.maxX - expected.minX : expected.maxY - expected.minY;
    // Dragging an edge outwards always grows the span by the pointer travel,
    // whichever side was grabbed.
    expect(spanAfter).toBeCloseTo(spanBefore + Math.abs(travel), 6);
    expect(groupBefore.rotation).toBe(0);
  });

  it('corner drag maps the content exactly and preserves the diagonally opposite corner', () => {
    const frameBefore = groupLocalBounds(SCENE, 'g');
    const edgeBefore = worldOf(SCENE, 'g');
    const fixedWorld = applyAffine(worldAffineOf(edgeBefore), { x: frameBefore.minX, y: frameBefore.minY });

    const after = applyContainerPatch(SCENE, 'g', cornerDrag(SCENE, 'g', 'br', 120, 40));
    const expected = aabbOfMappedBox(worldAffineOf(worldOf(after, 'g')), frameBefore);
    expectBoxClose(contentAabb(after, CHILD_IDS), expected);

    const fixedAfter = applyAffine(worldAffineOf(worldOf(after, 'g')), { x: frameBefore.minX, y: frameBefore.minY });
    expect(fixedAfter.x).toBeCloseTo(fixedWorld.x, 9);
    expect(fixedAfter.y).toBeCloseTo(fixedWorld.y, 9);
  });

  it('keeps every child authored TRS untouched (the shear is derived, never written)', () => {
    const after = applyContainerPatch(SCENE, 'g', edgeDrag(SCENE, 'g', 'right', 100, 'x'));
    CHILD_IDS.forEach((id) => {
      expect(after.find((p) => p.id === id)!.baseTransform)
        .toEqual(SCENE.find((p) => p.id === id)!.baseTransform);
    });
    // ...while their evaluated world maps carry the rotated-child shear.
    expect(worldOf(after, 'r30')).toMatchObject({ rotation: 30 });
    expect((worldOf(after, 'r30') as Transform & { affine?: WorldAffine }).affine).toBeDefined();
    expect((worldOf(after, 'r0') as Transform & { affine?: WorldAffine }).affine).toBeUndefined();
  });

  it('rotation is preserved for a rotated container and the fixed edge stays put', () => {
    const scene = [
      container('g', undefined, { rotation: 25, x: 40, y: -10 }),
      ...CHILD_IDS.map((id) => ({ ...SCENE.find((p) => p.id === id)! })),
    ];
    const frameBefore = groupLocalBounds(scene, 'g');
    const fixedBefore = applyAffine(worldAffineOf(worldOf(scene, 'g')), { x: frameBefore.minX, y: frameBefore.minY });
    const after = applyContainerPatch(scene, 'g', edgeDrag(scene, 'g', 'right', 90, 'x'));

    expect(worldOf(after, 'g').rotation).toBe(25);
    const fixedAfter = applyAffine(worldAffineOf(worldOf(after, 'g')), { x: frameBefore.minX, y: frameBefore.minY });
    expect(fixedAfter.x).toBeCloseTo(fixedBefore.x, 9);
    expect(fixedAfter.y).toBeCloseTo(fixedBefore.y, 9);
    CHILD_IDS.forEach((id) => expect(worldOf(after, id).rotation).toBeCloseTo(worldOf(scene, id).rotation, 9));
  });

  it('nests exactly: an inner container\'s children follow the outer frame', () => {
    const scene: CharacterPart[] = [
      container('g'),
      container('i', 'g', { x: -40 }),
      rect('n30', 'i', { x: 20, rotation: 30 }),
      rect('n0', 'i', { x: 90, rotation: 0 }),
    ];
    const frameBefore = groupLocalBounds(scene, 'g');
    const after = applyContainerPatch(scene, 'g', edgeDrag(scene, 'g', 'right', 100, 'x'));
    const expected = aabbOfMappedBox(worldAffineOf(worldOf(after, 'g')), frameBefore);
    expectBoxClose(contentAabb(after, ['n30', 'n0']), expected);
    expect(worldOf(after, 'i').rotation).toBe(0);
    expect(worldOf(after, 'n30').rotation).toBe(30);
  });

  it('crosses zero with a mirrored container without moving the anchor', () => {
    const scene = [
      container('g', undefined, { scaleX: -1 }),
      ...CHILD_IDS.map((id) => ({ ...SCENE.find((p) => p.id === id)!, baseTransform: TRS(SCENE.find((p) => p.id === id)!.baseTransform as Partial<Transform>) })),
    ];
    const frameBefore = groupLocalBounds(scene, 'g');
    // The 'right' handle is the local maxX edge, which a mirrored container puts
    // on the world LEFT; the fixed point of the gesture is the local minX edge.
    const anchorBefore = applyAffine(worldAffineOf(worldOf(scene, 'g')), { x: frameBefore.minX, y: (frameBefore.minY + frameBefore.maxY) / 2 });
    const after = applyContainerPatch(scene, 'g', edgeDrag(scene, 'g', 'right', 260, 'x'));
    const groupAfter = worldOf(after, 'g');
    expect(groupAfter.scaleX).toBeLessThan(0);

    const anchorAfter = applyAffine(worldAffineOf(groupAfter), { x: frameBefore.minX, y: (frameBefore.minY + frameBefore.maxY) / 2 });
    expect(anchorAfter.x).toBeCloseTo(anchorBefore.x, 9);
    expect(anchorAfter.y).toBeCloseTo(anchorBefore.y, 9);
    expectBoxClose(contentAabb(after, CHILD_IDS), aabbOfMappedBox(worldAffineOf(groupAfter), frameBefore));
  });
});

describe('group resize — the old fold law is pinned as the failure it was', () => {
  it('upward stretch: folding the container into the child axes reports a taller, shifted box', () => {
    const after = applyContainerPatch(SCENE, 'g', edgeDrag(SCENE, 'g', 'right', 100, 'x'));
    const r90 = after.find((p) => p.id === 'r90')!;
    const localBounds = getPartLocalBounds(r90, TRS());

    // The previous law: parent scale multiplied into the child's OWN axes.
    const foldWorld = composeWorldTransform(worldOf(after, 'g'), r90.baseTransform);
    const foldBox = aabbOfMappedBox(affineOfTransform(foldWorld), localBounds);

    // The reported symptom, exactly: the 100-tall rotated child grew about 30
    // vertically, and the content box shifted off the fixed edge instead of
    // following the frame's horizontal stretch.
    const k = 1 + 100 / 330;
    const exactBox = getPartWorldBounds(r90, worldOf(after, 'r90'), 0, 0);

    // The fold stretches the child's OWN X axis (its width) — which a 90° child
    // points along world Y — so its world height is exactly k times the exact
    // box's and its width exactly 1/k: the wrong axis, the upward stretch.
    expect((foldBox.maxY - foldBox.minY) / (exactBox.maxY - exactBox.minY)).toBeCloseTo(k, 9);
    expect((foldBox.maxX - foldBox.minX) / (exactBox.maxX - exactBox.minX)).toBeCloseTo(1 / k, 9);
    // ...and it also leaves the opposite (fixed) edge instead of following the frame.
    expect(foldBox.minX).toBeGreaterThan(exactBox.minX);
    expect(foldBox.minX).toBeCloseTo(-140.9090909090909, 6);
    expect(exactBox.minX).toBeCloseTo(-150, 6);
    expect(exactBox).not.toEqual(foldBox);
  });
});

describe('group resize — transform emission', () => {
  const svgFor = (parts: CharacterPart[], id: string) => {
    const world = worldOf(parts, id) as Transform & { affine?: WorldAffine };
    return affineSvgTransform(worldAffineOf(world), world, { x: 0, y: 0 });
  };

  /** `translate(x, y) rotate(r) scale(sx, sy)` → its numbers, or null. */
  const parseTrsEmission = (attribute: string) => {
    const match = /^translate\(([-\d.e]+), ([-\d.e]+)\) rotate\(([-\d.e]+)\) scale\(([-\d.e]+), ([-\d.e]+)\)$/.exec(attribute);
    return match ? { x: +match[1], y: +match[2], rotation: +match[3], scaleX: +match[4], scaleY: +match[5] } : null;
  };

  it('keeps the historical TRS spelling while the map is a TRS, and becomes exact matrix() after the drag', () => {
    expect(svgFor(SCENE, 'r0')).toBe('translate(120, 0) rotate(0) scale(1, 1)');
    expect(svgFor(SCENE, 'r30')).toBe('translate(0, 0) rotate(30) scale(1, 1)');

    const after = applyContainerPatch(SCENE, 'g', edgeDrag(SCENE, 'g', 'right', 100, 'x'));
    const k = 1 + 100 / 330;

    // Unrotated content is still a plain TRS: the same spelling, the new scale.
    const plain = parseTrsEmission(svgFor(after, 'r0'))!;
    expect(plain.rotation).toBeCloseTo(0, 9);
    expect(plain.scaleX).toBeCloseTo(k, 9);
    expect(plain.scaleY).toBeCloseTo(1, 9);
    expect(plain.x).toBeCloseTo(45.45454545454544 + 120 * k, 6);
    // A 90° child is represented exactly by an axis swap (no shear): still a TRS.
    const swapped = parseTrsEmission(svgFor(after, 'r90'))!;
    expect(swapped.rotation).toBeCloseTo(90, 9);
    expect(swapped.scaleX).toBeCloseTo(1, 9);
    expect(swapped.scaleY).toBeCloseTo(k, 9);
    expect(swapped.x).toBeCloseTo(45.45454545454544 - 120 * k, 6);
    // A 30° child genuinely shears: the exact map is emitted as matrix().
    expect(svgFor(after, 'r30')).toContain('matrix(');
  });
});

describe('group resize — undo/redo through the real write and history authorities', () => {
  const DOCUMENT: HistoryDocumentState = {
    fps: 30,
    totalFrames: 60,
    projectResolution: { width: 1920, height: 1080 },
    coordinateSystem: 'project-unit-center-v1',
    sceneTitle: 'Group resize',
    activeTemplateId: 'Sequence',
  };

  const trackFor = (partId: string): Track => ({
    id: `track_${partId}`,
    partId,
    name: partId,
    color: '#22d3ee',
    keyframes: [],
    channels: {},
    visible: true,
    locked: false,
  } as unknown as Track);

  /** The canvas sequence for a group frame drag: batch → live writes → pointer-up. */
  const mountCanvas = (initialParts: CharacterPart[]) => renderHook(() => {
    const [tracks, setTracks] = React.useState<Track[]>(initialParts.map((p) => trackFor(p.id)));
    const [characterParts, setCharacterParts] = React.useState(initialParts);
    const tracksRef = React.useRef(tracks);
    const characterPartsRef = React.useRef(characterParts);
    tracksRef.current = tracks;
    characterPartsRef.current = characterParts;

    const getComputedTransform = (partId: string, frame: number): Transform =>
      evaluateTransform(characterPartsRef.current, tracksRef.current, 'Sequence', partId, frame) as Transform;

    const inspector = useInspector({
      selectedPartId: 'g',
      selectedPartIds: ['g'],
      activeTemplateId: 'Sequence',
      currentFrame: 0,
      tracks,
      characterParts,
      setTracks,
      setCharacterParts,
      getComputedTransform,
    });

    const history = useHistory({
      tracks,
      setTracks,
      tracksRef,
      characterParts,
      setCharacterParts,
      characterPartsRef,
      documentState: DOCUMENT,
      restoreDocumentState: () => {},
    });

    /** One live drag sample of the group frame's right edge, solved in world space. */
    const dragRightEdge = (travel: number) => {
      const groupWorld = getComputedTransform('g', 0);
      const bounds = getGroupAggregateBounds(characterPartsRef.current, 'g', (id) => getComputedTransform(id, 0))!;
      const startPointer = {
        x: groupWorld.x + bounds.maxX,
        y: groupWorld.y + (bounds.minY + bounds.maxY) / 2,
      };
      const patch = resolveEdgeResize({
        transform: groupWorld,
        bounds,
        edge: 'right',
        startPointer,
        pointer: { x: startPointer.x + travel, y: startPointer.y },
      });
      inspector.updateCurrentTransform(patch);
    };

    return { tracks, characterParts, history, dragRightEdge, getComputedTransform, inspector };
  });

  it('translates a deep affine child and its bonded partner without jumping, with exact history', () => {
    const parts = [
      container('g', undefined, { x: -70, y: 20, rotation: 25, scaleX: 1.6, scaleY: 0.7 }),
      container('i', 'g', { x: 45, y: -18, rotation: 30 }),
      { ...rect('a', 'i', { x: 40, y: 15, rotation: 15 }), boundPartIds: ['b'] },
      rect('b', 'i', { x: -100, y: 50, rotation: -20 }),
    ];
    const { result } = mountCanvas(parts);
    const before = JSON.stringify({ tracks: result.current.tracks, parts: result.current.characterParts });
    const a = result.current.getComputedTransform('a', 0);
    const aMap = worldAffineOf(a);
    const bMap = worldAffineOf(result.current.getComputedTransform('b', 0));
    expect(a.x).toBeCloseTo(aMap.e, 9);
    expect(a.y).toBeCloseTo(aMap.f, 9);
    act(() => { result.current.history.startBatchInteraction(); });
    act(() => { result.current.inspector.updateCurrentTransform({ x: a.x + 35, y: a.y - 20 }, 'a'); });
    act(() => { result.current.history.endBatchInteraction(); });
    const movedA = worldAffineOf(result.current.getComputedTransform('a', 0));
    const movedB = worldAffineOf(result.current.getComputedTransform('b', 0));
    expect(movedA.e).toBeCloseTo(aMap.e + 35, 9);
    expect(movedA.f).toBeCloseTo(aMap.f - 20, 9);
    expect(movedB.e).toBeCloseTo(bMap.e + 35, 9);
    expect(movedB.f).toBeCloseTo(bMap.f - 20, 9);
    expect(result.current.characterParts.find((part) => part.id === 'a')!.baseTransform.rotation).toBe(15);
    const after = JSON.stringify({ tracks: result.current.tracks, parts: result.current.characterParts });
    act(() => { result.current.history.undo(); });
    expect(JSON.stringify({ tracks: result.current.tracks, parts: result.current.characterParts })).toBe(before);
    act(() => { result.current.history.redo(); });
    expect(JSON.stringify({ tracks: result.current.tracks, parts: result.current.characterParts })).toBe(after);
  });

  it('one gesture is one undo step, and undo restores the authored scene exactly', () => {
    const { result } = mountCanvas(SCENE.map((part) => ({ ...part })));
    const before = JSON.stringify({ tracks: result.current.tracks, parts: result.current.characterParts });

    act(() => {
      result.current.history.startBatchInteraction();
      result.current.dragRightEdge(60);
      result.current.dragRightEdge(100);
      result.current.history.endBatchInteraction();
    });

    const after = JSON.stringify({ tracks: result.current.tracks, parts: result.current.characterParts });
    expect(after).not.toBe(before);
    expect(result.current.history.canUndo).toBe(true);

    // The group's authored TRS is the only thing the gesture wrote; the children
    // stay byte-identical and their new world maps are derived again on read.
    expect(JSON.stringify(result.current.characterParts.filter((p) => p.id !== 'g')))
      .toBe(JSON.stringify(SCENE.filter((p) => p.id !== 'g')));

    act(() => {
      result.current.history.undo();
    });
    expect(JSON.stringify({ tracks: result.current.tracks, parts: result.current.characterParts })).toBe(before);
    expect(result.current.history.canUndo).toBe(false);

    act(() => {
      result.current.history.redo();
    });
    expect(JSON.stringify({ tracks: result.current.tracks, parts: result.current.characterParts })).toBe(after);
  });
});
