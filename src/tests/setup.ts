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
 * jsdom cannot follow a download link: clicking an anchor that carries
 * `download` (or a `blob:`/`data:` href) makes it log "Not implemented:
 * navigation to another Document". The download helpers only build the anchor
 * and click it, and the tests assert the anchor's own state, so skipping the
 * navigation attempt here removes the noise without changing what a test can
 * observe. Ordinary anchors keep jsdom's normal click behaviour.
 */
if (typeof HTMLAnchorElement !== 'undefined') {
  const nativeAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function anchorClick(this: HTMLAnchorElement) {
    const href = this.getAttribute('href') ?? '';
    const isDownloadLink = this.hasAttribute('download') || /^(?:blob|data):/u.test(href);
    if (isDownloadLink) return;
    nativeAnchorClick.call(this);
  };
}
