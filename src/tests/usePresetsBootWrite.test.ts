// N3 PR-2b — preset library boot-write safety.
//
// The persistence effect must be change-driven, not mount-driven: a tab that
// only booted has nothing to save, and writing the value it just read back
// over storage (a) destroys corrupt bytes the user could still recover,
// (b) overwrites fresher writes from another tab inside the boot window, and
// (c) burns a write per mount per tab for zero information.
//
// These tests pin the no-write-on-boot contract and every path that MUST
// still persist.

import { StrictMode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePresets } from '../hooks/usePresets';
import { DEFAULT_INITIAL_PRESETS } from '../context/initialStateData';
import { initializeIdCounter } from '../utils/layers/idGenerator';
import type { CustomMotionPreset } from '../types/animator';

const STORAGE_KEY = 'keyframe_custom_motion_presets';

const seed = (value: string) => {
  localStorage.setItem(STORAGE_KEY, value);
  // The spy sees this deliberate setup write; the boot contract under test
  // is about writes the hook itself performs after mount.
  vi.mocked(Storage.prototype.setItem).mockClear();
};
const stored = () => localStorage.getItem(STORAGE_KEY);

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'My Slide',
    type: 'in' as const,
    durationFrames: 40,
    keyframes: [
      { progress: 0, deltaX: 0, deltaY: -400, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0, easing: 'easeInOut' },
      { progress: 1, deltaX: 0, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, easing: 'easeInOut' },
    ],
    ...overrides,
  };
}

function mountPresets() {
  return renderHook(() => usePresets());
}

function mountPresetsStrict() {
  return renderHook(() => usePresets(), { wrapper: StrictMode });
}

describe('usePresets boot — no storage write without a user change', () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'setItem');
    localStorage.clear();
    initializeIdCounter([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('an idle boot with empty storage persists nothing', () => {
    const { result } = mountPresets();
    expect(result.current.customPresets).toEqual(DEFAULT_INITIAL_PRESETS);
    expect(Storage.prototype.setItem).not.toHaveBeenCalledWith(STORAGE_KEY, expect.anything());
    expect(stored()).toBeNull();
  });

  it('an idle boot leaves valid existing presets untouched on disk and loads them in memory', () => {
    const existing: CustomMotionPreset[] = [
      { id: 'preset_keep', name: 'Keep', type: 'in', durationFrames: 10, keyframes: [] },
    ];
    const raw = JSON.stringify(existing);
    seed(raw);

    const { result } = mountPresets();

    expect(result.current.customPresets).toEqual(existing);
    expect(Storage.prototype.setItem).not.toHaveBeenCalledWith(STORAGE_KEY, expect.anything());
    expect(stored()).toBe(raw);
  });

  it('corrupt storage is not silently replaced at mount: bytes survive and defaults show', () => {
    const corrupt = '{"broken":true}';
    seed(corrupt);

    const { result } = mountPresets();

    expect(result.current.customPresets).toEqual(DEFAULT_INITIAL_PRESETS);
    expect(Storage.prototype.setItem).not.toHaveBeenCalledWith(STORAGE_KEY, expect.anything());
    expect(stored()).toBe(corrupt);
  });

  it('StrictMode double-mount still writes nothing on boot', () => {
    const raw = JSON.stringify([{ id: 'preset_sm', name: 'SM', type: 'out', durationFrames: 5, keyframes: [] }]);
    seed(raw);

    mountPresetsStrict();

    expect(Storage.prototype.setItem).not.toHaveBeenCalledWith(STORAGE_KEY, expect.anything());
    expect(stored()).toBe(raw);
  });
});

describe('usePresets user-triggered persistence still works', () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'setItem');
    localStorage.clear();
    initializeIdCounter([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('savePreset persists the extended library', () => {
    const { result } = mountPresets();
    vi.mocked(Storage.prototype.setItem).mockClear();

    act(() => {
      result.current.savePreset(validInput());
    });

    expect(Storage.prototype.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.stringContaining('"My Slide"'),
    );
    const written = JSON.parse(stored() ?? '[]') as CustomMotionPreset[];
    expect(written.some((preset) => preset.name === 'My Slide')).toBe(true);
  });

  it('save-then-delete of the same preset still persists the revert', () => {
    const { result } = mountPresets();

    act(() => {
      result.current.savePreset(validInput({ name: 'Temp' }));
    });
    const saved = result.current.customPresets.find((preset) => preset.name === 'Temp');
    expect(saved).toBeDefined();
    const savedId = (saved as CustomMotionPreset).id;
    act(() => {
      result.current.deletePreset(savedId);
    });

    const written = JSON.parse(stored() ?? '[]') as CustomMotionPreset[];
    expect(written.some((preset) => preset.name === 'Temp')).toBe(false);
    expect(written.length).toBe(DEFAULT_INITIAL_PRESETS.length);
  });

  it('deletePreset of an existing preset persists without it', () => {
    const existing: CustomMotionPreset[] = [
      { id: 'preset_del', name: 'Del', type: 'in', durationFrames: 10, keyframes: [] },
    ];
    seed(JSON.stringify(existing));

    const { result } = mountPresets();
    vi.mocked(Storage.prototype.setItem).mockClear();

    act(() => {
      result.current.deletePreset('preset_del');
    });

    expect(Storage.prototype.setItem).toHaveBeenCalledWith(STORAGE_KEY, '[]');
    expect(stored()).toBe('[]');
  });

  it('unknown-id delete and invalid update remain no-ops that write nothing', () => {
    mountPresets();
    vi.mocked(Storage.prototype.setItem).mockClear();

    const { result } = renderHook(() => usePresets());
    act(() => {
      result.current.deletePreset('nope');
    });
    act(() => {
      result.current.updatePreset('nope', { name: 'Ghost' });
    });

    expect(Storage.prototype.setItem).not.toHaveBeenCalledWith(STORAGE_KEY, expect.anything());
  });

  it('importPresets replaces and persists the library (export/import compatibility)', () => {
    const { result } = mountPresets();
    vi.mocked(Storage.prototype.setItem).mockClear();

    const imported: CustomMotionPreset[] = [
      { id: 'preset_imp', name: 'Imported', type: 'stunt', durationFrames: 12, keyframes: [] },
    ];
    act(() => {
      result.current.importPresets(imported);
    });

    expect(stored()).toBe(JSON.stringify(imported));
    expect(result.current.customPresets).toEqual(imported);
  });

  it('a failed persist keeps warning honestly and the session working', () => {
    const { result } = mountPresets();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(Storage.prototype.setItem).mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });

    act(() => {
      result.current.savePreset(validInput({ name: 'Quota' }));
    });

    expect(result.current.customPresets.some((preset) => preset.name === 'Quota')).toBe(true);
    expect(warn).toHaveBeenCalled();
  });
});
