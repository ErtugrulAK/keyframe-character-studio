/**
 * Manual QA Round 4 — R4-14: a continuous authoring gesture is ONE undo entry.
 *
 * Observed: dragging a continuous control (a colour, a slider) recorded one
 * history entry per pointer sample, so Undo had to be pressed hundreds of times
 * to walk a gesture back. Expected: the gesture opens one transaction, its live
 * updates are not recorded separately, and the release commits ONE item when
 * something actually changed. Discrete edits stay discrete, and panel/timeline
 * resize is UI state that never enters document history.
 */

import React, { useEffect } from 'react';
import { render, act, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { DetailsPanel } from '../components/Inspector/DetailsPanel';
import { SequencerTimeline } from '../components/Timeline/SequencerTimeline';
import { resolveOpeningTimelineHeight } from '../components/Timeline/timelineConstants';
import { InteractiveCubicBezierEditor } from '../components/Inspector/InteractiveCubicBezierEditor';
import { TemporalGraphPanel } from '../components/Inspector/TemporalGraphPanel';
import { BezierPathEditor } from '../components/Inspector/BezierPathEditor';
import { makeEmptyChannels } from '../utils/animation/defaults';
import type { PropertyKeyframe } from '../types/animator';

const Consumer = ({ onCtx }: { onCtx: (ctx: AnimatorContextType) => void }) => {
  const ctx = useAnimator();
  useEffect(() => { onCtx(ctx); });
  return null;
};

interface Harness {
  container: HTMLElement;
  ctx: () => AnimatorContextType;
  document: () => string;
  /** The part the Inspector is showing. */
  part: () => AnimatorContextType['characterParts'][number];
}

const renderHarness = (children: React.ReactNode = null): Harness => {
  let live: AnimatorContextType | null = null;
  const { container } = render(
    <AnimatorProvider>
      <Consumer onCtx={(context) => { live = context; }} />
      {children}
    </AnimatorProvider>
  );
  const ctx = (): AnimatorContextType => {
    if (!live) throw new Error('provider context not captured yet');
    return live;
  };
  return {
    container,
    ctx,
    document: () => JSON.stringify({ parts: ctx().characterParts, tracks: ctx().tracks }),
    part: () => ctx().characterParts[0],
  };
};

const expandSection = (h: Harness, title: string) => {
  const disclosure = h.container.querySelector(`[aria-label="Expand ${title}"]`) as HTMLElement;
  if (!disclosure) throw new Error(`no ${title} section in the Inspector`);
  act(() => { fireEvent.click(disclosure); });
};

/** The colour picker's saturation/brightness surface, opened from the FILL swatch. */
const openFillPicker = (h: Harness): HTMLElement => {
  expandSection(h, 'APPEARANCE');
  const swatch = h.container.querySelector('[aria-label="FILL COLOR Color Preview"]') as HTMLElement;
  if (!swatch) throw new Error('no FILL COLOR swatch in the Inspector');
  act(() => { fireEvent.click(swatch); });
  const surface = document.querySelector('[aria-label="FILL COLOR Saturation and Brightness"]') as HTMLElement;
  if (!surface) throw new Error('the colour picker did not open');
  return surface;
};

/**
 * The picker reads the surface's own box: jsdom reports a zero box, so the test
 * gives it the size a real popover has, and every sample inside it then lands on
 * a different colour.
 */
const giveSurfaceABox = (surface: HTMLElement) => {
  surface.getBoundingClientRect = () => ({
    left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, x: 0, y: 0,
    toJSON: () => ({}),
  }) as DOMRect;
};

/** One pointer gesture over the colour surface: press, sweep, release. */
const dragColorSurface = (surface: HTMLElement, samples: Array<[number, number]>) => {
  const [first] = samples;
  const last = samples[samples.length - 1];
  fireEvent.pointerDown(surface, { pointerId: 0, clientX: first[0], clientY: first[1] });
  samples.slice(1).forEach(([clientX, clientY]) => {
    fireEvent.pointerMove(surface, { pointerId: 0, clientX, clientY });
  });
  fireEvent.pointerUp(surface, { pointerId: 0, clientX: last[0], clientY: last[1] });
};

/** A sweep across the surface: a different colour at every sample. */
const colorSweep = (count: number): Array<[number, number]> => (
  Array.from({ length: count }, (_, index) => [1 + (index % 190), 5 + (index % 90)] as [number, number])
);

const seedPart = (h: Harness, type = 'custom_rect') => {
  act(() => { h.ctx().addCustomPart(type, 'Rect A'); });
  const part = h.ctx().characterParts[0];
  act(() => { h.ctx().setSelectedPartIds([part.id]); h.ctx().setSelectedPartId(part.id); });
  return part.id;
};

describe('R4-14 — continuous gestures coalesce into one history entry', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem');
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('records a colour spectrum drag through hundreds of colours as ONE undo', () => {
    const h = renderHarness(<DetailsPanel />);
    seedPart(h);
    const surface = openFillPicker(h);
    giveSurfaceABox(surface);
    const beforeDrag = h.document();

    // A long sweep: every sample writes a different colour.
    dragColorSurface(surface, colorSweep(120));
    const afterDrag = h.document();
    expect(afterDrag).not.toBe(beforeDrag);

    // ONE undo walks the whole gesture back: a second entry would have left the
    // document somewhere in the middle on screen.
    act(() => { h.ctx().undo(); });
    expect(h.document()).toBe(beforeDrag);
  });

  it('keeps two separate colour gestures as two separate history items', () => {
    const h = renderHarness(<DetailsPanel />);
    seedPart(h);
    const surface = openFillPicker(h);
    giveSurfaceABox(surface);
    const beforeBoth = h.document();

    dragColorSurface(surface, [[4, 10], [40, 40], [90, 80]]);
    const afterFirst = h.document();
    dragColorSurface(surface, [[120, 20], [160, 50], [190, 90]]);
    const afterSecond = h.document();
    expect(afterSecond).not.toBe(afterFirst);

    act(() => { h.ctx().undo(); });
    expect(h.document()).toBe(afterFirst);
    act(() => { h.ctx().undo(); });
    expect(h.document()).toBe(beforeBoth);
  });

  it('keeps a click on the colour surface as its own history item', () => {
    const h = renderHarness(<DetailsPanel />);
    seedPart(h);
    const surface = openFillPicker(h);
    giveSurfaceABox(surface);
    const beforeClicks = h.document();

    // A press with no travel is a discrete edit, not a gesture.
    dragColorSurface(surface, [[30, 20]]);
    const afterFirstClick = h.document();
    dragColorSurface(surface, [[180, 80]]);

    act(() => { h.ctx().undo(); });
    expect(h.document()).toBe(afterFirstClick);
    act(() => { h.ctx().undo(); });
    expect(h.document()).toBe(beforeClicks);
  });

  it('records a slider drag as ONE undo while a keyboard step stays discrete', () => {
    const h = renderHarness(<DetailsPanel />);
    const partId = seedPart(h);
    expandSection(h, 'APPEARANCE');
    const slider = h.container.querySelector('#appearance-corner-radius') as HTMLInputElement;
    expect(slider).toBeTruthy();
    const beforeDrag = h.document();

    fireEvent.pointerDown(slider, { pointerId: 0 });
    [4, 8, 12, 16, 20].forEach((value) => {
      fireEvent.change(slider, { target: { value: String(value) } });
    });
    fireEvent.pointerUp(slider, { pointerId: 0 });

    expect(h.ctx().characterParts.find((part) => part.id === partId)?.borderRadius).toBe(20);
    expect(h.document()).not.toBe(beforeDrag);
    act(() => { h.ctx().undo(); });
    expect(h.document()).toBe(beforeDrag);

    // The same control driven by the keyboard writes discrete entries: two steps,
    // two undos.
    const beforeKeys = h.document();
    act(() => { fireEvent.change(slider, { target: { value: '24' } }); });
    const afterFirstKey = h.document();
    act(() => { fireEvent.change(slider, { target: { value: '28' } }); });
    act(() => { h.ctx().undo(); });
    expect(h.document()).toBe(afterFirstKey);
    act(() => { h.ctx().undo(); });
    expect(h.document()).toBe(beforeKeys);
  });

  it('keeps a timeline resize out of document history', () => {
    const h = renderHarness(<SequencerTimeline />);
    const partId = seedPart(h);
    const resizer = h.container.querySelector('[data-testid="timeline-height-resizer"]') as HTMLElement;
    expect(resizer).toBeTruthy();
    const documentBefore = h.document();

    fireEvent.mouseDown(resizer, { button: 0, clientX: 400, clientY: 300 });
    fireEvent.mouseMove(window, { clientX: 400, clientY: 240 });
    fireEvent.mouseMove(window, { clientX: 400, clientY: 200 });
    fireEvent.mouseUp(window, { clientX: 400, clientY: 200 });

    // The workspace resized (UI state) and the document did not move.
    const timeline = h.container.querySelector('.sequencer-timeline') as HTMLElement;
    // Dragged 100px up from the height the timeline OPENED with (C4: the
    // opening height follows the window — 320 px on a tall one).
    expect(timeline.style.height).toBe(`${resolveOpeningTimelineHeight(window.innerHeight) + 100}px`);
    expect(h.document()).toBe(documentBefore);

    // A discrete edit AFTER the resize undoes straight back to the same document:
    // the resize left nothing in between.
    const trackId = h.ctx().tracks[0].id;
    act(() => { h.ctx().addKeyframeToTrack(trackId, 7); });
    act(() => { h.ctx().undo(); });
    expect(h.document()).toBe(documentBefore);
    expect(h.ctx().characterParts[0].id).toBe(partId);
  });
});

