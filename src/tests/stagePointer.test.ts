import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The stage pointer store: Paste reads where the pointer last was over the
 * stage, and the edge markers follow it only while it is over the stage.
 * The store is module state, so every test loads a fresh copy.
 */
type Store = typeof import('../utils/editor/stagePointer');
let store: Store;
beforeEach(async () => {
  vi.resetModules();
  store = await import('../utils/editor/stagePointer');
});

describe('stage pointer store', () => {
  it('knows nothing before the pointer first reaches the stage', () => {
    expect(store.stagePointer()).toBeNull();
    expect(store.stageHoverPointer()).toBeNull();
  });

  it('remembers the pointer for Paste and for the markers', () => {
    store.rememberStagePointer({ x: 120, y: -40 });
    expect(store.stagePointer()).toEqual({ x: 120, y: -40 });
    expect(store.stageHoverPointer()).toEqual({ x: 120, y: -40 });
  });

  it('keeps a copy, not the caller\'s object', () => {
    const point = { x: 1, y: 2 };
    store.rememberStagePointer(point);
    point.x = 99;
    expect(store.stagePointer()).toEqual({ x: 1, y: 2 });
  });

  it('leaving the stage clears the hover point but Paste keeps the last place', () => {
    store.rememberStagePointer({ x: 10, y: 20 });
    store.leaveStage();
    expect(store.stageHoverPointer()).toBeNull();
    expect(store.stagePointer()).toEqual({ x: 10, y: 20 });
  });

  it('ignores a non-finite point for Paste and treats it as off the stage', () => {
    store.rememberStagePointer({ x: 5, y: 6 });
    store.rememberStagePointer({ x: Number.NaN, y: 0 });
    expect(store.stagePointer()).toEqual({ x: 5, y: 6 });
    expect(store.stageHoverPointer()).toBeNull();
    store.rememberStagePointer({ x: 0, y: Number.POSITIVE_INFINITY });
    expect(store.stagePointer()).toEqual({ x: 5, y: 6 });
    store.rememberStagePointer(null);
    expect(store.stagePointer()).toEqual({ x: 5, y: 6 });
    expect(store.stageHoverPointer()).toBeNull();
  });

  it('notifies subscribers on every change and stops after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = store.subscribeStageHover(listener);
    store.rememberStagePointer({ x: 1, y: 1 });
    store.leaveStage();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.rememberStagePointer({ x: 2, y: 2 });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('returns the same hover object until the pointer moves (a stable useSyncExternalStore snapshot)', () => {
    store.rememberStagePointer({ x: 3, y: 4 });
    expect(store.stageHoverPointer()).toBe(store.stageHoverPointer());
  });
});
