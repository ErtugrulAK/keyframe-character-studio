import { useState, useRef, useEffect, useCallback } from 'react';
import type { CustomMotionPreset, CustomMotionPresetKeyframe } from '../types/animator';
import { DEFAULT_INITIAL_PRESETS } from '../context/initialStateData';
import { generateId } from '../utils/idGenerator';

const STORAGE_KEY = 'keyframe_custom_motion_presets';

const PRESET_TYPES = ['in', 'out', 'stunt'] as const;

export interface SavePresetInput {
  name: string;
  type: 'in' | 'out' | 'stunt';
  durationFrames: number;
  keyframes: CustomMotionPresetKeyframe[];
  scope?: 'both' | 'motion_only' | 'shape_only' | 'none';
  maskShape?: 'none' | 'circle' | 'pill' | 'star' | 'hexagon' | 'heart';
  showInDirector?: boolean;
}

export const usePresets = () => {
  const [customPresets, setCustomPresets] = useState<CustomMotionPreset[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // BUGFIX/robustness: a parsed non-array (object/string/number) is
        // corrupt storage — fall back to defaults instead of returning a
        // value that would crash `customPresets.map(...)` downstream.
        return Array.isArray(parsed) ? parsed : DEFAULT_INITIAL_PRESETS;
      } catch {
        return DEFAULT_INITIAL_PRESETS;
      }
    }
    return DEFAULT_INITIAL_PRESETS;
  });

  const customPresetsRef = useRef(customPresets);
  customPresetsRef.current = customPresets;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets));
  }, [customPresets]);

  /**
   * M25 — save a custom preset into the existing collection and persist it
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
    while (customPresetsRef.current.some((p) => p != null && p.id === id)) {
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
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(input.maskShape !== undefined ? { maskShape: input.maskShape } : {}),
      ...(input.showInDirector !== undefined ? { showInDirector: input.showInDirector } : {}),
    };

    setCustomPresets((prev) => [...prev, preset]);
    return preset;
  }, []);

  /**
   * M25 — remove a custom preset by id and persist. Missing id is a safe
   * no-op (never throws). Builtin/default presets are never deleted — they
   * are only re-seeded when storage is empty/corrupt.
   */
  const deletePreset = useCallback((id: string): void => {
    setCustomPresets((prev) => {
      // Null-safe: malformed stored entries never crash the filter.
      if (!prev.some((p) => p != null && p.id === id)) return prev;
      return prev.filter((p) => p != null && p.id !== id);
    });
  }, []);

  /**
   * M30 — import already validated + merged presets (30A pure helpers own
   * validation/collision logic; this API only replaces the collection and
   * lets the existing useEffect persist to keyframe_custom_motion_presets).
   * Library operation: no history, no scene mutation.
   */
  const importPresets = useCallback((presets: CustomMotionPreset[]): void => {
    setCustomPresets(presets);
  }, []);

  return { customPresets, customPresetsRef, savePreset, deletePreset, importPresets };
};
