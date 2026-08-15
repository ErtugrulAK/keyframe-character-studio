import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildPresetExportPayload,
  validatePresetImportPayload,
  mergeImportedPresets,
  isDefaultPresetId,
  PRESET_EXPORT_VERSION,
} from '../utils/presetExportImport';
import type { CustomMotionPreset, CustomMotionPresetKeyframe } from '../types/animator';
import { DEFAULT_INITIAL_PRESETS } from '../context/initialStateData';

/**
 * M30 30A — PRESET EXPORT / IMPORT pure data layer.
 * Export = user-only versioned payload; Import = whole-file atomic validation
 * + merge (preserve-safe IDs, remap on collision, duplicate names allowed).
 */

function kf(progress: number, overrides: Partial<CustomMotionPresetKeyframe> = {}): CustomMotionPresetKeyframe {
  return { progress, deltaX: 10, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, ...overrides };
}

function preset(id: string, name: string, overrides: Partial<CustomMotionPreset> = {}): CustomMotionPreset {
  return {
    id, name, type: 'in', durationFrames: 30,
    keyframes: [kf(0), kf(0.5), kf(1)],
    ...overrides,
  };
}

const userA = preset('custom_A', 'Slide A');
const userB = preset('custom_B', 'Slide B', { type: 'out', scope: 'both', maskShape: 'circle', showInDirector: true, durationFrames: 45 });

beforeEach(() => {
  // deterministic generateId sequence across tests
  vi.clearAllMocks();
});

describe('M30 30A — export', () => {
  it('1+2. wrapper version = 1 with presets array', () => {
    const payload = buildPresetExportPayload([userA]);
    expect(payload.version).toBe(1);
    expect(Array.isArray(payload.presets)).toBe(true);
  });

  it('3+4. exports ONLY user presets — DEFAULT_INITIAL_PRESETS excluded', () => {
    const library = [...DEFAULT_INITIAL_PRESETS, userA];
    const payload = buildPresetExportPayload(library);
    expect(payload.presets).toHaveLength(1);
    expect(payload.presets[0].id).toBe('custom_A');
    // every default id filtered out
    for (const d of DEFAULT_INITIAL_PRESETS) {
      expect(payload.presets.some((p) => p.id === d.id)).toBe(false);
    }
  });

  it('5. all real preset fields preserved', () => {
    const payload = buildPresetExportPayload([userB]);
    const p = payload.presets[0];
    expect(p).toEqual(userB); // deep equality — id/name/type/durationFrames/scope/maskShape/showInDirector/keyframes
  });

  it('6. nested keyframes deep-cloned (mutating export output does not touch source)', () => {
    const payload = buildPresetExportPayload([userA]);
    payload.presets[0].keyframes[0].deltaX = -99;
    payload.presets[0].name = 'Mutated';
    expect(userA.keyframes[0].deltaX).toBe(10);
    expect(userA.name).toBe('Slide A');
  });

  it('7. export with empty user library → empty presets array (never defaults)', () => {
    const payload = buildPresetExportPayload([...DEFAULT_INITIAL_PRESETS]);
    expect(payload.presets).toHaveLength(0);
  });
});

