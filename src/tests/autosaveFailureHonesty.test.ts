// D2 — autosave failure honesty: a failed write is reported, never dressed
// up as a success; the in-memory document and the CAS tokens survive; the
// first landing write clears the failure.
import { renderHook as renderHookBase, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSerialization, type UseSerializationApi } from '../hooks/useSerialization';

const renderHook = () => {
  const mocks = {
    setFps: vi.fn(),
    setTotalFrames: vi.fn(),
    setProjectResolution: vi.fn(),
    setTracks: vi.fn(),
    setCharacterParts: vi.fn(),
    setActiveProjectTemplateIdState: vi.fn(),
    setMotionTemplates: vi.fn(),
    setActiveTemplateIdState: vi.fn(),
    setSceneTitleState: vi.fn(),
    setProjectTemplates: vi.fn(),
    setTemplateCanvasStore: vi.fn(),
    setCurrentFrame: vi.fn(),
    setIsPlaying: vi.fn(),
  };
  const rendered = renderHookBase(() => useSerialization({
    fps: 30, setFps: mocks.setFps,
    totalFrames: 100, setTotalFrames: mocks.setTotalFrames,
    projectResolution: { width: 800, height: 600 }, setProjectResolution: mocks.setProjectResolution,
    tracks: [], setTracks: mocks.setTracks,
    characterParts: [], setCharacterParts: mocks.setCharacterParts,
    activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mocks.setActiveProjectTemplateIdState,
    motionTemplates: [], setMotionTemplates: mocks.setMotionTemplates,
    activeTemplateId: 'Sequence', setActiveTemplateIdState: mocks.setActiveTemplateIdState,
    sceneTitle: 'My Scene', setSceneTitleState: mocks.setSceneTitleState,
    projectTemplates: [], setProjectTemplates: mocks.setProjectTemplates,
    setTemplateCanvasStore: mocks.setTemplateCanvasStore,
    setCurrentFrame: mocks.setCurrentFrame,
    setIsPlaying: mocks.setIsPlaying,
  }));
  const result = {
    get current(): UseSerializationApi {
      const live = rendered.result.current;
      return {
        ...live,
        triggerManualSave: () => {
          act(() => { live.triggerManualSave(); });
        },
      };
    },
  };
  const flush = () => act(async () => { await Promise.resolve(); });
  return { result, flush };
};

const quotaError = () => Object.assign(new Error('quota'), { name: 'QuotaExceededError' });

const store = new Map<string, string>();
const faithfulWrite = (key: string, value: string): void => { store.set(key, String(value)); };

beforeEach(() => {
  store.clear();
  // A faithful in-memory Storage: getItem mirrors what setItem wrote, so the
  // CAS compare sees reality, not a permanent null.
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => store.get(key) ?? null);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(faithfulWrite);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('D2 — autosave failure honesty', () => {
  it('reports a quota failure instead of claiming the write landed', async () => {
    const { result, flush } = renderHook();
    const before = result.current.lastSavedAt;
    vi.mocked(Storage.prototype.setItem).mockImplementation(() => { throw quotaError(); });

    result.current.triggerManualSave();
    await flush();

    const after = result.current;
    expect(after.autosaveError?.kind).toBe('quota');
    expect(typeof after.autosaveError?.at).toBe('number');
    // Honest: the saved stamp did not advance across the failed write.
    expect(after.lastSavedAt?.getTime()).toBe(before?.getTime());
  });

  it('reports an unreadable store as unavailable, not as saved', async () => {
    const { result, flush } = renderHook();
    vi.mocked(Storage.prototype.getItem).mockImplementation(() => { throw new Error('SecurityError'); });

    result.current.triggerManualSave();
    await flush();

    expect(result.current.autosaveError?.kind).toBe('unavailable');
  });

  it('keeps the first failure timestamp across repeated failing ticks (no churn)', async () => {
    const { result, flush } = renderHook();
    vi.mocked(Storage.prototype.setItem).mockImplementation(() => { throw quotaError(); });

    result.current.triggerManualSave();
    await flush();
    const firstAt = result.current.autosaveError?.at;

    result.current.triggerManualSave();
    await flush();

    expect(result.current.autosaveError?.at).toBe(firstAt);
  });

  it('a write that lands clears the failure and advances the stamp', async () => {
    const { result, flush } = renderHook();
    vi.mocked(Storage.prototype.setItem).mockImplementation(() => { throw quotaError(); });
    result.current.triggerManualSave();
    await flush();
    expect(result.current.autosaveError).not.toBeNull();

    vi.mocked(Storage.prototype.setItem).mockImplementation(faithfulWrite);
    result.current.triggerManualSave();
    await flush();

    expect(result.current.autosaveError).toBeNull();
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
  });

  it('never lets a failed write advance the CAS tokens', async () => {
    const { result, flush } = renderHook();
    vi.mocked(Storage.prototype.setItem).mockImplementation(() => { throw quotaError(); });
    result.current.triggerManualSave();
    await flush();

    // The key still holds nothing while the token says the store was written:
    // the next tick must re-observe reality, not skip the write as settled.
    expect(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5')).toBeNull();
    vi.mocked(Storage.prototype.setItem).mockImplementation(faithfulWrite);
    result.current.triggerManualSave();
    await flush();
    expect(localStorage.getItem('SEQUENCER_STUDIO_PRO_V5')).toContain('My Scene');
  });
});
