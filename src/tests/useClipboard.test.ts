import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useClipboard } from '../hooks/useClipboard';

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
});
