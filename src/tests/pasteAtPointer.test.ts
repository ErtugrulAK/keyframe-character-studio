import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useClipboard } from '../hooks/useClipboard';
import type { CharacterPart, Track } from '../types/animator';
import { makeEmptyChannels } from '../utils/animation/defaults';

const part = (id: string, x: number, y: number, extra: Partial<CharacterPart> = {}): CharacterPart => ({
  id, name: id, type: 'custom_rect', zIndex: 1,
  baseTransform: { x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  ...extra,
} as CharacterPart);
const track = (partId: string, channels: Partial<Track['channels']> = {}): Track => ({
  id: `t-${partId}`, partId, name: partId, keyframes: [], channels: { ...makeEmptyChannels(), ...channels },
} as Track);

/** Copy `selected`, paste with the pointer at `point`; returns the pasted layers and tracks. */
const pasteAt = (parts: CharacterPart[], tracks: Track[], selected: string[], point: { x: number; y: number } | null) => {
  let pastedParts: CharacterPart[] = [];
  let pastedTracks: Track[] = [];
  const { result } = renderHook(() => useClipboard({
    characterParts: parts,
    tracks,
    selectedPartId: selected[0],
    selectedPartIds: selected,
    showToast: () => {},
    setTracks: (update) => { pastedTracks = (update as (prev: Track[]) => Track[])([]); },
    setCharacterParts: (update) => { pastedParts = (update as (prev: CharacterPart[]) => CharacterPart[])([]); },
    setSelectedPartId: () => {},
    setSelectedPartIds: () => {},
    pastePoint: () => point,
  }));
  act(() => result.current.copySelectedPart());
  act(() => result.current.pasteCopiedPart());
  return { parts: pastedParts, tracks: pastedTracks };
};

describe('Ctrl+V pastes where the mouse is', () => {
  it('a single layer lands with its origin under the pointer', () => {
    const { parts } = pasteAt([part('a', -300, -200)], [track('a')], ['a'], { x: 400, y: 250 });
    expect(parts[0].baseTransform).toMatchObject({ x: 400, y: 250 });
  });

  it('several layers keep their arrangement, centred on the pointer', () => {
    const scene = [part('a', 0, 0), part('b', 100, 40)];
    const { parts } = pasteAt(scene, scene.map((p) => track(p.id)), ['a', 'b'], { x: 500, y: 500 });
    const byName = Object.fromEntries(parts.map((p) => [p.name, p.baseTransform]));
    expect(byName['a Copy']).toMatchObject({ x: 450, y: 480 });
    expect(byName['b Copy']).toMatchObject({ x: 550, y: 520 });
  });

  it('an animated layer carries its motion to the new place', () => {
    const moving = track('a', { x: [
      { id: 'k0', frame: 0, value: 0, templateId: 'Sequence' },
      { id: 'k1', frame: 10, value: 100, templateId: 'Sequence' },
    ] } as Partial<Track['channels']>);
    const { tracks } = pasteAt([part('a', 0, 0)], [moving], ['a'], { x: 300, y: 0 });
    expect(tracks[0].channels.x.map((key) => key.value)).toEqual([300, 400]);
  });

  it('without a pointer position the copy moves by the old small offset', () => {
    const { parts } = pasteAt([part('a', 10, 10)], [track('a')], ['a'], null);
    expect(parts[0].baseTransform).toMatchObject({ x: 30, y: 30 });
  });
});
