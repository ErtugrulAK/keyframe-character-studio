import '@testing-library/jest-dom';

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
