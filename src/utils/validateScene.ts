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

  return errors;
}

/**
 * Check if there are any critical errors that should block evaluation.
 */
export function hasCriticalErrors(errors: ValidationError[]): boolean {
  return errors.some(e => e.severity === 'critical');
}
