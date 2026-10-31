/**
 * The keyboard-focus boundary of the editor.
 *
 * Two questions are asked all over the editor's keyboard code, and both have
 * exactly one answer:
 *
 *   1. Does a TEXT surface own the keyboard? A focused `input`, `textarea`,
 *      `select` or `contenteditable` is typing, so a single-letter tool key must
 *      never reach the editor. (`modalBoundary` answers the neighbouring
 *      question about dialogs.)
 *   2. Which SURFACE owns the keyboard? A region declares its own scope with
 *      `data-shortcut-scope="…"`, and the focused element's nearest ancestor
 *      carrying that attribute is the surface that owns the keys. The timeline
 *      declares `timeline`, which is how a command can tell that the timeline —
 *      and not the canvas — is the active surface.
 */
import { SHORTCUT_SCOPE_ATTRIBUTE, type ShortcutScope } from './shortcuts';

const EDITABLE_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];

/** True while a text-editing surface holds focus. */
export const isEditableElement = (element: Element | null | undefined): boolean => {
  if (!element) return false;
  if (EDITABLE_TAGS.includes(element.tagName)) return true;
  return (element as HTMLElement).isContentEditable === true;
};

/** The scope of the surface the focused element lives in, when it declares one. */
export const focusedShortcutScope = (): string | null => {
  if (typeof document === 'undefined') return null;
  const owner = document.activeElement?.closest(`[${SHORTCUT_SCOPE_ATTRIBUTE}]`);
  return owner?.getAttribute(SHORTCUT_SCOPE_ATTRIBUTE) ?? null;
};

/** True while the focused element lives inside the surface that declares `scope`. */
export const ownsShortcutScope = (scope: ShortcutScope): boolean => focusedShortcutScope() === scope;
