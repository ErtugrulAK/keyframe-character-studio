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

/**
 * jsdom implements neither `URL.createObjectURL` nor `URL.revokeObjectURL`. The
 * environment therefore pairs **Node's** `URL` with the `Blob` jsdom provides, and
 * whether that pairing works is an accident of jsdom's internals: `jsdom` 30.0.1's
 * Blob carried the symbol the Node implementation looks for, and 30.1.1's does not,
 * so `createObjectURL` throws `Cannot read properties of undefined (reading
 * '_buffer')` on the very Blob this environment produces.
 *
 * The download helpers only build an anchor around the URL and click it, so a
 * stable object URL is all a test needs — and one definition here keeps every
 * download test independent of the jsdom version instead of each test depending on
 * the pairing. Tests that assert on their own object-URL calls still stub the API
 * locally, which overrides this.
 */
if (typeof URL !== 'undefined') {
  let objectUrlCounter = 0;
  URL.createObjectURL = () => `blob:kcs-test-${(objectUrlCounter += 1)}`;
  URL.revokeObjectURL = () => undefined;
}
