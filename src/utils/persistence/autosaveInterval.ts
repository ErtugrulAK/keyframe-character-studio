/**
 * How long autosave waits after the first unsaved change: an editor preference
 * of this browser, never scene data (a project opened elsewhere keeps that
 * machine's own setting).
 */
export const AUTOSAVE_INTERVAL_STORAGE_KEY = 'kcs_autosave_interval_seconds';
export const DEFAULT_AUTOSAVE_SECONDS = 10;
export const MIN_AUTOSAVE_SECONDS = 1;
export const MAX_AUTOSAVE_SECONDS = 600;

/** Whole seconds within [MIN, MAX]; anything unusable falls back to the default. */
export const normalizeAutosaveSeconds = (value: unknown): number => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) return DEFAULT_AUTOSAVE_SECONDS;
  return Math.min(MAX_AUTOSAVE_SECONDS, Math.max(MIN_AUTOSAVE_SECONDS, Math.round(number)));
};

/** The stored preference; the default when storage is empty, blocked or holds junk. */
export const readAutosaveSeconds = (): number => {
  try {
    const stored = localStorage.getItem(AUTOSAVE_INTERVAL_STORAGE_KEY);
    return stored === null ? DEFAULT_AUTOSAVE_SECONDS : normalizeAutosaveSeconds(stored);
  } catch {
    return DEFAULT_AUTOSAVE_SECONDS;
  }
};

/** Stores the normalized preference and returns it; a blocked storage keeps it for this session only. */
export const writeAutosaveSeconds = (value: unknown): number => {
  const seconds = normalizeAutosaveSeconds(value);
  try {
    localStorage.setItem(AUTOSAVE_INTERVAL_STORAGE_KEY, String(seconds));
  } catch {
    // The setting still applies until the page closes.
  }
  return seconds;
};
