import { useEffect } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { AUTOSAVE_STORAGE_KEY } from '../utils/editor/constants';
import { WORKSPACE_REFUSED_STORAGE_KEY, WORKSPACE_STORAGE_KEY } from '../utils/persistence/workspacePersistence';

/**
 * Template tabs are kept across a reload. The open tab's scene stays in the
 * autosave key exactly as before; the tab list and the closed tabs' scenes go
 * to a second key, written only when there is more than one tab.
 */

const renderProvider = () => {
  let latest: AnimatorContextType | null = null;
  const Probe = () => { const ctx = useAnimator(); useEffect(() => { latest = ctx; }); return null; };
  const view = render(<AnimatorProvider><Probe /></AnimatorProvider>);
  return { ctx: () => latest!, unmount: view.unmount };
};

const save = async (ctx: () => AnimatorContextType) => {
  let saved = false;
  await act(async () => { saved = await ctx().forceSaveNow(); });
  return saved;
};

const names = (ctx: () => AnimatorContextType) => ctx().characterParts.map((part) => part.name);
const tabNames = (ctx: () => AnimatorContextType) => ctx().projectTemplates.map((tab) => tab.name);
const storedWorkspace = () => window.localStorage.getItem(WORKSPACE_STORAGE_KEY);

describe('template tabs across a reload', () => {
  let clock = 1_800_000_000_000;
  beforeEach(() => {
    window.localStorage.clear();
    // New tabs are named by the time (`tmpl_<ms>`): one per call here.
    vi.spyOn(Date, 'now').mockImplementation(() => (clock += 1000));
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  /** Tab A (30 fps, 1280x720, "InA"), B (24 fps, portrait, "InB"), C open (60 fps, "InC"). */
  const buildThreeTabs = (ctx: () => AnimatorContextType) => {
    act(() => { ctx().renameProjectTemplate(ctx().activeProjectTemplateId, 'Lower third'); });
    act(() => { ctx().setFps(30); });
    act(() => { ctx().setProjectResolution({ width: 1280, height: 720 }); });
    act(() => { ctx().addCustomPart('custom_rect', 'InA'); });
    act(() => { ctx().addProjectTemplate('Score'); });
    act(() => { ctx().setFps(24); });
    act(() => { ctx().setProjectResolution({ width: 1080, height: 1920 }); });
    act(() => { ctx().addCustomPart('custom_rect', 'InB'); });
    act(() => { ctx().addProjectTemplate('Bug'); });
    act(() => { ctx().addCustomPart('custom_circle', 'InC'); });
  };

  it('every tab comes back with its name, layers, rate and size; the open tab stays open', async () => {
    const first = renderProvider();
    buildThreeTabs(first.ctx);
    const [aId, bId, cId] = first.ctx().projectTemplates.map((tab) => tab.id);
    const aNames = (() => {
      act(() => { first.ctx().setActiveProjectTemplateId(aId); });
      return names(first.ctx);
    })();
    act(() => { first.ctx().setActiveProjectTemplateId(cId); });
    expect(await save(first.ctx)).toBe(true);
    first.unmount();

    const second = renderProvider();
    await act(async () => {});
    const ctx = second.ctx;
    expect(tabNames(ctx)).toEqual(['Lower third', 'Score', 'Bug']);
    expect(ctx().activeProjectTemplateId).toBe(cId);
    expect(ctx().sceneTitle).toBe('Bug');
    expect(names(ctx)).toEqual(['InC']);
    expect(ctx().fps).toBe(60);

    act(() => { ctx().setActiveProjectTemplateId(aId); });
    expect(names(ctx)).toEqual(aNames);
    expect(ctx().fps).toBe(30);
    expect(ctx().projectResolution).toEqual({ width: 1280, height: 720 });
    act(() => { ctx().setActiveProjectTemplateId(bId); });
    expect(names(ctx)).toEqual(['InB']);
    expect(ctx().fps).toBe(24);
    expect(ctx().projectResolution).toEqual({ width: 1080, height: 1920 });
    // The restore is not an undoable edit, and the tabs did not move the open scene into another.
    expect(ctx().canUndo).toBe(false);
  });

  it('a single tab saves exactly as before: no second key', async () => {
    const { ctx } = renderProvider();
    act(() => { ctx().addCustomPart('custom_rect', 'Only'); });
    expect(await save(ctx)).toBe(true);
    expect(window.localStorage.getItem(AUTOSAVE_STORAGE_KEY)).not.toBeNull();
    expect(storedWorkspace()).toBeNull();
  });

  it('closing tabs down to one removes the saved tabs', async () => {
    const { ctx } = renderProvider();
    act(() => { ctx().addProjectTemplate('B'); });
    expect(await save(ctx)).toBe(true);
    expect(storedWorkspace()).not.toBeNull();
    act(() => { ctx().deleteProjectTemplate(ctx().activeProjectTemplateId); });
    expect(await save(ctx)).toBe(true);
    expect(storedWorkspace()).toBeNull();
  });

  it('renaming a closed tab is a change that gets saved', async () => {
    const { ctx } = renderProvider();
    const aId = ctx().activeProjectTemplateId;
    act(() => { ctx().addProjectTemplate('B'); });
    expect(await save(ctx)).toBe(true);
    act(() => { ctx().renameProjectTemplate(aId, 'Renamed'); });
    expect(ctx().hasUnsavedChanges).toBe(true);
    expect(await save(ctx)).toBe(true);
    expect(JSON.parse(storedWorkspace()!).tabs[0].name).toBe('Renamed');
  });

  it('a damaged tab is left out (its copy kept); the other tabs open', async () => {
    const first = renderProvider();
    buildThreeTabs(first.ctx);
    const [aId, bId] = first.ctx().projectTemplates.map((tab) => tab.id);
    expect(await save(first.ctx)).toBe(true);
    first.unmount();
    const record = JSON.parse(storedWorkspace()!);
    record.scenes[bId] = { ...record.scenes[bId], layers: 'not a list' };
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(record));

    const { ctx } = renderProvider();
    await act(async () => {});
    expect(tabNames(ctx)).toEqual(['Lower third', 'Bug']);
    expect(names(ctx)).toEqual(['InC']);
    act(() => { ctx().setActiveProjectTemplateId(aId); });
    expect(names(ctx)).toContain('InA');
    const refused = JSON.parse(window.localStorage.getItem(WORKSPACE_REFUSED_STORAGE_KEY)!);
    expect(refused.tabs.map((tab: { id: string }) => tab.id)).toEqual([bId]);
  });

  it('saved tabs this build cannot read are left exactly as they are', async () => {
    const foreign = JSON.stringify({ kind: 'kcs-workspace', version: 2, tabs: [] });
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, foreign);
    const { ctx } = renderProvider();
    await act(async () => {});
    act(() => { ctx().addProjectTemplate('B'); });
    act(() => { ctx().addCustomPart('custom_rect', 'InB'); });
    expect(await save(ctx)).toBe(true);
    expect(storedWorkspace()).toBe(foreign);
  });

  it('saved tabs changed by another browser tab pause the autosave instead of being overwritten', async () => {
    const { ctx } = renderProvider();
    act(() => { ctx().addProjectTemplate('B'); });
    expect(await save(ctx)).toBe(true);
    const theirs = storedWorkspace()!.replace('"B"', '"Theirs"');
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, theirs);
    act(() => { ctx().addCustomPart('custom_rect', 'Mine'); });
    expect(await save(ctx)).toBe(false);
    expect(ctx().autosaveConflict).toBe(true);
    expect(storedWorkspace()).toBe(theirs);
  });

  it('when the open scene cannot be written, the saved tabs go back to what they were', async () => {
    const { ctx } = renderProvider();
    act(() => { ctx().addProjectTemplate('B'); });
    expect(await save(ctx)).toBe(true);
    const before = storedWorkspace();
    act(() => { ctx().addProjectTemplate('C'); });
    const realSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === AUTOSAVE_STORAGE_KEY) throw new DOMException('full', 'QuotaExceededError');
      realSetItem.call(this, key, value);
    });
    expect(await save(ctx)).toBe(false);
    expect(storedWorkspace()).toBe(before);
    expect(ctx().autosaveError?.kind).toBe('quota');
  });
});

