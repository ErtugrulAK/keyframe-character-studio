import { useEffect, type RefObject } from 'react';

/**
 * Moves focus into a dialog when it opens, then returns focus to the element
 * that opened it when the dialog closes. Removed openers are ignored safely.
 */
export const useDialogFocusRestoration = <T extends HTMLElement>(
  isOpen: boolean,
  initialFocusRef: RefObject<T | null>,
): void => {
  useEffect(() => {
    if (!isOpen) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    initialFocusRef.current?.focus();

    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [initialFocusRef, isOpen]);
};
