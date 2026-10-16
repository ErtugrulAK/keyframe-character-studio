import { useState } from 'react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSerialization, type UseSerializationApi } from '../hooks/useSerialization';
import { AUTOSAVE_STORAGE_KEY } from '../utils/constants';
import type { CharacterPart, MotionTemplate, Track } from '../types/animator';
import type { SceneCoordinateSystem } from '../types/composition';

/**
 * SAFE-01 — multi-tab autosave data safety.
 *
 * The 10s autosave interval is the ONLY background writer to the shared
 * localStorage key, and today it writes unconditionally: an idle never-edited
 * tab (empty or stale-restored) overwrites what another tab saved. These
 * tests pin the safety contract on the real hook against real (ephemeral
 * jsdom) storage and fake timers — deterministic, no sleeps:
 *
 *   G1 an idle session (never edited) writes NOTHING for its key —
 *      fixes the reproduced K1 (empty idle tab wipe) and K2 (stale tab wipe);
 *   G2 an edited session still persists on its next tick (single-tab
 *      autosave keeps working — the feature is not weakened);
 *   G3 a background write performed by another tab between our saves is
 *      detected: the unsafe write is PAUSED, never silently overwritten (H1);
 *   G4 the manual save honors explicit intent but is blocked by a known
 *      conflict (it must not silently clobber newer storage either);
 *   G5 a failing localStorage write is not reported as a success and is
 *      retried on the following tick.
 */

const sceneLayer = (id: string, zIndex: number) => ({
  id,
  name: id,
  type: 'custom_rect',
  x: zIndex * 10,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  visible: true,
  zIndex,
  fillColor: '#3a86ff',
  strokeColor: '#000000',
  width: 80,
  height: 60,
});

const seedSceneJson = (ids: string[]): string =>
  JSON.stringify({
    version: 2,
    coordinateSystem: 'project-unit-center-v1',
    name: 'SAFE-01',
    width: 1280,
    height: 720,
    fps: 30,
    totalFrames: 60,
    layers: ids.map((id, index) => sceneLayer(id, index + 1)),
    tracks: ids.map((id, index) => ({
      id: `t_${id}`,
      partId: id,
      name: id,
      color: '#fff',
      visible: true,
      locked: false,
      channels: {
        x: [{ id: `${id}_x0`, frame: 0, value: index * 30, easing: 'linear' }],
      },
    })),
  });

const rectPart = (id: string): CharacterPart => ({
  id,
  name: id,
  type: 'custom_rect',
  zIndex: 9,
  fillColor: '#22d3ee',
  strokeColor: '#101218',
  fillEnabled: true,
  strokeEnabled: false,
  pivot: { x: 0, y: 0 },
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  width: 100,
  height: 70,
});

interface Harness {
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  lastSavedAt: Date | null;
  autosaveConflict: boolean;
  triggerManualSave: () => void;
  resetProject: () => void;
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
    const [projectTemplates, setProjectTemplates] = useState<any[]>([]);
    const [templateCanvasStore, setTemplateCanvasStore] = useState<any>(null);
    void tracks; void setTracks; void activeProjectTemplateId; void projectTemplates; void templateCanvasStore;
    const api = useSerialization({
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
      setProjectTemplates,
      setTemplateCanvasStore,
      setCurrentFrame: () => undefined,
      setIsPlaying: () => undefined,
    });
    // Read the CURRENT render's api, never a mount-time snapshot: the hooks
    // keep re-rendering while the assertions run.
    latest = api;
    setParts = setCharacterParts;
    return null;
  });
  return {
    get setCharacterParts() { return setParts; },
    get lastSavedAt() { return latest.lastSavedAt; },
    get autosaveConflict() { return latest.autosaveConflict; },
    get triggerManualSave() { return latest.triggerManualSave; },
    get resetProject() { return latest.resetProject; },
  };
};

const storedLayers = (): string[] | undefined => {
  const raw = window.localStorage.getItem(AUTOSAVE_STORAGE_KEY);
  if (raw === null) return undefined;
  const parsed = JSON.parse(raw) as { layers?: { id: string }[] };
  return (parsed.layers ?? []).map((layer) => layer.id);
};

const tickPastInterval = () => {
  act(() => {
    vi.advanceTimersByTime(11_000);
  });
};

const editWithPart = (harness: Harness, id: string) => {
  act(() => {
    harness.setCharacterParts((prev) => [...prev, rectPart(id)]);
  });
};

const autosaveWrites = (setItem: { mock: { calls: unknown[][] } }) =>
  setItem.mock.calls.filter(([key]) => key === AUTOSAVE_STORAGE_KEY);

