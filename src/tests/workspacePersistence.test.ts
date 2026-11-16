import { describe, expect, it } from 'vitest';
import { buildWorkspaceRecord, MAX_WORKSPACE_TABS, parseWorkspaceRecord } from '../utils/persistence/workspacePersistence';

const tabs = [{ id: 'tmpl_1', name: 'Lower third' }, { id: 'tmpl_2', name: 'Score' }, { id: 'tmpl_3', name: 'Bug' }];
const scene = (name: string) => ({ version: 2, name, width: 1280, height: 720, fps: 25, totalFrames: 50, layers: [], tracks: [] });

describe('buildWorkspaceRecord', () => {
  it('keeps the tab list and every scene but the open one', () => {
    const record = buildWorkspaceRecord('tmpl_2', tabs, { tmpl_1: scene('A'), tmpl_2: scene('B'), tmpl_3: scene('C') });
    expect(record).toEqual({
      kind: 'kcs-workspace',
      version: 1,
      activeTabId: 'tmpl_2',
      tabs,
      scenes: { tmpl_1: scene('A'), tmpl_3: scene('C') },
    });
  });

  it('writes nothing for a single tab', () => {
    expect(buildWorkspaceRecord('tmpl_1', [tabs[0]], { tmpl_1: scene('A') })).toBeNull();
  });

  it('leaves out scenes of tabs that are no longer listed, and lists a tab with no stored scene', () => {
    const record = buildWorkspaceRecord('tmpl_1', tabs.slice(0, 2), { tmpl_9: scene('Gone') });
    expect(record?.scenes).toEqual({});
    expect(record?.tabs.map((tab) => tab.id)).toEqual(['tmpl_1', 'tmpl_2']);
  });
});

describe('parseWorkspaceRecord', () => {
  const stored = (patch: Record<string, unknown> = {}) => JSON.stringify({
    ...buildWorkspaceRecord('tmpl_1', tabs, { tmpl_2: scene('B'), tmpl_3: scene('C') }),
    ...patch,
  });

  it('reads what buildWorkspaceRecord wrote, each scene as text for the import boundary', () => {
    const result = parseWorkspaceRecord(stored());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.activeTabId).toBe('tmpl_1');
    expect(result.tabs).toEqual(tabs);
    expect([...result.sceneTexts.keys()]).toEqual(['tmpl_2', 'tmpl_3']);
    expect(JSON.parse(result.sceneTexts.get('tmpl_3')!)).toEqual(scene('C'));
  });

  it.each([
    ['not JSON', '{'],
    ['another kind', stored({ kind: 'something-else' })],
    ['a newer version', stored({ version: 2 })],
    ['an open tab outside the list', stored({ activeTabId: 'tmpl_9' })],
    ['two tabs with one id', stored({ tabs: [...tabs, { id: 'tmpl_2', name: 'Again' }] })],
    ['a single tab', stored({ tabs: [tabs[0]], scenes: {} })],
    ['too many tabs', stored({ tabs: Array.from({ length: MAX_WORKSPACE_TABS + 1 }, (_, index) => ({ id: `tmpl_${index}`, name: `T${index}` })), activeTabId: 'tmpl_0', scenes: {} })],
    ['a prototype key as a tab id', stored({ tabs: [...tabs, { id: '__proto__', name: 'x' }] })],
    ['a scene for the open tab', stored({ scenes: { tmpl_1: scene('A') } })],
    ['a scene for no tab', stored({ scenes: { tmpl_9: scene('Z') } })],
    ['a scene that is not an object', stored({ scenes: { tmpl_2: 'scene' } })],
    ['a tab without a name', stored({ tabs: [tabs[0], { id: 'tmpl_2' }] })],
  ])('refuses %s', (_label, text) => {
    expect(parseWorkspaceRecord(text).ok).toBe(false);
  });
});
