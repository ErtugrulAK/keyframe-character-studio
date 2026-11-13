import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useClipboard } from '../hooks/useClipboard';
import type { CharacterPart, PropertyKeyframe, Track } from '../types/animator';
import { makeEmptyChannels } from '../utils/animation/defaults';
import { evaluateTransform } from '../utils/animation/evaluateTransform';
import type { MirrorAxis } from '../utils/animation/mirror';

/**
 * Duplicate Mirrored, judged by what plays: the mirrored copy evaluated at any
 * frame must be the mirror of the original at that frame — the same easing,
 * and the same size and direction of turn.
 */
const base = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
const key = (id: string, frame: number, value: number, extra: Partial<PropertyKeyframe> = {}): PropertyKeyframe =>
  ({ id, frame, value, easing: 'linear', ...extra });

const mirrorOf = (channels: Partial<Track['channels']>, axis: MirrorAxis) => {
  const part = { id: 'p1', type: 'custom_rect', name: 'Box', zIndex: 1, baseTransform: base } as unknown as CharacterPart;
  const track = { id: 't1', partId: 'p1', name: 'Box', keyframes: [], channels: { ...makeEmptyChannels(), ...channels } } as unknown as Track;
  const setTracks = vi.fn();
  const setCharacterParts = vi.fn();
  const { result } = renderHook(() => useClipboard({
    characterParts: [part],
    tracks: [track],
    selectedPartId: 'p1',
    showToast: vi.fn(),
    setTracks,
    setCharacterParts,
    setSelectedPartId: vi.fn(),
  }));
  act(() => result.current.duplicateMirrored(axis));
  const parts = setCharacterParts.mock.calls[0][0]([part]) as CharacterPart[];
  const tracks = setTracks.mock.calls[0][0]([track]) as Track[];
  const copy = parts[0];
  const at = (partId: string, frame: number) => evaluateTransform(parts, tracks, 'Sequence', partId, frame);
  return { copy, tracks, at };
};

const easeInOut = { easing: 'cubic_bezier' as const, bezierControlPoints: [0.42, 0, 0.58, 1] as [number, number, number, number] };

describe('duplicateMirrored', () => {
  it('keeps the easing curve, so the copy is the exact mirror at every frame', () => {
    const { copy, tracks, at } = mirrorOf({ x: [key('a', 0, 20, easeInOut), key('b', 30, 100)] }, 'y');
    expect(tracks[0].channels.x[0].bezierControlPoints).toEqual([0.42, 0, 0.58, 1]);
    for (const frame of [0, 5, 10, 15, 20, 25, 30]) {
      expect(at(copy.id, frame).x).toBeCloseTo(-at('p1', frame).x, 9);
    }
  });

  it('gives the copy fresh keyframe ids and leaves the source arrays untouched', () => {
    const points: [number, number, number, number] = [0.42, 0, 0.58, 1];
    const { tracks } = mirrorOf({ x: [key('a', 0, 0, { ...easeInOut, bezierControlPoints: points }), key('b', 30, 100)] }, 'y');
    expect(tracks[0].channels.x.map((k) => k.id)).not.toContain('a');
    expect(tracks[0].channels.x[0].bezierControlPoints).not.toBe(points);
    expect(points).toEqual([0.42, 0, 0.58, 1]);
  });

  it('keeps a spin wider than 180° turning the same way through the origin', () => {
    const { copy, at } = mirrorOf({ rotation: [key('a', 0, 0), key('b', 20, 200)] }, 'origin');
    const turn = (partId: string) => at(partId, 20).rotation - at(partId, 0).rotation;
    expect(turn(copy.id)).toBeCloseTo(turn('p1'), 9);
    expect(at(copy.id, 10).rotation - at(copy.id, 0).rotation).toBeCloseTo(100, 9);
  });

  it('keeps a full turn a full turn through the origin', () => {
    const { tracks } = mirrorOf({ rotation: [key('a', 0, 0), key('b', 30, 360)] }, 'origin');
    expect(tracks[0].channels.rotation.map((k) => k.value)).toEqual([180, 540]);
  });

  it('starts the mirrored angle channel inside [-180, 180], like a still value', () => {
    const { tracks } = mirrorOf({ rotation: [key('a', 0, 45), key('b', 10, 90)] }, 'origin');
    expect(tracks[0].channels.rotation.map((k) => k.value)).toEqual([-135, -90]);
  });

  it('still negates angle channels for an axis mirror', () => {
    const { tracks } = mirrorOf({ rotation: [key('a', 0, 10), key('b', 10, 250)] }, 'x');
    expect(tracks[0].channels.rotation.map((k) => k.value)).toEqual([-10, -250]);
  });
});
