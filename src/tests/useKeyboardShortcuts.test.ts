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
    const mockDeleteSelectedKeyframe = vi.fn(() => false);

    renderHook(() => useKeyboardShortcuts({
      selectedPartId: 'part_1',
      undo: mockUndo,
      redo: mockRedo,
      copySelectedPart: mockCopy,
      pasteCopiedPart: mockPaste,
      duplicateSelectedPart: mockDuplicate,
      deleteSelectedKeyframe: mockDeleteSelectedKeyframe,
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
      deleteSelectedKeyframe: vi.fn(() => false),
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

  it.each(['Backspace', 'Delete'])('deletes a selected keyframe before the selected part with %s', (key) => {
    const deleteSelectedKeyframe = vi.fn(() => true);
    const deletePart = vi.fn();
    renderHook(() => useKeyboardShortcuts({
      selectedPartId: 'part_1',
      undo: vi.fn(),
      redo: vi.fn(),
      copySelectedPart: vi.fn(),
      pasteCopiedPart: vi.fn(),
      duplicateSelectedPart: vi.fn(),
      deleteSelectedKeyframe,
      deletePart,
    }));

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key })));

    expect(deleteSelectedKeyframe).toHaveBeenCalledOnce();
    expect(deletePart).not.toHaveBeenCalled();
  });

  it('falls back to part deletion when no valid keyframe selection resolves', () => {
    const deletePart = vi.fn();
    renderHook(() => useKeyboardShortcuts({
      selectedPartId: 'part_1',
      undo: vi.fn(),
      redo: vi.fn(),
      copySelectedPart: vi.fn(),
      pasteCopiedPart: vi.fn(),
      duplicateSelectedPart: vi.fn(),
      deleteSelectedKeyframe: vi.fn(() => false),
      deletePart,
    }));

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' })));

    expect(deletePart).toHaveBeenCalledWith('part_1');
  });

  it('does not delete a keyframe or part while an editable element has focus', () => {
    const deleteSelectedKeyframe = vi.fn(() => true);
    const deletePart = vi.fn();
    renderHook(() => useKeyboardShortcuts({
      selectedPartId: 'part_1',
      undo: vi.fn(),
      redo: vi.fn(),
      copySelectedPart: vi.fn(),
      pasteCopiedPart: vi.fn(),
      duplicateSelectedPart: vi.fn(),
      deleteSelectedKeyframe,
      deletePart,
    }));
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.tabIndex = 0;
    Object.defineProperty(editor, 'isContentEditable', { value: true });
    document.body.appendChild(editor);
    editor.focus();

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' })));

    expect(deleteSelectedKeyframe).not.toHaveBeenCalled();
    expect(deletePart).not.toHaveBeenCalled();
    editor.remove();
  });
  it('switches Select/Hand tools and emits centralized zoom commands', () => {
    const setActiveTool = vi.fn();
    const zoomCommands: string[] = [];
    const listener = (event: Event) => {
      const type = (event as CustomEvent<{ type: string }>).detail.type;
      zoomCommands.push(type);
    };
    window.addEventListener('canvas-viewport-command', listener);
    renderHook(() => useKeyboardShortcuts({
      selectedPartId: null,
      undo: vi.fn(),
      redo: vi.fn(),
      copySelectedPart: vi.fn(),
      pasteCopiedPart: vi.fn(),
      duplicateSelectedPart: vi.fn(),
      deleteSelectedKeyframe: vi.fn(() => false),
      deletePart: vi.fn(),
      setActiveTool,
    }));

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' })));
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' })));
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '+' })));
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '-' })));

    expect(setActiveTool).toHaveBeenNthCalledWith(1, 'select');
    expect(setActiveTool).toHaveBeenNthCalledWith(2, 'pan');
    expect(zoomCommands).toEqual(['zoom-in', 'zoom-out']);
    window.removeEventListener('canvas-viewport-command', listener);
  });
});
