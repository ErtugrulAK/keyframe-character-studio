import { describe, expect, it } from 'vitest';
import { resolveKeyframeMoveTargets, stretchKeyframesMutator } from '../utils/animation/trackMutations';
import type { PropertyKeyframe, Track } from '../types/animator';

const key = (id: string, frame: number): PropertyKeyframe => ({ id, frame, value: frame, easing: 'easeInOut', templateId: 'Sequence' });

const track = (x: PropertyKeyframe[], y: PropertyKeyframe[] = []): Track => ({
  id: 't', partId: 'p', name: 'p', color: '#fff', visible: true, locked: false, expanded: true,
  channels: { x, y } as unknown as Track['channels'],
} as unknown as Track);

const stretch = (tracks: Track[], ids: string[], pivot: number, edge: number, to: number, total = 120) =>
  stretchKeyframesMutator(tracks, resolveKeyframeMoveTargets(tracks, ids, 'Sequence', false), pivot, edge, to, total);

const frames = (tracks: Track[] | null, channel: 'x' | 'y' = 'x') => tracks?.[0].channels[channel].map((k) => [k.id, k.frame]);

describe('C10 stretchKeyframesMutator — proportional time-stretch', () => {
  it('dragging the last key from 30 to 60 doubles every gap from the first key; values and ids travel', () => {
    const base = [track([key('a', 10), key('b', 20), key('c', 30)])];
    const out = stretch(base, ['a', 'b', 'c'], 10, 30, 50);
    expect(frames(out)).toEqual([['a', 10], ['b', 30], ['c', 50]]);
    expect(out![0].channels.x.map((k) => k.value)).toEqual([10, 20, 30]);
  });

  it('dragging the first key compresses towards the last; rounding uses the base, not the last step', () => {
    const base = [track([key('a', 0), key('b', 10), key('c', 40)])];
    expect(frames(stretch(base, ['a', 'b', 'c'], 40, 0, 20))).toEqual([['a', 20], ['b', 25], ['c', 40]]);
  });

  it('refuses reaching or crossing the pivot, leaving the range, or two keys of a channel on one frame', () => {
    const base = [track([key('a', 10), key('b', 11), key('c', 30)])];
    expect(stretch(base, ['a', 'b', 'c'], 10, 30, 10)).toBeNull();
    expect(stretch(base, ['a', 'b', 'c'], 10, 30, 5)).toBeNull();
    expect(stretch(base, ['a', 'b', 'c'], 10, 30, 200, 120)).toBeNull();
    // 10 & 11 collapse onto one frame when squeezed hard.
    expect(stretch(base, ['a', 'b', 'c'], 10, 30, 12)).toBeNull();
  });

  it('never lands on a key of the same channel that is not stretched; other channels are free', () => {
    const base = [track([key('a', 0), key('b', 10), key('keep', 20)], [key('y20', 20)])];
    // b would land on 20 where the unselected x key sits.
    expect(stretch(base, ['a', 'b'], 0, 10, 20)).toBeNull();
    const ok = stretch(base, ['a', 'b'], 0, 10, 15);
    expect(frames(ok)).toEqual([['a', 0], ['b', 15], ['keep', 20]]);
    expect(frames(ok, 'y')).toEqual([['y20', 20]]);
  });
});
