/**
 * Undo snapshots share structure with the live scene instead of copying it.
 *
 * Scene state is updated immutably: an edit replaces the arrays and objects on
 * the path to the changed value and keeps every other reference. A snapshot
 * can therefore hold the state arrays themselves, and two snapshots can be
 * compared by walking only the references that differ.
 */

/**
 * Deep equality that returns at the first shared reference, so comparing two
 * states that differ in one layer costs that layer, not the whole scene.
 *
 * Matches the JSON comparison it replaces: a key holding `undefined` counts as
 * absent.
 */
export const structurallyEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const other = b as unknown[];
    if (a.length !== other.length) return false;
    for (let index = 0; index < a.length; index += 1) {
      if (!structurallyEqual(a[index], other[index])) return false;
    }
    return true;
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const leftKeys = Object.keys(left).filter((key) => left[key] !== undefined);
  const rightCount = Object.keys(right).reduce((count, key) => count + (right[key] !== undefined ? 1 : 0), 0);
  if (leftKeys.length !== rightCount) return false;
  for (const key of leftKeys) {
    if (!structurallyEqual(left[key], right[key])) return false;
  }
  return true;
};

/**
 * Freezes a recorded value all the way down. Development builds freeze every
 * snapshot, so an in-place mutation of scene state — which would silently
 * rewrite undo history now that snapshots share references — throws where it
 * happens instead.
 */
export const deepFreeze = <T>(value: T): T => {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value) || ArrayBuffer.isView(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  return value;
};
