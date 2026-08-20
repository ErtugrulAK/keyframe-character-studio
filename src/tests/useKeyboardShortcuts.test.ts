import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

describe('useKeyboardShortcuts Hook', () => {
  it('registers keyboard event listener and triggers actions', () => {
    const mockUndo = vi.fn();
    const mockRedo = vi.fn();
    const mockCopy = vi.fn();
    const mockPaste = vi.fn();
    const mockDuplicate = vi.fn();
    const mockDelete = vi.fn();

    renderHook(() => useKeyboardShortcuts({
      selectedPartId: 'part_1',
      undo: mockUndo,
      redo: mockRedo,
      copySelectedPart: mockCopy,
      pasteCopiedPart: mockPaste,
      duplicateSelectedPart: mockDuplicate,
      deletePart: mockDelete
    }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    });
    expect(mockUndo).toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }));
    });
    expect(mockRedo).toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }));
    });
    expect(mockCopy).toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    });
    expect(mockDelete).toHaveBeenCalledWith('part_1');
  });

  it('ignores input fields', () => {
    const mockUndo = vi.fn();

    renderHook(() => useKeyboardShortcuts({
      selectedPartId: 'part_1',
      undo: mockUndo,
      redo: vi.fn(),
      copySelectedPart: vi.fn(),
      pasteCopiedPart: vi.fn(),
      duplicateSelectedPart: vi.fn(),
      deletePart: vi.fn()
    }));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    });

    expect(mockUndo).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });
});
