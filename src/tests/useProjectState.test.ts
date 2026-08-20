import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useProjectState } from '../hooks/useProjectState';

describe('useProjectState Hook', () => {
  it('initializes with default empty tracks and parts', () => {
    const { result } = renderHook(() => useProjectState());
    expect(result.current.tracks).toEqual([]);
    expect(result.current.characterParts).toEqual([]);
    expect(result.current.tracksRef.current).toEqual([]);
    expect(result.current.characterPartsRef.current).toEqual([]);
  });

  it('updates tracks and synchronizes ref', () => {
    const { result } = renderHook(() => useProjectState());
    
    act(() => {
      result.current.setTracks([{ id: 't1', partId: 'p1', name: 'T1', keyframes: [] }]);
    });

    expect(result.current.tracks.length).toBe(1);
    expect(result.current.tracksRef.current.length).toBe(1);
  });

  it('updates characterParts and synchronizes ref', () => {
    const { result } = renderHook(() => useProjectState());
    
    act(() => {
      result.current.setCharacterParts([{ id: 'p1', type: 'head', name: 'P1', zIndex: 1, baseTransform: { x:0, y:0, rotation:0, scaleX:1, scaleY:1, opacity:1 } }]);
    });

    expect(result.current.characterParts.length).toBe(1);
    expect(result.current.characterPartsRef.current.length).toBe(1);
  });
});
