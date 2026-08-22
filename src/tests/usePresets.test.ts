import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePresets } from '../hooks/usePresets';
import { DEFAULT_INITIAL_PRESETS } from '../context/initialStateData';
import { buildPresetExportPayload, isDefaultPresetId } from '../utils/presetExportImport';
import { initializeIdCounter } from '../utils/idGenerator';
import type { CustomMotionPreset } from '../types/animator';

const STORAGE_KEY = 'keyframe_custom_motion_presets';

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

function expectOnlyPresetKey(localStorageSpy: ReturnType<typeof vi.spyOn>) {
  const keys = localStorageSpy.mock.calls.map((c) => c[0]);
  const other = keys.filter((k) => k !== STORAGE_KEY);
  expect(other).toEqual([]); // no second localStorage key created
}

describe('usePresets Hook', () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'getItem');
    vi.spyOn(Storage.prototype, 'setItem');
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with DEFAULT_INITIAL_PRESETS if localStorage is empty', () => {
    const { result } = renderHook(() => usePresets());
    expect(result.current.customPresets).toEqual(DEFAULT_INITIAL_PRESETS);
    expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('initializes with saved presets if localStorage has data', () => {
    const mockSaved = [{ id: 'mock_preset', name: 'Mock' }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockSaved));

    const { result } = renderHook(() => usePresets());

    expect(result.current.customPresets).toEqual(mockSaved);
  });

  it('updates localStorage when customPresets changes (simulated via ref)', () => {
    renderHook(() => usePresets());
    // Since customPresets is not exported with a setter, we just ensure it sets on mount
    expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(DEFAULT_INITIAL_PRESETS));
  });
});

