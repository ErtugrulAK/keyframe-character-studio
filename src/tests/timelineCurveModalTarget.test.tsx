/**
 * C-01 — Motion Curves modal writes into the SELECTED layer only.
 *
 * Renders the real SequencerTimeline inside the real AnimatorProvider and
 * reproduces the Astra scenario: layer A owns canonical x keyframes, layer B
 * owns live legacy keyframes, B is selected. Applying an easing preset must
 * change B's segment and must not touch A's canonical curve.
 */

import React, { useEffect } from 'react';
import { render, act, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnimatorProvider } from '../context/AnimatorContext';
import type { AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { SequencerTimeline } from '../components/Timeline/SequencerTimeline';
import { makeEmptyChannels } from '../utils/defaults';
import type { Track, PropertyKeyframe, Keyframe } from '../types/animator';

let context: AnimatorContextType | null = null;

const ContextCapture: React.FC = () => {
  const ctx = useAnimator();
  useEffect(() => { context = ctx; });
  return null;
};

const pk = (id: string, frame: number, value: number): PropertyKeyframe =>
  ({ id, frame, value, easing: 'linear', templateId: 'Sequence' }) as PropertyKeyframe;

const legacy = (id: string, frame: number): Keyframe =>
  ({
    id, frame,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    easing: 'linear',
  }) as Keyframe;

const canonicalA = (): Track => ({
  id: 'track_a', partId: 'part_a', name: 'A', color: '#f00',
  keyframes: [], channels: { ...makeEmptyChannels(), x: [pk('ax0', 0, 0), pk('ax30', 30, 30)] },
  visible: true, locked: false,
});

const legacyB = (): Track => ({
  id: 'track_b', partId: 'part_b', name: 'B', color: '#0f0',
  keyframes: [legacy('b0', 0), legacy('b30', 30)], channels: makeEmptyChannels(),
  visible: true, locked: false,
});

const currentTracks = (): Track[] => context!.tracks;

describe('C-01 — Motion Curves targets the selected layer', () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});
    context = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applying Ease In edits the selected legacy layer, never the canonical one', () => {
    render(
      <AnimatorProvider>
        <ContextCapture />
        <SequencerTimeline />
      </AnimatorProvider>,
    );

    act(() => { context!.setTracks([canonicalA(), legacyB()]); });
    act(() => { context!.handleSelectPart('part_b'); });
    act(() => { context!.setSelectedKeyframeId('b30'); });
    act(() => { context!.setCurrentFrame(30); });

    // Open the Motion Curves studio modal.
    fireEvent.click(screen.getByTitle('Open Expanded Pro Cubic Bezier Motion Curve Studio Modal'));

    // The modal resolves B's incoming segment (F0 → F30) — never A's.
    expect(screen.queryByText('Segment F0 → F30')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Ease In' }));

    const tracks = currentTracks();
    const a = tracks.find((t) => t.id === 'track_a')!;
    const b = tracks.find((t) => t.id === 'track_b')!;

    // A's canonical curve is untouched.
    expect(a.channels.x.find((k) => k.id === 'ax0')?.bezierControlPoints).toBeUndefined();
    expect(a.channels.x.find((k) => k.id === 'ax0')?.easing).toBe('linear');
    expect(a.channels.x.find((k) => k.id === 'ax30')?.bezierControlPoints).toBeUndefined();

    // B's legacy segment start keyframe carries the new curve.
    const b0 = b.keyframes!.find((k) => k.id === 'b0')!;
    expect(b0.easing).toBe('cubic_bezier');
    expect(b0.bezierControlPoints).toEqual([0.42, 0, 1, 1]);
    // B's segment end keyframe is untouched.
    expect(b.keyframes!.find((k) => k.id === 'b30')!.bezierControlPoints).toBeUndefined();
  });

  it('selecting another layer while the modal is open retargets the edit', () => {
    render(
      <AnimatorProvider>
        <ContextCapture />
        <SequencerTimeline />
      </AnimatorProvider>,
    );

    act(() => { context!.setTracks([canonicalA(), legacyB()]); });
    act(() => { context!.handleSelectPart('part_b'); });
    act(() => { context!.setSelectedKeyframeId('b30'); });
    act(() => { context!.setCurrentFrame(30); });

    fireEvent.click(screen.getByTitle('Open Expanded Pro Cubic Bezier Motion Curve Studio Modal'));
    expect(screen.queryByText('Segment F0 → F30')).not.toBeNull();

    // Re-selection: layer A, its own keyframe.
    act(() => { context!.handleSelectPart('part_a'); });
    act(() => { context!.setSelectedKeyframeId('ax30'); });

    fireEvent.click(screen.getByRole('button', { name: 'Ease In' }));

    const tracks = currentTracks();
    const a = tracks.find((t) => t.id === 'track_a')!;
    const b = tracks.find((t) => t.id === 'track_b')!;

    expect(a.channels.x.find((k) => k.id === 'ax0')?.bezierControlPoints).toEqual([0.42, 0, 1, 1]);
    expect(b.keyframes!.find((k) => k.id === 'b0')!.bezierControlPoints).toBeUndefined();
  });
});
