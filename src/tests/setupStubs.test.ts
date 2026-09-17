import { describe, expect, it, vi } from 'vitest';

/**
 * Contract tests for the jsdom compatibility stubs in `src/tests/setup.ts`.
 *
 * They exist because the stubs remove environment noise (jsdom has no canvas
 * and cannot navigate). A stub that silently overreaches — swallowing the click
 * event instead of only the navigation, or leaving the element mutated — would
 * make later tests pass for the wrong reason, so the semantics are pinned here.
 */
describe('test setup stubs', () => {
  it('returns null from HTMLCanvasElement.getContext, matching jsdom without the canvas package', () => {
    const canvas = document.createElement('canvas');
    expect(canvas.getContext('2d')).toBeNull();
  });

  it('dispatches the click event for a download link and restores the href afterwards', () => {
    const anchor = document.createElement('a');
    anchor.setAttribute('href', 'blob:mock');
    anchor.setAttribute('download', 'kcs.json');
    const seen: { hrefDuringEvent: string | null; type: string }[] = [];
    anchor.addEventListener('click', (event) => {
      seen.push({ hrefDuringEvent: anchor.getAttribute('href'), type: event.type });
    });
    document.body.appendChild(anchor);

    expect(() => anchor.click()).not.toThrow();

    expect(seen).toEqual([{ hrefDuringEvent: '#', type: 'click' }]);
    expect(anchor.getAttribute('href')).toBe('blob:mock');
    expect(anchor.getAttribute('download')).toBe('kcs.json');
    anchor.remove();
  });

  it('lets a download-link listener cancel the event', () => {
    const anchor = document.createElement('a');
    anchor.setAttribute('href', 'data:application/json;base64,e30=');
    anchor.setAttribute('download', 'kcs.json');
    let defaultPrevented = false;
    anchor.addEventListener('click', (event) => {
      event.preventDefault();
      defaultPrevented = event.defaultPrevented;
    });
    document.body.appendChild(anchor);

    anchor.click();

    expect(defaultPrevented).toBe(true);
    expect(anchor.getAttribute('href')).toBe('data:application/json;base64,e30=');
    anchor.remove();
  });

  it('treats a blob href without the download attribute as a download link too', () => {
    const anchor = document.createElement('a');
    anchor.setAttribute('href', 'blob:another');
    const listener = vi.fn();
    anchor.addEventListener('click', listener);
    document.body.appendChild(anchor);

    anchor.click();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(anchor.getAttribute('href')).toBe('blob:another');
    anchor.remove();
  });

  it('keeps ordinary anchors on the native click path', () => {
    const anchor = document.createElement('a');
    anchor.setAttribute('href', '#section');
    const listener = vi.fn();
    anchor.addEventListener('click', listener);
    document.body.appendChild(anchor);

    anchor.click();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(anchor.getAttribute('href')).toBe('#section');
    anchor.remove();
  });
});
