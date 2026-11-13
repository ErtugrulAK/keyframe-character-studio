import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The Media button's import: what layer each file becomes, and that a file
 * which cannot be read or decoded says so (the stage's drop already did)
 * instead of silently adding nothing. jsdom decodes no images, so the reader
 * and the image are stand-ins that succeed or fail on demand.
 */
const store = vi.hoisted(() => ({ addCustomPart: vi.fn(), showToast: vi.fn() }));
vi.mock('../context/useAnimator', () => ({ useAnimatorSlice: () => store }));
vi.mock('../utils/geometry/imageContentBounds', () => ({
  visibleContentRectOfImage: () => null,
  contentBoundsInLocalUnits: () => undefined,
}));

const { useMediaImport } = await import('../hooks/useMediaImport');

let readFails = false;
let decodeFails = false;
let natural = { width: 300, height: 150 };

class FakeReader {
  onload: ((event: { target: { result: string } }) => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(file: File) {
    queueMicrotask(() => {
      if (readFails) this.onerror?.();
      else this.onload?.({ target: { result: `data:${file.type};base64,AAAA` } });
    });
  }
}

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = natural.width;
  naturalHeight = natural.height;
  set src(_value: string) {
    queueMicrotask(() => (decodeFails ? this.onerror?.() : this.onload?.()));
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const file = (name: string, type: string) => new File(['x'], name, { type });

beforeEach(() => {
  readFails = false;
  decodeFails = false;
  natural = { width: 300, height: 150 };
  store.addCustomPart.mockReset();
  store.showToast.mockReset();
  vi.stubGlobal('FileReader', FakeReader);
  vi.stubGlobal('Image', FakeImage);
});

afterEach(() => vi.unstubAllGlobals());

describe('useMediaImport', () => {
  it('adds an image layer fitted to 150 px on its long side, named without the extension', async () => {
    const { result } = renderHook(() => useMediaImport());
    result.current([file('logo.final.png', 'image/png')]);
    await flush();
    expect(store.addCustomPart).toHaveBeenCalledWith('custom_image', 'logo.final', expect.objectContaining({ width: 150, height: 75, imageUrl: 'data:image/png;base64,AAAA' }));
  });

  it('fits a tall image by its height', async () => {
    natural = { width: 100, height: 400 };
    const { result } = renderHook(() => useMediaImport());
    result.current([file('tall.png', 'image/png')]);
    await flush();
    expect(store.addCustomPart).toHaveBeenCalledWith('custom_image', 'tall', expect.objectContaining({ width: 38, height: 150 }));
  });

  it('adds a video layer, recognising a video by its extension when the type is empty', async () => {
    const { result } = renderHook(() => useMediaImport());
    result.current([file('clip.webm', '')]);
    await flush();
    expect(store.addCustomPart).toHaveBeenCalledWith('custom_video', 'clip', { videoUrl: 'data:;base64,AAAA' });
  });

  it('ignores a file that is neither an image nor a video', async () => {
    const { result } = renderHook(() => useMediaImport());
    result.current([file('notes.txt', 'text/plain')]);
    await flush();
    expect(store.addCustomPart).not.toHaveBeenCalled();
  });

  it('says so when a file cannot be read', async () => {
    readFails = true;
    const { result } = renderHook(() => useMediaImport());
    result.current([file('broken.png', 'image/png'), file('broken.mp4', 'video/mp4')]);
    await flush();
    expect(store.addCustomPart).not.toHaveBeenCalled();
    expect(store.showToast).toHaveBeenCalledWith('"broken.png" could not be read.', 'error');
    expect(store.showToast).toHaveBeenCalledWith('"broken.mp4" could not be read.', 'error');
  });

  it('says so when an image cannot be decoded', async () => {
    decodeFails = true;
    const { result } = renderHook(() => useMediaImport());
    result.current([file('corrupt.png', 'image/png')]);
    await flush();
    expect(store.addCustomPart).not.toHaveBeenCalled();
    expect(store.showToast).toHaveBeenCalledWith('"corrupt.png" could not be read.', 'error');
  });
});
