import { useEffect, type RefObject } from 'react';

/**
 * The dialog focus lifecycle: focus goes into the dialog when it opens, the
 * keyboard stays in it while it is open, and focus returns to the element that
 * opened it when it closes. Removed openers are ignored safely.
 */

/** Everything inside a dialog that can hold focus, in document order. */
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

/**
 * Keeps the keyboard inside an open modal: `Tab`/`Shift+Tab` wrap around the
 * dialog's own focusable elements — a disabled control is not a stop, so a
 * dialog with one enabled action keeps the keyboard on it — and `Escape`
 * dismisses the dialog through the caller's handler (the dialog keeps its own
 * Cancel semantics rather than this hook inventing a second one).
 */
export const useDialogFocusTrap = <T extends HTMLElement>(
  isOpen: boolean,
  containerRef: RefObject<T | null>,
  onDismiss: () => void,
): void => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
        return;
      }
      if (event.key !== 'Tab') return;

      const container = containerRef.current;
      if (!container) return;
      const stops = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (!first || !last) return;

      // Focus that is not inside the dialog (or is on the container itself) is
      // pulled back to an end of the loop instead of escaping the modal.
      const active = document.activeElement;
      const outside = !(active instanceof HTMLElement) || !container.contains(active) || active === container;
      if (event.shiftKey && (outside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (outside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, isOpen, onDismiss]);
};
