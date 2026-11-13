/**
 * The header's save status, derived only from what the serialization hook
 * reports: a conflict pause, a failed write, a save in flight, unsaved changes,
 * or the time since the last SUCCESSFUL save. Pure, so every wording is tested.
 */
type SaveStatusState = 'paused' | 'failed' | 'saving' | 'unsaved' | 'saved' | 'never';

interface SaveStatusInput {
  conflict: boolean;
  error: 'quota' | 'unavailable' | null;
  saving: boolean;
  unsaved: boolean;
  /** Epoch ms of the last successful save, or null. */
  lastSavedAt: number | null;
  now: number;
  /** The user's autosave delay in seconds (default 10). */
  intervalSeconds?: number;
}

interface SaveStatus {
  state: SaveStatusState;
  /** Short badge text (the badge reserves room for the longest one). */
  label: string;
  /** Tooltip: what the state means and what happens next. */
  detail: string;
}

/** "12s", "3m", "2h": the age of the last successful save. */
export const formatSaveAge = (ms: number): string => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
};

const clockTime = (at: number): string => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** "1 second", "10 seconds": the autosave delay in a sentence. */
export const formatAutosaveDelay = (seconds: number): string => `${seconds} second${seconds === 1 ? '' : 's'}`;

export const describeSaveStatus = ({ conflict, error, saving, unsaved, lastSavedAt, now, intervalSeconds = 10 }: SaveStatusInput): SaveStatus => {
  const delay = formatAutosaveDelay(intervalSeconds);
  const last = lastSavedAt === null
    ? 'Nothing has been saved in this session yet.'
    : `Last successful save: ${clockTime(lastSavedAt)} (${formatSaveAge(now - lastSavedAt)} ago).`;
  if (conflict) {
    return {
      state: 'paused',
      label: 'Autosave paused',
      detail: `Autosave paused: another tab changed the shared project. Reload to adopt it, or export this tab’s work — nothing here will be overwritten. ${last}`,
    };
  }
  if (error) {
    return {
      state: 'failed',
      label: 'Save failed',
      detail: `Auto-save failed: browser storage ${error === 'quota' ? 'is full' : 'is unavailable'}. Your changes are kept in memory — export the project to keep them. Autosave retries every ${delay}; clicking saves now. ${last}`,
    };
  }
  if (saving) return { state: 'saving', label: 'Saving…', detail: `Saving to this browser… ${last}` };
  if (unsaved) {
    return {
      state: 'unsaved',
      label: 'Unsaved changes',
      detail: `Unsaved changes: autosave writes them within ${delay} of the first change. Click to save now. ${last}`,
    };
  }
  if (lastSavedAt === null) {
    return { state: 'never', label: 'Not saved yet', detail: `Nothing to save yet: autosave writes within ${delay} of your first change. Click to save now.` };
  }
  const age = now - lastSavedAt;
  return {
    state: 'saved',
    label: age < 5000 ? 'Just saved' : `Saved ${formatSaveAge(age)} ago`,
    detail: `All changes saved. ${last} Autosave writes new changes within ${delay}; click to save now.`,
  };
};
