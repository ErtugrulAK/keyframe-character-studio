/**
 * M8e-prep A — legacy-only track motion transition canonicalization
 *
 * applyMotionTransition on a legacy-only track (empty channels + populated
 * keyframes[]) must write the canonical 6 channels (converting the existing
 * legacy keyframes first) instead of only appending to legacy keyframes[].
 * Legacy array stays untouched for import compatibility.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useTimeline } from '../hooks/useTimeline';
import type { Track, TrackChannel, PropertyKeyframe, Keyframe, Transform } from '../types/animator';

function makeLegacyTrack(): Track {
  const channels: Record<TrackChannel, PropertyKeyframe[]> = {
    x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
    maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
  };
  const keyframes: Keyframe[] = [
    { id: 'kf0', frame: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' },
    { id: 'kf60', frame: 60, transform: { x: 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' },
  ];
  return {
    id: 'trk_1', partId: 'part_1', name: 'T1', color: '#f00',
    keyframes, channels, visible: true, locked: false,
  } as Track;
}

function renderTimeline(track: Track, currentFrame = 30) {
  const mockSetTracks = vi.fn();
  const baseTransform: Transform = { x: 100, y: 50, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
  const { result } = renderHook(() => useTimeline({
    setCharacterParts: vi.fn(),
    tracks: [track],
    setTracks: mockSetTracks,
    selectedPartId: 'part_1',
    setSelectedPartId: vi.fn(),
    selectedPartIds: ['part_1'],
    setSelectedPartIds: vi.fn(),
    currentFrame,
    totalFrames: 120,
    activeTemplateId: 'Sequence',
    getComputedTransform: vi.fn().mockReturnValue(baseTransform),
    showToast: vi.fn(),
  }));
  return { result, mockSetTracks };
}

function applyTransition(track: Track, type: string) {
  const { result, mockSetTracks } = renderTimeline(track);
  act(() => {
    result.current.applyMotionTransition('part_1', type);
  });
  const [updated] = mockSetTracks.mock.calls.at(-1)[0]([track]);
  return updated as Track;
}

describe('M8e-prep A — legacy-only transition → canonical channels', () => {

  it('writes the transition to canonical channels (not only legacy keyframes[])', () => {
    const track = makeLegacyTrack();
    const updated = applyTransition(track, 'fade'); // currentFrame 30 → start 30, end 45

    // fade: opacity 0 at start, 1 at end — in channels
    expect(updated.channels.opacity.some((k) => k.frame === 30 && k.value === 0)).toBe(true);
    expect(updated.channels.opacity.some((k) => k.frame === 45 && k.value === 1)).toBe(true);
    // all 6 channels receive start/end keyframes
    expect(updated.channels.x.some((k) => k.frame === 30)).toBe(true);
    expect(updated.channels.x.some((k) => k.frame === 45)).toBe(true);
    expect(updated.channels.y.some((k) => k.frame === 30)).toBe(true);
  });

  it('preserves existing legacy animation by converting it into channels', () => {
    const track = makeLegacyTrack();
    const updated = applyTransition(track, 'fade');

    // legacy x keyframes (frame 0 = 0, frame 60 = 100) survive in channels
    expect(updated.channels.x.find((k) => k.frame === 0)?.value).toBe(0);
    expect(updated.channels.x.find((k) => k.frame === 60)?.value).toBe(100);
  });

  it('opacity 0 preserved; easing + templateId carried on new keyframes', () => {
    const track = makeLegacyTrack();
    const updated = applyTransition(track, 'fade');

    const startOp = updated.channels.opacity.find((k) => k.frame === 30)!;
    expect(startOp.value).toBe(0);
    expect(startOp.templateId).toBe('Sequence');
    expect(startOp.easing).toBe('easeOut');

    const endOp = updated.channels.opacity.find((k) => k.frame === 45)!;
    expect(endOp.easing).toBe('linear');
  });

  it('legacy keyframes[] array is not polluted (stays untouched for import compat)', () => {
    const track = makeLegacyTrack();
    const updated = applyTransition(track, 'fade');

    // Canonical transition must NOT append legacy keyframes
    expect(updated.keyframes).toHaveLength(2);
    expect(updated.keyframes[0].id).toBe('kf0');
    expect(updated.keyframes[1].id).toBe('kf60');
  });

  it('other tracks are not affected', () => {
    const t1 = makeLegacyTrack();
    const t2 = makeLegacyTrack();
    t2.id = 'trk_2';
    t2.partId = 'part_2';

    const mockSetTracks = vi.fn();
    const baseTransform: Transform = { x: 100, y: 50, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
    const { result } = renderHook(() => useTimeline({
      setCharacterParts: vi.fn(),
      tracks: [t1, t2],
      setTracks: mockSetTracks,
      selectedPartId: 'part_1',
      setSelectedPartId: vi.fn(),
      selectedPartIds: ['part_1'],
      setSelectedPartIds: vi.fn(),
      currentFrame: 30,
      totalFrames: 120,
      activeTemplateId: 'Sequence',
      getComputedTransform: vi.fn().mockReturnValue(baseTransform),
      showToast: vi.fn(),
    }));

    act(() => {
      result.current.applyMotionTransition('part_1', 'fade');
    });
    const [u1, u2] = mockSetTracks.mock.calls.at(-1)[0]([t1, t2]);

    expect(u1.channels.opacity.some((k) => k.frame === 30)).toBe(true);
    expect(u2.channels.opacity).toHaveLength(0);
    expect(u2.keyframes).toHaveLength(2);
  });

  it('"none" clears the active template channel keyframes (legacy anim converted, then cleared)', () => {
    const track = makeLegacyTrack();
    const updated = applyTransition(track, 'none');

    // All Sequence channel keyframes removed (including converted legacy ones)
    expect(updated.channels.x.filter((k) => (k.templateId || 'Sequence') === 'Sequence')).toHaveLength(0);
    expect(updated.channels.opacity.filter((k) => (k.templateId || 'Sequence') === 'Sequence')).toHaveLength(0);
    // Legacy array untouched
    expect(updated.keyframes).toHaveLength(2);
  });

  it('evaluation parity: converted channels evaluate to the same x as legacy keyframes', () => {
    const track = makeLegacyTrack();
    const updated = applyTransition(track, 'fade');
    // frame 60: legacy x was 100 → converted channel keeps 100
    expect(updated.channels.x.find((k) => k.frame === 60)?.value).toBe(100);
  });
});
