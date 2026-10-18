/**
 * K3 — the outliner's Mask group.
 *
 * Per-mask animation channels (`maskId:opacity|feather|expansion|path`) have
 * always lived on the track and rendered lanes; the outliner tree, however,
 * never showed them, so they could not be armed, navigated, or disarmed from
 * the property strip. K3 adds the collapsible Mask group (rows per mask
 * property, after Trim Path) and moves the mask lanes to sit AFTER the trim
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
  stopwatch: (channel: string) => HTMLElement;
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
  const stopwatch = (channel: string): HTMLElement => {
    const element = container.querySelector(`button.ue-channel-stopwatch[data-property-channel="${channel}"]`);
    if (!element) throw new Error(`no stopwatch for ${channel}`);
    return element as HTMLElement;
  };
  return {
    container,
    ctx,
    maskKeys: () => Object.keys(ctx().tracks[0].maskChannels ?? {}),
    rows: () => [...container.querySelectorAll('.ue-channel-row')].map((node) => node.getAttribute('data-property-channel') ?? ''),
    headers: () => [...container.querySelectorAll('.ue-subgroup-header')].map((node) => node.textContent ?? ''),
    groupHeader,
    stopwatch,
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

const maskRowKeys = ['m1:opacity', 'm1:feather', 'm1:expansion', 'm1:path', 'm2:opacity', 'm2:feather', 'm2:expansion', 'm2:path'];

describe('K3 — Mask group in the outliner', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem');
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('appears after Trim Path when the layer owns masks, and never without them', () => {
    const h = renderHarness();
    seedMaskedLayer(h);

    const headers = h.headers();
    const trimIndex = headers.findIndex((text) => text.includes('Trim Path'));
    const maskIndex = headers.findIndex((text) => text.includes('Mask'));
    expect(maskIndex).toBeGreaterThan(-1);
    expect(trimIndex).toBeGreaterThan(-1);
    expect(maskIndex).toBeGreaterThan(trimIndex);

    // A maskless layer shows no Mask group at all.
    const plain = renderHarness();
    seedMaskedLayer(plain);
    act(() => {
      plain.ctx().setCharacterParts((prev: CharacterPart[]) => prev.map((p) => ({ ...p, masks: [] })));
    });
    expect(plain.rows().filter((key) => key.includes(':'))).toHaveLength(0);
    expect(plain.headers().some((text) => text.includes('Mask'))).toBe(false);
  });

  it('is collapsed by default and lists every mask property row once expanded', () => {
    const h = renderHarness();
    seedMaskedLayer(h);

    expect(h.rows().filter((key) => key.includes(':'))).toHaveLength(0);
    act(() => { fireEvent.click(h.groupHeader('Mask')); });
    for (const key of maskRowKeys) {
      expect(h.rows()).toContain(key);
    }
    expect(h.rows().filter((key) => key.includes(':'))).toHaveLength(8);
  });

  it('arms a mask scalar through the stopwatch, recording its current value', () => {
    const h = renderHarness();
    seedMaskedLayer(h);
    act(() => { fireEvent.click(h.groupHeader('Mask')); });

    const stopwatch = h.stopwatch('m1:feather');
    expect(stopwatch.getAttribute('data-animation-state')).toBe('off');
    act(() => { fireEvent.click(stopwatch); });

    const keys = h.ctx().tracks[0].maskChannels?.['m1:feather'] ?? [];
    expect(keys).toHaveLength(1);
    expect(keys[0].frame).toBe(h.ctx().currentFrame);
    expect(h.stopwatch('m1:feather').getAttribute('data-animation-state')).toBe('keyed');
  });

  it('disarming a mask channel confirms once and clears the keys (D2 parity)', () => {
    const h = renderHarness();
    seedMaskedLayer(h);
    act(() => { fireEvent.click(h.groupHeader('Mask')); });
    act(() => { fireEvent.click(h.stopwatch('m2:opacity')); });
    expect(h.maskKeys()).toContain('m2:opacity');

    act(() => { fireEvent.click(h.stopwatch('m2:opacity')); });
    const dialog = document.querySelector('.confirmation-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('M2');
    act(() => { fireEvent.click(document.querySelector('.confirmation-dialog-confirm') as HTMLElement); });
    expect(h.ctx().tracks[0].maskChannels?.['m2:opacity'] ?? []).toHaveLength(0);
    expect(h.stopwatch('m2:opacity').getAttribute('data-animation-state')).toBe('off');
  });

  it('the lane band mirrors the tree: mask lanes sit after the trim lanes', () => {
    const h = renderHarness();
    const trackId = seedMaskedLayer(h);
    // Give both families a key so their lanes render.
    act(() => { h.ctx().addPropertyKeyframe(trackId, 'trimPathEnd', 5, 0.5, 'linear'); });
    act(() => { h.ctx().addPropertyKeyframe(trackId, 'm1:feather' as AnimationChannel, 5, 0.5, 'linear'); });

    const laneChannels = [...h.container.querySelectorAll('[data-lane-channel]')]
      .map((node) => node.getAttribute('data-lane-channel') ?? '');
    const trimIndex = laneChannels.indexOf('trimPathEnd');
    const maskIndex = laneChannels.indexOf('m1:feather');
    expect(trimIndex).toBeGreaterThan(-1);
    expect(maskIndex).toBeGreaterThan(trimIndex);
  });
});
