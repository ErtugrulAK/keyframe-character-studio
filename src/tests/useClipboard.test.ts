import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useClipboard } from '../hooks/useClipboard';
import type { CharacterPart, Track } from '../types/animator';
import { makeEmptyChannels } from '../utils/defaults';

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

    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('Copied'), 'info');
    expect(result.current.clipboardData).not.toBeNull();

    await act(async () => {
      result.current.pasteCopiedPart();
    });

    expect(mockSetTracks).toHaveBeenCalled();
    expect(mockSetCharacterParts).toHaveBeenCalled();
    expect(mockSetSelectedPartId).toHaveBeenCalled();
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
    expect(mockShowToast).toHaveBeenCalledWith('Duplicated "Group" with 1 layers', 'success');
  });
});
