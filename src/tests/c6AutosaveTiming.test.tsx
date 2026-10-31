import { useState } from 'react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { AUTOSAVE_DELAY_MS, useSerialization, type UseSerializationApi } from '../hooks/useSerialization';
import { AUTOSAVE_STORAGE_KEY } from '../utils/editor/constants';
import { describeSaveStatus, formatSaveAge } from '../utils/persistence/saveStatus';
import type { CharacterPart, MotionTemplate, Track } from '../types/animator';
import type { SceneCoordinateSystem } from '../types/composition';

/**
 * C6 — autosave timing and the honest header status.
 *
 * The save is due AUTOSAVE_DELAY_MS after the FIRST unsaved change; further
 * edits never postpone it (the old interval was re-created by every edit, so a
 * user who kept editing never got a save). Nothing is written without a change,
 * and "unsaved" clears only through a write that succeeded.
 */

const rectPart = (id: string, x = 0): CharacterPart => ({
  id,
  name: id,
  type: 'custom_rect',
  zIndex: 1,
  fillColor: '#22d3ee',
  strokeColor: '#101218',
  pivot: { x: 0, y: 0 },
  baseTransform: { x, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  width: 100,
  height: 70,
});

interface Harness {
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  api: UseSerializationApi;
}

const renderSession = (): Harness => {
  let latest!: UseSerializationApi;
  let setParts: React.Dispatch<React.SetStateAction<CharacterPart[]>> = () => undefined;
  renderHook(() => {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [characterParts, setCharacterParts] = useState<CharacterPart[]>([]);
    const [fps, setFps] = useState(24);
    const [totalFrames, setTotalFrames] = useState(48);
    const [projectResolution, setProjectResolution] = useState({ width: 1920, height: 1080 });
    const [coordinateSystem, setCoordinateSystem] = useState<SceneCoordinateSystem>('project-unit-center-v1');
    const [sceneTitle, setSceneTitleState] = useState('Fixture');
    const [activeTemplateId, setActiveTemplateIdState] = useState('Sequence');
    const [motionTemplates, setMotionTemplates] = useState<MotionTemplate[]>([]);
    const [activeProjectTemplateId, setActiveProjectTemplateIdState] = useState('default');
    latest = useSerialization({
      fps, setFps,
      totalFrames, setTotalFrames,
      projectResolution, setProjectResolution,
      coordinateSystem, setCoordinateSystem,
      tracks, setTracks,
      characterParts, setCharacterParts,
      activeProjectTemplateId, setActiveProjectTemplateIdState,
      motionTemplates, setMotionTemplates,
      activeTemplateId, setActiveTemplateIdState,
      sceneTitle, setSceneTitleState,
      setProjectTemplates: () => undefined,
      setTemplateCanvasStore: () => undefined,
      setCurrentFrame: () => undefined,
      setIsPlaying: () => undefined,
    });
    setParts = setCharacterParts;
    return null;
  });
  return {
    get setCharacterParts() { return setParts; },
    get api() { return latest; },
  };
};

const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const autosaveWrites = (setItem: { mock: { calls: unknown[][] } }) =>
  setItem.mock.calls.filter(([key]) => key === AUTOSAVE_STORAGE_KEY).length;
const storedX = (): number | undefined => {
  const raw = window.localStorage.getItem(AUTOSAVE_STORAGE_KEY);
  return raw ? (JSON.parse(raw).layers?.[0]?.x as number | undefined) : undefined;
};

describe('C6 — autosave is due 10 s after the first unsaved change', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('continuous editing does not postpone the save', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const harness = renderSession();
    advance(2000);
    act(() => harness.setCharacterParts([rectPart('a', 0)]));
    expect(harness.api.hasUnsavedChanges).toBe(true);
    // An edit every 2 s, for longer than the delay.
    for (let step = 1; step <= 4; step += 1) {
      advance(2000);
      act(() => harness.setCharacterParts([rectPart('a', step * 10)]));
    }
    expect(autosaveWrites(setItem)).toBe(0);
    advance(2000); // 10 s after the FIRST change (+ at most one check tick)
    expect(autosaveWrites(setItem)).toBe(1);
    expect(storedX()).toBe(40);
    expect(harness.api.hasUnsavedChanges).toBe(false);
    expect(harness.api.lastSavedAt).not.toBeNull();
  });

  it('the save lands within the delay plus one check tick of the first change', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const harness = renderSession();
    advance(500);
    act(() => harness.setCharacterParts([rectPart('a')]));
    advance(AUTOSAVE_DELAY_MS - 1000);
    expect(autosaveWrites(setItem)).toBe(0);
    advance(2000);
    expect(autosaveWrites(setItem)).toBe(1);
  });

  it('an idle session and an edit undone back to the saved document write nothing', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const harness = renderSession();
    advance(30_000);
    expect(autosaveWrites(setItem)).toBe(0);
    act(() => harness.setCharacterParts([rectPart('a')]));
    advance(11_000);
    expect(autosaveWrites(setItem)).toBe(1);
    act(() => harness.setCharacterParts([rectPart('a', 50)]));
    expect(harness.api.hasUnsavedChanges).toBe(true);
    act(() => harness.setCharacterParts([rectPart('a', 0)])); // back to the saved state
    advance(11_000);
    expect(autosaveWrites(setItem)).toBe(1);
    expect(harness.api.hasUnsavedChanges).toBe(false);
    advance(60_000);
    expect(autosaveWrites(setItem)).toBe(1);
  });

  it('a failed write keeps the changes unsaved, reports the error and retries', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const harness = renderSession();
    advance(1000);
    act(() => harness.setCharacterParts([rectPart('a')]));
    setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    advance(11_000);
    expect(harness.api.hasUnsavedChanges).toBe(true);
    expect(harness.api.autosaveError).not.toBeNull();
    expect(harness.api.lastSavedAt).toBeNull();
    advance(11_000);
    expect(storedX()).toBe(0);
    expect(harness.api.hasUnsavedChanges).toBe(false);
    expect(harness.api.autosaveError).toBeNull();
  });
});

