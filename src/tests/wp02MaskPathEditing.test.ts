/**
 * WP-02 — pure geometry of canvas mask editing: the path ↔ world maps are the
 * renderer's own (normalization + evaluated world affine), pointer deltas go
 * through one frozen inverse, and every edit is an absolute delta on the
 * gesture's initial path.
 */
import { describe, expect, it } from 'vitest';
import type { BezierPath, CharacterPart, LayerMask } from '../types/animator';
import { applyAffine, composeAffine, affineOfTransform } from '../utils/geometry/containerMath';
import { buildLayerMaskPathD } from '../utils/layers/layerMasks';
import {
  maskPathDeltaFromWorld,
  maskPathPointToWorld,
  moveMaskHandle,
  moveMaskVertex,
  resolveMaskEditBlock,
  resolveMaskPathFrame,
  translateMaskPath,
} from '../utils/geometry/maskPathEditing';

const image = (overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id: 'img',
  name: 'Landscape',
  type: 'custom_image',
  zIndex: 1,
  width: 800,
  height: 400,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  ...overrides,
});

const path: BezierPath = {
  version: 1,
  coordinateSpace: 'normalized',
  closed: true,
  points: [
    { id: 'a', x: 0.25, y: 0.75, kind: 'smooth', handleIn: { x: 0.2, y: 0.75 }, handleOut: { x: 0.3, y: 0.75 } },
    { id: 'b', x: 0.75, y: 0.75 },
    { id: 'c', x: 0.75, y: 0.25 },
  ],
};

const close = (actual: { x: number; y: number }, expected: { x: number; y: number }) => {
  expect(actual.x).toBeCloseTo(expected.x, 9);
  expect(actual.y).toBeCloseTo(expected.y, 9);
};

