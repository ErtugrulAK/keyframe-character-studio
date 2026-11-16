import { describe, expect, it } from 'vitest';
import type { CharacterPart, Track } from '../types/animator';
import { makeEmptyChannels } from '../utils/animation/defaults';
import { describeHistory, describeHistoryStep, type HistoryStepState } from '../utils/editor/historyLabels';

const pose = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
const part = (id: string, extra: Partial<CharacterPart> = {}): CharacterPart => (
  { id, name: id.toUpperCase(), type: 'custom_rect', zIndex: 1, fillColor: '#fff', baseTransform: pose, ...extra } as CharacterPart
);
const track = (partId: string, extra: Partial<Track> = {}): Track => ({
  id: `track-${partId}`, partId, name: partId, color: '#fff', visible: true, locked: false, channels: makeEmptyChannels(), ...extra,
});
const key = (id: string, frame: number, value: number) => ({ id, frame, value, easing: 'linear' as const });
const state = (parts: CharacterPart[], tracks: Track[] = parts.map((item) => track(item.id)), extra: Partial<HistoryStepState> = {}): HistoryStepState => (
  { characterParts: parts, tracks, ...extra }
);

describe('history step labels', () => {
  const a = part('a');
  const b = part('b');

  it('names layers added, deleted and replaced', () => {
    expect(describeHistoryStep(state([a]), state([a, b]))).toBe('Add B');
    expect(describeHistoryStep(state([]), state([a, b]))).toBe('Add 2 layers');
    expect(describeHistoryStep(state([a, b]), state([b]))).toBe('Delete A');
    expect(describeHistoryStep(state([a, b]), state([part('c')]))).toBe('Replace 2 layers with C');
  });

  it('reads a pose change as a move, a turn, a scale, a fade or a transform', () => {
    const moved = (patch: Partial<typeof pose>) => state([part('a', { baseTransform: { ...pose, ...patch } }), b]);
    expect(describeHistoryStep(state([a, b]), moved({ x: 10 }))).toBe('Move A');
    expect(describeHistoryStep(state([a, b]), moved({ rotation: 45 }))).toBe('Rotate A');
    expect(describeHistoryStep(state([a, b]), moved({ scaleX: 2, scaleY: 2 }))).toBe('Scale A');
    expect(describeHistoryStep(state([a, b]), moved({ opacity: 0.5 }))).toBe('Change opacity of A');
    expect(describeHistoryStep(state([a, b]), moved({ x: 10, rotation: 5 }))).toBe('Transform A');
    const both = state([part('a', { baseTransform: { ...pose, y: 4 } }), part('b', { baseTransform: { ...pose, y: 4 } })]);
    expect(describeHistoryStep(state([a, b]), both)).toBe('Move 2 layers');
  });

  it('names what of a layer changed', () => {
    const changed = (extra: Partial<CharacterPart>) => describeHistoryStep(state([a]), state([part('a', extra)]));
    expect(changed({ name: 'Logo' })).toBe('Rename Logo');
    expect(changed({ fillColor: '#f00' })).toBe('Change appearance of A');
    expect(changed({ textValue: 'Hi' })).toBe('Edit text of A');
    expect(changed({ fontSize: 40 })).toBe('Change text style of A');
    expect(changed({ glowColor: '#ff0' })).toBe('Change effects of A');
    expect(changed({ crop: { x: 0, y: 0, width: 5, height: 5 } })).toBe('Crop A');
    expect(changed({ motionPath: { sourcePartId: 'b' } })).toBe('Change motion path of A');
    expect(changed({ textFit: { enabled: true } as CharacterPart['textFit'] })).toBe('Change modifiers of A');
    expect(changed({ zIndex: 9 })).toBe('Reorder A');
    expect(changed({ parentId: 'b' })).toBe('Reparent A');
  });

  it('counts keyframes added and deleted, and tells an edit from them', () => {
    const none = state([a]);
    const one = state([a], [track('a', { channels: { ...makeEmptyChannels(), x: [key('k1', 0, 0)] } })]);
    const two = state([a], [track('a', { channels: { ...makeEmptyChannels(), x: [key('k1', 0, 0), key('k2', 10, 5)] } })]);
    const twoMoved = state([a], [track('a', { channels: { ...makeEmptyChannels(), x: [key('k1', 0, 0), key('k2', 20, 5)] } })]);
    expect(describeHistoryStep(none, two)).toBe('Add 2 keyframes on A');
    expect(describeHistoryStep(one, two)).toBe('Add keyframe on A');
    expect(describeHistoryStep(two, one)).toBe('Delete keyframe on A');
    expect(describeHistoryStep(two, twoMoved)).toBe('Edit keyframes on A');
  });

  it('names track-only and document-only steps', () => {
    expect(describeHistoryStep(state([a]), state([a], [track('a', { visible: false })]))).toBe('Show / hide A');
    expect(describeHistoryStep(state([a]), state([a], [track('a', { locked: true })]))).toBe('Lock / unlock A');
    expect(describeHistoryStep(state([a]), state([a], [track('a', { expanded: true })]))).toBe('Change timeline view of A');
    const tracks = [track('a')];
    expect(describeHistoryStep(state([a], tracks, { document: { fps: 30 } }), state([a], tracks, { document: { fps: 60 } }))).toBe('Change project settings');
    expect(describeHistoryStep(state([a], tracks), state([a], tracks))).toBe('Edit');
  });

  it('labels a whole stack, the first entry being where it starts', () => {
    const s0 = state([]);
    const s1 = state([a]);
    const s2 = state([part('a', { baseTransform: { ...pose, x: 3 } })]);
    const cache = new WeakMap<object, string>();
    expect(describeHistory([s0, s1, s2], cache)).toEqual(['Start', 'Add A', 'Move A']);
    expect(cache.get(s2)).toBe('Move A');
  });
});
