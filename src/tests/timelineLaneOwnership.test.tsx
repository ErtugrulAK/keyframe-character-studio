/**
 * Manual QA Round 1 — finding G: no orphan property row in the timeline.
 *
 * Observed: an expanded layer showed a lone `Transform` row whose owner was
 * unclear — the user could not tell which layer or group the property group
 * belonged to.
 *
 * These tests drive the real outliner rows through the real store and assert
 * that every property row is owned by exactly one layer: the property block
 * and each of its headers carry the owning part id, the Transform header names
 * its layer, and a group child's properties belong to the child — never to the
 * container above it.
 */

import React, { useEffect } from 'react';
import { render, act, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { SequencerTimeline } from '../components/Timeline/SequencerTimeline';
import { createLayerGroup } from '../utils/layerGrouping';
import { generateId } from '../utils/idGenerator';
import type { CharacterPart } from '../types/animator';

const Consumer = ({ onCtx }: { onCtx: (ctx: AnimatorContextType) => void }) => {
  const ctx = useAnimator();
  useEffect(() => { onCtx(ctx); });
  return null;
};

interface Harness {
  container: HTMLElement;
  ctx: () => AnimatorContextType;
  addRect: (name: string) => string;
  group: (ids: string[]) => string;
  partId: (name: string) => string;
  expand: (name: string) => void;
  trackRow: (name: string) => HTMLElement;
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
  const partId = (name: string): string => {
    const part = ctx().characterParts.find((candidate: CharacterPart) => candidate.name === name);
    if (!part) throw new Error(`no layer named ${name}`);
    return part.id;
  };
  const addRect = (name: string): string => {
    act(() => { ctx().addCustomPart('custom_rect', name); });
    return partId(name);
  };
  const trackRow = (name: string): HTMLElement => {
    const row = Array.from(container.querySelectorAll('.ue-track-group'))
      .find((group) => group.querySelector('.ue-track-name')?.textContent?.trim() === name);
    if (!row) throw new Error(`no timeline track row for ${name}`);
    return row as HTMLElement;
  };
  const expand = (name: string): void => {
    const button = trackRow(name).querySelector('button[title="Expand properties"]');
    if (!button) throw new Error(`no expand button for ${name}`);
    act(() => { fireEvent.click(button); });
  };
  const group = (ids: string[]): string => {
    const outcome = createLayerGroup(ctx().characterParts, ctx().tracks, ids, {
      groupId: generateId('group'),
      trackId: generateId('track'),
      name: 'Group 1',
      worldOf: (id) => ctx().getComputedTransform(id, ctx().currentFrame),
    });
    if (!outcome.ok) throw new Error(outcome.reason);
    act(() => {
      ctx().setCharacterParts(outcome.parts);
      ctx().setTracks(outcome.tracks);
    });
    return outcome.groupId;
  };
  return { container, ctx, addRect, group, partId, expand, trackRow };
};

describe('timeline property-row ownership (finding G)', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem');
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('binds the whole property block, and every row in it, to its own layer', () => {
    const h = renderHarness();
    const first = h.addRect('Rect A');
    const second = h.addRect('Rect B');
    h.expand('Rect A');

    const block = h.trackRow('Rect A').querySelector('.ue-channel-group') as HTMLElement;
    expect(block.getAttribute('data-owner-part-id')).toBe(first);
    expect(block.getAttribute('data-owner-name')).toBe('Rect A');
    expect(block.getAttribute('aria-label')).toBe('Properties of Rect A');

    const header = block.querySelector('.ue-subgroup-header') as HTMLElement;
    expect(header.getAttribute('data-owner-part-id')).toBe(first);
    expect(header.getAttribute('aria-label')).toBe('Position properties of Rect A');

    const owners = [...block.querySelectorAll('.ue-channel-row')]
      .map((row) => row.getAttribute('data-owner-part-id'));
    expect(owners.length).toBeGreaterThan(0);
    expect(owners.every((owner) => owner === first)).toBe(true);
    expect(owners).not.toContain(second);

    // The lane side of the same layer is tied to the same owner.
    const lane = h.container.querySelector(`.ue-lane-group[data-owner-part-id="${first}"]`);
    expect(lane).toBeTruthy();
    expect(h.container.querySelector(`.ue-lane-group[data-owner-part-id="${second}"]`)).toBeTruthy();
  });

  it('keeps a group child’s properties owned by the child, not the container', () => {
    const h = renderHarness();
    const a = h.addRect('Rect A');
    const b = h.addRect('Rect B');
    const containerId = h.group([a, b]);
    h.expand('Rect A');

    const childBlock = h.trackRow('Rect A').querySelector('.ue-channel-group') as HTMLElement;
    expect(childBlock.getAttribute('data-owner-part-id')).toBe(a);
    expect(childBlock.querySelectorAll(`[data-owner-part-id="${containerId}"]`).length).toBe(0);
    // The child still declares its own parent, so the nesting is explicit.
    expect(h.ctx().characterParts.find((part) => part.id === a)?.parentId).toBe(containerId);
  });

  it('names the owner on every header and keeps it while the group collapses', () => {
    const h = renderHarness();
    const id = h.addRect('Rect A');
    h.expand('Rect A');

    const block = h.trackRow('Rect A').querySelector('.ue-channel-group') as HTMLElement;
    const labels = [...block.querySelectorAll('[aria-label]')].map((node) => node.getAttribute('aria-label'));
    expect(labels.filter((label) => label?.includes('properties of'))).toEqual([
      'Position properties of Rect A',
      'Scale properties of Rect A',
      'Trim Path properties of Rect A',
    ]);

    // R4-06 — the first header under the layer is Position: there is no
    // `Transform` wrapper row to collapse, and the group itself still names its
    // owner when its rows are hidden.
    const header = block.querySelector('.ue-subgroup-header') as HTMLElement;
    expect(header.getAttribute('aria-expanded')).toBe('true');

    // Enter collapses the disclosure the same way a click does, and the owner
    // name does not disappear with the rows underneath it.
    act(() => { fireEvent.keyDown(header, { key: 'Enter' }); });
    const collapsed = h.trackRow('Rect A').querySelector('.ue-channel-group') as HTMLElement;
    expect(collapsed.getAttribute('data-owner-part-id')).toBe(id);
    expect(collapsed.getAttribute('data-owner-name')).toBe('Rect A');
    expect(collapsed.getAttribute('aria-label')).toBe('Properties of Rect A');
  });
});
