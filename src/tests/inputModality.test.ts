import { afterEach, describe, expect, it } from 'vitest';
import { installInputModality } from '../utils/editor/inputModality';

/**
 * Focus rings show only for keyboard navigation: the root element says how
 * the editor is being driven, and the stylesheet keys off it.
 */
describe('installInputModality', () => {
  let uninstall: (() => void) | null = null;
  afterEach(() => {
    uninstall?.();
    uninstall = null;
    delete document.documentElement.dataset.inputModality;
  });

  const key = (keyName: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true }));
  const pointer = () => window.dispatchEvent(new Event('pointerdown', { bubbles: true }));

  it('starts in pointer mode', () => {
    uninstall = installInputModality();
    expect(document.documentElement.dataset.inputModality).toBe('pointer');
  });

  it('switches to keyboard on Tab and back to pointer on a press', () => {
    uninstall = installInputModality();
    key('Tab');
    expect(document.documentElement.dataset.inputModality).toBe('keyboard');
    pointer();
    expect(document.documentElement.dataset.inputModality).toBe('pointer');
  });

  it('ignores other keys: typing or shortcuts never bring the rings back', () => {
    uninstall = installInputModality();
    for (const name of ['a', 'Enter', 'Escape', 'ArrowDown', 'Shift', 'Delete']) key(name);
    expect(document.documentElement.dataset.inputModality).toBe('pointer');
  });

  it('marks the root it is given', () => {
    const root = document.createElement('div');
    uninstall = installInputModality(root);
    key('Tab');
    expect(root.dataset.inputModality).toBe('keyboard');
    expect(document.documentElement.dataset.inputModality).toBeUndefined();
  });

  it('stops listening once uninstalled', () => {
    installInputModality()();
    key('Tab');
    expect(document.documentElement.dataset.inputModality).toBe('pointer');
  });

  it('listens in the capture phase, so a handler that stops the event cannot hide a Tab', () => {
    uninstall = installInputModality();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.addEventListener('keydown', (event) => event.stopPropagation());
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.documentElement.dataset.inputModality).toBe('keyboard');
    input.remove();
  });
});
