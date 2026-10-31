import { describe, expect, it, vi } from 'vitest';
import type { CharacterPart, LayerMask, Track } from '../types/animator';
import { layerMaskPathChannel } from '../types/animator';
import {
  isLayerLocked,
  lockedLayerIds,
  lockedLayersMessage,
  lockedLayersRefusal,
  lockedMaskChanges,
  lockedMasksMessage,
  lockedOutcomeRefusal,
  lockedPartChanges,
  lockedTrackChanges,
} from '../utils/layers/layerLocks';
import { selectAllLayers } from '../utils/layers/layerSelection';

const mask = (id: string, locked = false): LayerMask => ({
  id, name: id.toUpperCase(), mode: 'add', enabled: true, locked,
  path: { version: 1, coordinateSpace: 'normalized', closed: true, points: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 1, y: 0 }, { id: 'c', x: 1, y: 1 }] },
} as unknown as LayerMask);

const part = (id: string, extra: Partial<CharacterPart> = {}): CharacterPart => ({
  id, name: `Layer ${id}`, type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#fff', strokeColor: '#000', width: 10, height: 10, ...extra,
} as CharacterPart);

const track = (partId: string, locked = false, extra: Partial<Track> = {}): Track => ({
  id: `t-${partId}`, partId, name: partId, color: '#000', visible: true, locked, expanded: false,
  channels: { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [], trimPathStart: [], trimPathEnd: [], trimPathOffset: [] },
  ...extra,
} as Track);

describe('C4 layer locks — what a locked layer refuses', () => {
  const parts = [part('a'), part('b'), part('c')];
  const tracks = [track('a', true), track('b'), track('c')];
  const locked = lockedLayerIds(tracks);

  it('reads the lock switch from the tracks', () => {
    expect([...locked]).toEqual(['a']);
    expect(isLayerLocked(tracks, 'a')).toBe(true);
    expect(isLayerLocked(tracks, 'b')).toBe(false);
    expect(isLayerLocked(tracks, null)).toBe(false);
  });

  it('refuses a change or removal of the locked part; others and new parts pass', () => {
    expect(lockedPartChanges(parts, parts.map((p) => (p.id === 'a' ? { ...p, x: 5 } : p)), locked)).toEqual(['a']);
    expect(lockedPartChanges(parts, parts.filter((p) => p.id !== 'a'), locked)).toEqual(['a']);
    expect(lockedPartChanges(parts, parts.map((p) => (p.id === 'b' ? { ...p, x: 5 } : p)), locked)).toEqual([]);
    expect(lockedPartChanges(parts, [...parts, part('d')], locked)).toEqual([]);
  });

  it('lets other layers renumber it (zIndex) and ignores deep copies of unchanged values', () => {
    expect(lockedPartChanges(parts, parts.map((p, index) => ({ ...p, zIndex: 10 - index })), locked)).toEqual([]);
    const masked = [part('a', { masks: [mask('m')] })];
    expect(lockedPartChanges(masked, structuredClone(masked), locked)).toEqual([]);
  });

  it('allows the switches of a locked track (eyes, lock, disclosure) and refuses its animation', () => {
    expect(lockedTrackChanges(tracks, tracks.map((t) => (t.partId === 'a' ? { ...t, visible: false, editVisible: false, expanded: true } : t)))).toEqual([]);
    expect(lockedTrackChanges(tracks, tracks.map((t) => (t.partId === 'a' ? { ...t, locked: false } : t)))).toEqual([]);
    const keyed = tracks.map((t) => (t.partId === 'a' ? { ...t, channels: { ...t.channels, x: [{ id: 'k', frame: 0, value: 1 }] } } : t)) as Track[];
    expect(lockedTrackChanges(tracks, keyed)).toEqual(['a']);
    expect(lockedTrackChanges(tracks, tracks.map((t) => (t.partId === 'a' ? { ...t, name: 'Renamed' } : t)))).toEqual(['a']);
    expect(lockedTrackChanges(tracks, tracks.filter((t) => t.partId !== 'a'))).toEqual(['a']);
  });

  it('locking is decided on the previous state: the update that locks is allowed, the one after is not', () => {
    const unlocked = [track('b')];
    const lockedNow = [{ ...unlocked[0], locked: true }];
    expect(lockedTrackChanges(unlocked, lockedNow)).toEqual([]);
    expect(lockedTrackChanges(lockedNow, [{ ...lockedNow[0], name: 'x' }])).toEqual(['b']);
  });

  it('refuses a planned outcome that touches a locked layer, before anything is written', () => {
    expect(lockedOutcomeRefusal(parts, tracks, parts.map((p) => ({ ...p, parentId: 'g' })), null)).toMatch(/Layer “Layer a” is locked/);
    expect(lockedOutcomeRefusal(parts, tracks, parts.map((p) => (p.id === 'b' ? { ...p, parentId: 'g' } : p)), null)).toBeNull();
  });

  it('refuses a mixed selection as a whole and names the locked layers', () => {
    expect(lockedLayersRefusal(parts, tracks, ['b', 'a', 'c'])).toBe('Layer “Layer a” is locked. Unlock it to change it.');
    expect(lockedLayersRefusal(parts, tracks, ['b', 'c'])).toBeNull();
    expect(lockedLayersMessage(['A', 'B', 'C', 'D', 'E'])).toBe('Layers “A”, “B”, “C” and 2 more are locked. Unlock them, or leave them out of the selection, to change them.');
  });

  it('Select All leaves locked layers out; the primary is the last unlocked one', () => {
    const setSelectedPartIds = vi.fn();
    const setSelectedPartId = vi.fn();
    expect(selectAllLayers([{ id: 'a' }, { id: 'b' }, { id: 'c' }], { setSelectedPartIds, setSelectedPartId }, new Set(['c']))).toEqual(['a', 'b']);
    expect(setSelectedPartId).toHaveBeenCalledWith('b');
  });
});

