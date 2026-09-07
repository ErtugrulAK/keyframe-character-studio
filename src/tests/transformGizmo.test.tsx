import { describe, expect, it } from 'vitest';
import { getTransformGizmoMetrics } from '../utils/transformGizmoMetrics';

describe('TransformGizmo proportional handle metrics', () => {
  it('keeps tiny-object visuals bounded while preserving an 8px screen hit radius', () => {
    const metrics = getTransformGizmoMetrics(4, 4, 1);

    expect(metrics.cornerSize).toBe(3);
    expect(metrics.rotationRadius).toBe(3.2);
    expect(metrics.hitRadius).toBe(8);
  });

  it('scales visible controls from the selected object and clamps large objects', () => {
    const medium = getTransformGizmoMetrics(160, 90, 1);
    const large = getTransformGizmoMetrics(1600, 900, 1);

    expect(medium.cornerSize).toBe(9);
    expect(medium.rotationOffset).toBeCloseTo(19.8);
    expect(large.cornerSize).toBe(9);
    expect(large.rotationOffset).toBe(28);
  });

  it('keeps screen hit targets usable across zoom while visual size responds to zoom', () => {
    const zoomedOut = getTransformGizmoMetrics(100, 60, 3.333333);
    const zoomedIn = getTransformGizmoMetrics(100, 60, 0.333333);

    expect(zoomedOut.hitRadius / 3.333333).toBeCloseTo(8);
    expect(zoomedIn.hitRadius / 0.333333).toBeCloseTo(8);
    expect(zoomedOut.cornerSize / 3.333333).toBeLessThan(zoomedIn.cornerSize / 0.333333);
  });
});
