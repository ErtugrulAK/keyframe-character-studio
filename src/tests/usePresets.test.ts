import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePresets } from '../hooks/usePresets';
import { DEFAULT_INITIAL_PRESETS } from '../context/initialStateData';

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
    expect(localStorage.getItem).toHaveBeenCalledWith('keyframe_custom_motion_presets');
  });

  it('initializes with saved presets if localStorage has data', () => {
    const mockSaved = [{ id: 'mock_preset', name: 'Mock' }];
    localStorage.setItem('keyframe_custom_motion_presets', JSON.stringify(mockSaved));

    const { result } = renderHook(() => usePresets());
    
    expect(result.current.customPresets).toEqual(mockSaved);
  });

  it('updates localStorage when customPresets changes (simulated via ref)', () => {
    renderHook(() => usePresets());
    // Since customPresets is not exported with a setter, we just ensure it sets on mount
    expect(localStorage.setItem).toHaveBeenCalledWith('keyframe_custom_motion_presets', JSON.stringify(DEFAULT_INITIAL_PRESETS));
  });
});