describe('importing a legacy project into a new tab', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  const legacyProject = JSON.stringify({
    characterParts: [{ id: 'p1', name: 'Legacy', type: 'custom_rect', zIndex: 1, fillColor: '#fff', strokeColor: '#000', pivot: { x: 0, y: 0 }, baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } }],
    tracks: [],
    fps: 50,
    projectResolution: { width: 640, height: 480 },
  });

  it('keeps the rate and size of the tab it leaves', () => {
    const { ctx } = renderProvider();
    const aId = ctx().activeProjectTemplateId;
    act(() => { ctx().setFps(30); });
    act(() => { ctx().setProjectResolution({ width: 1280, height: 720 }); });
    act(() => { expect(ctx().importProject(legacyProject, 'Old').ok).toBe(true); });
    expect(ctx().fps).toBe(50);
    act(() => { ctx().setActiveProjectTemplateId(aId); });
    expect(ctx().fps).toBe(30);
    expect(ctx().projectResolution).toEqual({ width: 1280, height: 720 });
  });

  it('starts the new tab with a fresh undo history', () => {
    const { ctx } = renderProvider();
    act(() => { ctx().addCustomPart('custom_rect', 'InA'); });
    act(() => { expect(ctx().importProject(legacyProject, 'Old').ok).toBe(true); });
    act(() => { ctx().undo(); });
    expect(names(ctx)).toEqual(['Legacy']);
  });
});
