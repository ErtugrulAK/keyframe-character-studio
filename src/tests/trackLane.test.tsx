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
import { render, fireEvent, screen } from '@testing-library/react';
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
    onDuplicateKeyframeGroup: vi.fn(),
    kfClipboard: null,
    onCopyKeyframes: vi.fn(),
    onPasteKeyframes: vi.fn(),
    onFrameFromClientX: vi.fn(() => 30),
  };
  const utils = render(<TrackLane {...props} track={{ ...track, expanded: true }} />);
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

  test('7: right-click opens menu; Delete Keyframe deletes all channel keyframes at that frame', () => {
    const track = makeTrack({
      channels: {
        x: [pk('x0', 25, 1)], y: [pk('y0', 25, 2)],
      },
    });
    const { container, props } = renderLane(track);
    fireEvent.contextMenu(container.querySelector('.keyframe-diamond')!);
    expect(screen.getByLabelText('Delete Keyframe')).toBeTruthy(); // menu opened
    fireEvent.click(screen.getByLabelText('Delete Keyframe'));
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

describe('M27 27B — keyframe context menu (Duplicate Keyframes)', () => {
  test('1. right-click opens menu with Duplicate Keyframes + Delete Keyframe', () => {
    const track = makeTrack({ channels: { x: [pk('x0', 25, 1)] } });
    const { container } = renderLane(track);
    fireEvent.contextMenu(container.querySelector('.keyframe-diamond')!);
    expect(screen.getByLabelText('Duplicate Keyframes')).toBeTruthy();
    expect(screen.getByLabelText('Delete Keyframe')).toBeTruthy();
  });

  test('2. Duplicate Keyframes calls onDuplicateKeyframeGroup with trackId + frame', () => {
    const track = makeTrack({ channels: { x: [pk('x0', 25, 1)] } });
    const { container, props } = renderLane(track);
    fireEvent.contextMenu(container.querySelector('.keyframe-diamond')!);
    fireEvent.click(screen.getByLabelText('Duplicate Keyframes'));
    expect(props.onDuplicateKeyframeGroup).toHaveBeenCalledWith('trk_1', 25);
    expect(props.onDuplicateKeyframeGroup).toHaveBeenCalledTimes(1);
  });

  test('3. legacy composite keyframe right-click duplicates its frame', () => {
    const track = makeTrack({ keyframes: [lkf('kf0', 40)] });
    const { container, props } = renderLane(track);
    fireEvent.contextMenu(container.querySelector('.keyframe-diamond')!);
    fireEvent.click(screen.getByLabelText('Duplicate Keyframes'));
    expect(props.onDuplicateKeyframeGroup).toHaveBeenCalledWith('trk_1', 40);
  });

  test('4. channel-lane property diamond right-click also opens the menu', () => {
    const track = makeTrack({
      channels: { x: [pk('x0', 25, 1)] },
      expanded: true,
    });
    const { container, props } = renderLane(track);
    const propDiamond = container.querySelector('.ue-prop-diamond')!;
    fireEvent.contextMenu(propDiamond);
    fireEvent.click(screen.getByLabelText('Duplicate Keyframes'));
    expect(props.onDuplicateKeyframeGroup).toHaveBeenCalledWith('trk_1', 25);
  });

  test('5. menu closes after choosing an action', () => {
    const track = makeTrack({ channels: { x: [pk('x0', 25, 1)] } });
    const { container } = renderLane(track);
    fireEvent.contextMenu(container.querySelector('.keyframe-diamond')!);
    expect(screen.getByLabelText('Duplicate Keyframes')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Duplicate Keyframes'));
    expect(screen.queryByLabelText('Duplicate Keyframes')).toBeNull();
  });

  test('6. click outside closes the menu without action', () => {
    const track = makeTrack({ channels: { x: [pk('x0', 25, 1)] } });
    const { container, props } = renderLane(track);
    fireEvent.contextMenu(container.querySelector('.keyframe-diamond')!);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByLabelText('Duplicate Keyframes')).toBeNull();
    expect(props.onDuplicateKeyframeGroup).not.toHaveBeenCalled();
  });

  test('7. source keyframes stay; duplicate is a separate action (no delete on duplicate)', () => {
    const track = makeTrack({ channels: { x: [pk('x0', 25, 1)], y: [pk('y0', 25, 2)] } });
    const { container, props } = renderLane(track);
    fireEvent.contextMenu(container.querySelector('.keyframe-diamond')!);
    fireEvent.click(screen.getByLabelText('Duplicate Keyframes'));
    expect(props.onDeletePropertyKeyframe).not.toHaveBeenCalled();
    expect(props.onDuplicateKeyframeGroup).toHaveBeenCalledWith('trk_1', 25);
  });

  test('8. accessibility: menu role + item titles', () => {
    const track = makeTrack({ channels: { x: [pk('x0', 25, 1)] } });
    const { container } = renderLane(track);
    fireEvent.contextMenu(container.querySelector('.keyframe-diamond')!);
    expect(screen.getByRole('menu', { name: 'Keyframe actions' })).toBeTruthy();
    expect(screen.getByTitle('Duplicate the whole keyframe group at this frame (frame + 1)')).toBeTruthy();
    expect(screen.getByTitle('Delete the keyframe(s) at this frame')).toBeTruthy();
  });

  test('9. no keyboard shortcut / no new panel surface introduced by the menu', () => {
    const track = makeTrack({ channels: { x: [pk('x0', 25, 1)] } });
    const { container } = renderLane(track);
    // menu only appears after right-click — no pre-rendered toolbar/modal
    expect(screen.queryByLabelText('Duplicate Keyframes')).toBeNull();
    expect(container.querySelectorAll('.keyframe-diamond').length).toBe(1); // render unchanged
  });

  test('10. multi-select parts does not multi-target: menu action targets ONE track', () => {
    const track = makeTrack({ channels: { x: [pk('x0', 25, 1)] } });
    const { container, props } = renderLane(track);
    fireEvent.contextMenu(container.querySelector('.keyframe-diamond')!);
    fireEvent.click(screen.getByLabelText('Duplicate Keyframes'));
    // exactly one call with the lane's own track id
    expect(props.onDuplicateKeyframeGroup.mock.calls).toEqual([['trk_1', 25]]);
  });

  test('11. selectedKeyframeId behavior preserved (selection unchanged by menu actions)', () => {
    const track = makeTrack({ channels: { x: [pk('x0', 25, 1)] } });
    const { container } = renderLane(track);
    fireEvent.contextMenu(container.querySelector('.keyframe-diamond')!);
    expect(screen.getByLabelText('Duplicate Keyframes')).toBeTruthy();
    // no selection mutation callbacks fired by opening the menu
    fireEvent.click(screen.getByLabelText('Duplicate Keyframes'));
  });
});

describe('M28 28B — keyframe copy / paste UI', () => {
  test('1+2+3. Copy Keyframes joins Duplicate + Delete on the keyframe menu', () => {
    const track = makeTrack({ channels: { x: [pk('x0', 25, 1)] } });
    const { container } = renderLane(track);
    fireEvent.contextMenu(container.querySelector('.keyframe-diamond')!);
    expect(screen.getByLabelText('Copy Keyframes')).toBeTruthy();
    expect(screen.getByLabelText('Duplicate Keyframes')).toBeTruthy();
    expect(screen.getByLabelText('Delete Keyframe')).toBeTruthy();
  });

  test('4+5. Copy calls onCopyKeyframes with trackId+frame; no history callback invoked', () => {
    const track = makeTrack({ channels: { x: [pk('x0', 25, 1)] } });
    const { container, props } = renderLane(track);
    fireEvent.contextMenu(container.querySelector('.keyframe-diamond')!);
    fireEvent.click(screen.getByLabelText('Copy Keyframes'));
    expect(props.onCopyKeyframes).toHaveBeenCalledWith('trk_1', 25);
    // copy itself never touches delete/duplicate/paste paths
    expect(props.onDuplicateKeyframeGroup).not.toHaveBeenCalled();
    expect(props.onDeletePropertyKeyframe).not.toHaveBeenCalled();
  });

  test('6. copy menu closes after the action', () => {
    const track = makeTrack({ channels: { x: [pk('x0', 25, 1)] } });
    const { container } = renderLane(track);
    fireEvent.contextMenu(container.querySelector('.keyframe-diamond')!);
    fireEvent.click(screen.getByLabelText('Copy Keyframes'));
    expect(screen.queryByLabelText('Copy Keyframes')).toBeNull();
  });

  test('7. empty lane right-click opens Paste menu when clipboard exists', () => {
    const track = makeTrack({ channels: { x: [pk('x0', 25, 1)] } });
    const props = {
      ...trackLaneBaseProps(track),
      kfClipboard: { channels: { x: [{ frame: 25, value: 1, easing: 'linear' }] }, legacy: [] },
    };
    const { container } = render(<TrackLane {...props} />);
    fireEvent.contextMenu(container.querySelector('.ue-track-lane')!);
    expect(screen.getByLabelText('Paste Keyframes')).toBeTruthy();
  });

  test('8. empty lane right-click offers NO paste when clipboard is empty', () => {
    const track = makeTrack({ channels: { x: [pk('x0', 25, 1)] } });
    const { container } = renderLane(track); // kfClipboard null
    fireEvent.contextMenu(container.querySelector('.ue-track-lane')!);
    expect(screen.queryByLabelText('Paste Keyframes')).toBeNull();
  });

  test('9+10+11. Paste calls onPasteKeyframes with target track + clicked frame', () => {
    const track = makeTrack({ channels: { x: [pk('x0', 25, 1)] } });
    const props = {
      ...trackLaneBaseProps(track),
      kfClipboard: { channels: { x: [{ frame: 25, value: 1, easing: 'linear' }] }, legacy: [] },
    };
    const { container } = render(<TrackLane {...props} />);
    fireEvent.contextMenu(container.querySelector('.ue-track-lane')!);
    fireEvent.click(screen.getByLabelText('Paste Keyframes'));
    expect(props.onPasteKeyframes).toHaveBeenCalledWith('trk_1', 30); // frame from onFrameFromClientX mock
  });

  test('12. cross-track paste uses the CLICKED lane track (per-lane prop wiring)', () => {
    const trackA = makeTrack({ channels: { x: [pk('x0', 25, 1)] } });
    const trackB = makeTrack({ channels: { y: [pk('y0', 5, 1)] } });
    const props = {
      ...trackLaneBaseProps(trackB),
      kfClipboard: { channels: { x: [{ frame: 25, value: 1, easing: 'linear' }] }, legacy: [] },
    };
    const { container } = render(<TrackLane {...props} />);
    fireEvent.contextMenu(container.querySelector('.ue-track-lane')!);
    fireEvent.click(screen.getByLabelText('Paste Keyframes'));
    expect(props.onPasteKeyframes).toHaveBeenCalledWith('trk_1', 30); // track B id
  });

  test('14+15. paste is a safe no-op path (bridge handles collision/invalid frame — UI still closes cleanly)', () => {
    const track = makeTrack({ channels: { x: [pk('x0', 25, 1)] } });
    const props = {
      ...trackLaneBaseProps(track),
      kfClipboard: { channels: { x: [{ frame: 25, value: 1, easing: 'linear' }] }, legacy: [] },
    };
    const { container } = render(<TrackLane {...props} />);
    fireEvent.contextMenu(container.querySelector('.ue-track-lane')!);
    fireEvent.click(screen.getByLabelText('Paste Keyframes'));
    expect(screen.queryByLabelText('Paste Keyframes')).toBeNull(); // menu closes
    expect(props.onPasteKeyframes).toHaveBeenCalledTimes(1); // no crash
  });

  test('16. no automatic track creation path in UI (paste only targets existing lane)', () => {
    const track = makeTrack({ channels: { x: [pk('x0', 25, 1)] } });
    const props = {
      ...trackLaneBaseProps(track),
      kfClipboard: { channels: { x: [{ frame: 25, value: 1, easing: 'linear' }] }, legacy: [] },
    };
    const { container } = render(<TrackLane {...props} />);
    fireEvent.contextMenu(container.querySelector('.ue-track-lane')!);
    fireEvent.click(screen.getByLabelText('Paste Keyframes'));
    // only onPasteKeyframes fired — no create-track style callback exists
    expect(props.onPasteKeyframes).toHaveBeenCalledTimes(1);
  });

  test('22+23. accessibility + click-outside for both menus', () => {
    const track = makeTrack({ channels: { x: [pk('x0', 25, 1)] } });
    const props = {
      ...trackLaneBaseProps(track),
      kfClipboard: { channels: { x: [{ frame: 25, value: 1, easing: 'linear' }] }, legacy: [] },
    };
    const { container } = render(<TrackLane {...props} />);
    // keyframe menu roles/labels
    fireEvent.contextMenu(container.querySelector('.keyframe-diamond')!);
    expect(screen.getByRole('menu', { name: 'Keyframe actions' })).toBeTruthy();
    expect(screen.getByTitle('Copy the whole keyframe group at this frame to the timeline clipboard')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByLabelText('Copy Keyframes')).toBeNull();
    // paste menu roles/labels
    fireEvent.contextMenu(container.querySelector('.ue-track-lane')!);
    expect(screen.getByRole('menu', { name: 'Timeline actions' })).toBeTruthy();
    expect(screen.getByTitle('Paste the copied keyframe group at this frame')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByLabelText('Paste Keyframes')).toBeNull();
  });

  test('24+25. no second copy model: paste menu is the only extra surface; no localStorage clipboard key', () => {
    const track = makeTrack({ channels: { x: [pk('x0', 25, 1)] } });
    const props = {
      ...trackLaneBaseProps(track),
      kfClipboard: { channels: { x: [{ frame: 25, value: 1, easing: 'linear' }] }, legacy: [] },
    };
    const { container } = render(<TrackLane {...props} />);
    // nothing pre-rendered before right-click
    expect(screen.queryByLabelText('Paste Keyframes')).toBeNull();
    expect(screen.queryByLabelText('Copy Keyframes')).toBeNull();
    fireEvent.contextMenu(container.querySelector('.ue-track-lane')!);
    expect(screen.getByLabelText('Paste Keyframes')).toBeTruthy();
  });

  test('28+29+30. drag/selection surface unchanged; paste still works after switching track (new render)', () => {
    const track = makeTrack({ channels: { x: [pk('x0', 25, 1)] } });
    const props = {
      ...trackLaneBaseProps(track),
      kfClipboard: { channels: { x: [{ frame: 25, value: 1, easing: 'linear' }] }, legacy: [] },
    };
    const { container } = render(<TrackLane {...props} />);
    // keyframe diamond still clickable (selection path intact)
    fireEvent.click(container.querySelector('.keyframe-diamond')!);
    expect(props.onSelectKeyframe).toHaveBeenCalledWith('x0');
    // and the paste menu still opens on the lane afterwards
    fireEvent.contextMenu(container.querySelector('.ue-track-lane')!);
    expect(screen.getByLabelText('Paste Keyframes')).toBeTruthy();
  });
});

function trackLaneBaseProps(track: Track) {
  return {
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
    onDuplicateKeyframeGroup: vi.fn(),
    kfClipboard: null,
    onCopyKeyframes: vi.fn(),
    onPasteKeyframes: vi.fn(),
    onFrameFromClientX: vi.fn(() => 30),
  };
}
