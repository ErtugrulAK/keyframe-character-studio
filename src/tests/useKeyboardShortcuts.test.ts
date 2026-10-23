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
      deleteSelectedKeyframes: mockDeleteSelectedKeyframe,
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
      deleteSelectedKeyframes: vi.fn(() => false),
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
    const deleteSelectedKeyframes = vi.fn(() => true);
    const deletePart = vi.fn();
    renderHook(() => useKeyboardShortcuts({
      selectedPartId: 'part_1',
      undo: vi.fn(),
      redo: vi.fn(),
      copySelectedPart: vi.fn(),
      pasteCopiedPart: vi.fn(),
      duplicateSelectedPart: vi.fn(),
      deleteSelectedKeyframes,
      deletePart,
    }));

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key })));

    expect(deleteSelectedKeyframes).toHaveBeenCalledOnce();
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
      deleteSelectedKeyframes: vi.fn(() => false),
      deletePart,
    }));

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' })));

    expect(deletePart).toHaveBeenCalledWith('part_1');
  });

  it('does not delete a keyframe or part while an editable element has focus', () => {
    const deleteSelectedKeyframes = vi.fn(() => true);
    const deletePart = vi.fn();
    renderHook(() => useKeyboardShortcuts({
      selectedPartId: 'part_1',
      undo: vi.fn(),
      redo: vi.fn(),
      copySelectedPart: vi.fn(),
      pasteCopiedPart: vi.fn(),
      duplicateSelectedPart: vi.fn(),
      deleteSelectedKeyframes,
      deletePart,
    }));
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.tabIndex = 0;
    Object.defineProperty(editor, 'isContentEditable', { value: true });
    document.body.appendChild(editor);
    editor.focus();

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' })));

    expect(deleteSelectedKeyframes).not.toHaveBeenCalled();
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
      deleteSelectedKeyframes: vi.fn(() => false),
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

/**
 * The commands this round added, and the three rules that decide whether a
 * command runs at all: the keymap decides the gesture, the emphasis is on the
 * chains (Escape) and the scopes (the timeline owns Delete).
 */
interface HookSpies {
  undo: ReturnType<typeof vi.fn>;
  redo: ReturnType<typeof vi.fn>;
  copySelectedPart: ReturnType<typeof vi.fn>;
  pasteCopiedPart: ReturnType<typeof vi.fn>;
  duplicateSelectedPart: ReturnType<typeof vi.fn>;
  deleteSelectedKeyframes: ReturnType<typeof vi.fn>;
  deletePart: ReturnType<typeof vi.fn>;
  setActiveTool: ReturnType<typeof vi.fn>;
  armShapeCreation: ReturnType<typeof vi.fn>;
  addCustomPart: ReturnType<typeof vi.fn>;
  selectAllLayers: ReturnType<typeof vi.fn>;
  groupSelection: ReturnType<typeof vi.fn>;
  ungroupSelection: ReturnType<typeof vi.fn>;
  exitGroupDrillIn: ReturnType<typeof vi.fn>;
  clearKeyframeSelection: ReturnType<typeof vi.fn>;
  cancelShapeCreation: ReturnType<typeof vi.fn>;
  exitBooleanOperandEditing: ReturnType<typeof vi.fn>;
  openShortcutReference: ReturnType<typeof vi.fn>;
  setIsPlaying: ReturnType<typeof vi.fn>;
}

const spies = (): HookSpies => ({
  undo: vi.fn(),
  redo: vi.fn(),
  copySelectedPart: vi.fn(),
  pasteCopiedPart: vi.fn(),
  duplicateSelectedPart: vi.fn(),
  deleteSelectedKeyframes: vi.fn(() => false),
  deletePart: vi.fn(),
  setActiveTool: vi.fn(),
  armShapeCreation: vi.fn(),
  addCustomPart: vi.fn(),
  selectAllLayers: vi.fn(),
  groupSelection: vi.fn(),
  ungroupSelection: vi.fn(),
  exitGroupDrillIn: vi.fn(() => false),
  clearKeyframeSelection: vi.fn(() => false),
  cancelShapeCreation: vi.fn(),
  exitBooleanOperandEditing: vi.fn(() => false),
  openShortcutReference: vi.fn(),
  setIsPlaying: vi.fn(),
});

/**
 * Renders the hook with a full set of spies. `cancelShapeCreation` starts
 * undefined because it is the FIRST step of the Escape chain: a test that wants
 * to reach a later step simply does not arm it.
 */
const renderShortcuts = (overrides: Partial<HookSpies> & { selectedPartId?: string | null; activeTool?: string; appMode?: 'edit' | 'broadcast' } = {}) => {
  const api = spies();
  const options = { ...api, selectedPartId: 'part_1', cancelShapeCreation: undefined, ...overrides };
  renderHook(() => useKeyboardShortcuts({
    ...options,
    selectedPartId: options.selectedPartId,
    activeTool: options.activeTool as never,
    appMode: options.appMode,
  }));
  return { ...api, ...overrides } as HookSpies;
};

const pressWith = (key: string, init: KeyboardEventInit = {}) =>
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true, ...init })));

