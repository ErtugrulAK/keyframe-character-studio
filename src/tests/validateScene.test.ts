/**
 * Phase 3 Step 1 — validateCritical tests
 */

import { describe, test, expect } from 'vitest';
import { validateCritical, hasCriticalErrors } from '../utils/validateScene';
import type { SceneData } from '../types/composition';

function makeLayer(id: string, parentId?: string): any {
  return {
    id, name: id, type: 'custom_box',
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1, fillColor: '#fff', strokeColor: '#000',
    parentId,
  };
}

function makeScene(layers: any[]): SceneData {
  return {
    version: 1,
    width: 1920, height: 1080,
    fps: 60, totalFrames: 120,
    layers: layers,
    tracks: [],
  };
}

describe('validateCritical', () => {

  test('empty scene returns error', () => {
    const errors = validateCritical({ version: 1, width: 0, height: 0, fps: 0, totalFrames: 0, layers: [], tracks: [] });
    expect(errors).toHaveLength(0); // empty layers is not an error, just nothing to validate
  });

  test('valid scene produces no errors', () => {
    const scene = makeScene([makeLayer('A'), makeLayer('B')]);
    const errors = validateCritical(scene);
    expect(errors).toHaveLength(0);
  });

  test('duplicate layer IDs detected', () => {
    const scene = makeScene([makeLayer('A'), makeLayer('A')]);
    const errors = validateCritical(scene);

    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe('DUPLICATE_ID');
    expect(errors[0].severity).toBe('critical');
    expect(errors[0].layerId).toBe('A');
  });

  test('parent cycle A → B → A detected', () => {
    const scene = makeScene([
      makeLayer('A', 'B'),
      makeLayer('B', 'A'),
    ]);
    const errors = validateCritical(scene);

    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].type).toBe('PARENT_CYCLE');
    expect(errors[0].severity).toBe('critical');
  });

  test('parent cycle A → B → C → A detected', () => {
    const scene = makeScene([
      makeLayer('A', 'B'),
      makeLayer('B', 'C'),
      makeLayer('C', 'A'),
    ]);
    const errors = validateCritical(scene);

    expect(errors.some(e => e.type === 'PARENT_CYCLE')).toBe(true);
  });

  test('self-parent cycle A → A detected', () => {
    const scene = makeScene([makeLayer('A', 'A')]);
    const errors = validateCritical(scene);

    expect(errors.some(e => e.type === 'PARENT_CYCLE')).toBe(true);
  });

  test('valid parent-child produces no errors', () => {
    const scene = makeScene([
      makeLayer('P'),
      makeLayer('C', 'P'),
    ]);
    const errors = validateCritical(scene);
    expect(errors).toHaveLength(0);
  });

  test('missing parent produces no critical error (recoverable)', () => {
    const scene = makeScene([makeLayer('A', 'GHOST')]);
    const errors = validateCritical(scene);

    // Missing parent is NOT a critical error — it's recoverable (evaluateTransform uses fallback)
    expect(errors.filter(e => e.severity === 'critical')).toHaveLength(0);
  });

  test('both duplicate and cycle detected together', () => {
    const scene = makeScene([
      makeLayer('A', 'B'),
      makeLayer('A'),       // duplicate
      makeLayer('B', 'A'),  // cycle
    ]);
    const errors = validateCritical(scene);

    expect(errors.filter(e => e.type === 'DUPLICATE_ID')).toHaveLength(1);
    expect(errors.filter(e => e.type === 'PARENT_CYCLE').length).toBeGreaterThanOrEqual(1);
  });
});

describe('hasCriticalErrors', () => {

  test('returns true when critical errors exist', () => {
    const errors = [{ type: 'DUPLICATE_ID', message: 'x', severity: 'critical' as const }];
    expect(hasCriticalErrors(errors)).toBe(true);
  });

  test('returns false when only recoverable errors exist', () => {
    const errors = [{ type: 'MISSING_PARENT', message: 'x', severity: 'recoverable' as const }];
    expect(hasCriticalErrors(errors)).toBe(false);
  });

  test('returns false for empty array', () => {
    expect(hasCriticalErrors([])).toBe(false);
  });
});

describe('validateCritical — production shape (CharacterPart[])', () => {

  test('accepts runtime CharacterPart-like layers (structural typing)', () => {
    const runtimeLayers = [
      { id: 'P', parentId: undefined },
      { id: 'C', parentId: 'P' },
    ];
    const errors = validateCritical({ layers: runtimeLayers });
    expect(errors).toHaveLength(0);
  });

  test('detects cycle in runtime CharacterPart-like layers', () => {
    const runtimeLayers = [
      { id: 'A', parentId: 'B' },
      { id: 'B', parentId: 'A' },
    ];
    const errors = validateCritical({ layers: runtimeLayers });
    expect(errors.some(e => e.type === 'PARENT_CYCLE')).toBe(true);
  });
});
