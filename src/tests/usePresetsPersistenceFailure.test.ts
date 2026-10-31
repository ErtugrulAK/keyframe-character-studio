// SAFE-03-B — preset persistence failures must be visible, exactly once per
// failed attempt, without touching the storage model.
//
// Today a failed `localStorage.setItem` is only a console warning: the user
// believes presets are saved while they live in memory alone. The hook gains
// an optional `onPersistenceFailure` notification; this suite pins:
//   * failure -> in-memory edit kept, console warning kept, callback fired
//     EXACTLY once for that attempt, storage untouched, no false success;
//   * a later legitimate change retries and persists normally;
//   * successful saves never notify;
//   * boot (including StrictMode) still writes nothing and notifies nothing.

import { StrictMode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePresets } from '../hooks/usePresets';
import { initializeIdCounter } from '../utils/layers/idGenerator';
import type { CustomMotionPreset } from '../types/animator';

const STORAGE_KEY = 'keyframe_custom_motion_presets';

function validInput(name: string) {
  return {
    name,
    type: 'in' as const,
    durationFrames: 40,
    keyframes: [
      { progress: 0, deltaX: 0, deltaY: -400, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0, easing: 'easeInOut' },
      { progress: 1, deltaX: 0, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, easing: 'easeInOut' },
    ],
  };
}

class QuotaError extends Error {
  constructor() {
    super('QuotaExceededError');
    this.name = 'QuotaExceededError';
  }
}

// Captured before any spy replaces it, so the recovery path can delegate.
const nativeSetItem = Storage.prototype.setItem;
describe('SAFE-03-B — preset persistence failure feedback', () => {
  let setItemSpy: ReturnType<typeof vi.spyOn>;
  let onPersistenceFailure: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    initializeIdCounter([]);
    onPersistenceFailure = vi.fn();
    setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mount() {
    return renderHook(() => usePresets({ onPersistenceFailure }));
  }

  it('a quota failure notifies exactly once and keeps the edit in memory', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setItemSpy.mockImplementation(() => {
      throw new QuotaError();
    });

    const { result } = mount();
    act(() => {
      result.current.savePreset(validInput('Quota Preset'));
    });

    expect(onPersistenceFailure).toHaveBeenCalledTimes(1);
    expect(result.current.customPresets.some((preset) => preset.name === 'Quota Preset')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it('two failed attempts produce two honest notifications', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    setItemSpy.mockImplementation(() => {
      throw new QuotaError();
    });

    const { result } = mount();

    act(() => {
      result.current.savePreset(validInput('First'));
    });
    act(() => {
      result.current.savePreset(validInput('Second'));
    });

    expect(onPersistenceFailure).toHaveBeenCalledTimes(2);
  });

  it('after the store recovers, the next legitimate change persists normally', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let failNext = true;
    setItemSpy.mockImplementation((key: string, value: string) => {
      if (failNext) {
        failNext = false;
        throw new QuotaError();
      }
      return nativeSetItem.call(localStorage, key, value);
    });

    const { result } = mount();
    act(() => {
      result.current.savePreset(validInput('Down'));
    });
    expect(onPersistenceFailure).toHaveBeenCalledTimes(1);
    onPersistenceFailure.mockClear();

    act(() => {
      result.current.savePreset(validInput('Up'));
    });

    expect(onPersistenceFailure).not.toHaveBeenCalled();
    const written = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as CustomMotionPreset[];
    expect(written.some((preset) => preset.name === 'Up')).toBe(true);
  });

  it('successful persistence never notifies', () => {
    const { result } = mount();
    act(() => {
      result.current.savePreset(validInput('Healthy'));
    });

    expect(onPersistenceFailure).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toContain('Healthy');
  });

  it('boot with a hostile store neither writes nor notifies, in StrictMode too', () => {
    setItemSpy.mockImplementation(() => {
      throw new QuotaError();
    });

    renderHook(() => usePresets({ onPersistenceFailure }), { wrapper: StrictMode });

    expect(onPersistenceFailure).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('the hook stays usable without the options argument (existing consumers unaffected)', () => {
    const { result } = renderHook(() => usePresets());
    act(() => {
      result.current.savePreset(validInput('Classic'));
    });
    expect(localStorage.getItem(STORAGE_KEY)).toContain('Classic');
  });
});
