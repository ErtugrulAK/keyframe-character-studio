import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useToolbar } from '../hooks/useToolbar';
import { Track, CharacterPart } from '../types/animator';

describe('useToolbar Hook', () => {
  const mockSetTracks = vi.fn();
  const mockSetCharacterParts = vi.fn();
  const mockSetSelectedPartId = vi.fn();

  const mockTracks: Track[] = [];
  const mockCharacterParts: CharacterPart[] = [];

  it('initializes with select tool active', () => {
    const { result } = renderHook(() => useToolbar({
      tracks: mockTracks,
      setTracks: mockSetTracks,
      characterParts: mockCharacterParts,
      setCharacterParts: mockSetCharacterParts,
      setSelectedPartId: mockSetSelectedPartId
    }));

    expect(result.current.activeTool).toBe('select');
  });

  it('updates active tool', () => {
    const { result } = renderHook(() => useToolbar({
      tracks: mockTracks,
      setTracks: mockSetTracks,
      characterParts: mockCharacterParts,
      setCharacterParts: mockSetCharacterParts,
      setSelectedPartId: mockSetSelectedPartId
    }));

    act(() => {
      result.current.setActiveTool('move');
    });
    
    expect(result.current.activeTool).toBe('move');
  });

  it('arms fixed shape creation without creating an authored part', () => {
    const { result } = renderHook(() => useToolbar({
      tracks: mockTracks,
      setTracks: mockSetTracks,
      characterParts: mockCharacterParts,
      setCharacterParts: mockSetCharacterParts,
      setSelectedPartId: mockSetSelectedPartId,
    }));

    act(() => result.current.armShapeCreation('custom_rect', 'Rectangle'));

    expect(result.current.activeTool).toBe('shape_create');
    expect(result.current.pendingShapeType).toBe('custom_rect');
    expect(result.current.pendingShapeName).toBe('Rectangle');
    expect(mockSetTracks).not.toHaveBeenCalled();
    expect(mockSetCharacterParts).not.toHaveBeenCalled();
  });
  it('adds a custom part and selects it', () => {
    const { result } = renderHook(() => useToolbar({
      tracks: mockTracks,
      setTracks: mockSetTracks,
      characterParts: mockCharacterParts,
      setCharacterParts: mockSetCharacterParts,
      setSelectedPartId: mockSetSelectedPartId
    }));

    act(() => {
      result.current.addCustomPart('head', 'My Head');
    });

    expect(mockSetTracks).toHaveBeenCalled();
    expect(mockSetCharacterParts).toHaveBeenCalled();
    expect(mockSetSelectedPartId).toHaveBeenCalled();
  });

  it('preserves authored layer indices when adding a new part', () => {
    const parts: CharacterPart[] = [0, 5, 10].map((zIndex, index) => ({
      id: `part-${index}`,
      name: `Part ${index}`,
      type: 'custom_box',
      zIndex,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    }));
    mockSetCharacterParts.mockClear();

    const { result } = renderHook(() => useToolbar({
      tracks: mockTracks,
      setTracks: mockSetTracks,
      characterParts: parts,
      setCharacterParts: mockSetCharacterParts,
      setSelectedPartId: mockSetSelectedPartId,
    }));

    act(() => {
      result.current.addCustomPart('custom_box', 'New Part');
    });

    const updater = mockSetCharacterParts.mock.calls.at(-1)?.[0] as (previous: CharacterPart[]) => CharacterPart[];
    const nextParts = updater(parts);
    expect(nextParts.slice(1).map((part) => part.zIndex)).toEqual([0, 5, 10]);
    expect(nextParts[0].zIndex).toBe(11);
  });
});