describe('WP-02 mask path frame', () => {
  it('maps the documented fixture: 800×400 image, (0.25, 0.75) → world (-200, 100)', () => {
    const frame = resolveMaskPathFrame(image(), 'normalized', { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
    expect(frame).not.toBeNull();
    close(maskPathPointToWorld(frame!, { x: 0.25, y: 0.75 }), { x: -200, y: 100 });
  });

  it('is the exact inverse of the renderer map under scale, rotation, negative scale and a sheared parent', () => {
    const part = image();
    const sheared = composeAffine(
      affineOfTransform({ x: 30, y: -20, rotation: 20, scaleX: 1.4, scaleY: 0.7 }),
      affineOfTransform({ x: 50, y: 10, rotation: 45, scaleX: 2, scaleY: -0.5 }),
    );
    const poses = [
      { x: 10, y: 20, rotation: 30, scaleX: 2, scaleY: 0.5 },
      { x: -40, y: 5, rotation: 90, scaleX: -1, scaleY: 1 },
      { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, affine: sheared },
    ];
    for (const pose of poses) {
      const frame = resolveMaskPathFrame(part, 'normalized', pose)!;
      // forward(inverse(p)) = p
      const world = { x: 123.5, y: -67.25 };
      close(maskPathPointToWorld(frame, applyAffine(frame.toPath, world)), world);
      // The overlay map equals the renderer contour: the first move-to of
      // buildLayerMaskPathD is the first vertex mapped through the same frame.
      const first = maskPathPointToWorld(frame, path.points[0]);
      const d = buildLayerMaskPathD(path, part, pose, { x: 0, y: 0 });
      const [, mx, my] = d.match(/^M (\S+) (\S+)/)!;
      close({ x: Number(mx), y: Number(my) }, first);
    }
  });

  it('uses the local path space without normalization', () => {
    const frame = resolveMaskPathFrame(image(), 'local', { x: 5, y: 6, rotation: 0, scaleX: 2, scaleY: 3 })!;
    close(maskPathPointToWorld(frame, { x: 1, y: 1 }), { x: 7, y: 9 });
  });

  it('refuses a collapsed map (zero scale or a zero-sized layer) instead of inventing a delta', () => {
    expect(resolveMaskPathFrame(image(), 'normalized', { x: 0, y: 0, rotation: 0, scaleX: 0, scaleY: 1 })).toBeNull();
    expect(resolveMaskPathFrame(image({ width: 0 }), 'normalized', { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })).toBeNull();
    expect(resolveMaskPathFrame(image(), 'normalized', { x: 0, y: 0, rotation: 0, scaleX: 1e-12, scaleY: 1 })).toBeNull();
  });

  it('converts a world pointer delta through the frozen inverse (rotated, scaled owner)', () => {
    const frame = resolveMaskPathFrame(image(), 'normalized', { x: 0, y: 0, rotation: 90, scaleX: 2, scaleY: 0.5 })!;
    // A +X world move on a layer rotated 90° is −Y in layer-local space:
    // local −10 → normalized −10 / (400 · 0.5).
    const delta = maskPathDeltaFromWorld(frame, { x: 3, y: 4 }, { x: 13, y: 4 });
    expect(delta.x).toBeCloseTo(0, 12);
    expect(delta.y).toBeCloseTo(-10 / 200, 12);
  });
});

describe('WP-02 path edits', () => {
  it('moves every vertex and absolute handle by the same delta, without clamping', () => {
    const moved = translateMaskPath(path, { x: 0.5, y: -0.1 });
    expect(moved.points[0]).toEqual({ ...path.points[0], x: 0.75, y: 0.65, handleIn: { x: 0.7, y: 0.65 }, handleOut: { x: 0.8, y: 0.65 } });
    expect(moved.points[1]).toMatchObject({ x: 1.25, y: 0.65 });
    expect(moved.points.map((point) => point.id)).toEqual(['a', 'b', 'c']);
    expect(moved.closed).toBe(true);
    expect(translateMaskPath(path, { x: Number.NaN, y: 0 })).toBe(path);
  });

  it('moves one vertex with its own handles only', () => {
    const moved = moveMaskVertex(path, 0, { x: 0.1, y: 0 });
    close(moved.points[0], { x: 0.35, y: 0.75 });
    close(moved.points[0].handleIn!, { x: 0.3, y: 0.75 });
    close(moved.points[0].handleOut!, { x: 0.4, y: 0.75 });
    expect(moved.points.slice(1)).toEqual(path.points.slice(1));
    expect(moveMaskVertex(path, 9, { x: 1, y: 1 })).toBe(path);
  });

  it('moves one tangent handle and mirrors a smooth counterpart', () => {
    const moved = moveMaskHandle(path, 0, 'out', { x: 0, y: 0.05 });
    expect(moved.points[0].handleOut).toEqual({ x: 0.3, y: 0.8 });
    // The smooth counterpart keeps its length and points the opposite way.
    const handleIn = moved.points[0].handleIn!;
    expect(Math.hypot(handleIn.x - 0.25, handleIn.y - 0.75)).toBeCloseTo(0.05, 12);
    expect((handleIn.x - 0.25) * 0.05 + (handleIn.y - 0.75) * 0.05).toBeLessThan(0);
    // A vertex without that handle is untouched.
    expect(moveMaskHandle(path, 1, 'out', { x: 1, y: 1 })).toBe(path);
  });
});

describe('WP-02 edit refusals', () => {
  const mask: LayerMask = { id: 'm1', name: 'Mask 1', mode: 'add', path };
  const frame = resolveMaskPathFrame(image(), 'normalized', { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
  const base = { mask, tracks: [], totalFrames: 60, frame: 5, customPresets: [], hasLiveStunt: false, frameMap: frame };

  it('allows an ordinary pose and an opacity-only preset', () => {
    expect(resolveMaskEditBlock({ ...base, part: image() })).toBeNull();
    expect(resolveMaskEditBlock({ ...base, part: image({ inAnimPreset: 'fade', inAnimDuration: 30 }) })).toBeNull();
  });

  it('refuses a locked mask, a moving IN preset, a live stunt and a collapsed map', () => {
    expect(resolveMaskEditBlock({ ...base, part: image(), mask: { ...mask, locked: true } })?.kind).toBe('locked');
    expect(resolveMaskEditBlock({ ...base, part: image({ inAnimPreset: 'slide-left', inAnimDuration: 30 }) })?.kind).toBe('procedural');
    // Outside the preset interval the pose is the keyframe pose again.
    expect(resolveMaskEditBlock({ ...base, frame: 40, part: image({ inAnimPreset: 'slide-left', inAnimDuration: 30 }) })).toBeNull();
    expect(resolveMaskEditBlock({ ...base, part: image(), hasLiveStunt: true })?.kind).toBe('procedural');
    expect(resolveMaskEditBlock({ ...base, part: image(), frameMap: null })?.kind).toBe('singular');
    expect(resolveMaskEditBlock({ ...base, part: image(), isPlaying: true })?.kind).toBe('playback');
  });
});
