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
});