describe('M30 30A — import validation (atomic)', () => {
  it('8. valid import passes with deep-cloned presets', () => {
    const result = validatePresetImportPayload({ version: 1, presets: [userA, userB] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.presets).toHaveLength(2);
      // cloned — mutating result does not touch input
      result.presets[0].keyframes[0].deltaX = -99;
      expect(userA.keyframes[0].deltaX).toBe(10);
    }
  });

  it('9. invalid JSON / wrong root types rejected', () => {
    expect(validatePresetImportPayload(null).ok).toBe(false);
    expect(validatePresetImportPayload('nope').ok).toBe(false);
    expect(validatePresetImportPayload(42).ok).toBe(false);
  });

  it('10. null root rejected', () => {
    expect(validatePresetImportPayload(null).ok).toBe(false);
  });

  it('11. array root rejected', () => {
    expect(validatePresetImportPayload([userA]).ok).toBe(false);
  });

  it('12. missing version rejected', () => {
    expect(validatePresetImportPayload({ presets: [] }).ok).toBe(false);
  });

  it('13. unsupported version rejected (no migration)', () => {
    expect(validatePresetImportPayload({ version: 2, presets: [] }).ok).toBe(false);
    expect(validatePresetImportPayload({ version: 0, presets: [] }).ok).toBe(false);
  });

  it('14. missing presets rejected', () => {
    expect(validatePresetImportPayload({ version: 1 }).ok).toBe(false);
  });

  it('15. presets non-array rejected', () => {
    expect(validatePresetImportPayload({ version: 1, presets: 'x' }).ok).toBe(false);
    expect(validatePresetImportPayload({ version: 1, presets: {} }).ok).toBe(false);
  });

  it('16. malformed preset object rejected', () => {
    expect(validatePresetImportPayload({ version: 1, presets: ['x'] }).ok).toBe(false);
    expect(validatePresetImportPayload({ version: 1, presets: [null] }).ok).toBe(false);
    expect(validatePresetImportPayload({ version: 1, presets: [{ name: 'no-id' }] }).ok).toBe(false);
    expect(validatePresetImportPayload({ version: 1, presets: [{ id: 'x', name: 5, type: 'in', durationFrames: 10, keyframes: [] }] }).ok).toBe(false);
  });

  it('17. invalid type rejected', () => {
    expect(validatePresetImportPayload({ version: 1, presets: [{ ...userA, type: 'loop' }] }).ok).toBe(false);
  });

  it('18. invalid duration rejected (negative / non-number)', () => {
    expect(validatePresetImportPayload({ version: 1, presets: [{ ...userA, durationFrames: -1 }] }).ok).toBe(false);
    expect(validatePresetImportPayload({ version: 1, presets: [{ ...userA, durationFrames: NaN }] }).ok).toBe(false);
  });

  it('19. invalid keyframes rejected', () => {
    expect(validatePresetImportPayload({ version: 1, presets: [{ ...userA, keyframes: [] }] }).ok).toBe(true); // empty ok
    expect(validatePresetImportPayload({ version: 1, presets: [{ ...userA, keyframes: 'x' }] }).ok).toBe(false);
    expect(validatePresetImportPayload({ version: 1, presets: [{ ...userA, keyframes: [kf(0.5), { progress: 0.5 }] }] }).ok).toBe(false);
  });

  it('20. progress outside [0,1] rejected', () => {
    expect(validatePresetImportPayload({ version: 1, presets: [{ ...userA, keyframes: [kf(-0.1)] }] }).ok).toBe(false);
    expect(validatePresetImportPayload({ version: 1, presets: [{ ...userA, keyframes: [kf(1.5)] }] }).ok).toBe(false);
  });

  it('21. optional fields preserved and validated', () => {
    const ok = validatePresetImportPayload({ version: 1, presets: [userB] });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.presets[0]).toMatchObject({ scope: 'both', maskShape: 'circle', showInDirector: true });
    expect(validatePresetImportPayload({ version: 1, presets: [{ ...userA, scope: 'bogus' }] }).ok).toBe(false);
    expect(validatePresetImportPayload({ version: 1, presets: [{ ...userA, maskShape: 'bogus' }] }).ok).toBe(false);
    expect(validatePresetImportPayload({ version: 1, presets: [{ ...userA, showInDirector: 'yes' }] }).ok).toBe(false);
  });

  it('22. huge payload rejected (whole file)', () => {
    const many = Array.from({ length: 501 }, (_, i) => preset(`huge_${i}`, `Huge ${i}`));
    expect(validatePresetImportPayload({ version: 1, presets: many }).ok).toBe(false);
    const atLimit = Array.from({ length: 500 }, (_, i) => preset(`limit_${i}`, `Limit ${i}`));
    expect(validatePresetImportPayload({ version: 1, presets: atLimit }).ok).toBe(true);
  });

  it('23. malformed entry anywhere → whole file invalid (no partial result)', () => {
    const result = validatePresetImportPayload({ version: 1, presets: [userA, { id: 'bad' }, userB] });
    expect(result.ok).toBe(false);
  });
});