describe('C4 mask locks — only the locked mask path is protected', () => {
  const parts = [part('a', { masks: [mask('m1', true), mask('m2')] })];

  it('refuses a path edit or removal of the locked mask, never of the others', () => {
    const editedLocked = [{ ...parts[0], masks: [{ ...parts[0].masks![0], path: { ...parts[0].masks![0].path, closed: false } }, parts[0].masks![1]] }];
    expect(lockedMaskChanges(parts, editedLocked, null, null).map((hit) => hit.maskId)).toEqual(['m1']);
    const removed = [{ ...parts[0], masks: [parts[0].masks![1]] }];
    expect(lockedMaskChanges(parts, removed, null, null).map((hit) => hit.maskId)).toEqual(['m1']);
    const editedOther = [{ ...parts[0], masks: [parts[0].masks![0], { ...parts[0].masks![1], path: { ...parts[0].masks![1].path, closed: false } }] }];
    expect(lockedMaskChanges(parts, editedOther, null, null)).toEqual([]);
  });

  it('lets the locked mask change its mode, feather, opacity and the lock itself', () => {
    const tuned = [{ ...parts[0], masks: [{ ...parts[0].masks![0], mode: 'subtract', feather: 3, opacity: 0.5, locked: false } as LayerMask, parts[0].masks![1]] }];
    expect(lockedMaskChanges(parts, tuned, null, null)).toEqual([]);
  });

  it('refuses a change of the locked mask path animation', () => {
    const before = [track('a')];
    const after = [{ ...before[0], maskPathChannels: { [layerMaskPathChannel('m1')]: [{ id: 'k', frame: 0, value: parts[0].masks![0].path }] } }] as unknown as Track[];
    expect(lockedMaskChanges(parts, null, before, after).map((hit) => hit.maskId)).toEqual(['m1']);
    const otherMask = [{ ...before[0], maskPathChannels: { [layerMaskPathChannel('m2')]: [{ id: 'k', frame: 0, value: parts[0].masks![1].path }] } }] as unknown as Track[];
    expect(lockedMaskChanges(parts, null, before, otherMask)).toEqual([]);
  });

  it('deleting the whole layer is not a mask edit', () => {
    expect(lockedMaskChanges(parts, [], null, null)).toEqual([]);
  });

  it('names the mask and its layer', () => {
    expect(lockedMasksMessage([{ partId: 'a', maskId: 'm1', label: '“M1” on “Layer a”' }])).toBe('Mask “M1” on “Layer a” is locked. Unlock it to edit its path.');
  });
});
