import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransformGizmo } from '../components/Canvas/overlays/TransformGizmo';
import type { CharacterPart, Transform } from '../types/animator';
import { affineEquals, affineHasShear, affineOfTransform, applyAffine, invertAffine, type WorldAffine } from '../utils/containerMath';
import { getPartLocalBounds } from '../utils/bounds';
import { evaluateTransform } from '../utils/evaluateTransform';
import { selectionFrameGizmoBounds } from '../utils/selectionFrame';
import { EDITOR_CAMERA_CENTER } from '../utils/projectCoordinates';
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

/**
 * A frame whose world map is not a TRS.
 *
 * A rotated child of an anisotropically scaled container renders as the exact
 * nesting `R(θp)·S(sp)·R(θc)·S(sc)` — a general 2×2 — so its frame is a
 * PARALLELOGRAM: the local box mapped by the derived affine. These tests hold
 * the gizmo to that geometry, and hold every TRS layer to its historical markup.
 */
const TRS = (over: Partial<Transform> = {}): Transform => ({
  x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, ...over,
});

/** An anisotropically scaled container: the parent that makes a child's map shear. */
const anisotropicGroup: CharacterPart = {
  id: 'g', type: 'custom_freeform', name: 'Group', zIndex: 0, isGroup: true, points: [],
  baseTransform: TRS({ scaleX: 2, scaleY: 1 }),
} as unknown as CharacterPart;

const childOfGroup = (id: string, rotation: number, over: Partial<Transform> = {}): CharacterPart => ({
  id, type: 'custom_rect', name: id, zIndex: 1, width: 100, height: 60, parentId: 'g',
  baseTransform: TRS({ x: 40, rotation, ...over }),
} as unknown as CharacterPart);

const worldOf = (part: CharacterPart, parts: CharacterPart[] = [anisotropicGroup, part]) =>
  evaluateTransform(parts, [], 'Sequence', part.id, 0);

/** A layer with no container: its own TRS IS its world map, so it carries no affine. */
const plainRoot = (): CharacterPart => ({
  id: 'plain', type: 'custom_rect', name: 'plain', zIndex: 1, width: 100, height: 60,
  baseTransform: TRS({ x: 40, rotation: 15, scaleX: 2, scaleY: 0.5 }),
} as unknown as CharacterPart);

/** The evaluated affine, asserted present: a missing one is a failure, not a skip. */
const requiredAffine = (world: Transform & { affine?: WorldAffine }): WorldAffine => {
  if (!world.affine) throw new Error('the evaluated world transform carries no affine');
  return world.affine;
};

const renderPart = (part: CharacterPart, onScaleStart = vi.fn()) => {
  const world = worldOf(part);
  const bounds = getPartLocalBounds(part);
  const rendered = render(
    <svg>
      <TransformGizmo
        selectedPart={part}
        selectedTransform={world}
        zScale={1}
        onRotateMouseDown={() => {}}
        onScaleMouseDown={onScaleStart}
        outputOrigin={EDITOR_CAMERA_CENTER}
        {...selectionFrameGizmoBounds(bounds, world)}
      />
    </svg>,
  );
  return { world, bounds, rendered, onScaleStart };
};

const centerOf = (element: Element) => ({
  x: Number(element.getAttribute('x')) + Number(element.getAttribute('width')) / 2,
  y: Number(element.getAttribute('y')) + Number(element.getAttribute('height')) / 2,
});

/**
 * Read the emitted frame spelling back into a map: the affine the markup
 * actually renders (`translate(origin + x, origin + y) rotate scale`, or
 * `translate(origin) matrix`). This is how the tests hold the drawn frame to the
 * layer's exact map instead of to a spelling.
 */
