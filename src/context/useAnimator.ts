import { createContext, useContext } from 'react';
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
 * Reads the animator store from context.
 *
 * @throws When called outside `AnimatorProvider`, which is a programming error.
 */
export const useAnimator = () => {
  const ctx = useContext(AnimatorContext);
  if (!ctx) throw new Error('useAnimator must be used within an AnimatorProvider');
  return ctx;
};
