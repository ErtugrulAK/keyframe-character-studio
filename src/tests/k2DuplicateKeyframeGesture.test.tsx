/**
 * K2 (contract D1) — Alt-drag keyframe duplication.
 *
 * The existing right-click "Duplicate Frame" copies one frame group to
 * sourceFrame + 1. K2 arms the SAME authority as a gesture: hold Alt, press a
 * diamond, travel — the copy lands on the drop frame, one history entry, and
 * the source never moves. Everything else is refusal with zero side effects:
 * a collision with an existing frame, an out-of-range target, Escape
 * mid-drag. D1 is explicit: a blocked gesture shows exactly ONE warning and
 * changes nothing — no silent clamping.
 */

import { render, act, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { useEffect } from 'react';
import { SequencerTimeline } from '../components/Timeline/SequencerTimeline';
import type { TrackChannel } from '../types/animator';

/** The timeline's own frame width: `useTimeline` starts at 18 px per frame. */
const FRAME_WIDTH = 18;

const Consumer = ({ onCtx }: { onCtx: (ctx: AnimatorContextType) => void }) => {
  const ctx = useAnimator();
  useEffect(() => { onCtx(ctx); });
  return null;
};

interface Harness {
  container: HTMLElement;
  ctx: () => AnimatorContextType;
  keyframesAt: (channel: TrackChannel) => { id: string; frame: number }[];
  framesAt: (channel: TrackChannel) => number[];
  diamond: (id: string) => HTMLElement;
  grid: HTMLElement;
  xForFrame: (frame: number) => number;
  document: () => string;
}

const renderHarness = (): Harness => {
  let live: AnimatorContextType | null = null;
  const { container } = render(
    <AnimatorProvider>
      <Consumer onCtx={(context) => { live = context; }} />
      <SequencerTimeline />
    </AnimatorProvider>
  );
  const ctx = (): AnimatorContextType => {
    if (!live) throw new Error('provider context not captured yet');
    return live;
  };
  const keyframesAt = (channel: TrackChannel) => {
    const track = ctx().tracks[0];
    return [...(track?.channels[channel] ?? [])].map((keyframe) => ({ id: keyframe.id, frame: keyframe.frame }));
  };
  const diamond = (id: string): HTMLElement => {
    const element = container.querySelector(`[data-keyframe-id="${id}"]`);
    if (!element) throw new Error(`no timeline diamond for ${id}`);
    return element as HTMLElement;
  };
  return {
    container,
    ctx,
    keyframesAt,
    framesAt: (channel) => keyframesAt(channel).map((keyframe) => keyframe.frame).sort((a, b) => a - b),
    diamond,
    grid: container.querySelector('.timeline-grid-container') as HTMLElement,
    xForFrame: (frame) => {
      const grid = container.querySelector('.timeline-graph-pane') as HTMLElement;
      return frame * FRAME_WIDTH + 2 - grid.scrollLeft;
    },
    document: () => JSON.stringify({ parts: ctx().characterParts, tracks: ctx().tracks }),
  };
};

/** One track, keys at frames 5 and 15, the frame-5 group diamond selected. */
const seedKeys = (h: Harness): { trackId: string; ids: string[] } => {
  act(() => { h.ctx().addCustomPart('custom_rect', 'Rect A'); });
  const trackId = h.ctx().tracks[0].id;
  act(() => { h.ctx().addKeyframeToTrack(trackId, 5); });
  act(() => { h.ctx().addKeyframeToTrack(trackId, 15); });
  const ids = h.keyframesAt('x').map((keyframe) => keyframe.id);
  act(() => { h.ctx().selectKeyframes([ids[0]]); });
  return { trackId, ids };
};

const altPress = (h: Harness, id: string, frame: number) => {
  fireEvent.pointerDown(h.diamond(id), {
    button: 0,
    buttons: 1,
    pointerId: 0,
    altKey: true,
    clientX: h.xForFrame(frame),
    clientY: 20,
  });
};

const pointerMove = (h: Harness, frame: number, altKey = true) => {
  fireEvent.pointerMove(window, { buttons: 1, pointerId: 0, altKey, clientX: h.xForFrame(frame), clientY: 20 });
};

const pointerUp = (h: Harness, frame: number) => {
  fireEvent.pointerUp(window, { pointerId: 0, clientX: h.xForFrame(frame), clientY: 20 });
};

/** Toasts are rendered through the provider's portal into document.body. */
const errorToastCount = () => (document.body.textContent || '').match(/Duplicate (blocked|failed)/g)?.length ?? 0;

describe('K2/D1 — alt-drag duplicate gesture', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem');
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('drops a duplicate of the source group on the release frame; the source never moves', () => {
    const h = renderHarness();
    const { ids } = seedKeys(h);
    const pristine = JSON.parse(h.document());

    altPress(h, ids[0], 5);
    pointerMove(h, 9);
    pointerUp(h, 9);

    expect(h.framesAt('x')).toEqual([5, 9, 15]);
    const copy = h.keyframesAt('x').find((keyframe) => keyframe.frame === 9);
    expect(copy).toBeDefined();
    expect(copy!.id).not.toBe(ids[0]);
    // No toast on success, and exactly one undo reverses the whole gesture.
    expect(errorToastCount()).toBe(0);
    // Undo lands exactly on the pre-gesture document.
    act(() => { h.ctx().undo(); });
    expect(JSON.parse(h.document())).toEqual(pristine);
    expect(h.framesAt('x')).toEqual([5, 15]);
  });

  it('previews the drop target while the duplicate drags', () => {
    const h = renderHarness();
    const { ids } = seedKeys(h);

    altPress(h, ids[0], 5);
    pointerMove(h, 9);
    expect(h.grid.getAttribute('data-duplicate-target')).toBe('valid');
    pointerMove(h, 15);
    expect(h.grid.getAttribute('data-duplicate-target')).toBe('blocked');
    pointerUp(h, 15);
    expect(h.framesAt('x')).toEqual([5, 15]);
    expect(h.grid.hasAttribute('data-duplicate-target')).toBe(false);
  });

  it('refuses a colliding drop with exactly one warning and zero mutation', () => {
    const h = renderHarness();
    const { ids } = seedKeys(h);
    const before = h.document();

    altPress(h, ids[0], 5);
    pointerMove(h, 8);
    pointerMove(h, 15);
    pointerUp(h, 15);

    expect(h.document()).toBe(before);
    expect(errorToastCount()).toBe(1);
    // A refused gesture adds NO undo entry: the next successful duplicate is
    // still reversed by a single undo, landing exactly on this document.
    const afterRefusal = h.document();
    altPress(h, ids[0], 5);
    pointerMove(h, 9);
    pointerUp(h, 9);
    expect(h.framesAt('x')).toEqual([5, 9, 15]);
    act(() => { h.ctx().undo(); });
    expect(JSON.parse(h.document())).toEqual(JSON.parse(afterRefusal));
  });

  it('refuses a drop past the end of the timeline instead of clamping', () => {
    const h = renderHarness();
    const { ids } = seedKeys(h);
    const before = h.document();

    act(() => { h.ctx().setTotalFrames(20); });
    altPress(h, ids[0], 5);
    pointerMove(h, 24);
    pointerUp(h, 24);

    expect(h.document()).toBe(before);
    expect(errorToastCount()).toBe(1);
  });

  it('Escape mid-drag cancels the duplicate with nothing committed', () => {
    const h = renderHarness();
    const { ids } = seedKeys(h);
    const before = h.document();

    altPress(h, ids[0], 5);
    pointerMove(h, 9);
    fireEvent.keyDown(window, { key: 'Escape' });
    pointerMove(h, 11);
    pointerUp(h, 11);

    expect(h.document()).toBe(before);
    expect(errorToastCount()).toBe(0);
    expect(h.grid.hasAttribute('data-duplicate-target')).toBe(false);
  });

  it('a released press that never crossed the threshold duplicates nothing', () => {
    const h = renderHarness();
    const { ids } = seedKeys(h);
    const before = h.document();

    altPress(h, ids[0], 5);
    fireEvent.pointerMove(window, { buttons: 1, pointerId: 0, altKey: true, clientX: h.xForFrame(5) + 3, clientY: 20 });
    pointerUp(h, 5);

    expect(h.document()).toBe(before);
    expect(errorToastCount()).toBe(0);
  });

  it('duplicates every channel riding the source frame, values and easings intact', () => {
    const h = renderHarness();
    const { trackId, ids } = seedKeys(h);
    act(() => { h.ctx().addPropertyKeyframe(trackId, 'rotation', 5, 45, 'easeInOut'); });

    altPress(h, ids[0], 5);
    pointerMove(h, 9);
    pointerUp(h, 9);

    const rotations = h.keyframesAt('rotation' as TrackChannel);
    // The seed's frame-15 group carries rotation too; only the frame-5 group
    // was duplicated, so the copy sits at 9 beside the originals at 5 and 15.
    expect(rotations.map((keyframe) => keyframe.frame).sort((a, b) => a - b)).toEqual([5, 9, 15]);
    const copiedRotation = h.ctx().tracks[0].channels.rotation.find((keyframe) => keyframe.frame === 9);
    expect(copiedRotation).toMatchObject({ easing: 'easeInOut', value: 45 });
  });

  it('a plain press-and-drag still moves keys and never duplicates', () => {
    const h = renderHarness();
    const { ids } = seedKeys(h);

    fireEvent.pointerDown(h.diamond(ids[0]), { button: 0, buttons: 1, pointerId: 0, clientX: h.xForFrame(5), clientY: 20 });
    pointerMove(h, 9, false);
    pointerUp(h, 9);

    expect(h.framesAt('x')).toEqual([9, 15]);
  });
});
