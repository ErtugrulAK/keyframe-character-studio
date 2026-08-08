/**
 * M6 — TrackLane canonical channels render tests
 *
 * Verifies the parent-lane keyframe model:
 *   - channel-only tracks render ONE diamond per frame (frame-group UX)
 *   - same-frame multi-channel does not duplicate timeline points
 *   - template filtering keeps Sequence/Outro apart
 *   - legacy-only tracks keep the legacy composite render
 *   - empty/undefined channels do not crash
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { TrackLane } from '../components/Timeline/TrackLane';
import type { Track, TrackChannel, PropertyKeyframe, Keyframe } from '../types/animator';

function makeTrack(opts?: {
  keyframes?: Keyframe[];
  channels?: Partial<Record<TrackChannel, PropertyKeyframe[]>>;
}): Track {
  return {
    id: 'trk_1',
    partId: 'part_1',
    name: 'T1',
    color: '#f00',
    keyframes: opts?.keyframes || [],
    channels: {
      x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
      maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
      ...(opts?.channels || {}),
    },
    visible: true,
    locked: false,
  } as Track;
}

const pk = (id: string, frame: number, value: number, templateId = 'Sequence'): PropertyKeyframe =>
  ({ id, frame, value, easing: 'linear', templateId }) as PropertyKeyframe;

const lkf = (id: string, frame: number): Keyframe =>
  ({ id, frame, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' }) as Keyframe;

function renderLane(track: Track) {
  const props = {
    track,
    isSelected: false,
    selectedKeyframeId: null,
    frameWidth: 10,
    totalFrames: 120,
    activeTemplateId: 'Sequence',
    isGroupExpanded: () => true,
    onSelectKeyframe: vi.fn(),
    onSelectPart: vi.fn(),
    onSetFrame: vi.fn(),
    onStartDragKf: vi.fn(),
    onStartDragPKf: vi.fn(),
    onHoverKf: vi.fn(),
    onDeleteKeyframe: vi.fn(),
    onDeletePropertyKeyframe: vi.fn(),
  };
  const utils = render(<TrackLane {...props} />);
  return { ...utils, props };
}

describe('M6 — TrackLane canonical render', () => {

  test('1: channel-only track shows one diamond per frame (collapsed parent lane)', () => {
    const track = makeTrack({
      channels: {
        x: [pk('x0', 10, 1), pk('x1', 60, 5)],
        y: [pk('y0', 60, 9)],
      },
    });
    const { container } = renderLane(track);
    const diamonds = container.querySelectorAll('.keyframe-diamond');
    expect(diamonds.length).toBe(2); // frames 10 and 60 — NOT 3 (channels)
  });

  test('2: 6 channels at the same frame → single diamond', () => {
    const track = makeTrack({
      channels: {
        x: [pk('x0', 30, 1)], y: [pk('y0', 30, 2)],
        rotation: [pk('r0', 30, 3)], scaleX: [pk('sx0', 30, 4)],
        scaleY: [pk('sy0', 30, 5)], opacity: [pk('o0', 30, 6)],
      },
    });
    const { container } = renderLane(track);
    expect(container.querySelectorAll('.keyframe-diamond').length).toBe(1);
  });

  test('3: different frames appear as separate diamonds', () => {
    const track = makeTrack({
      channels: { x: [pk('x0', 0, 1), pk('x1', 30, 2), pk('x2', 90, 3)] },
    });
    const { container } = renderLane(track);
    expect(container.querySelectorAll('.keyframe-diamond').length).toBe(3);
  });

  test('4: template filtering — only active template diamonds render', () => {
    const track = makeTrack({
      channels: {
        x: [pk('x_seq', 10, 1, 'Sequence'), pk('x_outro', 50, 9, 'Outro')],
      },
    });
    const { container } = renderLane(track);
    expect(container.querySelectorAll('.keyframe-diamond').length).toBe(1);
    expect(container.querySelector('.keyframe-diamond')?.getAttribute('title')).toContain('Frame: 10');
  });

  test('5: Sequence and Outro at same frame do not merge', () => {
    const track = makeTrack({
      channels: {
        x: [pk('x_seq', 40, 1, 'Sequence'), pk('x_outro', 40, 9, 'Outro')],
      },
    });
    const { container } = renderLane(track);
    // active template = Sequence → only the Sequence diamond
    expect(container.querySelectorAll('.keyframe-diamond').length).toBe(1);
  });

  test('6: channel keyframe click selects representative id and jumps frame', () => {
    const track = makeTrack({
      channels: { x: [pk('x0', 25, 1)] },
    });
    const { container, props } = renderLane(track);
    fireEvent.click(container.querySelector('.keyframe-diamond')!);
    expect(props.onSelectKeyframe).toHaveBeenCalledWith('x0');
    expect(props.onSetFrame).toHaveBeenCalledWith(25);
  });

  test('7: right-click deletes all channel keyframes at that frame', () => {
    const track = makeTrack({
      channels: {
        x: [pk('x0', 25, 1)], y: [pk('y0', 25, 2)],
      },
    });
    const { container, props } = renderLane(track);
    fireEvent.contextMenu(container.querySelector('.keyframe-diamond')!);
    expect(props.onDeletePropertyKeyframe).toHaveBeenCalledWith('trk_1', 'x', 'x0');
    expect(props.onDeletePropertyKeyframe).toHaveBeenCalledWith('trk_1', 'y', 'y0');
  });

  test('8: legacy-only track keeps legacy composite render', () => {
    const track = makeTrack({
      keyframes: [lkf('kf0', 0), lkf('kf1', 60)],
    });
    const { container } = renderLane(track);
    expect(container.querySelectorAll('.keyframe-diamond').length).toBe(2);
    // legacy span bars still render
    expect(container.querySelectorAll('.keyframe-span-bar').length).toBe(1);
  });

  test('9: empty/undefined channels do not crash', () => {
    const empty = makeTrack({});
    const { container: c1 } = renderLane(empty);
    expect(c1.querySelectorAll('.keyframe-diamond').length).toBe(0);

    const noChannels = { id: 'trk_2', partId: 'part_2', name: 'T2', color: '#0f0', keyframes: [], visible: true, locked: false } as Track;
    const { container: c2 } = renderLane(noChannels);
    expect(c2.querySelectorAll('.keyframe-diamond').length).toBe(0);
  });
});