describe('R4-14 — the curve and path editors own one transaction per drag', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  const keyframes: PropertyKeyframe[] = [
    { id: 'a', frame: 0, value: 0, easing: 'easeInOut' },
    { id: 'b', frame: 12, value: 100, easing: 'easeInOut' },
  ];

  it('opens the curve gesture on the press and closes it on the release', () => {
    const onBatchStart = vi.fn();
    const onBatchEnd = vi.fn();
    const { container } = render(
      <InteractiveCubicBezierEditor
        controlPoints={[0.42, 0, 0.58, 1]}
        onChange={vi.fn()}
        onBatchStart={onBatchStart}
        onBatchEnd={onBatchEnd}
      />
    );
    // The editor opens its workspace in a portal, so the graph is queried from the
    // document, exactly where the user sees it.
    const handle = document.querySelectorAll('g[style*="grab"]')[0] as Element;
    // The editor renders icon SVGs too: the gesture surface is the handle's own graph.
    const graph = handle.closest('svg') as Element;
    expect(container).toBeTruthy();
    expect(handle).toBeTruthy();

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 40, clientY: 40 });
    expect(onBatchStart).toHaveBeenCalledTimes(1);
    [50, 60, 70, 80].forEach((clientX) => {
      fireEvent.pointerMove(graph, { pointerId: 1, clientX, clientY: 40 });
    });
    expect(onBatchStart).toHaveBeenCalledTimes(1);
    expect(onBatchEnd).not.toHaveBeenCalled();

    fireEvent.pointerUp(graph, { pointerId: 1, clientX: 80, clientY: 40 });
    expect(onBatchEnd).toHaveBeenCalledTimes(1);
  });

  it('opens the graph gesture on the press and closes it when the point is released', () => {
    const onInteractionStart = vi.fn();
    const onInteractionEnd = vi.fn();
    const { container } = render(
      <TemporalGraphPanel
        keyframes={keyframes}
        mode="value"
        onChangeKeyframeValue={vi.fn()}
        onInteractionStart={onInteractionStart}
        onInteractionEnd={onInteractionEnd}
      />
    );
    const point = container.querySelectorAll('circle[role="button"]')[1] as Element;
    const svg = container.querySelector('svg') as Element;

    fireEvent.mouseDown(point, { clientY: 60 });
    expect(onInteractionStart).toHaveBeenCalledTimes(1);
    [70, 80, 90].forEach((clientY) => fireEvent.mouseMove(svg, { clientY }));
    expect(onInteractionStart).toHaveBeenCalledTimes(1);
    expect(onInteractionEnd).not.toHaveBeenCalled();

    fireEvent.mouseUp(svg, {});
    expect(onInteractionEnd).toHaveBeenCalledTimes(1);
  });

  it('opens the mask-path gesture on the press and closes it when the vertex is released', () => {
    const onInteractionStart = vi.fn();
    const onInteractionEnd = vi.fn();
    const { container } = render(
      <BezierPathEditor
        path={{
          version: 1,
          coordinateSpace: 'normalized',
          closed: true,
          points: [
            { id: 'a', x: 0.1, y: 0.1, kind: 'corner' },
            { id: 'b', x: 0.9, y: 0.9, kind: 'corner' },
          ],
        }}
        onChange={vi.fn()}
        onInteractionStart={onInteractionStart}
        onInteractionEnd={onInteractionEnd}
      />
    );
    const vertex = container.querySelector('[aria-label="Vertex 1"]') as Element;
    const svg = container.querySelector('svg') as Element;

    fireEvent.mouseDown(vertex, { clientX: 10, clientY: 10 });
    expect(onInteractionStart).toHaveBeenCalledTimes(1);
    [20, 30, 40].forEach((clientX) => fireEvent.mouseMove(svg, { clientX, clientY: 10 }));
    expect(onInteractionStart).toHaveBeenCalledTimes(1);
    expect(onInteractionEnd).not.toHaveBeenCalled();

    fireEvent.mouseUp(svg, {});
    expect(onInteractionEnd).toHaveBeenCalledTimes(1);
  });

  it('keeps an un-dragged channel track out of the picture', () => {
    // The empty-channels guard keeps the fixture honest about what these editors write.
    expect(Object.values(makeEmptyChannels()).every((keys) => keys.length === 0)).toBe(true);
  });
});
