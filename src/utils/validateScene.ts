/**
 * Phase 3 Step 1 — Critical Scene Validation
 *
 * Pure functions to detect structural errors in a layer list that would
 * make frame evaluation impossible or incorrect.
 *
 * Critical errors prevent evaluation entirely:
 *   - Duplicate layer IDs
 *   - Parent cycles (A → B → A)
 *
 * Recoverable errors produce warnings but allow evaluation to continue
 * with fallback behavior (to be implemented in a later step).
 */

import type { ValidationError } from '../types/composition';

/** Minimal structural shape needed for validation — accepts SceneLayer[], CharacterPart[] */
export interface LayerRef {
  id: string;
  parentId?: string;
  /** M11: track matte reference (source part id); M22 8B: enabled flag — a
   *  disabled matte is NOT an active relationship (excluded from cycle graph) */
  matte?: { sourcePartId?: string; enabled?: boolean };
}

/**
 * Validate critical structural integrity of a layer list.
 *
 * Accepts anything with `{ id, parentId? }[]` — both canonical
 * `SceneData.layers` and the current runtime `CharacterPart[]` satisfy it.
 *
 * Returns all errors found. If any error has severity 'critical',
 * evaluation should NOT proceed.
 */
export function validateCritical(scene: { layers: LayerRef[] }): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!scene || !scene.layers) {
    return [{ type: 'EMPTY_SCENE', message: 'Scene has no layers', severity: 'critical' }];
  }

  // ── Duplicate layer IDs ──────────────────────────────────────────
  const seen = new Map<string, number>(); // id → first index
  for (let i = 0; i < scene.layers.length; i++) {
    const layer = scene.layers[i];
    if (seen.has(layer.id)) {
      errors.push({
        type: 'DUPLICATE_ID',
        layerId: layer.id,
        message: `Duplicate layer ID "${layer.id}" at index ${i} (first seen at index ${seen.get(layer.id)})`,
        severity: 'critical',
      });
    } else {
      seen.set(layer.id, i);
    }
  }

  // ── Parent cycles ────────────────────────────────────────────────
  // Build map using FIRST occurrence of each ID (duplicates are already
  // reported above; cycle detection still works with first occurrence)
  const layerMap = new Map<string, LayerRef>();
  for (const layer of scene.layers) {
    if (!layerMap.has(layer.id)) {
      layerMap.set(layer.id, layer);
    }
  }
  for (const layer of scene.layers) {
    if (!layer.parentId) continue;

    const visited = new Set<string>();
    let current: string | undefined = layer.id;

    while (current) {
      if (visited.has(current)) {
        errors.push({
          type: 'PARENT_CYCLE',
          layerId: layer.id,
          message: `Parent cycle detected starting from layer "${layer.id}"`,
          severity: 'critical',
        });
        break;
      }
      visited.add(current);
      const parent = layerMap.get(current);
      current = parent?.parentId;
    }
  }

  // ── Matte source references (recoverable) ─────────────────────────
  for (const layer of scene.layers) {
    if (!layer.matte?.sourcePartId) continue;
    if (!layerMap.has(layer.matte.sourcePartId)) {
      errors.push({
        type: 'MATTE_MISSING_SOURCE',
        layerId: layer.id,
        message: `Matte source "${layer.matte.sourcePartId}" not found for layer "${layer.id}"`,
        severity: 'recoverable',
      });
    }
  }

  // ── M22 8B: Matte cycles / self-reference (recoverable) ───────────
  // Chain-walk (same pattern as the parent-cycle walk above): from each layer,
  // follow matte.sourcePartId links; revisiting an id = cycle. A self
  // reference (A → A) is the 1-node cycle and is reported here as well.
  // DISABLED mattes (matte.enabled === false) are NOT active relationships
  // (runtime: StagePartLayers skips them) → excluded from the graph.
  // MISSING sources are NEVER classified as cycles: the walk simply ends at
  // the dangling id (that case is MATTE_MISSING_SOURCE, reported above).
  for (const layer of scene.layers) {
    if (!layer.matte?.sourcePartId) continue;
    if (layer.matte.enabled === false) continue;
    const visited = new Set<string>();
    let current: string | undefined = layer.id;
    while (current) {
      if (visited.has(current)) {
        errors.push({
          type: 'MATTE_CYCLE',
          layerId: layer.id,
          message: `Matte cycle detected starting from layer "${layer.id}"`,
          severity: 'recoverable',
        });
        break;
      }
      visited.add(current);
      const next = layerMap.get(current);
      // disabled matte = inactive edge → the walk stops here (no cycle
      // through a disabled relationship)
      if (!next?.matte?.sourcePartId || next.matte.enabled === false) break;
      current = next.matte.sourcePartId;
    }
  }

  return errors;
}

/**
 * Check if there are any critical errors that should block evaluation.
 */
export function hasCriticalErrors(errors: ValidationError[]): boolean {
  return errors.some(e => e.severity === 'critical');
}
