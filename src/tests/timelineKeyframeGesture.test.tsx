/**
 * Manual QA Round 4 — R4-03 / R4-04: the timeline's keyframe gestures.
 *
 * R4-03. Observed: a multi-keyframe drag did not stop on release — the keys kept
 * following the pointer until a second click. The gesture must be a POINTER
 * gesture: the press arms it, travelling past the drag threshold starts it, and
 * the release (or a cancelled/lost capture) ends it AT ONCE, so moving the
 * pointer afterwards changes nothing and one gesture stays one history entry.
 *
 * R4-04. Delete/Backspace must delete the WHOLE canonical keyframe selection
 * atomically — one history entry that Undo restores exactly — must not fire while
 * a text field owns focus, and must never fall through to deleting a LAYER.
 */

import React, { useEffect } from 'react';
import { render, act, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
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
  /** A client X the timeline maps onto `frame`, with the grid as it scrolls. */
  xForFrame: (frame: number) => number;
  /** The whole document, as the user sees it (layers + animation). */
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
    framesAt: (channel) => keyframesAt(channel).map((keyframe) => keyframe.frame),
    diamond,
    xForFrame: (frame) => {
      const grid = container.querySelector('.timeline-graph-pane') as HTMLElement;
      return frame * FRAME_WIDTH + 2 - grid.scrollLeft;
    },
    document: () => JSON.stringify({ parts: ctx().characterParts, tracks: ctx().tracks }),
  };
};

/** Two frame-group keyframes on one layer, both selected. */
const seedSelectedKeys = (h: Harness): { trackId: string; ids: string[] } => {
  act(() => { h.ctx().addCustomPart('custom_rect', 'Rect A'); });
  const trackId = h.ctx().tracks[0].id;
  act(() => { h.ctx().addKeyframeToTrack(trackId, 5); });
  act(() => { h.ctx().addKeyframeToTrack(trackId, 15); });
  const ids = h.keyframesAt('x').map((keyframe) => keyframe.id);
  act(() => { h.ctx().selectKeyframes(ids); });
  return { trackId, ids };
};

const pressDiamond = (h: Harness, id: string, frame = 5) => {
  fireEvent.pointerDown(h.diamond(id), {
    button: 0,
    buttons: 1,
    pointerId: 0,
    clientX: h.xForFrame(frame),
    clientY: 20,
  });
};

const pointerMove = (h: Harness, frame: number, buttons = 1) => {
  fireEvent.pointerMove(window, { buttons, pointerId: 0, clientX: h.xForFrame(frame), clientY: 20 });
};

describe('R4-03 — the timeline keyframe gesture ends when the pointer does', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem');
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('moves the whole selected set during the drag and stops the moment it is released', () => {
    const h = renderHarness();
    const { ids } = seedSelectedKeys(h);

    pressDiamond(h, ids[0], 5);
    pointerMove(h, 8);
    expect(h.framesAt('x')).toEqual([8, 18]);

    fireEvent.pointerUp(window, { pointerId: 0, clientX: h.xForFrame(8), clientY: 20 });

    // The release ended the gesture: a pointer move afterwards moves nothing.
    pointerMove(h, 30);
    expect(h.framesAt('x')).toEqual([8, 18]);
  });

  it('ends the gesture on a cancelled pointer, with no release ever delivered', () => {
    const h = renderHarness();
    const { ids } = seedSelectedKeys(h);

    pressDiamond(h, ids[0], 5);
    pointerMove(h, 8);
    fireEvent.pointerCancel(window, { pointerId: 0 });

    pointerMove(h, 30);
    expect(h.framesAt('x')).toEqual([8, 18]);
  });

  it('ends the gesture when the browser takes the pointer capture back', () => {
    const h = renderHarness();
    const { ids } = seedSelectedKeys(h);

    pressDiamond(h, ids[0], 5);
    pointerMove(h, 8);
    fireEvent.lostPointerCapture(h.diamond(ids[0]), { pointerId: 0 });

    pointerMove(h, 30);
    expect(h.framesAt('x')).toEqual([8, 18]);
  });

  it('ends a gesture whose release was never delivered, on the first pointer move with no button held', () => {
    const h = renderHarness();
    const { ids } = seedSelectedKeys(h);

    pressDiamond(h, ids[0], 5);
    // A move with nothing held proves the pointer was already lifted: the set
    // stops where it is instead of staying attached to a released pointer.
    pointerMove(h, 8, 0);
    expect(h.framesAt('x')).toEqual([5, 15]);

    pointerMove(h, 30);
    expect(h.framesAt('x')).toEqual([5, 15]);
  });

  it('treats a press below the drag threshold as a click: no move, no history entry', () => {
    const h = renderHarness();
    const { ids } = seedSelectedKeys(h);
    const before = h.document();

    pressDiamond(h, ids[0], 5);
    // Inside the threshold the press is still a click, and the release ends it.
    fireEvent.pointerMove(window, { buttons: 1, pointerId: 0, clientX: h.xForFrame(5) + 1, clientY: 20 });
    fireEvent.pointerUp(window, { pointerId: 0 });
    pointerMove(h, 30);

    expect(h.framesAt('x')).toEqual([5, 15]);
    expect(h.document()).toBe(before);
  });

  it('records one drag as ONE history entry', () => {
    const h = renderHarness();
    const { ids } = seedSelectedKeys(h);
    const beforeDrag = h.document();

    pressDiamond(h, ids[0], 5);
    pointerMove(h, 7);
    pointerMove(h, 9);
    pointerMove(h, 12);
    fireEvent.pointerUp(window, { pointerId: 0 });
    expect(h.framesAt('x')).toEqual([12, 22]);
    expect(h.document()).not.toBe(beforeDrag);

    act(() => { h.ctx().undo(); });
    expect(h.document()).toBe(beforeDrag);
  });
});

describe('R4-04 — deleting the keyframe selection', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem');
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('deletes every selected keyframe in one history entry, and Undo restores the exact set', () => {
    const h = renderHarness();
    seedSelectedKeys(h);
    const beforeDelete = h.document();

    fireEvent.keyDown(window, { key: 'Delete' });

    expect(h.framesAt('x')).toEqual([]);
    // The whole set is gone in ONE entry: a single undo brings all of it back.
    act(() => { h.ctx().undo(); });
    expect(h.document()).toBe(beforeDelete);
    expect(h.framesAt('x')).toEqual([5, 15]);
  });

  it('keeps normal editing while a text field owns focus', () => {
    const h = renderHarness();
    seedSelectedKeys(h);
    const beforeDelete = h.document();

    const field = document.createElement('input');
    document.body.appendChild(field);
    field.focus();
    fireEvent.keyDown(window, { key: 'Delete' });
    fireEvent.keyDown(window, { key: 'Backspace' });
    field.remove();

    expect(h.document()).toBe(beforeDelete);
    expect(h.framesAt('x')).toEqual([5, 15]);
  });

  it('never deletes a layer while keyframes are selected, even when the selection matches nothing', () => {
    const h = renderHarness();
    const { ids } = seedSelectedKeys(h);
    const layerId = h.ctx().characterParts[0].id;
    act(() => { h.ctx().selectKeyframes(['kf_that_no_longer_exists']); });
    act(() => { h.ctx().setSelectedPartId(layerId); });

    fireEvent.keyDown(window, { key: 'Delete' });

    // The keyframe selection owned the key: the layer (and its animation) is untouched.
    expect(h.ctx().characterParts.map((part) => part.id)).toEqual([layerId]);
    expect(h.framesAt('x')).toEqual([5, 15]);
    expect(ids).toHaveLength(2);
  });
});