describe('M30 30A — merge', () => {
  it('24+25. preserves existing and appends imported', () => {
    const merged = mergeImportedPresets([userA], [userB]);
    expect(merged.map((p) => p.id)).toEqual(['custom_A', 'custom_B']);
  });

  it('26. safe imported ID preserved (reconnect scenario)', () => {
    const merged = mergeImportedPresets([userA], [preset('custom_X', 'Restored X')]);
    expect(merged.map((p) => p.id)).toContain('custom_X'); // old reference can reconnect
  });

  it('27. custom ID collision remapped with fresh unique id', () => {
    const merged = mergeImportedPresets([userA], [preset('custom_A', 'Dup A')]);
    const dup = merged.find((p) => p.name === 'Dup A')!;
    expect(dup.id).not.toBe('custom_A');
    expect(merged.filter((p) => p.id === dup.id)).toHaveLength(1); // unique
  });

  it('28. default ID collision remapped (defaults never overwritten)', () => {
    const defaultPreset = DEFAULT_INITIAL_PRESETS[0];
    const merged = mergeImportedPresets([], [preset(defaultPreset.id, 'Imported Default')]);
    const imported = merged.find((p) => p.name === 'Imported Default')!;
    expect(imported.id).not.toBe(defaultPreset.id);
    expect(isDefaultPresetId(imported.id)).toBe(false);
    // existing defaults (if any were passed as existing) untouched
    expect(merged.filter((p) => p.id === defaultPreset.id)).toHaveLength(0);
  });

  it('29. duplicate names allowed', () => {
    const merged = mergeImportedPresets([userA], [preset('custom_Z', 'Slide A')]);
    expect(merged.filter((p) => p.name === 'Slide A')).toHaveLength(2);
  });

  it('30. imported order preserved (file order after existing)', () => {
    const merged = mergeImportedPresets([userA], [preset('c1', 'One'), preset('c2', 'Two'), preset('c3', 'Three')]);
    expect(merged.map((p) => p.id)).toEqual(['custom_A', 'c1', 'c2', 'c3']);
  });

  it('31. input library immutable', () => {
    const before = JSON.stringify(userA);
    mergeImportedPresets([userA], [userB]);
    expect(JSON.stringify(userA)).toBe(before);
  });

  it('32. input payload immutable', () => {
    const before = JSON.stringify(userB);
    mergeImportedPresets([userA], [userB]);
    expect(JSON.stringify(userB)).toBe(before);
  });

  it('33. merged nested data isolated (keyframes arrays not shared)', () => {
    const merged = mergeImportedPresets([userA], [userB]);
    merged[0].keyframes[0].deltaX = -99;
    merged[1].keyframes[0].deltaX = -88;
    expect(userA.keyframes[0].deltaX).toBe(10);
    expect(userB.keyframes[0].deltaX).toBe(10);
  });

  it('34. empty import → no-op (same library, same order)', () => {
    const merged = mergeImportedPresets([userA], []);
    expect(merged).toEqual([userA]);
  });

  it('35. deterministic semantic merge (same inputs → same output)', () => {
    const m1 = mergeImportedPresets([userA], [userB]);
    const m2 = mergeImportedPresets([userA], [userB]);
    expect(m1).toEqual(m2);
  });

  it('36. referenced-ID preservation scenario (delete → reimport reconnects)', () => {
    // part references custom_X; it was deleted; reimport restores the ID
    const merged = mergeImportedPresets([], [preset('custom_X', 'X')]);
    expect(merged.some((p) => p.id === 'custom_X')).toBe(true);
  });

  it('37. generated collision ID unique even with multiple collisions', () => {
    const merged = mergeImportedPresets([userA], [preset('custom_A', 'D1'), preset('custom_A', 'D2')]);
    const ids = merged.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
  });
});

describe('M30 30A — architecture', () => {
  it('38. no AnimationProject fields introduced', () => {
    const payload = buildPresetExportPayload([userA]);
    expect(Object.keys(payload).sort()).toEqual(['presets', 'version']);
    const merged = mergeImportedPresets([], [userA]);
    expect(Object.keys(merged[0])).toEqual(Object.keys(userA)); // same shape as CustomMotionPreset
  });

  it('39. pure helpers never touch localStorage', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('localStorage used!'); });
    const spySet = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('localStorage used!'); });
    buildPresetExportPayload([userA]);
    validatePresetImportPayload({ version: 1, presets: [userA] });
    mergeImportedPresets([], [userA]);
    expect(spy).not.toHaveBeenCalled();
    expect(spySet).not.toHaveBeenCalled();
    spy.mockRestore();
    spySet.mockRestore();
  });

  it('40. M25 default-filtering semantics compatible (same authority)', () => {
    // the export filter must exclude exactly the DEFAULT_INITIAL_PRESETS ids
    const library = [...DEFAULT_INITIAL_PRESETS, preset('custom_1', 'U1')];
    const payload = buildPresetExportPayload(library);
    expect(payload.presets.map((p) => p.id)).toEqual(['custom_1']);
  });

  it('PRESET_EXPORT_VERSION constant is 1', () => {
    expect(PRESET_EXPORT_VERSION).toBe(1);
  });
});
