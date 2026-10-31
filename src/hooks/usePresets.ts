import { useState, useRef, useEffect, useCallback } from 'react';
import type { CustomMotionPreset, CustomMotionPresetKeyframe } from '../types/animator';
import { DEFAULT_INITIAL_PRESETS } from '../context/initialStateData';
import { generateId } from '../utils/idGenerator';

const STORAGE_KEY = 'keyframe_custom_motion_presets';

const PRESET_TYPES = ['in', 'out', 'stunt'] as const;

/**
 * The stored library, or the defaults.
 *
 * Storage is an external boundary: a blocked or unavailable store throws on
 * access itself, and that must not take the editor down while it mounts. A
 * malformed value is the same kind of input and falls back the same way.
 */
const readStoredPresets = (): CustomMotionPreset[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_INITIAL_PRESETS;
    const parsed = JSON.parse(saved);
    // A parsed non-array (object/string/number) is corrupt storage — fall back
    // to defaults instead of returning a value that would crash
    // `customPresets.map(...)` downstream.
    return Array.isArray(parsed) ? parsed : DEFAULT_INITIAL_PRESETS;
  } catch (error) {
    console.warn('[Presets] Could not read the saved preset library; using the defaults.', error);
    return DEFAULT_INITIAL_PRESETS;
  }
};

export interface SavePresetInput {
  name: string;
  type: 'in' | 'out' | 'stunt';
  durationFrames: number;
  keyframes: CustomMotionPresetKeyframe[];
  category?: string;
  scope?: 'both' | 'motion_only' | 'shape_only' | 'none';
  maskShape?: 'none' | 'circle' | 'pill' | 'star' | 'hexagon' | 'heart';
  showInDirector?: boolean;
}

export interface UpdatePresetInput {
  name: string;
  category?: string;
}

interface UsePresetsOptions {
  /**
   * SAFE-03-B: called once per failed persistence attempt (never on mount,
   * never on success) so the editor can surface one honest visible warning.
   * The library stays usable in session memory regardless.
   */
  onPersistenceFailure?: (error: unknown) => void;
}

export const usePresets = (options: UsePresetsOptions = {}) => {
  const onPersistenceFailureRef = useRef(options.onPersistenceFailure);
  // Latest-callback mirror, same pattern as the library mirror below.
  // oxlint-disable-next-line react/refs
  onPersistenceFailureRef.current = options.onPersistenceFailure;
  const [customPresets, setCustomPresets] = useState<CustomMotionPreset[]>(readStoredPresets);

  const customPresetsRef = useRef(customPresets);
  // Intentional latest-value mirror keeps preset consumers on current state.
  // oxlint-disable-next-line react/refs
  customPresetsRef.current = customPresets;

  // Persistence is change-driven, never mount-driven. Booting a tab
  // has nothing to save, and writing the just-read (or just-defaulted) value
  // back would destroy corrupt-but-recoverable bytes and clobber fresher
  // writes from other tabs inside the boot window. The effect only persists
  // once a user-triggered mutation has marked the library dirty.
  const presetLibraryDirtyRef = useRef(false);

  useEffect(() => {
    if (!presetLibraryDirtyRef.current) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets));
    } catch (error) {
      // A full or blocked store must not fail the edit that is already in
      // memory; the library keeps working for this session. SAFE-03-B: the
      // session-only reality is also reported to the UI authority exactly
      // once for this attempt — never as a false success.
      console.warn('[Presets] Could not persist the preset library.', error);
      onPersistenceFailureRef.current?.(error);
    }
  }, [customPresets]);

  /**
   * Save a custom preset into the existing collection and persist it
   * to the existing localStorage key. Pure data-layer operation (no UI, no
   * animation edit, no history). Returns the created preset, or null when
   * the input is invalid (empty/whitespace name, unknown type, non-finite or
   * negative duration, non-array keyframes).
   *
   * ID strategy follows the repository convention (generateId — sequential
   * counter, deterministic within a session) and never collides with builtin
   * default presets or existing custom ids.
   */
  const savePreset = useCallback((input: SavePresetInput): CustomMotionPreset | null => {
    const name = (input.name ?? '').trim();
    if (!name) return null;
    if (!PRESET_TYPES.includes(input.type)) return null;
    if (!Number.isFinite(input.durationFrames) || input.durationFrames < 0) return null;
    if (!Array.isArray(input.keyframes)) return null;

    let id = generateId('preset');
    // Deterministic collision guard: sequential counter may overlap builtin
    // preset_N ids if the counter was not seeded — walk forward if needed.
    // (Null-safe: malformed stored entries never crash the collision check.)
    while (
      DEFAULT_INITIAL_PRESETS.some((preset) => preset.id === id)
      || customPresetsRef.current.some((preset) => preset != null && preset.id === id)
    ) {
      id = generateId('preset');
    }

    const preset: CustomMotionPreset = {
      id,
      name,
      type: input.type,
      durationFrames: input.durationFrames,
      // Deep clone: stored preset must never be mutated through the caller's
      // original keyframes reference (defensive copy).
      keyframes: structuredClone(input.keyframes),
      ...(input.category?.trim() ? { category: input.category.trim() } : {}),
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(input.maskShape !== undefined ? { maskShape: input.maskShape } : {}),
      ...(input.showInDirector !== undefined ? { showInDirector: input.showInDirector } : {}),
    };

    presetLibraryDirtyRef.current = true;
    setCustomPresets((prev) => [...prev, preset]);
    return preset;
  }, []);

  /**
   * Rename and categorize an existing user preset without changing its stable
   * id, sampled keyframes, runtime semantics, or scene references.
   * Default presets and invalid/missing ids are immutable safe no-ops.
   */
  const updatePreset = useCallback((id: string, input: UpdatePresetInput): CustomMotionPreset | null => {
    const name = (input.name ?? '').trim();
    if (!name) return null;
    if (DEFAULT_INITIAL_PRESETS.some((preset) => preset.id === id)) return null;

    const existing = customPresetsRef.current.find((preset) => preset?.id === id);
    if (!existing) return null;

    const category = input.category?.trim();
    const updated: CustomMotionPreset = {
      ...existing,
      name,
      category: category || undefined,
    };
    presetLibraryDirtyRef.current = true;
    setCustomPresets((prev) => prev.map((preset) => preset?.id === id ? updated : preset));
    return updated;
  }, []);

  /**
   * Remove a custom preset by id and persist. Missing id is a safe
   * no-op (never throws). Builtin/default presets are never deleted — they
   * are only re-seeded when storage is empty/corrupt.
   */
  const deletePreset = useCallback((id: string): void => {
    if (customPresetsRef.current.some((p) => p != null && p.id === id)) {
      presetLibraryDirtyRef.current = true;
    }
    setCustomPresets((prev) => {
      // Null-safe: malformed stored entries never crash the filter.
      if (!prev.some((p) => p != null && p.id === id)) return prev;
      return prev.filter((p) => p != null && p.id !== id);
    });
  }, []);

  /**
   * Import already validated + merged presets (30A pure helpers own
   * validation/collision logic; this API only replaces the collection and
   * lets the existing useEffect persist to keyframe_custom_motion_presets).
   * Library operation: no history, no scene mutation.
   */
  const importPresets = useCallback((presets: CustomMotionPreset[]): void => {
    presetLibraryDirtyRef.current = true;
    setCustomPresets(presets);
  }, []);

  return { customPresets, customPresetsRef, savePreset, updatePreset, deletePreset, importPresets };
};