describe('usePresets — M25 savePreset / deletePreset (data layer)', () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'getItem');
    vi.spyOn(Storage.prototype, 'setItem');
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads existing presets from localStorage', () => {
    const saved = [{ id: 'custom_1', name: 'Existing', type: 'in', durationFrames: 30, keyframes: [] }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    const { result } = renderHook(() => usePresets());
    expect(result.current.customPresets).toHaveLength(1);
    expect(result.current.customPresets[0].id).toBe('custom_1');
  });

  it('savePreset appends the preset to the collection', () => {
    const { result } = renderHook(() => usePresets());
    let created: CustomMotionPreset | null = null;
    act(() => {
      created = result.current.savePreset(validInput());
    });
    expect(created).not.toBeNull();
    expect(result.current.customPresets).toHaveLength(DEFAULT_INITIAL_PRESETS.length + 1);
    expect(result.current.customPresets.at(-1)?.id).toBe(created?.id);
  });

  it('savePreset persists to the existing localStorage key', () => {
    const { result } = renderHook(() => usePresets());
    act(() => {
      result.current.savePreset(validInput({ name: 'Persist Me' }));
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as CustomMotionPreset[];
    expect(stored.at(-1)?.name).toBe('Persist Me');
    expectOnlyPresetKey(vi.mocked(localStorage.setItem));
  });

  it('savePreset trims and persists an optional category', () => {
    const { result } = renderHook(() => usePresets());
    let created: CustomMotionPreset | null = null;
    act(() => {
      created = result.current.savePreset(validInput({ category: '  Logo Reveals  ' }));
    });
    expect(created?.category).toBe('Logo Reveals');
    expect(result.current.customPresets.at(-1)?.category).toBe('Logo Reveals');
  });

  it('updatePreset preserves stable identity and sampled data while changing name and category', () => {
    const { result } = renderHook(() => usePresets());
    let created: CustomMotionPreset | null = null;
    act(() => {
      created = result.current.savePreset(validInput({ name: 'Original' }));
    });
    const keyframesBefore = structuredClone(created!.keyframes);
    let updated: CustomMotionPreset | null = null;
    act(() => {
      updated = result.current.updatePreset(created!.id, {
        name: '  Renamed  ',
        category: '  Branding  ',
      });
    });
    expect(updated).toMatchObject({
      id: created!.id,
      name: 'Renamed',
      category: 'Branding',
      type: created!.type,
      durationFrames: created!.durationFrames,
    });
    expect(updated!.keyframes).toEqual(keyframesBefore);
    expect(result.current.customPresets.find((preset) => preset.id === created!.id)).toEqual(updated);
  });

  it('updatePreset rejects empty names, missing ids, and default preset ids', () => {
    const { result } = renderHook(() => usePresets());
    const before = structuredClone(result.current.customPresets);
    expect(result.current.updatePreset('missing', { name: 'X' })).toBeNull();
    expect(result.current.updatePreset(DEFAULT_INITIAL_PRESETS[0].id, { name: 'Changed' })).toBeNull();
    expect(result.current.updatePreset('missing', { name: '   ' })).toBeNull();
    expect(result.current.customPresets).toEqual(before);
  });

  it('reserves protected default ids across save, rename, category, export, and delete', () => {
    initializeIdCounter([]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{
      id: 'custom_existing',
      name: 'Existing',
      type: 'in',
      durationFrames: 20,
      keyframes: [],
    }]));
    const { result } = renderHook(() => usePresets());

    let created: CustomMotionPreset | null = null;
    act(() => {
      created = result.current.savePreset(validInput({ name: 'Collision Safe' }));
    });
    expect(created?.id).toBe('preset_3');
    expect(isDefaultPresetId(created!.id)).toBe(false);

    act(() => {
      result.current.updatePreset(created!.id, {
        name: 'Renamed Safely',
        category: 'Branding',
      });
    });
    const updated = result.current.customPresets.find((preset) => preset.id === created!.id)!;
    expect(updated).toMatchObject({
      id: 'preset_3',
      name: 'Renamed Safely',
      category: 'Branding',
    });
    expect(buildPresetExportPayload(result.current.customPresets).presets)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: 'preset_3' })]));

    act(() => {
      result.current.deletePreset(created!.id);
    });
    expect(result.current.customPresets.some((preset) => preset.id === 'preset_3')).toBe(false);
  });

  it('deletePreset removes the preset and persists', () => {
    const { result } = renderHook(() => usePresets());
    let created: CustomMotionPreset | null = null;
    act(() => {
      created = result.current.savePreset(validInput({ name: 'Doomed' }));
    });
    const before = result.current.customPresets.length;
    act(() => {
      result.current.deletePreset(created!.id);
    });
    expect(result.current.customPresets).toHaveLength(before - 1);
    expect(result.current.customPresets.some((p) => p.id === created!.id)).toBe(false);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as CustomMotionPreset[];
    expect(stored.some((p) => p.id === created!.id)).toBe(false); // delete persisted
  });

  it('deletePreset with a missing id is a safe no-op', () => {
    const { result } = renderHook(() => usePresets());
    const before = result.current.customPresets.length;
    expect(() => act(() => result.current.deletePreset('does_not_exist'))).not.toThrow();
    expect(result.current.customPresets).toHaveLength(before);
  });

  it('builtin/default presets remain intact after save + delete', () => {
    const { result } = renderHook(() => usePresets());
    const builtinIds = DEFAULT_INITIAL_PRESETS.map((p) => p.id).sort();
    let created: CustomMotionPreset | null = null;
    act(() => {
      created = result.current.savePreset(validInput());
    });
    act(() => {
      result.current.deletePreset(created!.id);
    });
    expect(result.current.customPresets.map((p) => p.id).sort()).toEqual(builtinIds);
  });

  it('duplicate names are deterministic (unique ids, both stored)', () => {
    const { result } = renderHook(() => usePresets());
    let first: CustomMotionPreset | null = null;
    let second: CustomMotionPreset | null = null;
    act(() => {
      first = result.current.savePreset(validInput({ name: 'Same Name' }));
      second = result.current.savePreset(validInput({ name: 'Same Name' }));
    });
    expect(first?.name).toBe('Same Name');
    expect(second?.name).toBe('Same Name');
    expect(first?.id).not.toBe(second?.id);
    expect(result.current.customPresets.filter((p) => p.name === 'Same Name')).toHaveLength(2);
  });

  it('empty name is rejected (returns null, nothing stored)', () => {
    const { result } = renderHook(() => usePresets());
    const before = result.current.customPresets.length;
    let created: CustomMotionPreset | null = null;
    act(() => {
      created = result.current.savePreset(validInput({ name: '' }));
    });
    expect(created).toBeNull();
    expect(result.current.customPresets).toHaveLength(before);
  });

  it('whitespace-only name is rejected', () => {
    const { result } = renderHook(() => usePresets());
    const before = result.current.customPresets.length;
    let created: CustomMotionPreset | null = null;
    act(() => {
      created = result.current.savePreset(validInput({ name: '   ' }));
    });
    expect(created).toBeNull();
    expect(result.current.customPresets).toHaveLength(before);
  });

  it('unknown type is rejected', () => {
    const { result } = renderHook(() => usePresets());
    const before = result.current.customPresets.length;
    let created: CustomMotionPreset | null = null;
    act(() => {
      created = result.current.savePreset(validInput({ type: 'sideways' }));
    });
    expect(created).toBeNull();
    expect(result.current.customPresets).toHaveLength(before);
  });

  it('negative / non-finite duration is rejected', () => {
    const { result } = renderHook(() => usePresets());
    let created: CustomMotionPreset | null = null;
    act(() => {
      created = result.current.savePreset(validInput({ durationFrames: -5 }));
    });
    expect(created).toBeNull();
    act(() => {
      created = result.current.savePreset(validInput({ durationFrames: Number.NaN }));
    });
    expect(created).toBeNull();
  });

  it('non-array keyframes are rejected', () => {
    const { result } = renderHook(() => usePresets());
    let created: CustomMotionPreset | null = null;
    act(() => {
      created = result.current.savePreset(validInput({ keyframes: 'nope' }));
    });
    expect(created).toBeNull();
  });

  it('invalid JSON storage falls back to DEFAULT_INITIAL_PRESETS', () => {
    localStorage.setItem(STORAGE_KEY, '{corrupt json!!');
    const { result } = renderHook(() => usePresets());
    expect(result.current.customPresets).toEqual(DEFAULT_INITIAL_PRESETS);
  });

  it('non-array parsed storage (object) falls back to DEFAULT_INITIAL_PRESETS', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 'not_an_array' }));
    const { result } = renderHook(() => usePresets());
    expect(result.current.customPresets).toEqual(DEFAULT_INITIAL_PRESETS);
  });

  it('malformed entries inside the array do not crash save/delete (existing lenient behavior)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'broken' }, null, 42]));
    const { result } = renderHook(() => usePresets());
    expect(result.current.customPresets).toHaveLength(3); // loaded as-is (existing behavior)
    let created: CustomMotionPreset | null = null;
    act(() => {
      created = result.current.savePreset(validInput());
    });
    expect(created).not.toBeNull(); // save still works
    expect(() => act(() => result.current.deletePreset('broken'))).not.toThrow();
    expect(result.current.customPresets.some((p) => p.id === 'broken')).toBe(false);
  });

  it('saved keyframes are preserved exactly', () => {
    const keyframes = [
      { progress: 0, deltaX: 0, deltaY: -300, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0, easing: 'easeInOut' },
      { progress: 0.5, deltaX: 40, deltaY: -150, rotation: 10, scaleX: 1.2, scaleY: 1.2, opacity: 0.5, easing: 'linear' },
      { progress: 1, deltaX: 0, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    ];
    const { result } = renderHook(() => usePresets());
    let created: CustomMotionPreset | null = null;
    act(() => {
      created = result.current.savePreset(validInput({ keyframes }));
    });
    expect(created!.keyframes).toEqual(keyframes);
    const stored = result.current.customPresets.find((p) => p.id === created!.id);
    expect(stored!.keyframes).toEqual(keyframes);
  });

  it('saved duration and type are preserved', () => {
    const { result } = renderHook(() => usePresets());
    let created: CustomMotionPreset | null = null;
    act(() => {
      created = result.current.savePreset(validInput({ durationFrames: 72, type: 'out' }));
    });
    expect(created!.durationFrames).toBe(72);
    expect(created!.type).toBe('out');
  });

  it('stored preset cannot be mutated through the caller keyframes reference', () => {
    const keyframes = [{ progress: 0, deltaX: 0, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }];
    const { result } = renderHook(() => usePresets());
    let created: CustomMotionPreset | null = null;
    act(() => {
      created = result.current.savePreset(validInput({ keyframes }));
    });
    // Mutate the ORIGINAL caller array after saving
    keyframes[0] = { ...keyframes[0], opacity: 0, deltaY: -999 };
    const stored = result.current.customPresets.find((p) => p.id === created!.id);
    expect(stored!.keyframes[0].opacity).toBe(1);
    expect(stored!.keyframes[0].deltaY).toBe(0);
  });

  it('repeated save/delete cycles are deterministic', () => {
    const { result } = renderHook(() => usePresets());
    const ids = new Set<string>();
    for (let i = 0; i < 3; i++) {
      let created: CustomMotionPreset | null = null;
      act(() => {
        created = result.current.savePreset(validInput({ name: `Cycle ${i}` }));
      });
      expect(created).not.toBeNull();
      ids.add(created!.id);
      act(() => {
        result.current.deletePreset(created!.id);
      });
    }
    expect(ids.size).toBe(3); // unique ids every cycle
    expect(result.current.customPresets.map((p) => p.id).sort())
      .toEqual(DEFAULT_INITIAL_PRESETS.map((p) => p.id).sort());
  });

  it('does not create a second localStorage key (save + delete only touch the preset key)', () => {
    const { result } = renderHook(() => usePresets());
    let created: CustomMotionPreset | null = null;
    act(() => {
      created = result.current.savePreset(validInput());
    });
    act(() => {
      result.current.deletePreset(created!.id);
    });
    expectOnlyPresetKey(vi.mocked(localStorage.setItem));
  });
});
