/**
 * The template tabs that are not on screen, kept across a reload.
 *
 * The autosave key (`SEQUENCER_STUDIO_PRO_V5`) holds the scene on screen, as
 * it always has, and stays the only copy of it: every build reads and writes
 * it the same way. This second key holds the tab list, which tab is open and
 * the scenes of the OTHER tabs. Nothing is stored twice, so the two can never
 * disagree about a scene's content.
 *
 * With a single tab the key is not written at all: the storage of a one-tab
 * user is exactly what it was before tabs were kept.
 *
 * Pure: no storage, no React. The hook (`useSerialization`) reads and writes.
 */

export const WORKSPACE_STORAGE_KEY = 'KCS_WORKSPACE_V1';
/** Where a tab's scene the restore refused is kept, so a later save cannot destroy the only copy. */
export const WORKSPACE_REFUSED_STORAGE_KEY = `${WORKSPACE_STORAGE_KEY}_REFUSED`;
/**
 * The most tabs a stored record may list; a longer list is a damaged record,
 * not a workspace. Far above real use, so no editor session outgrows it.
 */
export const MAX_WORKSPACE_TABS = 100;

const WORKSPACE_KIND = 'kcs-workspace';
const WORKSPACE_VERSION = 1;
/** Tab ids are the editor's own (`tmpl_<number>`); anything else is refused, `__proto__` included. */
const TAB_ID_PATTERN = /^(?!__proto__$|constructor$|prototype$)[A-Za-z0-9_-]{1,128}$/;
const MAX_TAB_NAME_LENGTH = 512;

export interface WorkspaceTab {
  id: string;
  name: string;
}

export interface WorkspaceRecord {
  kind: typeof WORKSPACE_KIND;
  version: typeof WORKSPACE_VERSION;
  activeTabId: string;
  tabs: WorkspaceTab[];
  /** The scene (SceneData) of each tab that is not open; the open tab's lives in the autosave key. */
  scenes: Record<string, unknown>;
}

/**
 * The record to store for these tabs, or null when there is nothing to keep
 * beside the open scene (a single tab). Scenes of tabs not in the list, and
 * the open tab's, are left out.
 */
export const buildWorkspaceRecord = (
  activeTabId: string,
  tabs: readonly WorkspaceTab[],
  scenes: Readonly<Record<string, unknown>>,
): WorkspaceRecord | null => {
  if (tabs.length <= 1) return null;
  const kept: Record<string, unknown> = {};
  for (const tab of tabs) {
    if (tab.id === activeTabId || !Object.prototype.hasOwnProperty.call(scenes, tab.id)) continue;
    kept[tab.id] = scenes[tab.id];
  }
  return {
    kind: WORKSPACE_KIND,
    version: WORKSPACE_VERSION,
    activeTabId,
    tabs: tabs.map((tab) => ({ id: tab.id, name: tab.name })),
    scenes: kept,
  };
};

export type WorkspaceParseResult =
  | {
      ok: true;
      activeTabId: string;
      tabs: WorkspaceTab[];
      /** Each stored scene as JSON text, for the scene import boundary (`validateImportedDocument`). */
      sceneTexts: Map<string, string>;
    }
  | { ok: false; reason: string };

const refuse = (reason: string): WorkspaceParseResult => ({ ok: false, reason });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reads a stored workspace strictly. Only the envelope is checked here; each
 * scene still has to pass the scene import boundary on its own, so one damaged
 * tab never costs the others. A refused envelope (damaged, or written by a
 * newer build) must be left in storage untouched.
 */
export const parseWorkspaceRecord = (text: string): WorkspaceParseResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return refuse('the saved tabs are not valid JSON');
  }
  if (!isRecord(parsed) || parsed.kind !== WORKSPACE_KIND) return refuse('the saved tabs are not a KCS workspace');
  if (parsed.version !== WORKSPACE_VERSION) return refuse(`the saved tabs use workspace version ${String(parsed.version)}, which this build does not read`);
  const { activeTabId, tabs, scenes } = parsed;
  if (typeof activeTabId !== 'string' || !TAB_ID_PATTERN.test(activeTabId)) return refuse('the open tab is not named');
  if (!Array.isArray(tabs) || tabs.length < 2 || tabs.length > MAX_WORKSPACE_TABS) return refuse(`the tab list must hold 2 to ${MAX_WORKSPACE_TABS} tabs`);
  const seen = new Set<string>();
  const readTabs: WorkspaceTab[] = [];
  for (const tab of tabs) {
    if (!isRecord(tab) || typeof tab.id !== 'string' || !TAB_ID_PATTERN.test(tab.id)) return refuse('a tab has no valid id');
    if (typeof tab.name !== 'string' || tab.name.length > MAX_TAB_NAME_LENGTH) return refuse('a tab has no valid name');
    if (seen.has(tab.id)) return refuse('two tabs share an id');
    seen.add(tab.id);
    readTabs.push({ id: tab.id, name: tab.name });
  }
  if (!seen.has(activeTabId)) return refuse('the open tab is not in the tab list');
  if (!isRecord(scenes)) return refuse('the saved tabs have no scenes');
  const sceneTexts = new Map<string, string>();
  for (const id of Object.keys(scenes)) {
    if (!seen.has(id) || id === activeTabId) return refuse('a saved scene belongs to no closed tab');
    if (!isRecord(scenes[id])) return refuse('a saved scene is not an object');
    sceneTexts.set(id, JSON.stringify(scenes[id]));
  }
  return { ok: true, activeTabId, tabs: readTabs, sceneTexts };
};
