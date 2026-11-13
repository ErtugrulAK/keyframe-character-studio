import { describe, expect, it, vi } from 'vitest';
import type { CharacterPart, Track } from '../types/animator';
import { createLayerParentingActions } from '../hooks/useLayerParenting';

/**
 * The parenting actions the layer tree, its keyboard commands, the context
 * menu and the Parent field share: what each one writes, that a write is one
 * batch (one undo step), that a refusal writes nothing and says why, and that
 * a re-base which adds keyframes asks first — Cancel writing nothing.
 */
const part = (id: string, base: Partial<CharacterPart['baseTransform']> = {}, extra: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  type: 'custom_rect',
  zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, ...base },
  ...extra,
} as CharacterPart);

const track = (partId: string, extra: Partial<Track> = {}): Track => ({
  id: `track-${partId}`, partId, name: partId, keyframes: [], channels: {}, ...extra,
} as unknown as Track);

const setup = (parts: CharacterPart[], tracks: Track[] = parts.map((p) => track(p.id)), withConfirmation = false) => {
  const calls: string[] = [];
  const deps = {
    currentFrame: 0,
    activeTemplateId: 'Sequence',
    characterParts: parts,
    tracks,
    setCharacterParts: vi.fn(() => calls.push('parts')),
    setTracks: vi.fn(() => calls.push('tracks')),
    startBatchInteraction: vi.fn(() => calls.push('start')),
    endBatchInteraction: vi.fn(() => calls.push('end')),
    showToast: vi.fn(),
    ...(withConfirmation ? { requestConfirmation: vi.fn() } : {}),
  };
  return { actions: createLayerParentingActions(deps), deps, calls };
};

const writtenParts = (deps: ReturnType<typeof setup>['deps']) => deps.setCharacterParts.mock.calls[0][0] as unknown as CharacterPart[];

