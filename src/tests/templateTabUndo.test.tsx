import { useEffect } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';

/**
 * One undo stack covers the scene arrays on screen. Template tabs swap those
 * arrays, so a tab switch starts a fresh baseline: Ctrl+Z never writes another
 * tab's layers into the open one (it used to — undo right after adding a tab
 * put the previous tab's layers in it, and autosave then saved them there).
 */
const renderProvider = () => {
  let latest: AnimatorContextType | null = null;
  const Probe = () => { const ctx = useAnimator(); useEffect(() => { latest = ctx; }); return null; };
  render(<AnimatorProvider><Probe /></AnimatorProvider>);
  return () => latest!;
};

const names = (ctx: () => AnimatorContextType) => ctx().characterParts.map((part) => part.name);

describe('undo across template tabs', () => {
  afterEach(() => cleanup());

  it('undo right after adding a tab leaves the new tab empty', () => {
    const ctx = renderProvider();
    act(() => { ctx().addCustomPart('custom_rect', 'InA'); });
    act(() => { ctx().addProjectTemplate('B'); });
    expect(names(ctx)).toEqual([]);
    act(() => { ctx().undo(); });
    expect(names(ctx)).toEqual([]);
  });

  it('undo after switching back keeps the tab its own layers', () => {
    const ctx = renderProvider();
    const aBefore = names(ctx);
    act(() => { ctx().addCustomPart('custom_rect', 'InA'); });
    const aId = ctx().activeProjectTemplateId;
    act(() => { ctx().addProjectTemplate('B'); });
    act(() => { ctx().addCustomPart('custom_rect', 'InB'); });
    act(() => { ctx().setActiveProjectTemplateId(aId); });
    expect(names(ctx)).toEqual(['InA', ...aBefore]);
    act(() => { ctx().undo(); });
    expect(names(ctx)).not.toContain('InB');
    expect(names(ctx)).toEqual(['InA', ...aBefore]);
  });

  it('edits made in a tab after the switch are still undoable', () => {
    const ctx = renderProvider();
    act(() => { ctx().addProjectTemplate('B'); });
    act(() => { ctx().addCustomPart('custom_rect', 'First'); });
    act(() => { ctx().addCustomPart('custom_rect', 'Second'); });
    act(() => { ctx().undo(); });
    expect(names(ctx)).toEqual(['First']);
    act(() => { ctx().undo(); });
    expect(names(ctx)).toEqual([]);
    act(() => { ctx().redo(); });
    expect(names(ctx)).toEqual(['First']);
  });

  it('deleting the open tab starts the remaining tab with a fresh baseline', () => {
    const ctx = renderProvider();
    act(() => { ctx().addCustomPart('custom_rect', 'InA'); });
    const aNames = names(ctx);
    act(() => { ctx().addProjectTemplate('B'); });
    act(() => { ctx().addCustomPart('custom_rect', 'InB'); });
    act(() => { ctx().deleteProjectTemplate(ctx().activeProjectTemplateId); });
    expect(names(ctx)).toEqual(aNames);
    act(() => { ctx().undo(); });
    expect(names(ctx)).toEqual(aNames);
  });
});

describe('template tabs keep their own frame rate and length', () => {
  afterEach(() => cleanup());

  it('a new tab does not change the rate of the tab it leaves', () => {
    const ctx = renderProvider();
    const aId = ctx().activeProjectTemplateId;
    act(() => { ctx().setFps(30); });
    act(() => { ctx().addProjectTemplate('B'); });
    expect(ctx().fps).toBe(60);
    act(() => { ctx().setActiveProjectTemplateId(aId); });
    expect(ctx().fps).toBe(30);
  });

  it('each tab opens at its own rate', () => {
    const ctx = renderProvider();
    const aId = ctx().activeProjectTemplateId;
    act(() => { ctx().setFps(24); });
    act(() => { ctx().addProjectTemplate('B'); });
    const bId = ctx().activeProjectTemplateId;
    act(() => { ctx().setFps(120); });
    act(() => { ctx().setActiveProjectTemplateId(aId); });
    expect(ctx().fps).toBe(24);
    act(() => { ctx().setActiveProjectTemplateId(bId); });
    expect(ctx().fps).toBe(120);
  });

  it('a tab opens at its active sequence\'s length', () => {
    const ctx = renderProvider();
    const aId = ctx().activeProjectTemplateId;
    const sequenceId = ctx().activeTemplateId;
    act(() => { ctx().updateMotionTemplateDuration(sequenceId, 200); });
    act(() => { ctx().setActiveTemplateId(sequenceId); });
    expect(ctx().totalFrames).toBe(200);
    act(() => { ctx().addProjectTemplate('B'); });
    expect(ctx().totalFrames).toBe(60);
    act(() => { ctx().setActiveProjectTemplateId(aId); });
    expect(ctx().totalFrames).toBe(200);
  });
});
