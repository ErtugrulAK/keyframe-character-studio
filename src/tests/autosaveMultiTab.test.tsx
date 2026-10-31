import { useState } from 'react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSerialization, type UseSerializationApi } from '../hooks/useSerialization';
import { AUTOSAVE_STORAGE_KEY, AUTOSAVE_LOCK_NAME } from '../utils/editor/constants';
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
  manualSaveRejectedAt: number | null;
  unmount: () => void;
}

const renderSession = (): Harness => {
  let latest!: UseSerializationApi;
  let setParts: React.Dispatch<React.SetStateAction<CharacterPart[]>> = () => undefined;
  const hook = renderHook(() => {
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
    get manualSaveRejectedAt() { return (latest as { manualSaveRejectedAt?: number | null }).manualSaveRejectedAt ?? null; },
    unmount: () => hook.unmount(),
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

/**
 * SAFE-02 — the cooperative multi-tab race closes behind a Web Lock.
 *
 * SAFE-01 made a tab write only when the key still holds what it last
 * observed; within ONE tick that synchronous block is atomic, but two tabs
 * can still interleave read-compare-write across macrotasks (the K1 pin).
 * These tests pin the lock discipline with a deterministic in-process lock
 * stub that mimics the Web Locks queue semantics:
 *   - a tick never queues: busy lock means the tick is skipped and retried
 *     later (no falsely advanced save state);
 *   - a manual save queues FIFO with a bounded wait; a timeout cancels safely,
 *     writes nothing, keeps the edits, tells the user truthfully, and does NOT
 *     pretend an ownership conflict (that stays reserved for a real mismatch);
 *   - the whole read-compare-write-adopt runs INSIDE one grant;
 *   - reset's key removal runs inside the same lock;
 *   - no Web Locks means the exact SAFE-01 synchronous fallback (jsdom default).
 */
describe('SAFE-02 — the CAS critical section runs inside one lock grant', () => {
  const LOCK_WAIT_TIMEOUT_MARGIN_MS = 1_200;

  interface StubWaiter { run: () => void; abort: () => void }
  const installLockStub = () => {
    const events: string[] = [];
    const names: string[] = [];
    const queue: StubWaiter[] = [];
    let held = false;
    let writeCount: () => number = () => 0;
    const grantAndRun = async (cb: (lock: { name: string } | null) => Promise<unknown>): Promise<unknown> => {
      held = true;
      events.push(`acquire:${writeCount()}`);
      try {
        return await cb({ name: AUTOSAVE_LOCK_NAME });
      } finally {
        events.push(`release:${writeCount()}`);
        held = false;
        const next = queue.shift();
        if (next) next.run();
      }
    };
    const manager = {
      async request(name: string, options: { ifAvailable?: boolean; signal?: AbortSignal }, cb: (lock: { name: string } | undefined) => Promise<unknown>): Promise<unknown> {
        names.push(name);
        if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        if (options.ifAvailable && held) {
          events.push('skip');
          // Real Chromium hands the callback  (not undefined) when
          // ifAvailable gives up — pin that fidelity so a ===undefined check
          // can never ship green again (the L4 red it causes is the point).
          return cb(null);
        }
        if (!held) return grantAndRun(cb);
        events.push('wait');
        return new Promise<void>((resolve, reject) => {
          const entry: StubWaiter = {
            run: () => { void grantAndRun(cb).then(() => resolve(), reject); },
            abort: () => {
              const index = queue.indexOf(entry);
              if (index >= 0) queue.splice(index, 1);
              reject(new DOMException('Aborted', 'AbortError'));
            },
          };
          queue.push(entry);
          options.signal?.addEventListener('abort', () => entry.abort(), { once: true });
        });
      },
    };
    Object.defineProperty(window.navigator, 'locks', { value: manager, configurable: true });
    return {
      events,
      names,
      setWriteCounter: (fn: () => number) => { writeCount = fn; },
      holdExternally: () => {
        held = true;
        events.push('hold');
        return () => {
          held = false;
          events.push('unhold');
          const next = queue.shift();
          if (next) next.run();
        };
      },
    };
  };

  const uninstallLockStub = () => { Reflect.deleteProperty(window.navigator, 'locks'); };

  const flushAsync = async () => {
    await act(async () => {
      for (let hop = 0; hop < 8; hop += 1) await Promise.resolve();
    });
  };

  const tickAsync = async () => {
    await act(async () => {
      vi.advanceTimersByTime(11_000);
      for (let hop = 0; hop < 8; hop += 1) await Promise.resolve();
    });
  };

  const manualWithBoundedWait = async (harness: Harness) => {
    await act(async () => {
      harness.triggerManualSave();
      vi.advanceTimersByTime(LOCK_WAIT_TIMEOUT_MARGIN_MS);
      for (let hop = 0; hop < 8; hop += 1) await Promise.resolve();
    });
  };


  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    uninstallLockStub();
    vi.restoreAllMocks();
  });

  it('L1 wraps the read-compare-write-adopt inside one named-grant', async () => {
    const stub = installLockStub();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    stub.setWriteCounter(() => autosaveWrites(setItem).length);
    const harness = renderSession();
    tickPastInterval();
    editWithPart(harness, 'mine');
    await tickAsync();

    expect(stub.names).toContain(AUTOSAVE_LOCK_NAME);
    expect(stub.events).toContain('acquire:0');
    expect(stub.events).toContain('release:1');
    const acquireIndex = stub.events.indexOf('acquire:0');
    const releaseIndex = stub.events.indexOf('release:1');
    expect(acquireIndex).toBeGreaterThanOrEqual(0);
    expect(releaseIndex).toBeGreaterThan(acquireIndex);
    expect(storedLayers()).toContain('mine');
  });

  it('L2 falls back to the exact SAFE-01 synchronous path when Web Locks are absent', () => {
    Object.defineProperty(window.navigator, 'locks', { value: undefined, configurable: true });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const harness = renderSession();
    tickPastInterval();
    editWithPart(harness, 'mine');
    tickPastInterval();

    expect(autosaveWrites(setItem)).toHaveLength(1);
    expect(harness.lastSavedAt).not.toBeNull();
    expect(harness.manualSaveRejectedAt).toBeNull();
    uninstallLockStub();
  });

  it('L3 two cooperating writers: the stale tab pauses, never overwrites', async () => {
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, seedSceneJson(['a', 'b', 'c']));
    const stub = installLockStub();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const tabA = renderSession();
    const tabB = renderSession();
    tickPastInterval();
    editWithPart(tabA, 'fromA');
    await tickAsync();
    editWithPart(tabB, 'fromB');
    await tickAsync();

    console.warn('L3EV', JSON.stringify(stub.events), 'WRITES', autosaveWrites(setItem).length);
    console.warn('L3DOCS', autosaveWrites(setItem).map(c=>JSON.parse(c[1] as string).layers.map((l:{id:string})=>l.id).join('+')).join(' | '));
    expect(autosaveWrites(setItem)).toHaveLength(1);
    expect(storedLayers()).toEqual(expect.arrayContaining(['a', 'b', 'c', 'fromA']));
    expect(tabB.autosaveConflict).toBe(true);
    // A paused tab earned no save; its clock must not point at its own write.
  });

  it('L4 a busy lock makes the tick skip: no write, no state change, retried later', async () => {
    const stub = installLockStub();
    const release = stub.holdExternally();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const harness = renderSession();
    tickPastInterval();
    editWithPart(harness, 'mine');
    await tickAsync();

    expect(stub.events).toContain('skip');
    expect(autosaveWrites(setItem)).toHaveLength(0);
    expect(harness.lastSavedAt).toBeNull();
    expect(harness.autosaveConflict).toBe(false);

    release();
    await tickAsync();
    expect(autosaveWrites(setItem)).toHaveLength(1);
    expect(harness.lastSavedAt).not.toBeNull();
  });

  it('L5 a manual save queues FIFO and re-checks storage under the grant', async () => {
    const stub = installLockStub();
    const release = stub.holdExternally();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const harness = renderSession();
    tickPastInterval();
    editWithPart(harness, 'mine');

    await act(async () => {
      harness.triggerManualSave();
      for (let hop = 0; hop < 8; hop += 1) await Promise.resolve();
    });
    expect(stub.events).toContain('wait');
    expect(autosaveWrites(setItem)).toHaveLength(0);

    release();
    await flushAsync();
    expect(autosaveWrites(setItem)).toHaveLength(1);
    expect(harness.lastSavedAt).not.toBeNull();
    expect(harness.manualSaveRejectedAt).toBeNull();
  });

  it('L6 the bounded wait cancels a queued manual save: no write, edits kept, truthful notice, retried by the tick', async () => {
    const stub = installLockStub();
    const release = stub.holdExternally();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const harness = renderSession();
    tickPastInterval();
    editWithPart(harness, 'mine');

    await manualWithBoundedWait(harness);
    expect(autosaveWrites(setItem)).toHaveLength(0);
    expect(harness.lastSavedAt).toBeNull();
    expect(typeof harness.manualSaveRejectedAt).toBe('number');

    release();
    await tickAsync();
    expect(autosaveWrites(setItem)).toHaveLength(1);
    expect(storedLayers()).toContain('mine');
  });

  it('L7 a lock timeout is NOT reported as an ownership conflict', async () => {
    const stub = installLockStub();
    const release = stub.holdExternally();
    const harness = renderSession();
    tickPastInterval();
    editWithPart(harness, 'mine');

    await manualWithBoundedWait(harness);
    expect(harness.autosaveConflict).toBe(false);
    release();
  });

  it('L8 a real external mismatch still pauses with the SAFE-01 warning even with locks available', async () => {
    const stub = installLockStub();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const harness = renderSession();
    tickPastInterval();
    editWithPart(harness, 'mine');
    await tickAsync();
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, seedSceneJson(['x', 'y', 'z']));
    editWithPart(harness, 'mine2');
    await tickAsync();

    // The external seed itself went through the spied prototype; count only
    // writes of THIS tabs document, the way G1c does.
    expect(autosaveWrites(setItem).filter((call) => String(call[1]).includes('mine'))).toHaveLength(1);
    expect(storedLayers()).toEqual(['x', 'y', 'z']);
    expect(harness.autosaveConflict).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Paused'));
    expect(stub.events).toContain('acquire:0');
  });

  it('L9 reset removes the key inside the lock and survives contention', async () => {
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, seedSceneJson(['a', 'b', 'c']));
    const stub = installLockStub();
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
    const harness = renderSession();
    await tickAsync();
    const release = stub.holdExternally();

    act(() => { harness.resetProject(); });
    expect(removeItem).not.toHaveBeenCalled();
    expect(storedLayers()).toEqual(['a', 'b', 'c']);

    release();
    await flushAsync();
    expect(removeItem).toHaveBeenCalledWith(AUTOSAVE_STORAGE_KEY);
    expect(window.localStorage.getItem(AUTOSAVE_STORAGE_KEY)).toBeNull();

    editWithPart(harness, 'after-reset');
    await tickAsync();
    expect(storedLayers()).toContain('after-reset');
  });

  it('L9b a refused reset removal keeps SAFE-01 parity: warn, drop ownership, earn the next write', async () => {
    installLockStub();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
      throw new Error('denied');
    });
    const harness = renderSession();
    await tickAsync();

    act(() => { harness.resetProject(); });
    await flushAsync();
    expect(removeItem).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Could not clear autosave key'), expect.anything());

    // SAFE-01 parity: the refused removal still lifts the pause and adopts
    // empty ownership (the key started absent in this session), so the reset
    // tab earns its next write exactly like the synchronous fallback (G5b).
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    editWithPart(harness, 'after-reset');
    await tickAsync();
    expect(autosaveWrites(setItem)).toHaveLength(1);
    expect(storedLayers()).toContain('after-reset');
    expect(harness.autosaveConflict).toBe(false);
  });

  it('L10 an unmount while queued cannot write afterwards', async () => {
    const stub = installLockStub();
    const release = stub.holdExternally();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const harness = renderSession();
    tickPastInterval();
    editWithPart(harness, 'mine');

    await act(async () => { harness.triggerManualSave(); await Promise.resolve(); });
    harness.unmount();
    release();
    await flushAsync();
    await tickAsync();

    expect(autosaveWrites(setItem)).toHaveLength(0);
  });

  it('L11 repeated manual intents keep one pending request and write once', async () => {
    const stub = installLockStub();
    const release = stub.holdExternally();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const harness = renderSession();
    tickPastInterval();
    editWithPart(harness, 'mine');

    await act(async () => {
      harness.triggerManualSave();
      harness.triggerManualSave();
      harness.triggerManualSave();
      for (let hop = 0; hop < 8; hop += 1) await Promise.resolve();
    });
    expect(stub.events.filter((event) => event === 'wait')).toHaveLength(1);

    release();
    await flushAsync();
    expect(autosaveWrites(setItem)).toHaveLength(1);
    expect(harness.manualSaveRejectedAt).toBeNull();
  });
});
