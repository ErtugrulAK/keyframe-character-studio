import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TrackLane } from '../components/Timeline/TrackLane';
import { makeEmptyChannels } from '../utils/defaults';
import type { Track, PropertyKeyframe } from '../types/animator';

/**
 * Milestone B — the timeline keyframe diamonds are keyboard operable:
 * button semantics, an accessible name with frame/property context, the
 * selected state, Enter/Space activation, and a local arrow-key focus walk.
 */

const frame = (id: string, frameNumber: number, value: number): PropertyKeyframe => ({
  id, frame: frameNumber, value, easing: 'linear',
});

function makeTrack(overrides: Partial<Track> = {}): Track {
  const channels = makeEmptyChannels();
  channels.x = [frame('x0', 0, 100), frame('x12', 12, 140), frame('x30', 30, 80)];
  return {
    id: 't1', partId: 'p1', name: 'Body', color: '#22d3ee',
    keyframes: [], channels,
    visible: true, locked: false, expanded: true,
    ...overrides,
  };
}

function renderLane(track: Track, options: { selectedKeyframeId?: string | null; expanded?: boolean } = {}) {
  const onSelectKeyframe = vi.fn();
  const onSetFrame = vi.fn();
  const onSelectPart = vi.fn();
  const utils = render(
    <TrackLane
      track={track}
      isSelected
      selectedKeyframeId={options.selectedKeyframeId ?? null}
      frameWidth={10}
      totalFrames={60}
      activeTemplateId="Sequence"
      isGroupExpanded={() => options.expanded ?? false}
      onSelectKeyframe={onSelectKeyframe}
      onSelectPart={onSelectPart}
      onSetFrame={onSetFrame}
      onStartDragKf={vi.fn()}
      onStartDragPKf={vi.fn()}
      onHoverKf={vi.fn()}
      onDeleteKeyframe={vi.fn()}
      onDeletePropertyKeyframe={vi.fn()}
      onUpdateMaskPathKeyframeFrame={vi.fn()}
      onDeleteMaskPathKeyframe={vi.fn()}
      onDuplicateKeyframeGroup={vi.fn()}
      kfClipboard={null}
      onCopyKeyframes={vi.fn()}
      onPasteKeyframes={vi.fn()}
      onFrameFromClientX={vi.fn()}
    />,
  );
  return { ...utils, onSelectKeyframe, onSetFrame, onSelectPart };
}

const diamonds = () => screen.getAllByRole('button', { name: /^Keyframe at frame/ });

describe('TrackLane keyframe diamonds — keyboard accessibility', () => {
  it('exposes each frame-group diamond as a labelled, focusable button with frame and channel context', () => {
    renderLane(makeTrack());

    const buttons = diamonds();
    expect(buttons).toHaveLength(3);
    expect(buttons[0].getAttribute('aria-label')).toBe('Keyframe at frame 0, Body, channels x, linear');
    expect(buttons[1].getAttribute('aria-label')).toContain('frame 12');
    expect(buttons.every((button) => button.getAttribute('tabindex') === '0')).toBe(true);
  });

  it('reports the selected state through aria-pressed', () => {
    renderLane(makeTrack(), { selectedKeyframeId: 'x12' });

    const selected = diamonds().filter((button) => button.getAttribute('aria-pressed') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0].getAttribute('aria-label')).toContain('frame 12');
  });

  it('activates the focused diamond with Enter and with Space', () => {
    const { onSelectKeyframe, onSetFrame } = renderLane(makeTrack());

    fireEvent.keyDown(diamonds()[1], { key: 'Enter' });
    expect(onSelectKeyframe).toHaveBeenCalledWith('x12');
    expect(onSetFrame).toHaveBeenCalledWith(12);

    onSelectKeyframe.mockClear();
    onSetFrame.mockClear();
    fireEvent.keyDown(diamonds()[2], { key: ' ' });
    expect(onSelectKeyframe).toHaveBeenCalledWith('x30');
    expect(onSetFrame).toHaveBeenCalledWith(30);
  });

  it('walks focus along the lane with the arrow keys and stops at the ends', () => {
    renderLane(makeTrack());
    const buttons = diamonds();

    buttons[0].focus();
    expect(document.activeElement).toBe(buttons[0]);

    fireEvent.keyDown(buttons[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(buttons[1]);
    fireEvent.keyDown(buttons[1], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(buttons[2]);
    // The walk does not wrap and does not move focus off the lane.
    fireEvent.keyDown(buttons[2], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(buttons[2]);

    fireEvent.keyDown(buttons[2], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(buttons[1]);
    fireEvent.keyDown(buttons[1], { key: 'ArrowLeft' });
    fireEvent.keyDown(buttons[0], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('keeps the existing mouse selection working', () => {
    const { onSelectKeyframe, onSetFrame } = renderLane(makeTrack());

    fireEvent.click(diamonds()[1]);
    expect(onSelectKeyframe).toHaveBeenCalledWith('x12');
    expect(onSetFrame).toHaveBeenCalledWith(12);
  });

  it('labels the expanded channel-lane diamonds with their property and value', () => {
    renderLane(makeTrack(), { expanded: true });

    const propertyDiamond = screen.getByRole('button', { name: 'Keyframe at frame 12, Location X, value 140.00' });
    expect(propertyDiamond.className).toContain('ue-prop-diamond');
    fireEvent.keyDown(propertyDiamond, { key: 'Enter' });
  });

  it('labels legacy composite diamonds and still activates them', () => {
    const legacy = makeTrack({
      channels: makeEmptyChannels(),
      keyframes: [
        { id: 'k0', frame: 3, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'ease-in' },
      ],
    });
    const { onSelectKeyframe } = renderLane(legacy);

    const button = screen.getByRole('button', { name: 'Keyframe at frame 3, Body, ease-in' });
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onSelectKeyframe).toHaveBeenCalledWith('k0');
  });
});
