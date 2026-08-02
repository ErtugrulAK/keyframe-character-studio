import '@testing-library/jest-dom';

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
