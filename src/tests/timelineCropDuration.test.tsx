/**
 * Manual QA round 4: Crop on a 120 fps, 1 s sequence whose last key is on
 * frame 60 left DURATION at 1 s. Crop now sets the sequence's own duration,
 * so the field reads 0.5 s.
 */

import React, { useEffect } from 'react';
import { render, act, fireEvent, cleanup, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { SequencerTimeline } from '../components/Timeline/SequencerTimeline';
import type { Track } from '../types/animator';

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

describe('timeline Crop sets the sequence duration', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem');
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('60 frames at 120 fps crop to 0.5 s', () => {
    const { ctx } = renderTimeline();
    act(() => {
      ctx().setFps(120);
      ctx().setTotalFrames(120);
      ctx().updateMotionTemplateDuration(ctx().activeTemplateId, 120);
    });
    const duration = () => (document.getElementById('sequence-duration-input') as HTMLInputElement).value;
    expect(duration()).toBe('1');

    const track = {
      id: 'crop-track',
      partId: 'crop-part',
      keyframes: [],
      channels: { x: [{ id: 'k0', frame: 0, value: 0 }, { id: 'k60', frame: 60, value: 100 }] },
    } as unknown as Track;
    act(() => { ctx().setTracks((previous) => [...previous, track]); });
    act(() => { fireEvent.click(screen.getByTitle('Crop the sequence to the last keyframe')); });

    expect(ctx().totalFrames).toBe(60);
    expect(ctx().motionTemplates.find((template) => template.id === ctx().activeTemplateId)?.durationFrames).toBe(60);
    expect(duration()).toBe('0.5');
  });
});
