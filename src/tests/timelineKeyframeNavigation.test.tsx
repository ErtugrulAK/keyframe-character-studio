import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TrackOutlinerRow } from '../components/Timeline/TrackOutlinerRow';
import { makeEmptyChannels } from '../utils/defaults';
import type { CharacterPart, PropertyKeyframe, Track, TrackChannel } from '../types/animator';

/**
 * Manual QA Round 3.
 *
 * R3-05/R3-06 — the property tree reads Layer > Transform > { Position > {X, Y},
 * Rotation, Scale > {X, Y}, Opacity } and Layer > Trim Path > {Start, End,
 * Offset}, and no property row carries a bare numeric counter.
 *
 * R3-07 — the layer row navigates its own keyframes: [◀][+][▶] with the same +
 * action in the middle, both arrows disabled when the layer has nothing on that
 * side, and both moves are PLAYHEAD moves — never a document write.
 */

const key = (id: string, frameNumber: number, value: number, templateId = 'Sequence'): PropertyKeyframe => ({
  id, frame: frameNumber, value, easing: 'linear', templateId,
});

const part = (id: string, name: string): CharacterPart => ({
  id,
  name,
  type: 'custom_rect',
  zIndex: 1,
  fillColor: '#336699',
  strokeColor: '#101218',
  width: 100,
  height: 100,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
});

function makeTrack(channels: Partial<Record<TrackChannel, PropertyKeyframe[]>>, expanded = true): Track {
  return {
    id: 't1',
    partId: 'p1',
    name: 'Body',
    color: '#22d3ee',
    keyframes: [],
    channels: { ...makeEmptyChannels(), ...channels },
    visible: true,
    locked: false,
    expanded,
  };
}

const renderRow = (track: Track, currentFrame: number) => {
  const onJumpToFrame = vi.fn();
  const onAddKeyframe = vi.fn();
  const onAddChannelKeyframe = vi.fn();
  const utils = render(
    <TrackOutlinerRow
      track={track}
      parts={[part('p1', 'Body')]}
      isChildLayer={false}
      isSelected
      editingPartId={null}
      editingNameValue=""
      currentFrame={currentFrame}
      activeTemplateId="Sequence"
      onSelect={vi.fn()}
      onStartEdit={vi.fn()}
      onEnterCommit={vi.fn()}
      onCancelEdit={vi.fn()}
      onToggleExpand={vi.fn()}
      onToggleEditVisible={vi.fn()}
      onToggleVisible={vi.fn()}
      onToggleLock={vi.fn()}
      onAddKeyframe={onAddKeyframe}
      onAddChannelKeyframe={onAddChannelKeyframe}
      onJumpToFrame={onJumpToFrame}
      isGroupExpanded={(_, defaultVal) => defaultVal ?? true}
      onToggleSubGroup={vi.fn()}
    />,
  );
  return { ...utils, onJumpToFrame, onAddKeyframe, onAddChannelKeyframe };
};

describe('R3-05/R3-06 — the timeline property tree', () => {
  it('renders the animation hierarchy with named parents and leaves', () => {
    const view = renderRow(
      makeTrack({ x: [key('x0', 0, 10)], rotation: [key('r0', 0, 0)], trimPathEnd: [key('t0', 0, 1)] }),
      0,
    );

    expect(screen.getByRole('button', { name: 'Position properties of Body' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Trim Path properties of Body' })).toBeTruthy();
    // R4-06 — `Transform` is the internal model name, not a level the user reads
    // through: no wrapper row, and no row that only restates the layer.
    expect(screen.queryByRole('button', { name: 'Transform property group of Body' })).toBeNull();

    // Linearised tree order: the leaves sit under the parent that names them.
    const tree = [...view.container.querySelectorAll('.ue-subgroup-header, .ue-channel-row')]
      .map((row) => row.textContent?.trim());
    expect(tree).toEqual([
      'Position',
      'X',
      'Y',
      'Rotation',
      'Scale',
      'Opacity',
      'Trim Path',
      'Start',
      'End',
      'Offset',
    ]);
  });

  it('keeps Scale collapsed until the user opens it', () => {
    const view = renderRow(makeTrack({ scaleX: [key('s0', 0, 1)] }), 0);
    expect(view.container.querySelector('[data-property-channel="scaleX"]')).toBeNull();
    expect(view.container.querySelector('[data-property-channel="x"]')).not.toBeNull();
  });

  it('states the property without a numeric counter badge', () => {
    const view = renderRow(makeTrack({ x: [key('x0', 0, 10), key('x9', 9, 20)] }), 0);
    expect(view.container.querySelectorAll('.ue-kf-count')).toHaveLength(0);
    // The key count stays discoverable on the leaf's own add action.
    expect(screen.getByRole('button', { name: 'Add Location X keyframe' }).getAttribute('title'))
      .toBe('Add Location X keyframe');
    expect(view.container.querySelector('[data-property-channel="x"] .ue-channel-label')?.getAttribute('title'))
      .toBe('Location X — 2 keyframes');
  });
});

describe('R3-07 — per-layer keyframe navigation', () => {
  it('jumps to the nearest earlier and later keyframe across the layer channels', () => {
    const view = renderRow(makeTrack({ x: [key('x0', 0, 10), key('x12', 12, 20)], opacity: [key('o30', 30, 1)] }), 12);

    const previous = screen.getByRole('button', { name: 'Previous keyframe of Body, frame 0' });
    const next = screen.getByRole('button', { name: 'Next keyframe of Body, frame 30' });
    expect(previous).not.toBeDisabled();
    expect(next).not.toBeDisabled();

    fireEvent.click(next);
    expect(view.onJumpToFrame).toHaveBeenCalledWith(30);
    fireEvent.click(previous);
    expect(view.onJumpToFrame).toHaveBeenCalledWith(0);
  });

  it('disables the arrow with no candidate on that side instead of guessing', () => {
    const view = renderRow(makeTrack({ x: [key('x0', 0, 10), key('x12', 12, 20)] }), 0);

    expect(screen.getByRole('button', { name: 'Previous keyframe of Body (none)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next keyframe of Body, frame 12' })).not.toBeDisabled();

    const atEnd = renderRow(makeTrack({ x: [key('x0', 0, 10), key('x12', 12, 20)] }), 12);
    expect(screen.getByRole('button', { name: 'Next keyframe of Body (none)' })).toBeDisabled();
    expect(view.onJumpToFrame).not.toHaveBeenCalled();
    expect(atEnd.onJumpToFrame).not.toHaveBeenCalled();
  });

  it('navigates without touching the animation: no keyframe is added or edited', () => {
    const view = renderRow(makeTrack({ x: [key('x0', 0, 10), key('x12', 12, 20)] }), 4);

    fireEvent.click(screen.getByRole('button', { name: 'Next keyframe of Body, frame 12' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous keyframe of Body, frame 0' }));

    expect(view.onJumpToFrame.mock.calls).toEqual([[12], [0]]);
    expect(view.onAddKeyframe).not.toHaveBeenCalled();
    expect(view.onAddChannelKeyframe).not.toHaveBeenCalled();
  });

  it('never offers a frame of another sequence', () => {
    renderRow(makeTrack({ x: [key('x0', 0, 10), key('xOther', 40, 20, 'Outro')] }), 0);
    expect(screen.getByRole('button', { name: 'Next keyframe of Body (none)' })).toBeDisabled();
  });
});
