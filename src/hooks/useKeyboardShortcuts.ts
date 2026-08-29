import { useEffect } from 'react';
import type { ToolType } from '../types/animator';

interface UseKeyboardShortcutsOptions {
  selectedPartId: string | null;
  undo: () => void;
  redo: () => void;
  copySelectedPart: () => void;
  pasteCopiedPart: () => void;
  duplicateSelectedPart: () => void;
  deleteSelectedKeyframe: () => boolean;
  deletePart: (partId: string) => void;
  setActiveTool?: (tool: ToolType) => void;
  cancelShapeCreation?: () => void;
  exitBooleanOperandEditing?: () => void;
}

export const useKeyboardShortcuts = ({
  selectedPartId,
  undo,
  redo,
  copySelectedPart,
  pasteCopiedPart,
  duplicateSelectedPart,
  deleteSelectedKeyframe,
  deletePart,
  setActiveTool,
  cancelShapeCreation,
  exitBooleanOperandEditing,
}: UseKeyboardShortcutsOptions) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (
        activeEl.tagName === 'INPUT'
        || activeEl.tagName === 'TEXTAREA'
        || activeEl.tagName === 'SELECT'
        || (activeEl as HTMLElement).isContentEditable
      );
      if (isInputActive) return;

      const key = e.key.toLowerCase();
      if (e.key === 'Escape') {
        if (cancelShapeCreation) {
          cancelShapeCreation();
          return;
        }
        exitBooleanOperandEditing?.();
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key === 'v') {
        setActiveTool?.('select');
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key === 'h') {
        setActiveTool?.('pan');
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === '+' || e.key === '=' || e.key === '-')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('canvas-viewport-command', {
          detail: { type: e.key === '-' ? 'zoom-out' : 'zoom-in' },
        }));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        ((e.ctrlKey || e.metaKey) && key === 'y')
        || ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'z')
      ) {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && key === 'c') {
        if (selectedPartId) {
          e.preventDefault();
          copySelectedPart();
        }
      } else if ((e.ctrlKey || e.metaKey) && key === 'v') {
        e.preventDefault();
        pasteCopiedPart();
      } else if ((e.ctrlKey || e.metaKey) && key === 'd') {
        if (selectedPartId) {
          e.preventDefault();
          duplicateSelectedPart();
        }
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (deleteSelectedKeyframe()) {
          e.preventDefault();
          return;
        }
        if (selectedPartId) {
          e.preventDefault();
          deletePart(selectedPartId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPartId, deletePart, deleteSelectedKeyframe, undo, redo, copySelectedPart, pasteCopiedPart, duplicateSelectedPart, setActiveTool, cancelShapeCreation, exitBooleanOperandEditing]);
};
