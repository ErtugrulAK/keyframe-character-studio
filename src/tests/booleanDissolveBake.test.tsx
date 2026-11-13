import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterPart, Track } from '../types/animator';
import { makeEmptyChannels } from '../utils/animation/defaults';
import { evaluateTransform } from '../utils/animation/evaluateTransform';
import { worldAffineOf } from '../utils/geometry/containerMath';

/**
 * Dissolving a Boolean bakes each operand's world pose into its own base
 * transform. The world value the editor reads also carries evaluator-only
 * fields (the mask transform defaults, the legacy mask, and — for a sheared
 * nesting — a derived `affine`). None of them may be stored: a stored
 * `affine` made the layer keep drawing at the baked map after it was moved.
 * A sheared operand cannot keep its shape as position/rotation/scale at all,
 * so that dissolve is refused, as deleting such a parent already is.
 */
const shape = (id: string, overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id.toUpperCase(),
  type: 'custom_rect',
  zIndex: 1,
  width: 100,
  height: 100,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  ...overrides,
} as CharacterPart);

const track = (partId: string): Track => ({ id: `t-${partId}`, partId, name: partId, keyframes: [], channels: makeEmptyChannels() } as unknown as Track);

const scene = (groupScale: { scaleX: number; scaleY: number }) => {
  const group = shape('group', {
    type: 'custom_freeform',
    booleanOperation: 'union',
    booleanOperandIds: ['a', 'b'],
    booleanContours: [],
    baseTransform: { x: 10, y: 20, rotation: 0, opacity: 1, ...groupScale },
  });
  const a = shape('a', { booleanGroupId: 'group', baseTransform: { x: 30, y: 0, rotation: 30, scaleX: 1, scaleY: 1, opacity: 0.5 } });
  const b = shape('b', { booleanGroupId: 'group', baseTransform: { x: -30, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } });
  const parts = [group, a, b];
  return { parts, tracks: parts.map((part) => track(part.id)) };
};

const ctx = {
  currentFrame: 0,
  selectedPartId: 'group' as string | null,
  selectedPartIds: ['group'],
  characterParts: [] as CharacterPart[],
  tracks: [] as Track[],
  setCharacterParts: vi.fn(),
  setTracks: vi.fn(),
  setSelectedPartId: vi.fn(),
  setSelectedPartIds: vi.fn(),
  getComputedTransform: (partId: string, frame: number) => evaluateTransform(ctx.characterParts, ctx.tracks, 'Sequence', partId, frame),
  startBatchInteraction: vi.fn(),
  endBatchInteraction: vi.fn(),
  showToast: vi.fn(),
  setBooleanOperandEditingGroupId: vi.fn(),
};

vi.mock('../context/useAnimator', () => ({ useAnimatorAuthority: (create: (state: typeof ctx) => object) => create(ctx) }));

const { useBooleanAuthoring } = await import('../hooks/useBooleanAuthoring');

const dissolve = (groupScale: { scaleX: number; scaleY: number }) => {
  const { parts, tracks } = scene(groupScale);
  ctx.characterParts = parts;
  ctx.tracks = tracks;
  const { result } = renderHook(() => useBooleanAuthoring());
  result.current.dissolveBooleanGroup();
};

beforeEach(() => {
  ctx.setCharacterParts.mockClear();
  ctx.setTracks.mockClear();
  ctx.showToast.mockClear();
});

describe('Boolean dissolve bake', () => {
  it('stores only the authored base fields of each operand', () => {
    dissolve({ scaleX: 2, scaleY: 2 });
    const written = ctx.setCharacterParts.mock.calls[0][0] as CharacterPart[];
    const operand = written.find((part) => part.id === 'a')!;
    expect(operand.booleanGroupId).toBeUndefined();
    expect(Object.keys(operand.baseTransform).sort()).toEqual(['opacity', 'rotation', 'scaleX', 'scaleY', 'x', 'y']);
    // The world pose is baked: the group's uniform 2× and offset are in it.
    expect(operand.baseTransform).toMatchObject({ x: 70, y: 20, rotation: 30, scaleX: 2, scaleY: 2, opacity: 0.5 });
  });

  it('a dissolved operand follows a later move', () => {
    dissolve({ scaleX: 2, scaleY: 2 });
    const written = ctx.setCharacterParts.mock.calls[0][0] as CharacterPart[];
    const dissolvedTracks = ctx.setTracks.mock.calls[0][0] as Track[];
    const moved = written.map((part) => (part.id === 'a' ? { ...part, baseTransform: { ...part.baseTransform, x: part.baseTransform.x + 100 } } : part));
    const before = worldAffineOf(evaluateTransform(written, dissolvedTracks, 'Sequence', 'a', 0));
    const after = worldAffineOf(evaluateTransform(moved, dissolvedTracks, 'Sequence', 'a', 0));
    expect(after.e - before.e).toBeCloseTo(100, 9);
  });

  it('refuses a sheared operand with the reason and the remedy, writing nothing', () => {
    const { parts, tracks } = scene({ scaleX: 2, scaleY: 1 });
    expect(evaluateTransform(parts, tracks, 'Sequence', 'a', 0).affine).toBeDefined();
    dissolve({ scaleX: 2, scaleY: 1 });
    expect(ctx.setCharacterParts).not.toHaveBeenCalled();
    expect(ctx.setTracks).not.toHaveBeenCalled();
    expect(ctx.showToast).toHaveBeenCalledWith('A cannot keep its exact shape outside the Boolean (its pose would need a skew). Give the Boolean an even scale first.', 'error');
  });
});
