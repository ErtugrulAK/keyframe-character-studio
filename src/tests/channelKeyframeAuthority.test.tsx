/**
 * Manual QA Round 3 — R3-10 / R3-11: ONE canonical authored animation truth.
 *
 * Observed: (a) a layer-level (aggregate) keyframe action created animation that
 * showed on the aggregate layer row while the expanded `Location X` /
 * `Location Y` rows stayed empty; (b) editing X (or adding an X keyframe) on a
 * layer whose animation still lived in the legacy composite list made the
 * aggregate row's diamonds disappear.
 *
 * Root cause: two animation stores. The aggregate add wrote `track.keyframes`
 * (legacy composite) while the channel lanes read `track.channels`; the moment
 * ANY canonical channel key existed, the aggregate row switched to the channel
 * projection and the legacy-only frames vanished from the UI even though the
 * evaluator still used them.
 *
 * These tests drive the real store + the real timeline, and assert the contract:
 *   1. creating a transform keyframe materializes the canonical channel keys;
 *   2. the aggregate row is a projection of those keys (nothing hides);
 *   3. editing one channel never removes or hides another channel's keys;
 *   4/5. expand/collapse and manual edits never change animation data;
 *   6. sequence identity survives; undo/redo and save/reload restore exactly.
 */

import React, { useEffect } from 'react';
import { render, act, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { SequencerTimeline } from '../components/Timeline/SequencerTimeline';
import { makeEmptyChannels } from '../utils/defaults';
import { DISPLAY_CHANNELS, TRIM_PATH_CHANNELS } from '../utils/channelKeyframeGroups';
import { createLayerGroup } from '../utils/layerGrouping';
import { generateId } from '../utils/idGenerator';
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

const trackRow = (container: HTMLElement, name: string): HTMLElement => {
  const row = Array.from(container.querySelectorAll('.ue-track-group'))
    .find((group) => group.querySelector('.ue-track-name')?.textContent?.trim() === name);
  if (!row) throw new Error(`no timeline track row for ${name}`);
  return row;
};

/** The aggregate (layer-level) keyframe action. */
const clickAggregateKeyframe = (container: HTMLElement, name: string) => {
  const button = trackRow(container, name).querySelector('button[title="Add Composite Keyframe"]');
  if (!button) throw new Error(`no aggregate keyframe button for ${name}`);
  fireEvent.click(button);
};

/** The per-property channel keyframe action. */
const clickChannelKeyframe = (container: HTMLElement, name: string, label: string) => {
  const button = trackRow(container, name).querySelector(`button[title="Add ${label} keyframe"]`);
  if (!button) throw new Error(`no ${label} keyframe button for ${name}`);
  fireEvent.click(button);
};

/**
 * The grid-side lane group of a layer: the element that actually renders the
 * diamonds (the outliner row only carries the name and the + buttons).
 */
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

const legacyKeyframe = (id: string, frame: number, x: number, y: number): Keyframe => ({
  id,
  frame,
  transform: { x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  easing: 'linear',
  templateId: 'Sequence',
});

interface Harness {
  container: HTMLElement;
  ctx: () => AnimatorContextType;
  addRect: (name: string, x: number, y: number) => string;
  pose: (partId: string) => Transform;
  trackOf: (partId: string) => Track;
  /** Replace a track's animation with a legacy-only composite list. */
  injectLegacyTrack: (partId: string, keyframes: Keyframe[]) => void;
  /** Group the given layers through the canonical grouping authority. */
  group: (ids: string[]) => string;
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
    return part.id;
  };
  const pose = (partId: string): Transform => ctx().getComputedTransform(partId, ctx().currentFrame);
  const injectLegacyTrack = (partId: string, keyframes: Keyframe[]) => {
    act(() => {
      ctx().setTracks((prev) => prev.map((track) => (
        track.partId === partId
          ? { ...track, keyframes, channels: makeEmptyChannels() }
          : track
      )));
    });
  };
  const group = (ids: string[]): string => {
    const outcome = createLayerGroup(ctx().characterParts, ctx().tracks, ids, {
      groupId: generateId('group'),
      trackId: generateId('track'),
      name: 'Group 1',
      worldOf: (partId) => ctx().getComputedTransform(partId, ctx().currentFrame),
    });
    if (!outcome.ok) throw new Error(outcome.reason);
    act(() => {
      ctx().setCharacterParts(outcome.parts);
      ctx().setTracks(outcome.tracks);
    });
    return outcome.groupId;
  };
  return { container, ctx, addRect, pose, trackOf, injectLegacyTrack, group };
};

describe('R3-10/R3-11 — one canonical transform channel authoring', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem');
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('materializes the canonical channel keys for an aggregate transform keyframe', () => {
    const h = renderHarness();
    const id = h.addRect('Rect A', 300, 260);

    act(() => { clickAggregateKeyframe(h.container, 'Rect A'); });

    const track = h.trackOf(id);
    for (const channel of [...DISPLAY_CHANNELS, ...TRIM_PATH_CHANNELS] as TrackChannel[]) {
      const keys = track.channels?.[channel] ?? [];
      expect(keys.length, `${channel} must carry the authored key`).toBe(1);
      expect(keys[0].frame).toBe(h.ctx().currentFrame);
      expect(keys[0].templateId).toBe('Sequence');
    }
    // The canonical values are the authored pose, not a world-space capture.
    expect(track.channels?.x?.[0].value).toBeCloseTo(300, 9);
    expect(track.channels?.y?.[0].value).toBeCloseTo(260, 9);
    expect(track.channels?.opacity?.[0].value).toBeCloseTo(1, 9);
    expect(track.channels?.trimPathEnd?.[0].value).toBeCloseTo(1, 9);
  });

  it('shows the aggregate action on the expanded Location X / Location Y rows', () => {
    const h = renderHarness();
    const id = h.addRect('Rect A', 300, 260);
    act(() => { h.ctx().toggleTrackExpanded(h.trackOf(id).id); });

    act(() => { clickAggregateKeyframe(h.container, 'Rect A'); });

    expect(aggregateDiamonds(h.container, id).length).toBe(1);
    expect(channelDiamonds(h.container, id, 'Location X').length).toBe(1);
    expect(channelDiamonds(h.container, id, 'Location Y').length).toBe(1);
    expect(channelDiamonds(h.container, id, 'Opacity').length).toBe(1);
  });

  it('keeps legacy composite frames visible when a canonical channel key appears', () => {
    const h = renderHarness();
    const id = h.addRect('Rect A', 0, 0);
    h.injectLegacyTrack(id, [legacyKeyframe('kf0', 0, 0, 0), legacyKeyframe('kf20', 20, 200, 0)]);

    // Legacy-only track: both frames are visible on the aggregate row.
    expect(aggregateDiamonds(h.container, id).length).toBe(2);

    // Writing ONE canonical channel must migrate the legacy animation, never
    // hide it: the very state that used to blank the aggregate row.
    act(() => { h.ctx().toggleTrackExpanded(h.trackOf(id).id); });
    act(() => { clickChannelKeyframe(h.container, 'Rect A', 'Location X'); });

    const track = h.trackOf(id);
    expect(track.keyframes).toHaveLength(0);
    // The composite list animates X (0 → 200) and nothing else: Y, rotation,
    // scale and opacity hold the layer's own pose at every sample, so the
    // migration carries X and leaves no phantom keys on the other rows. The
    // frames themselves stay: both were visible before and both are visible now.
    expect(track.channels?.x?.map((key) => key.frame).sort((a, b) => a - b)).toEqual([0, 20]);
    for (const channel of DISPLAY_CHANNELS.filter((channel) => channel !== 'x')) {
      expect(track.channels?.[channel] ?? [], channel).toHaveLength(0);
    }
    expect(aggregateDiamonds(h.container, id).length).toBe(2);
    expect(channelDiamonds(h.container, id, 'Location X').length).toBe(2);
    expect(channelDiamonds(h.container, id, 'Location Y').length).toBe(0);
    // Nothing was lost: the layer plays the composite pose at every frame.
    act(() => { h.ctx().setCurrentFrame(20); });
    expect(h.pose(id).x).toBeCloseTo(200, 9);
    expect(h.pose(id).y).toBeCloseTo(0, 9);
    act(() => { h.ctx().setCurrentFrame(10); });
    expect(h.pose(id).x).toBeGreaterThan(0);
    expect(h.pose(id).x).toBeLessThan(200);
    expect(h.pose(id).y).toBeCloseTo(0, 9);
  });

  it('edits only X at a keyed frame, leaving every other channel alone', () => {
    const h = renderHarness();
    const id = h.addRect('Rect A', 100, 100);
    act(() => { clickAggregateKeyframe(h.container, 'Rect A'); });
    const before = h.trackOf(id);
    const yBefore = before.channels?.y?.[0];
    const rotationBefore = before.channels?.rotation?.[0];

    act(() => { h.ctx().updateCurrentTransform({ x: 480 }, id); });

    const after = h.trackOf(id);
    expect(after.channels?.x?.[0].value).toBeCloseTo(480, 9);
    expect(after.channels?.y?.[0]).toEqual(yBefore);
    expect(after.channels?.rotation?.[0]).toEqual(rotationBefore);
    expect(aggregateDiamonds(h.container, id).length).toBe(1);
  });

  it('never hides animation data when a property is edited off a keyed frame', () => {
    const h = renderHarness();
    const id = h.addRect('Rect A', 0, 0);
    h.injectLegacyTrack(id, [legacyKeyframe('kf0', 0, 0, 0), legacyKeyframe('kf20', 20, 200, 0)]);

    act(() => { h.ctx().setCurrentFrame(10); });
    act(() => { h.ctx().updateCurrentTransform({ x: 50 }, id); });

    const track = h.trackOf(id);
    // The edit is authored (not swallowed by a base-transform write) and the
    // composite's own X animation keeps every frame it carried.
    expect(track.channels?.x?.map((key) => key.frame).sort((a, b) => a - b)).toEqual([0, 10, 20]);
    // Y never moves in the composite (it holds the layer's own pose), so the
    // migration invents no Y key — and the layer still plays Y = 0 everywhere.
    expect(track.channels?.y ?? []).toHaveLength(0);
    expect(h.pose(id).x).toBeCloseTo(50, 9);
    expect(h.pose(id).y).toBeCloseTo(0, 9);
  });

  it('does not change animation data when the track is expanded or collapsed', () => {
    const h = renderHarness();
    const id = h.addRect('Rect A', 10, 20);
    act(() => { clickAggregateKeyframe(h.container, 'Rect A'); });
    // The lane's own expand flag is view state; the AUTHORED animation must not move.
    const authored = () => JSON.stringify({ channels: h.trackOf(id).channels, keyframes: h.trackOf(id).keyframes });
    const snapshot = authored();

    act(() => { h.ctx().toggleTrackExpanded(h.trackOf(id).id); });
    const expandButton = trackRow(h.container, 'Rect A').querySelector('button[title="Collapse properties"]');
    if (expandButton) fireEvent.click(expandButton);

    expect(authored()).toBe(snapshot);
  });

  it('preserves the sequence identity and the pose on a grouped child', () => {
    const h = renderHarness();
    const a = h.addRect('Rect A', 120, 130);
    const b = h.addRect('Rect B', 420, 340);
    const groupId = h.group([a, b]);
    const groupWorld = h.pose(groupId);
    const before = h.pose(b);

    act(() => { h.ctx().setActiveTemplateId('Outro'); });
    act(() => { clickAggregateKeyframe(h.container, 'Rect B'); });

    const track = h.trackOf(b);
    for (const channel of DISPLAY_CHANNELS) {
      const keys = track.channels?.[channel] ?? [];
      expect(keys.length, channel).toBe(1);
      expect(keys[0].templateId, channel).toBe('Outro');
    }
    expectSamePose(h.pose(b), before);
    expectSamePose(h.pose(groupId), groupWorld);

    act(() => { h.ctx().setActiveTemplateId('Sequence'); });
    for (const channel of DISPLAY_CHANNELS) {
      const keys = track.channels?.[channel] ?? [];
      expect(keys.filter((key) => (key.templateId || 'Sequence') === 'Sequence'), channel).toHaveLength(0);
    }
  });

  it('restores the exact channel set through undo and redo', () => {
    const h = renderHarness();
    const id = h.addRect('Rect A', 40, 60);
    act(() => { clickAggregateKeyframe(h.container, 'Rect A'); });
    const authored = JSON.stringify(h.trackOf(id).channels);

    act(() => { h.ctx().undo(); });
    expect(JSON.stringify(h.trackOf(id).channels)).toBe(JSON.stringify(makeEmptyChannels()));

    act(() => { h.ctx().redo(); });
    expect(JSON.stringify(h.trackOf(id).channels)).toBe(authored);
  });

  it('round-trips the authored channels through save and reload', () => {
    const h = renderHarness();
    const id = h.addRect('Rect A', 40, 60);
    act(() => { clickAggregateKeyframe(h.container, 'Rect A'); });
    act(() => { h.ctx().setCurrentFrame(12); });
    act(() => { h.ctx().updateCurrentTransform({ x: 210 }, id); });
    const authored = JSON.stringify(h.trackOf(id).channels);

    const scene = h.ctx().exportProject();
    act(() => { h.ctx().importProject(scene); });

    expect(JSON.stringify(h.trackOf(id).channels)).toBe(authored);
    expect(aggregateDiamonds(h.container, id).length).toBe(2);
  });

  it('projects the aggregate row from the canonical keys after an import of a mixed file', () => {
    const h = renderHarness();
    const id = h.addRect('Rect A', 0, 0);
    // A foreign/hand-edited document: partial canonical channels plus a legacy
    // list the evaluator still resolves. The composite animates X and Y (its
    // rotation/scale/opacity hold the layer's own pose).
    h.injectLegacyTrack(id, [legacyKeyframe('kf0', 0, 0, 40), legacyKeyframe('kf20', 20, 200, 90)]);
    act(() => {
      h.ctx().setTracks((prev) => prev.map((track) => (
        track.partId === id
          ? { ...track, channels: { ...makeEmptyChannels(), x: [{ id: 'px5', frame: 5, value: 5, easing: 'linear' as const, templateId: 'Sequence' }] } }
          : track
      )));
    });
    const poseBefore = [0, 5, 10, 20].map((frame) => h.ctx().getComputedTransform(id, frame));
    const scene = h.ctx().exportProject();
    act(() => { h.ctx().importProject(scene); });

    // The evaluator's own resolution: canonical x wins for the sequence it
    // covers, the legacy list fills the channel it still drives (Y). The row
    // shows every frame the animation uses — none of it is hidden.
    const track = h.trackOf(id);
    expect(track.channels?.x?.map((key) => key.frame)).toEqual([5]);
    expect(track.channels?.y?.map((key) => key.frame).sort((a, b) => a - b)).toEqual([0, 20]);
    // The properties the composite never moves are not fabricated as animation.
    for (const channel of ['rotation', 'scaleX', 'scaleY', 'opacity'] as TrackChannel[]) {
      expect(track.channels?.[channel] ?? [], channel).toHaveLength(0);
    }
    expect(aggregateDiamonds(h.container, id).length).toBe(3);
    // … and the imported animation is exactly the animation that played before.
    [0, 5, 10, 20].forEach((frame, index) => {
      const pose = h.ctx().getComputedTransform(id, frame);
      expect(pose.x).toBeCloseTo(poseBefore[index].x, 9);
      expect(pose.y).toBeCloseTo(poseBefore[index].y, 9);
      expect(pose.rotation).toBeCloseTo(poseBefore[index].rotation, 9);
      expect(pose.opacity).toBeCloseTo(poseBefore[index].opacity, 9);
    });
  });

  it('keeps a group container free of transform channels after ungroup-free authoring', () => {
    const h = renderHarness();
    const a = h.addRect('Rect A', 120, 130);
    const b = h.addRect('Rect B', 420, 340);
    const groupId = h.group([a, b]);

    // Authoring on a child never writes the container's own track.
    act(() => { clickAggregateKeyframe(h.container, 'Rect B'); });
    const groupTrack = h.trackOf(groupId);
    expect(groupTrack.keyframes).toHaveLength(0);
    for (const channel of DISPLAY_CHANNELS) {
      expect(groupTrack.channels?.[channel] ?? [], channel).toHaveLength(0);
    }
    expect(h.ctx().characterParts.find((part) => part.id === groupId)?.baseTransform.opacity).toBe(0);
  });
});
