import { createContext, useCallback, useContext, useMemo, useRef, useSyncExternalStore } from 'react';
import type { AnimatorContextType } from './AnimatorContext';

/**
 * The animator store context object.
 *
 * It lives in this module, separate from `AnimatorContext.tsx`, so that the
 * provider module exports components only. A module that exports both a
 * component and a hook/constant breaks React Fast Refresh for that module
 * (the `react(only-export-components)` rule); keeping the context object and
 * its hook here restores it without changing any runtime behaviour.
 */
export const AnimatorContext = createContext<AnimatorContextType | null>(null);

/**
 * Reads the whole animator store from context. A component using it renders
 * whenever anything in the store changes — every frame while playing. Prefer
 * `useAnimatorSlice` in components that do not show the current frame.
 *
 * @throws When called outside `AnimatorProvider`, which is a programming error.
 */
export const useAnimator = () => {
  const ctx = useContext(AnimatorContext);
  if (!ctx) throw new Error('useAnimator must be used within an AnimatorProvider');
  return ctx;
};

type AnimatorAction = (...args: never[]) => unknown;

/**
 * The same store as a subscription source. The provider writes the latest
 * value into `current` while it renders and notifies after commit; slices are
 * read from it.
 */
export interface AnimatorStore {
  current: AnimatorContextType | null;
  listeners: Set<() => void>;
  /** One stable function per action name that calls the latest action. */
  actions: Map<string, AnimatorAction>;
}

export const createAnimatorStore = (): AnimatorStore => ({ current: null, listeners: new Set(), actions: new Map() });

export const AnimatorStoreContext = createContext<AnimatorStore | null>(null);

const stableAction = (store: AnimatorStore, key: string): AnimatorAction => {
  let action = store.actions.get(key);
  if (!action) {
    action = (...args: never[]) => (store.current![key as keyof AnimatorContextType] as AnimatorAction)(...args);
    store.actions.set(key, action);
  }
  return action;
};

/**
 * Subscribes to the named fields of the animator store only: the component
 * renders when one of THOSE values changes, not on every store change (the
 * store changes every frame during playback). Functions come back as stable
 * wrappers that call the latest version, so a handler never runs a stale
 * closure and a changed function identity never causes a render.
 *
 * A slice update reaches the component one commit after context readers see
 * the change (the store notifies from the provider's layout effect). A
 * component whose output the stage measures in that same commit — the shell
 * that mounts surfaces per `appMode` — must read `useAnimator` instead.
 *
 * Do not list a function a render result depends on through its identity
 * (for example as a `useMemo` dependency standing for the data it reads);
 * list the data instead.
 */
export const useAnimatorSlice = <K extends keyof AnimatorContextType>(...keys: K[]): Pick<AnimatorContextType, K> => {
  const store = useContext(AnimatorStoreContext);
  if (!store) throw new Error('useAnimatorSlice must be used within an AnimatorProvider');
  const cached = useRef<Pick<AnimatorContextType, K> | null>(null);
  const keyList = keys.join('|');

  const subscribe = useCallback((listener: () => void) => {
    store.listeners.add(listener);
    return () => { store.listeners.delete(listener); };
  }, [store]);

  const getSnapshot = useCallback((): Pick<AnimatorContextType, K> => {
    const state = store.current;
    if (!state) throw new Error('The animator store is read before its provider rendered');
    const previous = cached.current;
    let changed = previous === null;
    const next = {} as Pick<AnimatorContextType, K>;
    for (const key of keyList.split('|') as K[]) {
      const value = state[key];
      const resolved = (typeof value === 'function' ? stableAction(store, key as string) : value) as AnimatorContextType[K];
      next[key] = resolved;
      if (!changed && !Object.is(previous![key], resolved)) changed = true;
    }
    if (changed) cached.current = next;
    return cached.current!;
  }, [store, keyList]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

/**
 * Reads the latest store at call time (in an event handler), without
 * subscribing: for a value a component only needs when the user acts, such as
 * the current frame in a header button.
 */
export const useAnimatorReader = (): (() => AnimatorContextType) => {
  const store = useContext(AnimatorStoreContext);
  if (!store) throw new Error('useAnimatorReader must be used within an AnimatorProvider');
  return useMemo(() => readStore.bind(null, store), [store]);
};

const readStore = (store: AnimatorStore): AnimatorContextType => store.current!;

/**
 * Wires an authority built from the store (`create(state)` returning derived
 * values and actions) to a component without subscribing it to every frame.
 *
 * The component renders when one of `keys` changes; the derived values it
 * shows are computed from the latest store at that render, so `keys` must name
 * every field those VALUES are derived from. Each action builds the authority
 * again from the latest store when it is called, so an action never acts on a
 * frame or selection captured at an earlier render.
 */
export const useAnimatorAuthority = <T extends object, K extends keyof AnimatorContextType>(
  create: (state: AnimatorContextType) => T,
  ...keys: K[]
): T => {
  useAnimatorSlice(...keys);
  const read = useAnimatorReader();
  const now = create(read());
  const wired = {} as Record<string, unknown>;
  for (const [name, value] of Object.entries(now)) {
    wired[name] = typeof value === 'function'
      ? (...args: unknown[]) => (create(read()) as Record<string, (...a: unknown[]) => unknown>)[name](...args)
      : value;
  }
  return wired as T;
};
