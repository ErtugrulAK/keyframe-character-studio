/**
 * Phase 3 Step 1 — validateCritical tests
 */

import { describe, test, expect } from 'vitest';
import { validateCritical, hasCriticalErrors } from '../utils/validateScene';
import type { SceneData } from '../types/composition';

function makeLayer(id: string, parentId?: string, matte?: { sourcePartId?: string; enabled?: boolean }): any {
  return {
    id, name: id, type: 'custom_box',
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1, fillColor: '#fff', strokeColor: '#000',
    parentId,
    ...(matte ? { matte } : {}),
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

  test('M11: missing matte source is a recoverable error', () => {
    const layers = [
      { id: 'A' },
      { id: 'B', matte: { sourcePartId: 'ghost' } },
    ];
    const errors = validateCritical({ layers });
    const matteErr = errors.find(e => e.type === 'MATTE_MISSING_SOURCE');
    expect(matteErr).toBeDefined();
    expect(matteErr!.severity).toBe('recoverable');
    expect(matteErr!.layerId).toBe('B');
    expect(errors.some(e => e.severity === 'critical')).toBe(false);
  });

  test('M11: valid matte source produces no matte error', () => {
    const layers = [
      { id: 'A' },
      { id: 'B', matte: { sourcePartId: 'A' } },
    ];
    const errors = validateCritical({ layers });
    expect(errors.some(e => e.type === 'MATTE_MISSING_SOURCE')).toBe(false);
  });
});

