/**
 * PR #11 manual QA — property-level authored key semantics.
 *
 * Observed: property rows showed keyframes on channels the animation never
 * touches. A legacy composite list stores POSES (every property of every
 * keyframe), so a position-only composite animation projected keys onto the
 * Rotation / Scale / Opacity rows, their per-property navigation reached those
 * frames, and the Inspector's keyframe list listed them — and any authoring
 * entry (which migrates the legacy list first) or export made them permanent.
 *
 * These tests drive the REAL provider, the REAL timeline and the REAL import /
 * export path, and assert:
 *   1. the canonical Rectangle + Position workflow keys Position only, frame by
 *      frame, with the evaluated pose intact (runtime, not a data echo);
 *   2. an explicit Rotation key — even a held value equal to the base pose —
 *      stays visible on the Rotation row only, and the frame group it owns can be
 *      removed without touching the position groups;
 *   3. a legacy composite projection materializes a property only where the
 *      composite actually moves it (or holds a pose the layer does not own), is
 *      pose-exact at every frame, and never hides a frame the layer row draws.
 */

import React, { useEffect } from 'react';
import { render, act, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { SequencerTimeline } from '../components/Timeline/SequencerTimeline';
import { makeEmptyChannels } from '../utils/defaults';
import type { Keyframe, Track, Transform, TrackChannel } from '../types/animator';

const Consumer = ({ onCtx }: { onCtx: (ctx: AnimatorContextType) => void }) => {
  const ctx = useAnimator();
  useEffect(() => { onCtx(ctx); });
  return null;
};

const POSE_CHANNELS = ['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const;

const expectSamePose = (actual: Transform, expected: Transform) => {
  POSE_CHANNELS.forEach((channel) => expect(actual[channel]).toBeCloseTo(expected[channel], 9));
};

/** A full pose from the channels under test; the rest stays at the layer's rest pose. */
const expectedPose = (overrides: Partial<Transform>): Transform => ({
  x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, ...overrides,
});

const trackRow = (container: HTMLElement, name: string): HTMLElement => {
  const row = Array.from(container.querySelectorAll('.ue-track-group'))
    .find((group) => group.querySelector('.ue-track-name')?.textContent?.trim() === name);
  if (!row) throw new Error(`no timeline track row for ${name}`);
  return row;
};

/** The per-property keyframe action of one channel row. */
const clickChannelKeyframe = (container: HTMLElement, name: string, label: string) => {
  const button = trackRow(container, name).querySelector(`button[title="Add ${label} keyframe"]`);
  if (!button) throw new Error(`no ${label} keyframe button for ${name}`);
  fireEvent.click(button);
};

/** The layer-level ("aggregate") keyframe action. */
const clickAggregateKeyframe = (container: HTMLElement, name: string) => {
  const button = trackRow(container, name).querySelector('button[title="Add Composite Keyframe"]');
  if (!button) throw new Error(`no aggregate keyframe button for ${name}`);
  fireEvent.click(button);
};

/** The grid-side lane group of a layer: the element that renders the diamonds. */
const laneOf = (container: HTMLElement, partId: string): HTMLElement => {
  const lane = container.querySelector(`.ue-lane-group[data-owner-part-id="${partId}"]`);
  if (!lane) throw new Error(`no timeline lane for ${partId}`);
  return lane as HTMLElement;
};

/** Aggregate-row diamonds: the layer-level projection of the channel keys. */
const aggregateDiamonds = (container: HTMLElement, partId: string): HTMLElement[] => (
  Array.from(laneOf(container, partId).querySelectorAll('.keyframe-diamond'))
);

/** Channel-lane diamonds, identified by the property they belong to. */
const channelDiamonds = (container: HTMLElement, partId: string, label: string): HTMLElement[] => (
  Array.from(laneOf(container, partId).querySelectorAll('.ue-prop-diamond'))
    .filter((diamond) => (diamond.getAttribute('title') ?? '').startsWith(`${label} =`))
);

/** The frames a lane's diamonds sit on, ascending (read from their titles). */
const framesOf = (diamonds: HTMLElement[]): number[] => diamonds
  .map((diamond) => Number(/@ F(\d+)/.exec(diamond.getAttribute('title') ?? '')?.[1]))
  .sort((a, b) => a - b);

/** A legacy composite keyframe: a full pose sample, exactly as the old model stored it. */
const legacyKeyframe = (id: string, frame: number, pose: Partial<Transform>): Keyframe => ({
  id,
  frame,
  transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, ...pose },
  easing: 'linear',
  templateId: 'Sequence',
});

interface Harness {
  container: HTMLElement;
  ctx: () => AnimatorContextType;
  /** Create a rectangle at an exact authored position; returns its layer id. */
  addRect: (name: string, x: number, y: number) => string;
  poseAt: (partId: string, frame: number) => Transform;
  trackOf: (partId: string) => Track;
  /** Replace a track's animation with a legacy-only composite list. */
  injectLegacyTrack: (partId: string, keyframes: Keyframe[]) => void;
}

const renderHarness = (): Harness => {
  let live: AnimatorContextType | null = null;
  const { container } = render(
    <AnimatorProvider>
      <Consumer onCtx={(c) => { live = c; }} />
      <SequencerTimeline />
    </AnimatorProvider>
  );
  const ctx = (): AnimatorContextType => {
    if (!live) throw new Error('provider context not captured yet');
    return live;
  };
  const trackOf = (partId: string): Track => {
    const track = ctx().tracks.find((candidate) => candidate.partId === partId);
    if (!track) throw new Error(`no track for ${partId}`);
    return track;
  };
  const addRect = (name: string, x: number, y: number): string => {
    act(() => { ctx().addCustomPart('custom_rect', name); });
    const part = ctx().characterParts.find((candidate) => candidate.name === name);
    if (!part) throw new Error(`rectangle ${name} was not created`);
    act(() => { ctx().setSelectedPartId(part.id); });
    act(() => { ctx().updateCurrentTransform({ x, y }, part.id); });
    act(() => { ctx().toggleTrackExpanded(trackOf(part.id).id); });
    // The Scale lanes are collapsed by default: open them so a "no keys" claim
    // about a scale row is really read from the lane, not from a hidden row.
    act(() => { expandGroup(container, name, 'Scale'); });
    return part.id;
  };
  const poseAt = (partId: string, frame: number): Transform => ctx().getComputedTransform(partId, frame);
  const injectLegacyTrack = (partId: string, keyframes: Keyframe[]) => {
    act(() => {
      ctx().setTracks((prev) => prev.map((track) => (
        track.partId === partId
          ? { ...track, keyframes, channels: makeEmptyChannels() }
          : track
      )));
    });
  };
  return { container, ctx, addRect, poseAt, trackOf, injectLegacyTrack };
};

/** Author one position keyframe at the given frame through the property rows. */
const keyPositionAt = (h: Harness, name: string, partId: string, frame: number, x: number, y: number) => {
  act(() => { h.ctx().setCurrentFrame(frame); });
  act(() => { h.ctx().updateCurrentTransform({ x, y }, partId); });
  act(() => { clickChannelKeyframe(h.container, name, 'Location X'); });
  act(() => { clickChannelKeyframe(h.container, name, 'Location Y'); });
};

/** Open one property group of the outliner (Position / Scale / Trim Path). */
const expandGroup = (container: HTMLElement, name: string, label: string) => {
  const header = trackRow(container, name)
    .querySelector(`.ue-subgroup-header[aria-label^="${label} properties of"]`);
  if (!header) throw new Error(`no ${label} group header for ${name}`);
  fireEvent.click(header);
};

/** Select one property diamond (the press the timeline turns into a selection). */
const clickChannelDiamond = (container: HTMLElement, partId: string, label: string, frame: number) => {
  const diamond = channelDiamonds(container, partId, label)
    .find((candidate) => (candidate.getAttribute('title') ?? '').includes(`@ F${frame} `));
  if (!diamond) throw new Error(`no ${label} diamond at frame ${frame}`);
  fireEvent.click(diamond);
};

/** The enabled state of a property row's own keyframe navigation. */
const channelNav = (container: HTMLElement, name: string, label: string): { previous: boolean; next: boolean } => {
  const row = Array.from(trackRow(container, name).querySelectorAll('.ue-channel-row'))
    .find((candidate) => candidate.getAttribute('data-property-channel') === label);
  if (!row) throw new Error(`no ${label} property row for ${name}`);
  // Select by the nav buttons' accessible names, not by child index: K1's
  // stopwatch is a new button in the same control strip, and the contract
  // under test is the prev/next ENABLED STATE, not button order.
  const previous = row.querySelector('button[aria-label^="Previous "]') as HTMLButtonElement;
  const next = row.querySelector('button[aria-label^="Next "]') as HTMLButtonElement;
  return { previous: !previous.disabled, next: !next.disabled };
};

/** The enabled state of the layer row's own keyframe navigation. */
const layerNav = (container: HTMLElement, name: string): { previous: boolean; next: boolean } => {
  const row = trackRow(container, name);
  const previous = row.querySelector('button[aria-label^="Previous keyframe of"]') as HTMLButtonElement;
  const next = row.querySelector('button[aria-label^="Next keyframe of"]') as HTMLButtonElement;
  return { previous: !previous.disabled, next: !next.disabled };
};

describe('PR #11 — property-level authored key semantics', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem');
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('keys only Position for a Rectangle position workflow, with the runtime pose intact', () => {
    const h = renderHarness();
    const id = h.addRect('Rect A', 300, 260);

    keyPositionAt(h, 'Rect A', id, 0, 300, 260);
    keyPositionAt(h, 'Rect A', id, 20, 500, 320);
    keyPositionAt(h, 'Rect A', id, 40, 700, 260);

    // Position owns three frames …
    expect(framesOf(channelDiamonds(h.container, id, 'Location X'))).toEqual([0, 20, 40]);
    expect(framesOf(channelDiamonds(h.container, id, 'Location Y'))).toEqual([0, 20, 40]);
    // … and no other property row was keyed by the position authoring.
    for (const label of ['Rotation', 'Scale X', 'Scale Y', 'Opacity']) {
      expect(channelDiamonds(h.container, id, label), label).toHaveLength(0);
    }
    const track = h.trackOf(id);
    for (const channel of ['rotation', 'scaleX', 'scaleY', 'opacity'] as TrackChannel[]) {
      expect(track.channels?.[channel] ?? [], channel).toHaveLength(0);
    }
    // The layer row is the frame-group projection of those keys, nothing more.
    expect(aggregateDiamonds(h.container, id)).toHaveLength(3);

    // The runtime pose is the authored animation — the same values the stage draws.
    expectSamePose(h.poseAt(id, 0), expectedPose({ x: 300, y: 260 }));
    expectSamePose(h.poseAt(id, 20), expectedPose({ x: 500, y: 320 }));
    expectSamePose(h.poseAt(id, 40), expectedPose({ x: 700, y: 260 }));
    // Between the keys the layer interpolates (100 → 500 over frames 0 → 20).
    expect(h.poseAt(id, 10).x).toBeGreaterThan(300);
    expect(h.poseAt(id, 10).x).toBeLessThan(500);
    expect(h.poseAt(id, 30).x).toBeGreaterThan(500);
    expect(h.poseAt(id, 30).x).toBeLessThan(700);
  });

  it('keeps an explicit held Rotation key on the Rotation row and removes only its frame group', () => {
    const h = renderHarness();
    const id = h.addRect('Rect A', 300, 260);
    keyPositionAt(h, 'Rect A', id, 0, 300, 260);
    keyPositionAt(h, 'Rect A', id, 20, 500, 320);

    // A held key: the authored rotation equals the layer's own pose (0).
    act(() => { h.ctx().setCurrentFrame(10); });
    const poseBeforeKey = h.poseAt(id, 10);
    act(() => { clickChannelKeyframe(h.container, 'Rect A', 'Rotation'); });

    const track = h.trackOf(id);
    expect(track.channels?.rotation?.map((key) => key.frame)).toEqual([10]);
    expect(framesOf(channelDiamonds(h.container, id, 'Rotation'))).toEqual([10]);
    // The explicit key is authored truth: it may not be pruned and it may not
    // appear on any other property row.
    for (const label of ['Location X', 'Location Y', 'Scale X', 'Scale Y', 'Opacity']) {
      expect(framesOf(channelDiamonds(h.container, id, label)), label).not.toContain(10);
    }
    expect(framesOf(channelDiamonds(h.container, id, 'Location X'))).toEqual([0, 20]);
    expect(aggregateDiamonds(h.container, id)).toHaveLength(3);
    // The held key does not move the layer.
    expect(h.poseAt(id, 10).rotation).toBeCloseTo(0, 9);
    expectSamePose(h.poseAt(id, 10), poseBeforeKey);

    // Removing it (the frame-group delete the keyframe menu runs) removes
    // exactly that group: the position groups survive untouched.
    act(() => { clickChannelDiamond(h.container, id, 'Rotation', 10); });
    act(() => { h.ctx().deleteKeyframeFrameGroup(h.trackOf(id).id, 10); });

    expect(h.trackOf(id).channels?.rotation ?? []).toHaveLength(0);
    expect(channelDiamonds(h.container, id, 'Rotation')).toHaveLength(0);
    expect(framesOf(channelDiamonds(h.container, id, 'Location X'))).toEqual([0, 20]);
    expect(aggregateDiamonds(h.container, id)).toHaveLength(2);
    expectSamePose(h.poseAt(id, 10), poseBeforeKey);
  });

  it('projects a legacy composite list onto the properties it actually moves, pose-exact', () => {
    const h = renderHarness();
    const id = h.addRect('Rect A', 300, 260);
    // A legacy composite animation: three pose samples. x/y move, rotation and
    // scale hold the pose the layer already owns (prunable — the pose proves it),
    // opacity holds 0.5 while the layer's own opacity is 1 (a real held override).
    h.injectLegacyTrack(id, [
      legacyKeyframe('kf0', 0, { x: 300, y: 260, opacity: 0.5 }),
      legacyKeyframe('kf20', 20, { x: 500, y: 320, opacity: 0.5 }),
      legacyKeyframe('kf40', 40, { x: 700, y: 260, opacity: 0.5 }),
    ]);
    const poseBefore = [0, 10, 20, 40].map((frame) => h.poseAt(id, frame));

    // The layer row draws the composite frames (nothing hidden) …
    expect(aggregateDiamonds(h.container, id)).toHaveLength(3);
    // … while the property rows show exactly the properties the composite moves.
    expect(framesOf(channelDiamonds(h.container, id, 'Location X'))).toEqual([0, 20, 40]);
    expect(framesOf(channelDiamonds(h.container, id, 'Location Y'))).toEqual([0, 20, 40]);
    for (const label of ['Rotation', 'Scale X', 'Scale Y']) {
      expect(channelDiamonds(h.container, id, label), label).toHaveLength(0);
    }
    // The held override survives on its own row.
    expect(framesOf(channelDiamonds(h.container, id, 'Opacity'))).toEqual([0, 20, 40]);
    // Property navigation matches the rows: Rotation has no frame to reach, the
    // layer rows still reach every drawn frame, and Position reaches on both
    // sides from between its keys.
    act(() => { h.ctx().setCurrentFrame(10); });
    expect(channelNav(h.container, 'Rect A', 'rotation')).toEqual({ previous: false, next: false });
    expect(channelNav(h.container, 'Rect A', 'x')).toEqual({ previous: true, next: true });
    expect(channelNav(h.container, 'Rect A', 'opacity')).toEqual({ previous: true, next: true });
    expect(layerNav(h.container, 'Rect A')).toEqual({ previous: true, next: true });

    // Export / import (the user's auto-save reload) materializes the SAME
    // properties only, and the animation the stage plays is unchanged.
    const scene = h.ctx().exportProject();
    act(() => { h.ctx().importProject(scene); });
    const track = h.trackOf(id);
    expect(track.keyframes).toHaveLength(0);
    expect(track.channels?.x?.map((key) => key.frame)).toEqual([0, 20, 40]);
    expect(track.channels?.y?.map((key) => key.frame)).toEqual([0, 20, 40]);
    expect(track.channels?.opacity?.map((key) => key.frame)).toEqual([0, 20, 40]);
    for (const channel of ['rotation', 'scaleX', 'scaleY'] as TrackChannel[]) {
      expect(track.channels?.[channel] ?? [], channel).toHaveLength(0);
    }
    [0, 10, 20, 40].forEach((frame, index) => {
      expectSamePose(h.poseAt(id, frame), poseBefore[index]);
      expect(h.poseAt(id, frame).opacity).toBeCloseTo(poseBefore[index].opacity, 9);
    });
    expect(h.poseAt(id, 10).opacity).toBeCloseTo(0.5, 9);
  });

  it('keeps untagged and explicit Sequence samples in one scope through export and import', () => {
    const h = renderHarness();
    const id = h.addRect('Rect A', 0, 0);
    h.injectLegacyTrack(id, [
      { ...legacyKeyframe('start', 0, { x: 0, y: 0 }), templateId: undefined },
      legacyKeyframe('middle', 10, { x: 100, y: 100 }),
      { ...legacyKeyframe('end', 20, { x: 200, y: 0 }), templateId: undefined },
    ]);
    const frames = [0, 5, 10, 15, 20];
    const expectedY = [0, 50, 100, 50, 0];
    frames.forEach((frame, index) => expect(h.poseAt(id, frame).y).toBeCloseTo(expectedY[index], 9));
    const scene = h.ctx().exportProject();
    act(() => { h.ctx().importProject(scene); });
    frames.forEach((frame, index) => expect(h.poseAt(id, frame).y).toBeCloseTo(expectedY[index], 9));
    expect(h.trackOf(id).channels?.y?.map((key) => key.frame)).toEqual([0, 10, 20]);
  });

  it('keeps a legacy held pose the layer does not own, and keeps authoring pose-exact', () => {
    const h = renderHarness();
    const id = h.addRect('Rect A', 300, 260);
    // rotation 30 is held across the composite while the layer's own pose is 0:
    // a consumer-visible override, never prunable.
    h.injectLegacyTrack(id, [
      legacyKeyframe('kf0', 0, { x: 300, y: 260, rotation: 30 }),
      legacyKeyframe('kf20', 20, { x: 500, y: 260, rotation: 30 }),
      legacyKeyframe('kf40', 40, { x: 700, y: 260, rotation: 30 }),
    ]);
    const rotationBefore = [0, 20, 40].map((frame) => h.poseAt(id, frame).rotation);

    expect(framesOf(channelDiamonds(h.container, id, 'Rotation'))).toEqual([0, 20, 40]);
    expect(framesOf(channelDiamonds(h.container, id, 'Location X'))).toEqual([0, 20, 40]);

    // The migration every authoring entry runs keeps it too.
    act(() => { h.ctx().setCurrentFrame(20); });
    act(() => { clickChannelKeyframe(h.container, 'Rect A', 'Location Y'); });
    const track = h.trackOf(id);
    expect(track.keyframes).toHaveLength(0);
    expect(track.channels?.rotation?.map((key) => key.frame)).toEqual([0, 20, 40]);
    [0, 20, 40].forEach((frame, index) => expect(h.poseAt(id, frame).rotation).toBeCloseTo(rotationBefore[index], 9));
  });

  it('keeps a composite list that animates nothing whole (a static hold may not vanish)', () => {
    const h = renderHarness();
    const id = h.addRect('Rect A', 300, 260);
    // Three samples that hold the layer's own pose: no motion at all.
    h.injectLegacyTrack(id, [
      legacyKeyframe('kf0', 0, { x: 300, y: 260 }),
      legacyKeyframe('kf20', 20, { x: 300, y: 260 }),
      legacyKeyframe('kf40', 40, { x: 300, y: 260 }),
    ]);
    const poseBefore = [0, 20, 40].map((frame) => h.poseAt(id, frame));

    expect(aggregateDiamonds(h.container, id)).toHaveLength(3);
    for (const label of ['Location X', 'Location Y', 'Rotation', 'Scale X', 'Scale Y', 'Opacity']) {
      expect(framesOf(channelDiamonds(h.container, id, label)), label).toEqual([0, 20, 40]);
    }

    // Any authoring entry migrates the list; a hold must survive it, or the
    // user's own keyframes would disappear behind a pose they already own.
    act(() => { h.ctx().setCurrentFrame(20); });
    act(() => { clickChannelKeyframe(h.container, 'Rect A', 'Location X'); });
    const track = h.trackOf(id);
    expect(track.keyframes).toHaveLength(0);
    expect(track.channels?.x?.map((key) => key.frame).sort((a, b) => a - b)).toEqual([0, 20, 40]);
    expect(track.channels?.opacity?.map((key) => key.frame).sort((a, b) => a - b)).toEqual([0, 20, 40]);
    expect(aggregateDiamonds(h.container, id)).toHaveLength(3);
    [0, 20, 40].forEach((frame, index) => expectSamePose(h.poseAt(id, frame), poseBefore[index]));
  });

  it('keeps the layer-level composite action a full-pose key (its own contract)', () => {
    const h = renderHarness();
    const id = h.addRect('Rect A', 300, 260);
    act(() => { clickAggregateKeyframe(h.container, 'Rect A'); });

    const track = h.trackOf(id);
    for (const channel of ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'] as TrackChannel[]) {
      expect(track.channels?.[channel]?.map((key) => key.frame), channel).toEqual([0]);
    }
    expect(aggregateDiamonds(h.container, id)).toHaveLength(1);
    expect(channelDiamonds(h.container, id, 'Opacity')).toHaveLength(1);
  });
});