const emittedAffine = (transform: string, origin: { x: number; y: number }): WorldAffine => {
  const matrix = /matrix\(([^)]+)\)/.exec(transform);
  if (matrix) {
    const [a, b, c, d, e, f] = matrix[1].split(/\s+/).map(Number);
    return { a, b, c, d, e, f };
  }
  const translate = /translate\(([^)]+)\)/.exec(transform);
  const rotate = /rotate\(([^)]+)\)/.exec(transform);
  const scale = /scale\(([^)]+)\)/.exec(transform);
  if (!translate || !rotate || !scale) throw new Error(`unreadable frame spelling: ${transform}`);
  const [tx, ty] = translate[1].split(',').map((part) => Number(part.trim()));
  const [sx, sy] = scale[1].split(',').map((part) => Number(part.trim()));
  return affineOfTransform({ x: tx - origin.x, y: ty - origin.y, rotation: Number(rotate[1]), scaleX: sx, scaleY: sy });
};

describe('TransformGizmo — the affine frame of a layer whose map is not a TRS', () => {
  it('emits the sheared frame as matrix(...) over the LOCAL box, handles on its corners', () => {
    const { world, bounds, rendered } = renderPart(childOfGroup('c30', 30));
    const affine = requiredAffine(world);
    // A 30° child under a container scaled (2, 1): the exact map is genuinely sheared.
    expect(affineHasShear(affine)).toBe(true);

    const frame = rendered.container.querySelector('[data-testid="transform-gizmo"] > g')!;
    expect(frame.getAttribute('transform')).toBe(
      `translate(${EDITOR_CAMERA_CENTER.x}, ${EDITOR_CAMERA_CENTER.y}) matrix(${affine.a} ${affine.b} ${affine.c} ${affine.d} ${affine.e} ${affine.f})`,
    );
    // ...and the markup therefore renders the layer's exact map.
    expect(affineEquals(emittedAffine(frame.getAttribute('transform')!, EDITOR_CAMERA_CENTER), affine)).toBe(true);

    // The drawn rect is the LOCAL box — the emitted matrix carries the scale.
    const halo = rendered.getByTestId('selection-frame-halo');
    expect(halo.getAttribute('x')).toBe(String(bounds.minX));
    expect(halo.getAttribute('y')).toBe(String(bounds.minY));
    expect(halo.getAttribute('width')).toBe(String(bounds.maxX - bounds.minX));
    expect(halo.getAttribute('height')).toBe(String(bounds.maxY - bounds.minY));

    // Every corner handle sits on the affine image of its own local box corner.
    const corners = [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.minX, y: bounds.maxY },
      { x: bounds.maxX, y: bounds.maxY },
    ];
    const handles = [...rendered.container.querySelectorAll('rect[fill="#00d2ff"]')];
    expect(handles).toHaveLength(4);
    handles.forEach((handle, index) => {
      const onFrame = applyAffine(affine, corners[index]);
      expect(centerOf(handle).x).toBeCloseTo(onFrame.x, 6);
      expect(centerOf(handle).y).toBeCloseTo(onFrame.y, 6);
    });

    // A handle mapped back through the affine lands on the local box corner: the
    // handle lies ON the drawn parallelogram, not on a box a TRS would produce.
    const back = applyAffine(invertAffine(affine)!, centerOf(handles[0]));
    expect(back.x).toBeCloseTo(bounds.minX, 6);
    expect(back.y).toBeCloseTo(bounds.minY, 6);

    // The rotation stem starts on the frame's top edge and the pivot is its centre.
    const boxCenter = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
    const stem = rendered.container.querySelector('line')!;
    const topEdge = applyAffine(affine, { x: boxCenter.x, y: bounds.minY });
    expect(Number(stem.getAttribute('x1'))).toBeCloseTo(topEdge.x, 6);
    expect(Number(stem.getAttribute('y1'))).toBeCloseTo(topEdge.y, 6);
    const pivot = rendered.container.querySelector('circle')!;
    const center = applyAffine(affine, boxCenter);
    expect(Number(pivot.getAttribute('cx'))).toBeCloseTo(center.x, 6);
    expect(Number(pivot.getAttribute('cy'))).toBeCloseTo(center.y, 6);
  });

  it('hands a corner drag the LOCAL box the frame drew', () => {
    const onScaleStart = vi.fn();
    const { bounds, rendered } = renderPart(childOfGroup('c30', 30), onScaleStart);

    fireEvent.mouseDown(rendered.getAllByTestId('gizmo-hit-target')[0], { button: 0 });

    expect(onScaleStart).toHaveBeenCalledTimes(1);
    expect(onScaleStart.mock.calls[0][1]).toBe('scale_corner_tl');
    expect(onScaleStart.mock.calls[0][2]).toEqual({
      minX: bounds.minX, minY: bounds.minY, maxX: bounds.maxX, maxY: bounds.maxY,
    });
  });

  it('frames an axis-swapped layer by its exact map and its LOCAL box', () => {
    const { world, bounds, rendered } = renderPart(childOfGroup('c90', 90));
    const affine = requiredAffine(world);

    // A 90° child is an axis swap, not a shear — yet the summed/multiplied TRS
    // reading is a DIFFERENT map, so the frame cannot be drawn from it.
    expect(affineHasShear(affine)).toBe(false);
    const frame = rendered.container.querySelector('[data-testid="transform-gizmo"] > g')!;
    expect(affineEquals(emittedAffine(frame.getAttribute('transform')!, EDITOR_CAMERA_CENTER), affine)).toBe(true);

    // The rect is the LOCAL box (the spelling's own scale carries the swap), and
    // the handles are still the affine images of its corners.
    const halo = rendered.getByTestId('selection-frame-halo');
    expect(halo.getAttribute('width')).toBe(String(bounds.maxX - bounds.minX));
    expect(halo.getAttribute('height')).toBe(String(bounds.maxY - bounds.minY));
    const [firstCorner] = [...rendered.container.querySelectorAll('rect[fill="#00d2ff"]')];
    const onFrame = applyAffine(affine, { x: bounds.minX, y: bounds.minY });
    expect(centerOf(firstCorner).x).toBeCloseTo(onFrame.x, 6);
    expect(centerOf(firstCorner).y).toBeCloseTo(onFrame.y, 6);
  });

  it('keeps the historical TRS markup for a layer whose map IS a TRS', () => {
    const { world, bounds, rendered } = renderPart(plainRoot());
    expect(world.affine).toBeUndefined();
    // The props are exactly the five historical TRS props: no affine frame.
    expect(Object.keys(selectionFrameGizmoBounds(bounds, world)).sort()).toEqual([
      'overrideBounds', 'overrideCenterX', 'overrideCenterY', 'overrideHalfH', 'overrideHalfW',
    ]);

    const gizmo = rendered.container.querySelector('[data-testid="transform-gizmo"]')!;
    expect(gizmo.getAttribute('transform')).toBe(`translate(${EDITOR_CAMERA_CENTER.x + 40}, ${EDITOR_CAMERA_CENTER.y}) rotate(15)`);
    expect(gizmo.querySelector('g')!.getAttribute('transform')).toBe('scale(1, 1)');
    expect(rendered.container.innerHTML).not.toContain('matrix(');

    // The frame is still the SCALED local box, and the handles still follow it:
    // the wrapping rotate-only transform with a scale-carrying rect is the exact
    // map of this layer's TRS.
    const halo = rendered.getByTestId('selection-frame-halo');
    expect(halo.getAttribute('x')).toBe(String(bounds.minX * 2));
    expect(halo.getAttribute('width')).toBe(String((bounds.maxX - bounds.minX) * 2));
    const [firstCorner] = [...rendered.container.querySelectorAll('rect[fill="#00d2ff"]')];
    expect(centerOf(firstCorner).x).toBeCloseTo(bounds.minX * 2, 6);
    expect(centerOf(firstCorner).y).toBeCloseTo(bounds.minY * 0.5, 6);
  });
});