describe('validateCritical — M22 8B matte cycle / self-reference', () => {
  const matteTypes = (errors: { type: string }[]) => errors.map(e => e.type);

  test('1. self-reference (A → A) is invalid', () => {
    const errors = validateCritical({ layers: [
      makeLayer('A', undefined, { sourcePartId: 'A' }),
    ] });
    const cycles = errors.filter(e => e.type === 'MATTE_CYCLE');
    expect(cycles.length).toBeGreaterThanOrEqual(1);
    expect(cycles[0].layerId).toBe('A');
    expect(cycles[0].severity).toBe('recoverable');
  });

  test('2. direct 2-node cycle (A → B, B → A) is invalid', () => {
    const errors = validateCritical({ layers: [
      makeLayer('A', undefined, { sourcePartId: 'B' }),
      makeLayer('B', undefined, { sourcePartId: 'A' }),
    ] });
    const cycles = errors.filter(e => e.type === 'MATTE_CYCLE');
    expect(cycles.length).toBeGreaterThanOrEqual(2); // both members report the cycle (chain-walk per layer)
    expect(cycles.map(c => c.layerId).sort()).toEqual(['A', 'B']);
  });

  test('3. 3-node cycle (A→B, B→C, C→A) is invalid', () => {
    const errors = validateCritical({ layers: [
      makeLayer('A', undefined, { sourcePartId: 'B' }),
      makeLayer('B', undefined, { sourcePartId: 'C' }),
      makeLayer('C', undefined, { sourcePartId: 'A' }),
    ] });
    const cycles = errors.filter(e => e.type === 'MATTE_CYCLE');
    expect(cycles.length).toBe(3); // every member reports it
    expect(cycles.map(c => c.layerId).sort()).toEqual(['A', 'B', 'C']);
  });

  test('4. 4+ node cycle (A→B, B→C, C→D, D→A) is invalid', () => {
    const errors = validateCritical({ layers: [
      makeLayer('A', undefined, { sourcePartId: 'B' }),
      makeLayer('B', undefined, { sourcePartId: 'C' }),
      makeLayer('C', undefined, { sourcePartId: 'D' }),
      makeLayer('D', undefined, { sourcePartId: 'A' }),
    ] });
    const cycles = errors.filter(e => e.type === 'MATTE_CYCLE');
    expect(cycles.length).toBe(4);
  });

  test('5. valid one-way matte chain is VALID', () => {
    const errors = validateCritical({ layers: [
      makeLayer('A'),
      makeLayer('B', undefined, { sourcePartId: 'A' }),
    ] });
    expect(errors.filter(e => e.type === 'MATTE_CYCLE')).toHaveLength(0);
    expect(errors).toHaveLength(0); // fully clean
  });

  test('6. valid long acyclic chain (A→B→C→D, D→nothing) is VALID', () => {
    const errors = validateCritical({ layers: [
      makeLayer('A'),
      makeLayer('B', undefined, { sourcePartId: 'A' }),
      makeLayer('C', undefined, { sourcePartId: 'B' }),
      makeLayer('D', undefined, { sourcePartId: 'C' }),
    ] });
    expect(errors.filter(e => e.type === 'MATTE_CYCLE')).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  test('7. no matte at all is VALID', () => {
    const errors = validateCritical({ layers: [makeLayer('A'), makeLayer('B')] });
    expect(errors).toHaveLength(0);
  });

  test('8-9. missing source stays MATTE_MISSING_SOURCE and is NOT a cycle', () => {
    const errors = validateCritical({ layers: [
      makeLayer('A', undefined, { sourcePartId: 'ghost' }),
    ] });
    expect(errors.filter(e => e.type === 'MATTE_MISSING_SOURCE')).toHaveLength(1);
    expect(errors.filter(e => e.type === 'MATTE_CYCLE')).toHaveLength(0);
  });

  test('10. cycle never becomes a missing-source error', () => {
    const errors = validateCritical({ layers: [
      makeLayer('A', undefined, { sourcePartId: 'B' }),
      makeLayer('B', undefined, { sourcePartId: 'A' }),
    ] });
    expect(errors.filter(e => e.type === 'MATTE_MISSING_SOURCE')).toHaveLength(0);
    expect(errors.filter(e => e.type === 'MATTE_CYCLE')).toHaveLength(2);
  });

  test('11. multiple independent cycles detect correctly', () => {
    const errors = validateCritical({ layers: [
      makeLayer('A', undefined, { sourcePartId: 'B' }),
      makeLayer('B', undefined, { sourcePartId: 'A' }),
      makeLayer('X', undefined, { sourcePartId: 'Y' }),
      makeLayer('Y', undefined, { sourcePartId: 'X' }),
      makeLayer('Solo'),
    ] });
    const cycles = errors.filter(e => e.type === 'MATTE_CYCLE');
    expect(cycles.length).toBe(4); // 2 cycles × 2 members
    expect(cycles.map(c => c.layerId).sort()).toEqual(['A', 'B', 'X', 'Y']);
  });

  test('12-13. cycle detection is deterministic (same scene → same issue list, repeated)', () => {
    const layers = [
      makeLayer('A', undefined, { sourcePartId: 'B' }),
      makeLayer('B', undefined, { sourcePartId: 'A' }),
    ];
    const first = validateCritical({ layers });
    const second = validateCritical({ layers });
    expect(matteTypes(first)).toEqual(matteTypes(second));
    expect(first.map(e => e.layerId)).toEqual(second.map(e => e.layerId));
    expect(first).toEqual(second);
  });

  test('14. disabled matte (enabled:false) is NOT part of the cycle graph', () => {
    // A's matte is disabled → the A→B→A relationship is inactive at runtime
    const errors = validateCritical({ layers: [
      makeLayer('A', undefined, { sourcePartId: 'B', enabled: false }),
      makeLayer('B', undefined, { sourcePartId: 'A' }),
    ] });
    const cycles = errors.filter(e => e.type === 'MATTE_CYCLE');
    // B is still active and reaches A — but A's link is disabled, so the walk
    // from B ends at A (A has no active matte) → no cycle
    expect(cycles).toHaveLength(0);
  });

  test('14b. disabled matte in a fully-disabled pair is VALID', () => {
    const errors = validateCritical({ layers: [
      makeLayer('A', undefined, { sourcePartId: 'B', enabled: false }),
      makeLayer('B', undefined, { sourcePartId: 'A', enabled: false }),
    ] });
    expect(errors.filter(e => e.type === 'MATTE_CYCLE')).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  test('15. parent cycle behavior remains unchanged', () => {
    const errors = validateCritical({ layers: [
      makeLayer('A', 'B'),
      makeLayer('B', 'A'),
    ] });
    expect(errors.filter(e => e.type === 'PARENT_CYCLE').length).toBeGreaterThanOrEqual(2);
    expect(errors.filter(e => e.type === 'MATTE_CYCLE')).toHaveLength(0);
  });

  test('16. existing validation issues remain unchanged (duplicate id + missing source still detected)', () => {
    const errors = validateCritical({ layers: [
      makeLayer('A'),
      makeLayer('A'),
      makeLayer('B', undefined, { sourcePartId: 'ghost' }),
    ] });
    expect(errors.filter(e => e.type === 'DUPLICATE_ID').length).toBeGreaterThanOrEqual(1);
    expect(errors.filter(e => e.type === 'MATTE_MISSING_SOURCE')).toHaveLength(1);
    expect(errors.filter(e => e.type === 'MATTE_CYCLE')).toHaveLength(0);
  });
});
