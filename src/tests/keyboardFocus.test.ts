import { afterEach, describe, expect, it } from 'vitest';
import { focusedShortcutScope, isEditableElement, isTextEntryElement, ownsShortcutScope } from '../utils/editor/keyboardFocus';
import { isBlockingModalOpen } from '../utils/editor/modalBoundary';
import { SHORTCUT_SCOPE_ATTRIBUTE } from '../utils/editor/shortcuts';

/**
 * The two keyboard boundaries every editor shortcut asks about: does a text
 * surface own the keys, and which surface (or blocking dialog) is active.
 */
const make = (html: string): HTMLElement => {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  return host.firstElementChild as HTMLElement;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('isEditableElement / isTextEntryElement', () => {
  it.each([
    ['<input type="text">', true, true],
    ['<input>', true, true],
    ['<input type="number">', true, true],
    ['<input type="search">', true, true],
    ['<textarea></textarea>', true, true],
    ['<select><option>a</option></select>', true, false],
    ['<input type="range">', true, false],
    ['<input type="checkbox">', true, false],
    ['<input type="color">', true, false],
    ['<input type="file">', true, false],
    ['<button>b</button>', false, false],
    ['<div tabindex="0">d</div>', false, false],
  ])('%s: editable %s, text entry %s', (html, editable, textEntry) => {
    const element = make(html);
    expect(isEditableElement(element)).toBe(editable);
    expect(isTextEntryElement(element)).toBe(textEntry);
  });

  it('a contenteditable element is text entry; nothing focused is neither', () => {
    const element = make('<div contenteditable="true">x</div>');
    // jsdom does not implement isContentEditable; the browser sets it.
    Object.defineProperty(element, 'isContentEditable', { value: true });
    expect(isEditableElement(element)).toBe(true);
    expect(isTextEntryElement(element)).toBe(true);
    expect(isEditableElement(null)).toBe(false);
    expect(isTextEntryElement(undefined)).toBe(false);
  });
});

describe('shortcut scope', () => {
  it('is the nearest declared scope around the focused element', () => {
    const outer = make(`<div ${SHORTCUT_SCOPE_ATTRIBUTE}="canvas"><div ${SHORTCUT_SCOPE_ATTRIBUTE}="timeline"><button id="inner">t</button></div><button id="outer">c</button></div>`);
    outer.querySelector<HTMLElement>('#inner')!.focus();
    expect(focusedShortcutScope()).toBe('timeline');
    expect(ownsShortcutScope('timeline')).toBe(true);
    expect(ownsShortcutScope('canvas')).toBe(false);
    outer.querySelector<HTMLElement>('#outer')!.focus();
    expect(focusedShortcutScope()).toBe('canvas');
  });

  it('is null when the focused element sits in no declared surface', () => {
    make('<button id="free">f</button>');
    document.querySelector<HTMLElement>('#free')!.focus();
    expect(focusedShortcutScope()).toBeNull();
    (document.activeElement as HTMLElement).blur();
    expect(focusedShortcutScope()).toBeNull();
  });
});

describe('isBlockingModalOpen', () => {
  it('only an aria-modal dialog blocks; a popover dialog leaves the editor active', () => {
    expect(isBlockingModalOpen()).toBe(false);
    const popover = make('<div role="dialog">popover</div>');
    expect(isBlockingModalOpen()).toBe(false);
    popover.setAttribute('aria-modal', 'false');
    expect(isBlockingModalOpen()).toBe(false);
    const modal = make('<div role="dialog" aria-modal="true">modal</div>');
    expect(isBlockingModalOpen()).toBe(true);
    modal.remove();
    expect(isBlockingModalOpen()).toBe(false);
  });
});