describe('shortcut commands added in round four, part four', () => {
  it('runs Select All, Group and Ungroup on the mod+A/G/Shift+G bindings', () => {
    const api = renderShortcuts();

    pressWith('a', { ctrlKey: true });
    pressWith('g', { ctrlKey: true });
    pressWith('g', { ctrlKey: true, shiftKey: true });

    expect(api.selectAllLayers).toHaveBeenCalledOnce();
    expect(api.groupSelection).toHaveBeenCalledOnce();
    expect(api.ungroupSelection).toHaveBeenCalledOnce();
  });

  it('arms creation on R/O/T and toggles the pen on P', () => {
    const api = renderShortcuts();

    pressWith('r');
    pressWith('o');
    pressWith('t');
    pressWith('p');

    expect(api.armShapeCreation).toHaveBeenNthCalledWith(1, 'custom_rect', 'Rectangle');
    expect(api.armShapeCreation).toHaveBeenNthCalledWith(2, 'custom_circle', 'Circle');
    expect(api.addCustomPart).toHaveBeenCalledWith('custom_text', 'Text');
    expect(api.setActiveTool).toHaveBeenCalledWith('freeform_draw');
  });

  it('stops the drawing tool on P while it is the active tool', () => {
    const api = renderShortcuts({ activeTool: 'freeform_draw' });

    pressWith('p');

    expect(api.setActiveTool).toHaveBeenCalledWith('select');
  });

  it('opens the shortcut reference on ?', () => {
    const api = renderShortcuts();

    pressWith('?', { shiftKey: true });

    expect(api.openShortcutReference).toHaveBeenCalledOnce();
  });

  it('toggles playback on Space through the one authority and stays inert in broadcast', () => {
    const playing = renderShortcuts();
    pressWith(' ');
    expect(playing.setIsPlaying).toHaveBeenCalledOnce();
    const toggle = (playing.setIsPlaying.mock.calls[0][0] as (playing: boolean) => boolean);
    expect(toggle(false)).toBe(true);
    expect(toggle(true)).toBe(false);

    const broadcast = renderShortcuts({ appMode: 'broadcast' });
    pressWith(' ');
    expect(broadcast.setIsPlaying).not.toHaveBeenCalled();
  });

  it('C4: Broadcast takes no editing key — only the shortcut reference opens', () => {
    const api = renderShortcuts({ appMode: 'broadcast' });

    pressWith('Delete');
    pressWith('Backspace');
    pressWith('z', { ctrlKey: true });
    pressWith('y', { ctrlKey: true });
    pressWith('c', { ctrlKey: true });
    pressWith('v', { ctrlKey: true });
    pressWith('d', { ctrlKey: true });
    pressWith('a', { ctrlKey: true });
    pressWith('g', { ctrlKey: true });
    pressWith('r');
    pressWith('t');
    pressWith('p');
    pressWith('Escape');

    for (const spy of [api.deletePart, api.deleteSelectedKeyframes, api.undo, api.redo, api.copySelectedPart, api.pasteCopiedPart,
      api.duplicateSelectedPart, api.selectAllLayers, api.groupSelection, api.armShapeCreation, api.addCustomPart, api.setActiveTool,
      api.clearKeyframeSelection]) {
      expect(spy).not.toHaveBeenCalled();
    }
    pressWith('?', { shiftKey: true });
    expect(api.openShortcutReference).toHaveBeenCalledOnce();
  });
});

