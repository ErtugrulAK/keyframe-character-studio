/**
 * WP-03 — pure mask creation and whole-path edits: rectangle/ellipse/pen
 * paths, layer-space rotate/scale, shape-preserving vertex insertion, vertex
 * removal limits and the animated-topology guard.
 */
import { describe, expect, it } from 'vitest';
import type { BezierPath, CharacterPart } from '../types/animator';
import {
  createEllipseMaskPath,
  createPolygonMaskPath,
  createRectangleMaskPath,
  deleteMaskVertex,
  insertMaskVertex,
  maskPathTopologyLockReason,
  nearestMaskPathSegment,
  pointOnMaskPathSegment,
  transformMaskPathInLayerSpace,
} from '../utils/maskPathCreation';
import { maskPathPointToWorld, resolveMaskPathFrame } from '../utils/maskPathEditing';

const owner = (overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id: 'img',
  name: 'Landscape',
  type: 'custom_image',
  zIndex: 1,
  width: 800,
  height: 400,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  ...overrides,
});

const close = (actual: { x: number; y: number }, expected: { x: number; y: number }, digits = 9) => {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
};

describe('WP-03 mask creation', () => {
  it('builds a layer-aligned rectangle from a drag in any direction', () => {
    const path = createRectangleMaskPath('normalized', { x: 0.8, y: 0.7 }, { x: 0.2, y: 0.1 });
    expect(path.closed).toBe(true);
    expect(path.points.map((point) => [point.x, point.y])).toEqual([[0.2, 0.1], [0.8, 0.1], [0.8, 0.7], [0.2, 0.7]]);
    expect(new Set(path.points.map((point) => point.id)).size).toBe(4);
  });

  it('approximates an ellipse with four cubic segments within 0.03 % radial error', () => {
    const path = createEllipseMaskPath('normalized', { x: 0.1, y: 0.2 }, { x: 0.9, y: 0.6 });
    expect(path.points).toHaveLength(4);
    expect(path.points.every((point) => point.kind === 'smooth' && point.handleIn && point.handleOut)).toBe(true);
    const [cx, cy, rx, ry] = [0.5, 0.4, 0.4, 0.2];
    for (let segment = 0; segment < 4; segment += 1) {
      for (let step = 0; step <= 10; step += 1) {
        const point = pointOnMaskPathSegment(path, segment, step / 10)!;
        const radius = Math.hypot((point.x - cx) / rx, (point.y - cy) / ry);
        expect(Math.abs(radius - 1)).toBeLessThan(3e-4);
      }
    }
  });

  it('closes a pen polygon through the clicked points', () => {
    const path = createPolygonMaskPath('normalized', [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.9 }, { x: 0.9, y: 0.1 }]);
    expect(path.closed).toBe(true);
    expect(path.points.map((point) => point.kind)).toEqual(['corner', 'corner', 'corner']);
  });
});

describe('WP-03 whole-path transforms', () => {
  const square: BezierPath = createRectangleMaskPath('normalized', { x: 0.25, y: 0.25 }, { x: 0.75, y: 0.75 });

  it('rotates in LAYER space, so a non-square layer keeps a true rotation', () => {
    // 0.5 × 0.5 normalized on 800 × 400 is a 400 × 200 local box; 90° makes it 200 × 400.
    const rotated = transformMaskPathInLayerSpace(square, owner(), { rotation: 90 });
    const xs = rotated.points.map((point) => point.x);
    const ys = rotated.points.map((point) => point.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(200 / 800, 12);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(400 / 400, 12);
    expect(rotated.points.map((point) => point.id)).toEqual(square.points.map((point) => point.id));
    // The centre (the pivot of the edit) stays put.
    close({ x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2 }, { x: 0.5, y: 0.5 });
  });

  it('scales vertices AND absolute handles about the centre', () => {
    const ellipse = createEllipseMaskPath('normalized', { x: 0.25, y: 0.25 }, { x: 0.75, y: 0.75 });
    const scaled = transformMaskPathInLayerSpace(ellipse, owner(), { scaleX: 2, scaleY: 2 });
    close(scaled.points[1], { x: 1, y: 0.5 });
    close(scaled.points[1].handleOut!, { x: 1, y: 0.5 + 2 * (ellipse.points[1].handleOut!.y - 0.5) });
    // Not clamped to the layer: a mask may reach beyond it.
    expect(scaled.points[1].x).toBe(1);
    expect(transformMaskPathInLayerSpace(ellipse, owner(), { scaleX: Number.NaN })).toBe(ellipse);
  });
});

describe('WP-03 topology edits', () => {
  const rect = createRectangleMaskPath('normalized', { x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 });

  it('guards topology on a path keyed in any sequence (D-08)', () => {
    expect(maskPathTopologyLockReason({ maskPathChannels: {} }, 'm1')).toBeNull();
    expect(maskPathTopologyLockReason(undefined, 'm1')).toBeNull();
    expect(maskPathTopologyLockReason({
      maskPathChannels: { 'm1:path': [{ id: 'k', frame: 3, value: rect, easing: 'linear', templateId: 'Intro' }] },
    }, 'm1')).toMatch(/animated/);
  });

  it('removes a vertex but keeps at least three on a closed path', () => {
    const triangle = deleteMaskVertex(rect, 1)!;
    expect(triangle.points.map((point) => point.id)).toEqual(['vertex-0', 'vertex-2', 'vertex-3']);
    expect(deleteMaskVertex(triangle, 0)).toBeNull();
    expect(deleteMaskVertex(rect, 9)).toBeNull();
  });

  it('inserts a corner on a straight edge with a fresh id', () => {
    const inserted = insertMaskVertex(rect, 0, 0.5)!;
    expect(inserted.points).toHaveLength(5);
    close(inserted.points[1], { x: 0.5, y: 0.2 });
    expect(inserted.points[1].id).toBe('vertex-4');
    // The closing edge (last → first) can be split too.
    expect(insertMaskVertex(rect, 3, 0.5)!.points[4]).toMatchObject({ x: 0.2, y: 0.5 });
    expect(insertMaskVertex(rect, 0, 0)).toBeNull();
  });

  it('splits a curved segment without changing the drawn shape (De Casteljau)', () => {
    const ellipse = createEllipseMaskPath('normalized', { x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 });
    const t = 0.3;
    const split = insertMaskVertex(ellipse, 0, t)!;
    for (let step = 0; step <= 10; step += 1) {
      const u = step / 10;
      close(pointOnMaskPathSegment(split, 0, u)!, pointOnMaskPathSegment(ellipse, 0, u * t)!, 12);
      close(pointOnMaskPathSegment(split, 1, u)!, pointOnMaskPathSegment(ellipse, 0, t + u * (1 - t))!, 12);
    }
  });

  it('finds the visually nearest segment in world space', () => {
    const frame = resolveMaskPathFrame(owner(), 'normalized', { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })!;
    // A point just below the middle of the bottom edge (local y = +120).
    const target = maskPathPointToWorld(frame, { x: 0.5, y: 0.8 });
    const hit = nearestMaskPathSegment(rect, frame, { x: target.x, y: target.y + 3 })!;
    expect(hit.segmentIndex).toBe(2);
    expect(hit.t).toBeCloseTo(0.5, 3);
    expect(hit.distance).toBeCloseTo(3, 3);
  });
});