describe('SAFE-01 — autosave only writes what this tab earned', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('G1a. an idle empty session never writes the shared key (K1: the empty-tab wipe)', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    renderSession();
    for (let rep = 0; rep < 3; rep += 1) tickPastInterval();
    expect(autosaveWrites(setItem)).toHaveLength(0);
    expect(window.localStorage.getItem(AUTOSAVE_STORAGE_KEY)).toBeNull();
  });

  it('G1b. an idle restored session never rewrites the key it only READ at boot (K3 idle churn)', () => {
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, seedSceneJson(['a', 'b', 'c']));
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    renderSession();
    for (let rep = 0; rep < 3; rep += 1) tickPastInterval();
    expect(autosaveWrites(setItem)).toHaveLength(0);
    expect(storedLayers()).toEqual(['a', 'b', 'c']);
  });

  it('G1c. a stale restored tab cannot overwrite the newer document another tab saved (K2)', () => {
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, seedSceneJson(['a', 'b', 'c']));
    renderSession(); // restores a,b,c into memory and never edits
    // Another tab legitimately saves a newer document...
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, seedSceneJson(['a', 'b', 'c', 'newer']));
    for (let rep = 0; rep < 3; rep += 1) tickPastInterval();
    expect(storedLayers()).toEqual(['a', 'b', 'c', 'newer']);
  });

  it('G2. an edited session still autosaves on its next tick (feature preserved)', () => {
    const harness = renderSession();
    tickPastInterval(); // let the session settle first (no write expected yet)
    editWithPart(harness, 'mine');
    tickPastInterval();
    expect(storedLayers()).toContain('mine');
  });

  it('G2b. an edited restored session persists its edit over the document it read', () => {
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, seedSceneJson(['a', 'b', 'c']));
    const harness = renderSession();
    tickPastInterval();
    editWithPart(harness, 'mine');
    tickPastInterval();
    expect(storedLayers()).toEqual(['a', 'b', 'c', 'mine']);
  });

  it('G3. an external write since this tab last saved pauses autosave instead of silently overwriting (H1)', () => {
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, seedSceneJson(['a', 'b', 'c']));
    const harness = renderSession();
    tickPastInterval();
    editWithPart(harness, 'mine');
    tickPastInterval();
    expect(storedLayers()).toEqual(['a', 'b', 'c', 'mine']); // this tab legitimately saved
    // Another tab now wins the shared key with its own newer document.
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, seedSceneJson(['x', 'y', 'z']));
    editWithPart(harness, 'mine2');
    tickPastInterval();
    tickPastInterval();
    // The external document must survive this tab's next attempted write...
    expect(storedLayers()).toEqual(['x', 'y', 'z']);
    // ...and the pause must be visible to the UI layer.
    expect(harness.autosaveConflict).toBe(true);
  });

  it('G4. manual save writes with no conflict but cannot silently clobber a known conflict', () => {
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, seedSceneJson(['a', 'b', 'c']));
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const harness = renderSession();
    tickPastInterval();
    act(() => harness.triggerManualSave());
    expect(autosaveWrites(setItem)).toHaveLength(1); // explicit intent writes, even with unchanged content
    expect(harness.autosaveConflict).toBe(false);

    // A conflicting external change makes the same manual save refuse silently.
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, seedSceneJson(['x', 'y', 'z']));
    editWithPart(harness, 'mine');
    tickPastInterval(); // autosave attempt sees the foreign value and pauses
    const writesBeforeManual = autosaveWrites(setItem).length;
    act(() => harness.triggerManualSave());
    expect(autosaveWrites(setItem)).toHaveLength(writesBeforeManual); // no silent overwrite...
    expect(storedLayers()).toEqual(['x', 'y', 'z']); // ...the newer storage survives
    expect(harness.autosaveConflict).toBe(true);
  });

  it('G5. a failing localStorage write is not reported as a success and is retried', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const harness = renderSession();
    tickPastInterval();
    editWithPart(harness, 'mine');
    setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededState');
    });
    tickPastInterval(); // the write fails; nothing may claim it succeeded
    expect(window.localStorage.getItem(AUTOSAVE_STORAGE_KEY)).toBeNull();
    expect(harness.lastSavedAt).toBeNull();
    tickPastInterval(); // honest retry succeeds on the next tick
    expect(storedLayers()).toContain('mine');
    expect(harness.lastSavedAt).not.toBeNull();
  });

  it('G5b. reset-project keeps its documented manual semantics and a later edit still saves', () => {
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, seedSceneJson(['a', 'b', 'c']));
    const harness = renderSession();
    tickPastInterval();
    act(() => harness.resetProject());
    tickPastInterval();
    editWithPart(harness, 'after-reset');
    tickPastInterval();
    expect(storedLayers()).toContain('after-reset');
  });
});