describe('the Escape chain', () => {
  it('cancels an armed shape creation before anything else', () => {
    const api = renderShortcuts({ cancelShapeCreation: vi.fn() });

    pressWith('Escape');

    expect(api.cancelShapeCreation).toHaveBeenCalledOnce();
    expect(api.exitBooleanOperandEditing).not.toHaveBeenCalled();
    expect(api.exitGroupDrillIn).not.toHaveBeenCalled();
    expect(api.clearKeyframeSelection).not.toHaveBeenCalled();
  });

  it('leaves Escape to the drawing tool while it owns the gesture', () => {
    const api = renderShortcuts({ activeTool: 'freeform_draw' });

    pressWith('Escape');

    expect(api.exitBooleanOperandEditing).not.toHaveBeenCalled();
    expect(api.exitGroupDrillIn).not.toHaveBeenCalled();
    expect(api.clearKeyframeSelection).not.toHaveBeenCalled();
  });

  it('walks the chain in priority order and stops at the first step that acted', () => {
    const operands = renderShortcuts({ exitBooleanOperandEditing: vi.fn(() => true) });
    pressWith('Escape');
    expect(operands.exitBooleanOperandEditing).toHaveBeenCalledOnce();
    expect(operands.exitGroupDrillIn).not.toHaveBeenCalled();
    expect(operands.clearKeyframeSelection).not.toHaveBeenCalled();

    const drillIn = renderShortcuts({ exitGroupDrillIn: vi.fn(() => true) });
    pressWith('Escape');
    expect(drillIn.exitGroupDrillIn).toHaveBeenCalledOnce();
    expect(drillIn.clearKeyframeSelection).not.toHaveBeenCalled();

    const keyframes = renderShortcuts({ clearKeyframeSelection: vi.fn(() => true) });
    pressWith('Escape');
    expect(keyframes.clearKeyframeSelection).toHaveBeenCalledOnce();
  });

  it('never clears the layer selection', () => {
    // No step acts: the selection survives (clicking empty stage space is the
    // editor's deselect gesture, and several surfaces own Escape while open).
    const api = renderShortcuts();
    pressWith('Escape');
    expect(api.deletePart).not.toHaveBeenCalled();
    expect(api.exitGroupDrillIn).toHaveBeenCalledOnce();
  });
});

describe('the timeline scope owns Delete', () => {
  const timeline = (): HTMLDivElement => {
    const element = document.createElement('div');
    element.setAttribute('data-shortcut-scope', 'timeline');
    const button = document.createElement('button');
    element.appendChild(button);
    document.body.appendChild(element);
    return element;
  };

  it('removes keyframes only, never a layer, while the timeline holds focus', () => {
    const api = renderShortcuts();
    const scope = timeline();
    act(() => scope.querySelector('button')?.focus());

    pressWith('Delete');
    // No keyframe was deleted, and the layer is untouched.
    expect(api.deleteSelectedKeyframes).toHaveBeenCalledOnce();
    expect(api.deletePart).not.toHaveBeenCalled();

    scope.remove();
  });

  it('keeps the existing fallback outside the timeline', () => {
    const api = renderShortcuts();
    const scope = timeline();
    act(() => scope.querySelector('button')?.focus());

    pressWith('Delete');
    expect(api.deletePart).not.toHaveBeenCalled();

    // Leaving the timeline surface (here: the scope element is gone, so focus
    // falls back to the document body) restores the ordinary chain.
    scope.remove();
    pressWith('Delete');
    expect(api.deletePart).toHaveBeenCalledWith('part_1');
  });
});
