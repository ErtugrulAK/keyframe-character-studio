import { describe, expect, it } from 'vitest';
import type { CharacterPart, Track } from '../types/animator';
import { evaluateTransform } from '../utils/animation/evaluateTransform';

/**
 * The parent-child contract, told as a solar system (the scene-graph example of
 * After Effects, three.js and Unreal): a child's own transform is LOCAL to its
 * parent. A parent's move carries the child, a parent's turn swings the child
 * around the parent's origin (an orbit) and turns it too, and a parent's scale
 * scales the child's distance and size. The child's own animation adds on top,
 * in the parent's space. Opacity is never inherited.
 */
const part = (id: string, base: Partial<CharacterPart['baseTransform']> = {}, extra: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id,
  type: 'custom_circle',
  zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, ...base },
  ...extra,
} as CharacterPart);

const key = (frame: number, value: number) => ({ id: `k${frame}-${value}`, frame, value, templateId: 'Sequence', easing: 'linear' });
const track = (partId: string, channels: Record<string, unknown> = {}): Track => ({
  id: `track-${partId}`, partId, name: partId, keyframes: [], channels,
} as unknown as Track);

const at = (parts: CharacterPart[], tracks: Track[], id: string, frame: number) => evaluateTransform(parts, tracks, 'Sequence', id, frame);

describe('parent-child hierarchy: relative (local) motion', () => {
  // Sun at the centre; Earth 200 to its right; Moon 50 to the right of Earth.
  const parts = [
    part('sun', { x: 0, y: 0 }),
    part('earth', { x: 200, y: 0 }, { parentId: 'sun' }),
    part('moon', { x: 50, y: 0 }, { parentId: 'earth' }),
  ];

  it('a parent turn makes the child orbit around the parent, and the grandchild follows', () => {
    // The sun turns 90° over 10 frames; nothing else is animated.
    const tracks = [track('sun', { rotation: [key(0, 0), key(10, 90)] }), track('earth'), track('moon')];
    const earth = at(parts, tracks, 'earth', 10);
    expect(earth.x).toBeCloseTo(0, 6);
    expect(earth.y).toBeCloseTo(200, 6);
    expect(earth.rotation).toBeCloseTo(90, 6);
    const moon = at(parts, tracks, 'moon', 10);
    expect(moon.x).toBeCloseTo(0, 6);
    expect(moon.y).toBeCloseTo(250, 6);
  });

  it("the child's own spin adds to the orbit and does not move the parent", () => {
    // Earth spins on its own axis; the Moon orbits it; the Sun is untouched.
    const tracks = [track('sun'), track('earth', { rotation: [key(0, 0), key(10, 180)] }), track('moon')];
    expect(at(parts, tracks, 'sun', 10)).toMatchObject({ x: 0, y: 0, rotation: 0 });
    const earth = at(parts, tracks, 'earth', 10);
    expect(earth.x).toBeCloseTo(200, 6);
    expect(earth.y).toBeCloseTo(0, 6);
    const moon = at(parts, tracks, 'moon', 10);
    expect(moon.x).toBeCloseTo(150, 6);
    expect(moon.y).toBeCloseTo(0, 6);
  });

  it('a parent move carries the child by the same amount; a parent scale scales distance and size', () => {
    const moved = [track('sun', { x: [key(0, 0), key(10, 30)] }), track('earth'), track('moon')];
    expect(at(parts, moved, 'earth', 10).x).toBeCloseTo(230, 6);
    const scaled = [track('sun', { scaleX: [key(0, 1), key(10, 2)], scaleY: [key(0, 1), key(10, 2)] }), track('earth'), track('moon')];
    const earth = at(parts, scaled, 'earth', 10);
    expect(earth.x).toBeCloseTo(400, 6);
    expect(earth.scaleX).toBeCloseTo(2, 6);
  });

  it('opacity is not inherited', () => {
    const tracks = [track('sun', { opacity: [key(0, 1), key(10, 0.2)] }), track('earth'), track('moon')];
    expect(at(parts, tracks, 'earth', 10).opacity).toBe(1);
  });
});