describe('layer parenting actions', () => {
  it('setLayerParent writes the new parent inside one batch', () => {
    const { actions, deps, calls } = setup([part('a', { x: 50 }), part('b', { x: -20 })]);
    expect(actions.setLayerParent('b', 'a')).toBe(true);
    expect(calls[0]).toBe('start');
    expect(calls[calls.length - 1]).toBe('end');
    expect(writtenParts(deps).find((p) => p.id === 'b')!.parentId).toBe('a');
    expect(deps.showToast).not.toHaveBeenCalled();
  });

  it('setting the parent a layer already has writes nothing', () => {
    const { actions, deps } = setup([part('a'), part('b', {}, { parentId: 'a' })]);
    expect(actions.setLayerParent('b', 'a')).toBe(true);
    expect(deps.setCharacterParts).not.toHaveBeenCalled();
    expect(deps.startBatchInteraction).not.toHaveBeenCalled();
  });

  it('a cycle is refused with a reason and writes nothing', () => {
    const { actions, deps } = setup([part('a'), part('b', {}, { parentId: 'a' })]);
    expect(actions.setLayerParent('a', 'b')).toBe(false);
    expect(deps.showToast).toHaveBeenCalledWith(expect.any(String), 'error');
    expect(deps.setCharacterParts).not.toHaveBeenCalled();
  });

  it('a locked layer is refused before any planning and writes nothing', () => {
    const parts = [part('a'), part('b')];
    const tracks = [track('a'), track('b', { locked: true })];
    const { actions, deps } = setup(parts, tracks);
    expect(actions.dropLayer('b', 'a', 'nest')).toBe(false);
    expect(deps.showToast).toHaveBeenCalledWith(expect.any(String), 'error');
    expect(deps.setCharacterParts).not.toHaveBeenCalled();
  });

  it('nestIntoLayerAbove nests into the sibling row above', () => {
    const { actions, deps } = setup([part('a'), part('b')]);
    expect(actions.nestIntoLayerAbove('b')).toBe(true);
    expect(writtenParts(deps).find((p) => p.id === 'b')!.parentId).toBe('a');
  });

  it('nestIntoLayerAbove on the top row says there is nothing above', () => {
    const { actions, deps } = setup([part('a'), part('b')]);
    expect(actions.nestIntoLayerAbove('a')).toBe(false);
    expect(deps.showToast).toHaveBeenCalledWith(expect.stringContaining('no layer above'), 'info');
  });

  it('unparentLayer moves the layer out to its parent\'s level', () => {
    const { actions, deps } = setup([part('a'), part('b', {}, { parentId: 'a' })]);
    expect(actions.unparentLayer('b')).toBe(true);
    expect(writtenParts(deps).find((p) => p.id === 'b')!.parentId).toBeUndefined();
  });

  it('unparentLayer on a top-level layer says it has no parent', () => {
    const { actions, deps } = setup([part('a')]);
    expect(actions.unparentLayer('a')).toBe(false);
    expect(deps.showToast).toHaveBeenCalledWith('“A” has no parent.', 'info');
  });

  it('unknown ids are refused quietly', () => {
    const { actions, deps } = setup([part('a')]);
    expect(actions.nestIntoLayerAbove('missing')).toBe(false);
    expect(actions.unparentLayer('missing')).toBe(false);
    expect(actions.moveLayerAmongSiblings('missing', 1)).toBe(false);
    expect(deps.showToast).not.toHaveBeenCalled();
  });

  it('moveLayerAmongSiblings moves within the level and stops at its ends', () => {
    const { actions, deps } = setup([part('a'), part('b'), part('c')]);
    expect(actions.moveLayerAmongSiblings('a', -1)).toBe(false);
    expect(actions.moveLayerAmongSiblings('c', 1)).toBe(false);
    expect(actions.moveLayerAmongSiblings('a', 1)).toBe(true);
    expect(writtenParts(deps).map((p) => p.id)).toEqual(['b', 'a', 'c']);
  });

  describe('a re-base that adds keyframes', () => {
    // The parent turns over time; keeping a still child where it is inside it
    // needs keys on the child — the change the editor asks about first.
    const animatedScene = () => {
      const parts = [part('spinner', { x: 100 }), part('child', { x: 200, y: 40 })];
      const tracks = [
        track('spinner', {
          channels: {
            rotation: [
              { id: 'r0', frame: 0, value: 0, easing: 'linear' },
              { id: 'r1', frame: 30, value: 90, easing: 'linear' },
            ],
          } as unknown as Track['channels'],
        }),
        track('child'),
      ];
      return { parts, tracks };
    };

    it('asks first, and Cancel (no confirm) writes nothing', () => {
      const { parts, tracks } = animatedScene();
      const { actions, deps } = setup(parts, tracks, true);
      expect(actions.setLayerParent('child', 'spinner')).toBe(true);
      expect(deps.requestConfirmation).toHaveBeenCalledTimes(1);
      const request = deps.requestConfirmation!.mock.calls[0][0] as { title: string; description: string; confirmLabel: string };
      expect(request.title).toContain('Child');
      expect(request.confirmLabel).toBe('Re-parent');
      expect(request.description).toContain('inside “Spinner”');
      expect(deps.setCharacterParts).not.toHaveBeenCalled();
      expect(deps.setTracks).not.toHaveBeenCalled();
    });

    it('confirming writes parts and tracks as one batch', () => {
      const { parts, tracks } = animatedScene();
      const { actions, deps, calls } = setup(parts, tracks, true);
      actions.setLayerParent('child', 'spinner');
      const request = deps.requestConfirmation!.mock.calls[0][0] as { onConfirm: () => void };
      request.onConfirm();
      expect(calls).toEqual(['start', 'parts', 'tracks', 'end']);
      expect(writtenParts(deps).find((p) => p.id === 'child')!.parentId).toBe('spinner');
    });

    it('without a confirmation dialog the change is written at once', () => {
      const { parts, tracks } = animatedScene();
      const { actions, deps } = setup(parts, tracks, false);
      actions.setLayerParent('child', 'spinner');
      expect(deps.setCharacterParts).toHaveBeenCalledTimes(1);
      expect(deps.setTracks).toHaveBeenCalledTimes(1);
    });
  });
});
