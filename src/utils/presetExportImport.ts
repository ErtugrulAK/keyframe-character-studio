import type { CustomMotionPreset } from '../types/animator';
import { DEFAULT_INITIAL_PRESETS } from '../context/initialStateData';
import { generateId } from './idGenerator';

/**
 * M30 30A — PRESET EXPORT / IMPORT (pure data layer).
 *
 * Canonical file format:
 *   { "version": 1, "presets": CustomMotionPreset[] }
 *
 * - Export ships USER presets ONLY (DEFAULT_INITIAL_PRESETS never appears —
 *   same M25 authority: id-equality against DEFAULT_INITIAL_PRESETS).
 * - Import validates the ENTIRE payload first; any error → import nothing.
 * - Merge appends imported presets after the existing library, PRESERVING
 *   imported IDs when safe (so deleted-then-restored scene references like
 *   inAnimPreset = "custom_X" reconnect automatically) and remapping ONLY on
 *   collision (existing custom IDs + DEFAULT_INITIAL_PRESETS IDs).
 * - Duplicate names are allowed (M25 convention — ID is identity).
 *
 * Pure: no localStorage, no history, no AnimationProject/serialization
 * changes. 30B bridges the merged result into the existing
 * keyframe_custom_motion_presets persistence.
 */

export const PRESET_EXPORT_VERSION = 1;

/** Export library size safety limit (whole-file reject above this). */
export const MAX_IMPORT_PRESETS = 500;

/** M25 authority: a preset is "user" iff its id is not one of the defaults. */
export function isDefaultPresetId(id: string): boolean {
  return DEFAULT_INITIAL_PRESETS.some((d) => d.id === id);
}

export interface PresetExportPayload {
  version: number;
  presets: CustomMotionPreset[];
}

function clonePreset(p: CustomMotionPreset): CustomMotionPreset {
  return {
    ...p,
    keyframes: p.keyframes.map((kf) => ({ ...kf })),
  };
}

/**
 * Build the canonical export payload from the user library.
 * User presets only; nested keyframes deep-cloned (no shared references).
 */
export function buildPresetExportPayload(customPresets: CustomMotionPreset[]): PresetExportPayload {
  return {
    version: PRESET_EXPORT_VERSION,
    presets: customPresets.filter((p) => !isDefaultPresetId(p.id)).map(clonePreset),
  };
}

export type PresetImportResult =
  | { ok: true; presets: CustomMotionPreset[] }
  | { ok: false; error: string };

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

const PRESET_TYPES = ['in', 'out', 'stunt'] as const;
const SCOPE_TYPES = ['both', 'motion_only', 'shape_only', 'none'] as const;
const MASK_SHAPES = ['none', 'circle', 'pill', 'star', 'hexagon', 'heart'] as const;

function validateKeyframe(kf: unknown, index: number): string | null {
  if (typeof kf !== 'object' || kf === null) return `keyframes[${index}] must be an object`;
  const k = kf as Record<string, unknown>;
  for (const field of ['progress', 'deltaX', 'deltaY', 'rotation', 'scaleX', 'scaleY', 'opacity']) {
    if (!isFiniteNumber(k[field])) return `keyframes[${index}].${field} must be a finite number`;
  }
  const progress = k.progress as number;
  if (progress < 0 || progress > 1) return `keyframes[${index}].progress must be in [0,1]`;
  if (k.easing !== undefined && typeof k.easing !== 'string') {
    return `keyframes[${index}].easing must be a string`;
  }
  return null;
}

function validatePreset(p: unknown, index: number): string | null {
  if (typeof p !== 'object' || p === null) return `presets[${index}] must be an object`;
  const preset = p as Record<string, unknown>;
  if (typeof preset.id !== 'string' || preset.id.length === 0) return `presets[${index}].id must be a non-empty string`;
  if (typeof preset.name !== 'string') return `presets[${index}].name must be a string`;
  if (!PRESET_TYPES.includes(preset.type as (typeof PRESET_TYPES)[number])) {
    return `presets[${index}].type must be one of: in, out, stunt`;
  }
  if (!isFiniteNumber(preset.durationFrames) || (preset.durationFrames as number) < 0) {
    return `presets[${index}].durationFrames must be a finite number >= 0`;
  }
  if (preset.scope !== undefined && !SCOPE_TYPES.includes(preset.scope as (typeof SCOPE_TYPES)[number])) {
    return `presets[${index}].scope is invalid`;
  }
  if (preset.maskShape !== undefined && !MASK_SHAPES.includes(preset.maskShape as (typeof MASK_SHAPES)[number])) {
    return `presets[${index}].maskShape is invalid`;
  }
  if (preset.showInDirector !== undefined && typeof preset.showInDirector !== 'boolean') {
    return `presets[${index}].showInDirector must be a boolean`;
  }
  if (!Array.isArray(preset.keyframes)) return `presets[${index}].keyframes must be an array`;
  for (let i = 0; i < preset.keyframes.length; i++) {
    const err = validateKeyframe(preset.keyframes[i], i);
    if (err) return `presets[${index}].${err}`;
  }
  return null;
}

/**
 * Validate a whole import payload. Atomic: ANY error → { ok:false } and the
 * caller must import NOTHING (no partial import).
 */
export function validatePresetImportPayload(raw: unknown): PresetImportResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'Payload root must be a JSON object' };
  }
  const root = raw as Record<string, unknown>;
  if (root.version !== PRESET_EXPORT_VERSION) {
    return { ok: false, error: `Unsupported export version: ${String(root.version)} (expected ${PRESET_EXPORT_VERSION})` };
  }
  if (!Array.isArray(root.presets)) {
    return { ok: false, error: 'Payload presets must be an array' };
  }
  if (root.presets.length > MAX_IMPORT_PRESETS) {
    return { ok: false, error: `Import file exceeds the ${MAX_IMPORT_PRESETS} preset limit` };
  }
  for (let i = 0; i < root.presets.length; i++) {
    const err = validatePreset(root.presets[i], i);
    if (err) return { ok: false, error: err };
  }
  // whole file validated — return deep-cloned presets (payload immutability)
  return { ok: true, presets: (root.presets as CustomMotionPreset[]).map(clonePreset) };
}

/**
 * Merge imported presets into the existing user library.
 * - existing records preserved (first)
 * - imported appended in file order
 * - imported ID preserved when it collides with NEITHER existing custom IDs
 *   NOR DEFAULT_INITIAL_PRESETS IDs; otherwise remapped via generateId('preset')
 * - duplicate names allowed; inputs never mutated; output nested-isolated
 */
export function mergeImportedPresets(
  existing: CustomMotionPreset[],
  imported: CustomMotionPreset[],
): CustomMotionPreset[] {
  // taken = existing custom IDs + default IDs; imported IDs are added one at a
  // time as they are processed (file-internal duplicates remap correctly).
  const taken = new Set<string>(existing.map((p) => p.id));

  const merged = existing.map(clonePreset);
  for (const preset of imported) {
    let id = preset.id;
    if (taken.has(id) || isDefaultPresetId(id)) {
      do {
        id = generateId('preset');
        // generateId('preset') yields preset_1, preset_2, ... which collide
        // with DEFAULT_INITIAL_PRESETS ids — keep looping until fully unique.
      } while (taken.has(id) || isDefaultPresetId(id));
    }
    taken.add(id);
    merged.push({ ...clonePreset(preset), id });
  }
  return merged;
}
