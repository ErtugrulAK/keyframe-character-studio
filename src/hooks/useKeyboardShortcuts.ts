import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  selectedPartId: string | null;
  undo: () => void;
  redo: () => void;
  copySelectedPart: () => void;
  pasteCopiedPart: () => void;
  duplicateSelectedPart: () => void;
  deletePart: (partId: string) => void;
}

export const useKeyboardShortcuts = ({
  selectedPartId,
  undo,
  redo,
  copySelectedPart,
  pasteCopiedPart,
  duplicateSelectedPart,
  deletePart,
}: UseKeyboardShortcutsOptions) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputActive =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable);

      if (isInputActive) return;

      // Undo: Ctrl + Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Redo: Ctrl + Y or Ctrl + Shift + Z
      else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        redo();
      }
      // Copy: Ctrl + C
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedPartId) {
          e.preventDefault();
          copySelectedPart();
        }
      }
      // Paste: Ctrl + V
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteCopiedPart();
      }
      // Duplicate: Ctrl + D
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedPartId) {
          e.preventDefault();
          duplicateSelectedPart();
        }
      }
      // Instant Delete without alert modal on Backspace or Delete
      else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedPartId) {
          e.preventDefault();
          deletePart(selectedPartId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPartId, deletePart, undo, redo, copySelectedPart, pasteCopiedPart, duplicateSelectedPart]);
};
