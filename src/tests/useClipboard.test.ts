import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useClipboard } from '../hooks/useClipboard';
import type { CharacterPart, Track } from '../types/animator';
import { makeEmptyChannels } from '../utils/animation/defaults';

describe('useClipboard Hook', () => {
  const mockShowToast = vi.fn();
  const mockSetTracks = vi.fn();
  const mockSetCharacterParts = vi.fn();
  const mockSetSelectedPartId = vi.fn();

  it('copies and pastes successfully', async () => {
    const mockParts = [{ id: 'p1', type: 'head' as const, name: 'Head', zIndex: 1, baseTransform: { x:0, y:0, rotation:0, scaleX:1, scaleY:1, opacity:1 } }];
    const mockTracks = [{ id: 't1', partId: 'p1', name: 'T1', channels: { customProps: [] }, keyframes: [] }];
    
    const { result } = renderHook(() => useClipboard({
      characterParts: mockParts,
      tracks: mockTracks as any,
      selectedPartId: 'p1',
      showToast: mockShowToast,
      setTracks: mockSetTracks,
      setCharacterParts: mockSetCharacterParts,
      setSelectedPartId: mockSetSelectedPartId
    }));

    act(() => {
      result.current.copySelectedPart();
    });

    // C8: copy and paste show their result, not a toast.
    expect(mockShowToast).not.toHaveBeenCalled();
    expect(result.current.clipboardData).not.toBeNull();

    await act(async () => {
      result.current.pasteCopiedPart();
    });

    expect(mockSetTracks).toHaveBeenCalled();
    expect(mockSetCharacterParts).toHaveBeenCalled();
    expect(mockSetSelectedPartId).toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it('warns on paste when empty', () => {
    const { result } = renderHook(() => useClipboard({
      characterParts: [],
      tracks: [],
      selectedPartId: null,
      showToast: mockShowToast,
      setTracks: mockSetTracks,
      setCharacterParts: mockSetCharacterParts,
      setSelectedPartId: mockSetSelectedPartId
    }));

    act(() => {
      result.current.pasteCopiedPart();
    });

    expect(mockShowToast).toHaveBeenCalledWith('Clipboard is empty', 'error');
  });

  it('M11: duplicate preserves the matte reference (structuredClone spread)', () => {
    const mattePart = {
      id: 'p1', type: 'custom_box' as const, name: 'Head', zIndex: 1,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      matte: { sourcePartId: 'src', mode: 'clip' },
    };
    const mockParts = [mattePart];
    const mockTracks = [{ id: 't1', partId: 'p1', name: 'T1', channels: { customProps: [] }, keyframes: [] }];

    const { result } = renderHook(() => useClipboard({
      characterParts: mockParts,
      tracks: mockTracks as any,
      selectedPartId: 'p1',
      showToast: mockShowToast,
      setTracks: mockSetTracks,
      setCharacterParts: mockSetCharacterParts,
      setSelectedPartId: mockSetSelectedPartId
    }));

    act(() => {
      result.current.duplicateSelectedPart();
    });

    // The duplicate keeps the SAME sourcePartId (no automatic remapping)
    const updater = mockSetCharacterParts.mock.calls.at(-1)?.[0] as (prev: typeof mockParts) => typeof mockParts;
    const updated = updater(mockParts);
    const dup = updated.find((p: any) => p.id !== 'p1');
    expect(dup).toBeDefined();
    expect(dup!.matte).toEqual({ sourcePartId: 'src', mode: 'clip' });
  });

  it('duplicates a whole layer group with fresh ids and re-parented children', () => {
    const container: CharacterPart = {
      id: 'g', type: 'custom_freeform', name: 'Group', zIndex: 3, isGroup: true,
      fillColor: '#fff', strokeColor: '#101218', pivot: { x: 0, y: 0 },
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    };
    const child: CharacterPart = {
      id: 'a', type: 'custom_rect', name: 'A', zIndex: 1, parentId: 'g',
      fillColor: '#fff', strokeColor: '#101218', pivot: { x: 0, y: 0 },
      baseTransform: { x: -50, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    };
    const mockParts: CharacterPart[] = [child, container];
    const mockTracks: Track[] = [
      { id: 't_a', partId: 'a', name: 'A', color: '#fff', visible: true, locked: false, keyframes: [], channels: makeEmptyChannels() },
      { id: 't_g', partId: 'g', name: 'Group', color: '#fff', visible: true, locked: false, keyframes: [], channels: makeEmptyChannels() },
    ];

    const { result } = renderHook(() => useClipboard({
      characterParts: mockParts,
      tracks: mockTracks,
      selectedPartId: 'g',
      showToast: mockShowToast,
      setTracks: mockSetTracks,
      setCharacterParts: mockSetCharacterParts,
      setSelectedPartId: mockSetSelectedPartId,
    }));

    act(() => {
      result.current.duplicateSelectedPart();
    });

    const updater = mockSetCharacterParts.mock.calls.at(-1)?.[0] as (prev: CharacterPart[]) => CharacterPart[];
    const updated = updater(mockParts);
    const clones = updated.filter((part) => part.id !== 'g' && part.id !== 'a');
    const cloneContainer = clones.find((part) => part.isGroup)!;
    const cloneChild = clones.find((part) => !part.isGroup)!;

    expect(clones).toHaveLength(2);
    expect(cloneContainer.id).not.toBe('g');
    expect(cloneChild.parentId).toBe(cloneContainer.id);
    expect(cloneChild.baseTransform.x).toBe(-50);
    // The copy is offset in its own parent's space, and selects the new container.
    expect(cloneContainer.baseTransform.x).toBe(20);
    expect(mockSetSelectedPartId).toHaveBeenCalledWith(cloneContainer.id);
    // C8: the selected copy is the confirmation.
    expect(mockShowToast).not.toHaveBeenCalled();
  });
});

describe('useClipboard — copying a multi-layer selection (rc.6 QA)', () => {
  const base = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
  const layer = (id: string, zIndex: number, extra: Partial<CharacterPart> = {}): CharacterPart => ({
    id, type: 'custom_rect', name: id.toUpperCase(), zIndex, fillColor: '#fff', strokeColor: '#000',
    baseTransform: { ...base, x: zIndex * 10 }, ...extra,
  } as CharacterPart);
  const trackOf = (partId: string): Track => ({
    id: `t-${partId}`, partId, name: partId, color: '#3b82f6', keyframes: [], visible: true, locked: false, expanded: false,
    channels: { ...makeEmptyChannels(), x: [{ id: `k-${partId}`, frame: 0, value: 1, easing: 'linear' }] },
  } as Track);

  const setup = (parts: CharacterPart[], selected: string[], primary = selected[selected.length - 1]) => {
    const setTracks = vi.fn();
    const setCharacterParts = vi.fn();
    const setSelectedPartId = vi.fn();
    const setSelectedPartIds = vi.fn();
    const hook = renderHook(() => useClipboard({
      characterParts: parts,
      tracks: parts.map((part) => trackOf(part.id)),
      selectedPartId: primary,
      selectedPartIds: selected,
      showToast: vi.fn(),
      setTracks,
      setCharacterParts,
      setSelectedPartId,
      setSelectedPartIds,
    }));
    act(() => hook.result.current.copySelectedPart());
    act(() => hook.result.current.pasteCopiedPart());
    const pastedParts = (setCharacterParts.mock.calls[0][0] as (prev: CharacterPart[]) => CharacterPart[])(parts).slice(0, -parts.length || undefined);
    const pastedTracks = (setTracks.mock.calls[0][0] as (prev: Track[]) => Track[])([]);
    return { pastedParts, pastedTracks, setSelectedPartId, setSelectedPartIds };
  };

  it('pastes every selected layer, with its animation, as copies above the scene', () => {
    const parts = [layer('a', 1), layer('b', 2), layer('c', 3)];
    const { pastedParts, pastedTracks, setSelectedPartIds, setSelectedPartId } = setup(parts, ['a', 'c']);

    expect(pastedParts.map((part) => part.name)).toEqual(['A Copy', 'C Copy']);
    expect(pastedParts.every((part) => !['a', 'b', 'c'].includes(part.id))).toBe(true);
    // Stacking order kept, above the three existing layers.
    expect(pastedParts.map((part) => part.zIndex)).toEqual([4, 5]);
    expect(pastedParts.map((part) => part.baseTransform.x)).toEqual([30, 50]);
    expect(pastedTracks.map((track) => track.partId)).toEqual(pastedParts.map((part) => part.id));
    expect(pastedTracks.every((track) => track.channels.x.length === 1 && !track.channels.x[0].id.startsWith('k-'))).toBe(true);
    expect(setSelectedPartIds).toHaveBeenCalledWith(pastedParts.map((part) => part.id));
    expect(setSelectedPartId).toHaveBeenCalledWith(pastedParts[1].id);
  });

  it('links the copies to each other, and leaves links to uncopied layers on the original', () => {
    const parts = [
      layer('src', 1),
      layer('target', 2, { matte: { sourcePartId: 'src', mode: 'alpha' } } as Partial<CharacterPart>),
      layer('other', 3, { matte: { sourcePartId: 'outside', mode: 'alpha' } } as Partial<CharacterPart>),
      layer('outside', 4),
    ];
    const { pastedParts } = setup(parts, ['src', 'target', 'other']);
    const [srcCopy, targetCopy, otherCopy] = pastedParts;

    expect(targetCopy.matte?.sourcePartId).toBe(srcCopy.id);
    expect(otherCopy.matte?.sourcePartId).toBe('outside');
  });

  it('remaps Track Matte sources and text-box links between copied layers', () => {
    const parts = [
      layer('src', 1),
      layer('target', 2, { trackMatte: { sourceLayerId: 'src', mode: 'alpha' } } as Partial<CharacterPart>),
      layer('title', 3, { type: 'custom_text', textValue: 'Hi' } as Partial<CharacterPart>),
      layer('bar', 4, { fitToText: { textLayerId: 'title', padding: 10 } } as Partial<CharacterPart>),
      layer('loneBar', 5, { fitToText: { textLayerId: 'outsideText' } } as Partial<CharacterPart>),
    ];
    const { pastedParts } = setup(parts, ['src', 'target', 'title', 'bar', 'loneBar']);
    const [srcCopy, targetCopy, titleCopy, barCopy, loneBarCopy] = pastedParts;

    expect(targetCopy.trackMatte?.sourceLayerId).toBe(srcCopy.id);
    expect(barCopy.fitToText).toEqual({ textLayerId: titleCopy.id, padding: 10 });
    expect(loneBarCopy.fitToText?.textLayerId).toBe('outsideText');
  });

  it('copies a selected group with its contents and re-parents them to the copied group', () => {
    const parts = [
      layer('group', 1, { isGroup: true } as Partial<CharacterPart>),
      layer('child', 2, { parentId: 'group' }),
      layer('loose', 3),
    ];
    const { pastedParts, setSelectedPartIds } = setup(parts, ['group', 'loose'], 'loose');
    const [groupCopy, childCopy, looseCopy] = pastedParts;

    expect(childCopy.parentId).toBe(groupCopy.id);
    // Only the outermost copies move by the paste offset; a child keeps its place in the group.
    expect(childCopy.baseTransform.x).toBe(20);
    expect(groupCopy.baseTransform.x).toBe(30);
    expect(setSelectedPartIds).toHaveBeenCalledWith([groupCopy.id, looseCopy.id]);
  });

  it('copies only the primary layer when the selection does not include it', () => {
    const parts = [layer('a', 1), layer('b', 2)];
    const { pastedParts, setSelectedPartIds } = setup(parts, ['a'], 'b');

    expect(pastedParts.map((part) => part.name)).toEqual(['B Copy']);
    expect(setSelectedPartIds).not.toHaveBeenCalled();
  });
});
