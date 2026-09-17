import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Polyfill WebIDL for Undici / JSDOM compatibility in Node environments
if (typeof (globalThis as any).webidl === 'object') {
  if (!(globalThis as any).webidl.util) (globalThis as any).webidl.util = {};
  if (!(globalThis as any).webidl.util.markAsUncloneable) {
    (globalThis as any).webidl.util.markAsUncloneable = () => {};
  }
}

const dummyRaf = (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
const dummyCaf = (id: number) => clearTimeout(id);

if (typeof window !== 'undefined') {
  if (!('requestAnimationFrame' in window) || !(window as any).requestAnimationFrame) {
    Object.defineProperty(window, 'requestAnimationFrame', {
      value: dummyRaf,
      writable: true,
      configurable: true,
    });
  }
  if (!('cancelAnimationFrame' in window) || !(window as any).cancelAnimationFrame) {
    Object.defineProperty(window, 'cancelAnimationFrame', {
      value: dummyCaf,
      writable: true,
      configurable: true,
    });
  }
}

afterEach(() => {
  cleanup();
});

/**
 * jsdom has no canvas implementation: `HTMLCanvasElement.prototype.getContext`
 * logs "Not implemented" and returns null. The production text-measurement
 * helper (`src/utils/bounds.ts`) already falls back when the context is
 * missing, so returning null up front is behaviour-identical and removes the
 * per-suite noise from every test that renders text geometry.
 */
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

/**
 * jsdom cannot follow a download link: activating an anchor that carries
 * `download` (or a `blob:`/`data:` href) makes it log "Not implemented:
 * navigation to another Document". The download helpers only build the anchor
 * and click it, so for those links the click event is still dispatched for
 * listeners, but jsdom must not try to activate the (unreachable) target.
 *
 * Approach: while the event is dispatched the link temporarily points at a
 * same-document fragment, which jsdom navigates without logging; the original
 * href is restored immediately afterwards, so the element's own observable
 * state is unchanged. Ordinary anchors stay entirely on jsdom's native path.
 */
if (typeof HTMLAnchorElement !== 'undefined') {
  const nativeAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function anchorClick(this: HTMLAnchorElement) {
    const href = this.getAttribute('href') ?? '';
    const isDownloadLink = this.hasAttribute('download') || /^(?:blob|data):/u.test(href);
    if (!isDownloadLink) {
      nativeAnchorClick.call(this);
      return;
    }
    this.setAttribute('href', '#');
    try {
      this.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    } finally {
      this.setAttribute('href', href);
    }
  };
}
