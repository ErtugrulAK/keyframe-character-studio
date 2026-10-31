import { useLayoutEffect } from 'react';

/** Controls that stay usable on a locked layer: they only show or navigate. */
const EXEMPT = '[aria-expanded], [data-lock-exempt]';
const CONTROLS = 'input, select, textarea, button';

/**
 * The Inspector of a LOCKED layer stays readable but not editable: while
 * `active`, every form control inside `ref` is disabled, except disclosure
 * toggles (anything with `aria-expanded`) and controls marked
 * `data-lock-exempt` (navigation, copy). Controls mounted later — a card the
 * user opens — are caught too. When the lock is lifted, exactly the controls
 * this hook disabled are enabled again; a control that was disabled for its
 * own reason keeps that.
 *
 * This is the VISIBLE half of the lock only; the write path refuses every
 * change of a locked layer on its own (`utils/layers/layerLocks`).
 */
export const useLockedRegion = (ref: React.RefObject<HTMLElement | null>, active: boolean): void => {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!active || !root) return undefined;
    const disabledHere = new Set<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>();
    const lock = (element: Element) => {
      const control = element as HTMLInputElement;
      if (control.matches(EXEMPT) || control.disabled) return;
      control.disabled = true;
      disabledHere.add(control);
    };
    const lockAll = () => root.querySelectorAll(CONTROLS).forEach(lock);
    lockAll();
    const observer = typeof MutationObserver === 'function'
      ? new MutationObserver((records) => {
        for (const record of records) {
          // React may re-enable a control it re-renders; a new card mounts new ones.
          if (record.type === 'attributes' && record.target instanceof Element && record.target.matches(CONTROLS)) {
            const control = record.target as HTMLInputElement;
            if (!control.disabled && !control.matches(EXEMPT)) lock(control);
          }
          record.addedNodes.forEach((node) => {
            if (!(node instanceof Element)) return;
            if (node.matches(CONTROLS)) lock(node);
            node.querySelectorAll(CONTROLS).forEach(lock);
          });
        }
      })
      : null;
    observer?.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled'] });
    return () => {
      observer?.disconnect();
      disabledHere.forEach((control) => {
        control.disabled = false;
      });
    };
  }, [ref, active]);
};
