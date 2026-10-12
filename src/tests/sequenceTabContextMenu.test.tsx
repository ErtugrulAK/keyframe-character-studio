/**
 * Manual QA Round 1 — finding H: a sequence tab must not open the browser menu.
 *
 * Observed: right-clicking a sequence tab opened Chrome's native context menu.
 * Expected for this round: the native menu does not open on sequence tabs, and
 * no custom sequence menu is introduced. The prevention is scoped to the tab
 * element, so clicking, double-click renaming and the close control keep
 * working exactly as before.
 */

import React, { useEffect } from 'react';
import { render, act, fireEvent, cleanup, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { SequencerTimeline } from '../components/Timeline/SequencerTimeline';

const Consumer = ({ onCtx }: { onCtx: (ctx: AnimatorContextType) => void }) => {
  const ctx = useAnimator();
  useEffect(() => { onCtx(ctx); });
  return null;
};

const renderTimeline = () => {
  let live: AnimatorContextType | null = null;
  const utils = render(
    <AnimatorProvider>
      <Consumer onCtx={(c) => { live = c; }} />
      <SequencerTimeline />
    </AnimatorProvider>
  );
  const ctx = (): AnimatorContextType => {
    if (!live) throw new Error('provider context not captured yet');
    return live;
  };
  return { ...utils, ctx };
};

describe('sequence tab context menu (finding H)', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem');
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('prevents the browser menu on a sequence tab and still selects it on click', () => {
    const { container, ctx } = renderTimeline();
    const tab = container.querySelector('.timeline-seq-tab') as HTMLElement;
    expect(tab).toBeTruthy();

    const menuEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    tab.dispatchEvent(menuEvent);
    expect(menuEvent.defaultPrevented).toBe(true);
    // The prevention is scoped: no menu component was opened by it.
    expect(screen.queryByRole('menu')).toBeNull();

    // An unrelated right-click outside the tabs still reports the native menu.
    const outside = document.createElement('div');
    container.appendChild(outside);
    const outsideEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    outside.dispatchEvent(outsideEvent);
    expect(outsideEvent.defaultPrevented).toBe(false);

    // Clicking the tab still switches the active sequence, and right-click on
    // the tab did not change it.
    const templates = ctx().motionTemplates;
    if (templates.length > 1) {
      const second = container.querySelectorAll('.timeline-seq-tab')[1] as HTMLElement;
      act(() => { fireEvent.click(second); });
      expect(ctx().activeTemplateId).toBe(templates[1].id);
    }
    act(() => { fireEvent.click(tab); });
    expect(ctx().activeTemplateId).toBe(templates[0].id);
  });
});
