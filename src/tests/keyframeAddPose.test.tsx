/**
 * Manual QA Round 1 — finding F: the keyframe-add `+` must preserve the pose.
 *
 * Observed: pressing the timeline's `+` (Add Composite Keyframe) on a second
 * rectangle visibly moved it downward, and repeated clicks accumulated drift.
 *
 * Root cause: the capture read `getComputedTransform` — the evaluated WORLD
 * transform, parent chain composed in — and wrote it into the layer's own
 * channels. `evaluateTransform` treats a channel/keyframe value as the layer's
 * container-local pose and composes the parent afterwards, so every capture
 * re-composed the container onto an already-composed value: a parented or
 * grouped layer moved by its container's transform, once per click.
 *
 * These tests drive the real `+` button and the real per-channel diamonds
 * through the real store, and assert the exact evaluated world pose before and
 * after, for unparented, sibling, grouped, rotated/scaled-parent, non-default
 * sequence and repeated add/remove cases, x and y independently.
 */

import React, { useEffect } from 'react';
import { render, act, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { SequencerTimeline } from '../components/Timeline/SequencerTimeline';
import { createLayerGroup } from '../utils/layers/layerGrouping';
import { worldToContainerLocal } from '../utils/geometry/containerMath';
import { generateId } from '../utils/layers/idGenerator';
import type { CharacterPart, Track, Transform, TrackChannel } from '../types/animator';

const Consumer = ({ onCtx }: { onCtx: (ctx: AnimatorContextType) => void }) => {
  const ctx = useAnimator();
  useEffect(() => { onCtx(ctx); });
  return null;
};

const POSE_CHANNELS = ['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const;

/** Frames and container composition are float math — compare with exact tolerance. */
const expectSamePose = (actual: Transform, expected: Transform) => {
  POSE_CHANNELS.forEach((channel) => expect(actual[channel]).toBeCloseTo(expected[channel], 9));
};

const trackRow = (container: HTMLElement, name: string): HTMLElement => {
  const row = Array.from(container.querySelectorAll('.ue-track-group'))
    .find((group) => group.querySelector('.ue-track-name')?.textContent?.trim() === name);
  if (!row) throw new Error(`no timeline track row for ${name}`);
  return row;
};

const clickAddKeyframe = (container: HTMLElement, name: string) => {
  const button = trackRow(container, name).querySelector('button[title="Add Composite Keyframe"]');
  if (!button) throw new Error(`no + button for ${name}`);
  fireEvent.click(button);
};

const clickChannelKeyframe = (container: HTMLElement, name: string, channel: TrackChannel) => {
  const labels: Partial<Record<TrackChannel, string>> = { x: 'Location X', y: 'Location Y' };
  const button = trackRow(container, name).querySelector(`button[title="Add ${labels[channel]} keyframe"]`);
  if (!button) throw new Error(`no ${channel} keyframe button for ${name}`);
  fireEvent.click(button);
};

interface Harness {
  container: HTMLElement;
  /** The live context — reassigned on every provider render, so always re-read it. */
  ctx: () => AnimatorContextType;
  /** Create a rectangle and place it at an exact WORLD position; returns its id. */
  addRect: (name: string, x: number, y: number) => string;
  /** Exact evaluated world pose of a layer at the current frame. */
  pose: (partId: string) => Transform;
  trackOf: (partId: string) => Track;
  partOf: (partId: string) => CharacterPart;
  /** Group the given layer ids through the canonical grouping authority. */
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
  const partOf = (partId: string): CharacterPart => {
    const part = ctx().characterParts.find((candidate) => candidate.id === partId);
    if (!part) throw new Error(`no part ${partId}`);
    return part;
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
  return { container, ctx, addRect, pose, trackOf, partOf, group };
};

describe('keyframe add preserves the evaluated pose (finding F)', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem');
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('keeps an unparented rectangle in place across repeated adds', () => {
    const h = renderHarness();
    const id = h.addRect('Rect A', 300, 260);

    const before = h.pose(id);
    expect(before.y).toBeCloseTo(260, 9);
    act(() => { clickAddKeyframe(h.container, 'Rect A'); });
    expectSamePose(h.pose(id), before);
    act(() => { clickAddKeyframe(h.container, 'Rect A'); });
    act(() => { clickAddKeyframe(h.container, 'Rect A'); });
    expectSamePose(h.pose(id), before);
  });

  it('keeps the second sibling rectangle — and its sibling — in place', () => {
    const h = renderHarness();
    const first = h.addRect('Rect A', 120, 130);
    const second = h.addRect('Rect B', 420, 340);

    const firstBefore = h.pose(first);
    const secondBefore = h.pose(second);

    act(() => { clickAddKeyframe(h.container, 'Rect B'); });
    act(() => { clickAddKeyframe(h.container, 'Rect B'); });

    expectSamePose(h.pose(second), secondBefore);
    expectSamePose(h.pose(first), firstBefore);
  });

  it('keeps a group child in place and stores its container-local pose', () => {
    const h = renderHarness();
    const a = h.addRect('Rect A', 120, 130);
    const b = h.addRect('Rect B', 420, 340);
    const groupId = h.group([a, b]);

    const groupWorld = h.pose(groupId);
    const before = h.pose(b);
    const aBefore = h.pose(a);
    const captured = worldToContainerLocal(before, groupWorld);

    // A fresh track has no channel data, so the first `+` materializes the
    // canonical transform keyframe group — it must capture the container-local
    // pose too (one canonical authored truth: no legacy composite write).
    act(() => { clickAddKeyframe(h.container, 'Rect B'); });
    expectSamePose(h.pose(b), before);
    const authoredChannels = h.trackOf(b).channels;
    expect(authoredChannels?.x?.[0].value).toBeCloseTo(captured.x, 9);
    expect(authoredChannels?.y?.[0].value).toBeCloseTo(captured.y, 9);
    expect(h.trackOf(b).keyframes).toHaveLength(0);

    // Keying one channel keeps the same container-local capture.
    act(() => { h.ctx().toggleTrackExpanded(h.trackOf(b).id); });
    act(() => { clickChannelKeyframe(h.container, 'Rect B', 'x'); });
    expect(h.trackOf(b).channels?.x?.[0].value).toBeCloseTo(captured.x, 9);
    expectSamePose(h.pose(b), before);

    act(() => { clickAddKeyframe(h.container, 'Rect B'); });
    const channels = h.trackOf(b).channels;
    expect(channels?.x?.[0].value).toBeCloseTo(captured.x, 9);
    expect(channels?.y?.[0].value).toBeCloseTo(captured.y, 9);
    expectSamePose(h.pose(b), before);

    act(() => { clickAddKeyframe(h.container, 'Rect B'); });
    expect(h.trackOf(b).channels?.x?.length).toBe(1);
    expect(h.trackOf(b).keyframes.length).toBe(0);
    expectSamePose(h.pose(b), before);
    expectSamePose(h.pose(a), aBefore);
    expectSamePose(h.pose(groupId), groupWorld);
  });

  it('is exact for a rotated and scaled relationship parent', () => {
    const h = renderHarness();
    const parent = h.addRect('Parent', 200, 150);
    const child = h.addRect('Child', 380, 300);

    act(() => {
      h.ctx().updateCurrentTransform({ rotation: 30, scaleX: 2, scaleY: 0.5 }, parent);
      h.ctx().setCharacterParts((prev) => prev.map((part) => (part.id === child ? { ...part, parentId: parent } : part)));
    });

    const before = h.pose(child);
    expect(h.partOf(child).parentId).toBe(parent);
    act(() => { clickAddKeyframe(h.container, 'Child'); });
    expectSamePose(h.pose(child), before);
    act(() => { clickAddKeyframe(h.container, 'Child'); });
    expectSamePose(h.pose(child), before);
  });

  it('writes only the active sequence and leaves the pose frozen there too', () => {
    const h = renderHarness();
    const id = h.addRect('Rect A', 260, 180);

    act(() => { h.ctx().setActiveTemplateId('Outro'); });
    const before = h.pose(id);
    act(() => { clickAddKeyframe(h.container, 'Rect A'); });

    expectSamePose(h.pose(id), before);
    // Fresh layer → the canonical transform keyframe group, tagged with the
    // active sequence on every channel it materializes.
    for (const channel of POSE_CHANNELS) {
      expect(h.trackOf(id).channels?.[channel]?.[0].templateId, channel).toBe('Outro');
    }
    expect(h.trackOf(id).keyframes).toHaveLength(0);
    act(() => { h.ctx().toggleTrackExpanded(h.trackOf(id).id); });
    act(() => { clickChannelKeyframe(h.container, 'Rect A', 'x'); });
    const xKfs = h.trackOf(id).channels?.x ?? [];
    expect(xKfs.length).toBe(1);
    expect(xKfs[0].templateId).toBe('Outro');
    expectSamePose(h.pose(id), before);

    // The Sequence channels stay untouched by the Outro authoring.
    act(() => { h.ctx().setActiveTemplateId('Sequence'); });
    expect((h.trackOf(id).channels?.x ?? []).length).toBe(1);
    expect(h.trackOf(id).keyframes).toHaveLength(0);
  });

  it('does not drift across repeated add/remove cycles', () => {
    const h = renderHarness();
    const a = h.addRect('Rect A', 180, 160);
    const id = h.addRect('Rect B', 320, 240);
    h.group([a, id]);
    const before = h.pose(id);

    for (let cycle = 0; cycle < 3; cycle += 1) {
      act(() => { clickAddKeyframe(h.container, 'Rect B'); });
      expectSamePose(h.pose(id), before);
      act(() => {
        const track = h.trackOf(id);
        const channels = track.channels;
        for (const channel of POSE_CHANNELS) {
          for (const keyframe of channels?.[channel] ?? []) {
            h.ctx().deletePropertyKeyframe(track.id, channel, keyframe.id);
          }
        }
        for (const keyframe of h.trackOf(id).keyframes) {
          h.ctx().deleteKeyframe(track.id, keyframe.id);
        }
      });
      expectSamePose(h.pose(id), before);
      expect(h.trackOf(id).channels?.x?.length ?? 0).toBe(0);
      expect(h.trackOf(id).keyframes.length).toBe(0);
    }
  });

  it('preserves the pose when x and y are keyed independently', () => {
    const h = renderHarness();
    const a = h.addRect('Rect A', 120, 130);
    const b = h.addRect('Rect B', 400, 320);
    h.group([a, b]);
    act(() => { h.ctx().toggleTrackExpanded(h.trackOf(b).id); });

    const before = h.pose(b);
    act(() => { clickChannelKeyframe(h.container, 'Rect B', 'x'); });
    expect(h.trackOf(b).channels?.y?.length ?? 0).toBe(0);
    expectSamePose(h.pose(b), before);
    act(() => { clickChannelKeyframe(h.container, 'Rect B', 'y'); });
    expectSamePose(h.pose(b), before);
  });
});