describe('C6 — save status wording', () => {
  const base = { conflict: false, error: null, saving: false, unsaved: false, lastSavedAt: null, now: 100_000 } as const;

  it('says how long ago the last SUCCESSFUL save was', () => {
    expect(describeSaveStatus({ ...base, lastSavedAt: 98_000 }).label).toBe('Just saved');
    expect(describeSaveStatus({ ...base, lastSavedAt: 88_000 }).label).toBe('Saved 12s ago');
    expect(describeSaveStatus({ ...base, lastSavedAt: 100_000 - 3 * 60_000 }).label).toBe('Saved 3m ago');
    expect(describeSaveStatus({ ...base, lastSavedAt: 88_000 }).detail).toMatch(/Last successful save: .* \(12s ago\)/);
    expect(formatSaveAge(2 * 3_600_000)).toBe('2h');
  });

  it('never shows success while changes are unsaved, in flight, failed or paused', () => {
    const saved = { ...base, lastSavedAt: 99_000 };
    expect(describeSaveStatus({ ...saved, unsaved: true })).toMatchObject({ state: 'unsaved', label: 'Unsaved changes' });
    expect(describeSaveStatus({ ...saved, unsaved: true, saving: true })).toMatchObject({ state: 'saving', label: 'Saving…' });
    expect(describeSaveStatus({ ...saved, unsaved: true, error: 'quota' })).toMatchObject({ state: 'failed', label: 'Save failed' });
    expect(describeSaveStatus({ ...saved, conflict: true, error: 'quota' })).toMatchObject({ state: 'paused', label: 'Autosave paused' });
    expect(describeSaveStatus(base)).toMatchObject({ state: 'never', label: 'Not saved yet' });
  });

  it('every label fits the 15ch box the badge reserves', () => {
    const labels = [
      describeSaveStatus({ ...base, unsaved: true }).label,
      describeSaveStatus({ ...base, conflict: true }).label,
      describeSaveStatus({ ...base, error: 'unavailable' }).label,
      describeSaveStatus({ ...base, saving: true }).label,
      describeSaveStatus(base).label,
      describeSaveStatus({ ...base, lastSavedAt: 100_000 - 59 * 60_000 }).label,
      describeSaveStatus({ ...base, lastSavedAt: 100_000 - 59_000 }).label,
    ];
    for (const label of labels) expect(label.length).toBeLessThanOrEqual(15);
  });
});
