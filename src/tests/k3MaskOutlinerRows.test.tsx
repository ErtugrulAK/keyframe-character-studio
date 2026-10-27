/**
 * K3 — the outliner's Mask group.
 *
 * Per-mask animation channels (`maskId:opacity|feather|expansion|path`) have
 * always lived on the track and rendered lanes; the outliner tree, however,
 * never showed them, so they could not be armed, navigated, or disarmed from
 * the property strip. K3 adds the collapsible mask rows (C7: one group per
 * mask, named by the mask, after Trim Paths) and moves the mask lanes to sit AFTER the trim
 * lanes so the tree and the band stay row-for-row aligned (R4-06). The
 * stopwatch semantics are exactly K1's (D2): arm records the current value,
 * disarm confirms and collapses to the evaluated static.
 */

import { useEffect } from 'react';
import { render, act, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { SequencerTimeline } from '../components/Timeline/SequencerTimeline';
import type { AnimationChannel, CharacterPart, LayerMask } from '../types/animator';

const Consumer = ({ onCtx }: { onCtx: (ctx: AnimatorContextType) => void }) => {
  const ctx = useAnimator();
  useEffect(() => { onCtx(ctx); });
  return null;
};

interface Harness {
  container: HTMLElement;
  ctx: () => AnimatorContextType;
  maskKeys: () => string[];
  rows: () => string[];
  headers: () => string[];
  groupHeader: (label: string) => HTMLElement;
  /** C10 — the property row (it carries the animation state; no stopwatch). */
  channelRow: (channel: string) => HTMLElement;
  /** C10 — the arm / disarm request: the row's "+" when off, its menu when animated. */
  toggleAnimation: (channel: string) => void;
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
  const groupHeader = (label: string): HTMLElement => {
    const element = [...container.querySelectorAll('.ue-subgroup-header')]
      .find((node) => node.textContent?.includes(label));
    if (!element) throw new Error(`no group header for ${label}`);
    return element as HTMLElement;
  };
  const channelRow = (channel: string): HTMLElement => {
    const element = container.querySelector(`.ue-channel-row[data-property-channel="${channel}"]`);
    if (!element) throw new Error(`no property row for ${channel}`);
    return element as HTMLElement;
  };
  const toggleAnimation = (channel: string) => {
    const row = channelRow(channel);
    if (row.getAttribute('data-animation-state') === 'off') {
      fireEvent.click(row.querySelector('button.track-add-kf-btn') as HTMLElement);
      return;
    }
    fireEvent.contextMenu(row);
    const item = [...document.querySelectorAll('[role="menuitem"]')].find((node) => node.textContent === 'Remove all keyframes');
    if (!item) throw new Error('no "Remove all keyframes" menu item');
    fireEvent.click(item);
  };
  return {
    container,
    ctx,
    maskKeys: () => Object.keys(ctx().tracks[0].maskChannels ?? {}),
    rows: () => [...container.querySelectorAll('.ue-channel-row')].map((node) => node.getAttribute('data-property-channel') ?? ''),
    headers: () => [...container.querySelectorAll('.ue-subgroup-header')].map((node) => node.textContent ?? ''),
    groupHeader,
    channelRow,
    toggleAnimation,
  };
};

const twoMasks = (): LayerMask[] => [
  { id: 'm1', name: 'M1', mode: 'add', path: { version: 1, coordinateSpace: 'normalized', points: [], closed: false } },
  { id: 'm2', name: 'M2', mode: 'add', path: { version: 1, coordinateSpace: 'normalized', points: [], closed: false } },
];

const seedMaskedLayer = (h: Harness): string => {
  act(() => { h.ctx().addCustomPart('custom_rect', 'Rect A'); });
  const trackId = h.ctx().tracks[0].id;
  const partId = h.ctx().tracks[0].partId;
  act(() => {
    h.ctx().setCharacterParts((prev: CharacterPart[]) => prev.map((p) => (p.id === partId ? { ...p, masks: twoMasks() } : p)));
  });
  act(() => { fireEvent.click(h.container.querySelector('.ue-expand-btn') as HTMLElement); });
  return trackId;
};

const maskRowKeys = (id: string) => [`${id}:path`, `${id}:feather`, `${id}:opacity`, `${id}:expansion`];

describe('K3 — Mask group in the outliner', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem');
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  // C7 — one group per mask, named by the mask, after the layer properties
  // (and after Trim Paths when the layer uses it), in the layer's mask order.
  it('lists one group per mask, after the layer properties, and none without masks', () => {
    const h = renderHarness();
    seedMaskedLayer(h);

    expect(h.headers()).toEqual(['Position', 'Scale', 'M1', 'M2']);

    const partId = h.ctx().tracks[0].partId;
    act(() => {
      h.ctx().setCharacterParts((prev: CharacterPart[]) => prev.map((p) => (p.id === partId ? { ...p, trimPathEnabled: true } : p)));
    });
    expect(h.headers()).toEqual(['Position', 'Scale', 'Trim Paths', 'M1', 'M2']);

    // A maskless layer shows no mask group at all.
    const plain = renderHarness();
    seedMaskedLayer(plain);
    act(() => {
      plain.ctx().setCharacterParts((prev: CharacterPart[]) => prev.map((p) => ({ ...p, masks: [] })));
    });
    expect(plain.rows().filter((key) => key.includes(':'))).toHaveLength(0);
    expect(plain.headers()).toEqual(['Position', 'Scale']);
  });

  it('each mask group is collapsed by default and lists Path, Feather, Opacity, Expansion once opened', () => {
    const h = renderHarness();
    seedMaskedLayer(h);

    expect(h.rows().filter((key) => key.includes(':'))).toHaveLength(0);
    act(() => { fireEvent.click(h.groupHeader('M1')); });
    expect(h.rows().filter((key) => key.includes(':'))).toEqual(maskRowKeys('m1'));
    act(() => { fireEvent.click(h.groupHeader('M2')); });
    expect(h.rows().filter((key) => key.includes(':'))).toEqual([...maskRowKeys('m1'), ...maskRowKeys('m2')]);
    const labels = [...h.container.querySelectorAll('.ue-channel-row[data-property-channel^="m1:"]')].map((node) => node.textContent?.trim());
    expect(labels).toEqual(['Path', 'Feather', 'Opacity', 'Expansion']);
  });

  it('arms a mask scalar through its "+", recording its current value', () => {
    const h = renderHarness();
    seedMaskedLayer(h);
    act(() => { fireEvent.click(h.groupHeader('M1')); });

    expect(h.channelRow('m1:feather').getAttribute('data-animation-state')).toBe('off');
    h.toggleAnimation('m1:feather');

    const keys = h.ctx().tracks[0].maskChannels?.['m1:feather'] ?? [];
    expect(keys).toHaveLength(1);
    expect(keys[0].frame).toBe(h.ctx().currentFrame);
    expect(h.channelRow('m1:feather').getAttribute('data-animation-state')).toBe('keyed');
  });

  it('C10: the "+" of a mask PATH row arms the path; once animated it is inert (path keys come from editing)', () => {
    const h = renderHarness();
    seedMaskedLayer(h);
    act(() => { fireEvent.click(h.groupHeader('M1')); });
    const plus = () => h.channelRow('m1:path').querySelector('button.track-add-kf-btn') as HTMLButtonElement;
    expect(plus().disabled).toBe(false);
    act(() => { fireEvent.click(plus()); });
    expect(h.ctx().tracks[0].maskPathChannels?.['m1:path']).toHaveLength(1);
    expect(h.channelRow('m1:path').getAttribute('data-animation-state')).toBe('keyed');
    expect(plus().disabled).toBe(true);
  });

  it('disarming a mask channel confirms once and clears the keys (D2 parity)', () => {
    const h = renderHarness();
    seedMaskedLayer(h);
    act(() => { fireEvent.click(h.groupHeader('M2')); });
    h.toggleAnimation('m2:opacity');
    expect(h.maskKeys()).toContain('m2:opacity');

    h.toggleAnimation('m2:opacity');
    const dialog = document.querySelector('.confirmation-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('M2');
    act(() => { fireEvent.click(document.querySelector('.confirmation-dialog-confirm') as HTMLElement); });
    expect(h.ctx().tracks[0].maskChannels?.['m2:opacity'] ?? []).toHaveLength(0);
    expect(h.channelRow('m2:opacity').getAttribute('data-animation-state')).toBe('off');
  });

  it('the lane band mirrors the tree row for row: mask lanes sit after the trim lanes', () => {
    const h = renderHarness();
    const trackId = seedMaskedLayer(h);
    // Give both families a key so their lanes render; Trim keys list Trim Paths.
    act(() => { h.ctx().addPropertyKeyframe(trackId, 'trimPathEnd', 5, 0.5, 'linear'); });
    act(() => { h.ctx().addPropertyKeyframe(trackId, 'm1:feather' as AnimationChannel, 5, 0.5, 'linear'); });
    act(() => { fireEvent.click(h.groupHeader('M1')); });

    const laneChannels = [...h.container.querySelectorAll('[data-lane-channel]')]
      .map((node) => node.getAttribute('data-lane-channel') ?? '');
    const trimIndex = laneChannels.indexOf('trimPathEnd');
    const maskIndex = laneChannels.indexOf('m1:feather');
    expect(trimIndex).toBeGreaterThan(-1);
    expect(maskIndex).toBeGreaterThan(trimIndex);
    // Tree row N and lane N are the same property.
    expect(laneChannels).toEqual(h.rows());
  });
});
