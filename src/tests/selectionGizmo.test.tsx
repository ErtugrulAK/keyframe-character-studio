import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SelectionGizmo } from '../components/Canvas/SelectionGizmo';
import type { CharacterPart, Transform } from '../types/animator';
import { affineHasShear, applyAffine, type WorldAffine } from '../utils/geometry/containerMath';
import { evaluateTransform } from '../utils/animation/evaluateTransform';
import { getSelectionFrameBounds } from '../utils/geometry/selectionFrame';
import { EDITOR_CAMERA_CENTER } from '../utils/geometry/projectCoordinates';

const transform: Transform = { x: 120, y: -40, rotation: 15, scaleX: 2, scaleY: 0.5, opacity: 1 };

const makePart = (type: CharacterPart['type'], matte?: CharacterPart['matte']): CharacterPart => ({
  id: 'target',
  name: 'Target',
  type,
  zIndex: 1,
  width: 160,
  height: 90,
  points: type === 'custom_freeform' ? [{ x: -40, y: -20 }, { x: 40, y: -20 }, { x: 0, y: 30 }] : undefined,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  matte,
} as CharacterPart);

const renderGizmo = (part: CharacterPart, onTranslateStart = vi.fn()) => render(
  <svg>
    <SelectionGizmo
      selectedPartIds={[part.id]}
      characterParts={[part]}
      getComputedTransform={() => transform}
      currentFrame={0}
      selectedPart={part}
      selectedTransform={transform}
      tracks={[]}
      zScale={1}
      onRotateStart={() => {}}
      onScaleStart={() => {}}
      onTranslateStart={onTranslateStart}
    />
  </svg>,
);

describe('SelectionGizmo — editor-only matte interaction area', () => {
  it('keeps the selection outline and handles in the renderer orientation for mirrored asymmetric shapes', () => {
    const part = makePart('custom_parallelogram');
    const { container } = renderGizmo(part);
    const gizmo = container.querySelector('[data-testid="transform-gizmo"]');

    expect(gizmo).not.toBeNull();
    expect(gizmo?.getAttribute('transform')).toBe('translate(420, 200) rotate(15)');
    expect(gizmo?.querySelector('g')?.getAttribute('transform')).toBe('scale(1, 1)');

    cleanup();
    const mirrored = render(
      <svg>
        <SelectionGizmo
          selectedPartIds={[part.id]}
          characterParts={[part]}
          getComputedTransform={() => ({ ...transform, scaleX: -2 })}
          currentFrame={0}
          selectedPart={part}
          selectedTransform={{ ...transform, scaleX: -2 }}
          tracks={[]}
          zScale={1}
          onRotateStart={() => {}}
          onScaleStart={() => {}}
          onTranslateStart={() => {}}
        />
      </svg>,
    );
    const mirroredGizmo = mirrored.container.querySelector('[data-testid="transform-gizmo"]');
    expect(mirroredGizmo?.querySelector('g')?.getAttribute('transform')).toBe('scale(-1, 1)');
  });
  it('renders individual bounds without a permanent aggregate multi-selection box', () => {
    const parts = [makePart('custom_triangle'), { ...makePart('custom_rect'), id: 'second' }];
    render(
      <svg>
        <SelectionGizmo
          selectedPartIds={parts.map((item) => item.id)}
          characterParts={parts}
          getComputedTransform={() => transform}
          currentFrame={0}
          selectedPart={parts[0]}
          selectedTransform={transform}
          tracks={[]}
          zScale={1}
          onRotateStart={() => {}}
          onScaleStart={() => {}}
          onTranslateStart={() => {}}
        />
      </svg>,
    );
    expect(screen.getAllByTestId('transform-gizmo')).toHaveLength(2);
    expect(screen.queryByTestId('aggregate-selection-box')).toBeNull();
  });

  it('draws tight bounds for asymmetric polygon geometry', () => {
    const { container } = renderGizmo(makePart('custom_triangle'));
    const bounds = container.querySelector('[data-testid="transform-gizmo"] > g > rect');

    expect(bounds).not.toBeNull();
    expect(bounds?.getAttribute('x')).toBe('-70');
    expect(bounds?.getAttribute('y')).toBe('-17.5');
    expect(bounds?.getAttribute('width')).toBe('140');
    expect(bounds?.getAttribute('height')).toBe('30');
  });

  it('derives Boolean selection bounds from current operands instead of persisted contours', () => {
    const group = {
      ...makePart('custom_freeform'),
      id: 'group',
      booleanOperation: 'exclude' as const,
      booleanOperandIds: ['a', 'b'],
      booleanContours: [[{ x: -10000, y: -10000 }, { x: 10000, y: -10000 }, { x: 10000, y: 10000 }]],
      points: [{ x: -10000, y: -10000 }, { x: 10000, y: -10000 }, { x: 10000, y: 10000 }],
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    };
    const a = { ...makePart('custom_rect'), id: 'a', baseTransform: { ...makePart('custom_rect').baseTransform, x: -150 } };
    const b = { ...makePart('custom_rect'), id: 'b', baseTransform: { ...makePart('custom_rect').baseTransform, x: 150 } };
    const transforms: Record<string, Transform> = {
      group: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      a: { x: -150, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      b: { x: 150, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    };
    const { container } = render(
      <svg>
        <SelectionGizmo
          selectedPartIds={['group']}
          characterParts={[group, a, b]}
          getComputedTransform={(id) => transforms[id]}
          currentFrame={0}
          selectedPart={group}
          selectedTransform={transforms.group}
          tracks={[]}
          zScale={1}
          onRotateStart={() => {}}
          onScaleStart={() => {}}
          onTranslateStart={() => {}}
        />
      </svg>,
    );
    const bounds = container.querySelector('[data-testid="transform-gizmo"] > g > rect');
    expect(Number(bounds?.getAttribute('width'))).toBeGreaterThan(300);
    expect(Number(bounds?.getAttribute('width'))).toBeLessThan(500);
  });

  it.each(['custom_image', 'custom_text', 'custom_box', 'custom_freeform'] as const)(
    'exposes evaluated bounds for a selected enabled-matte %s target',
    (type) => {
      renderGizmo(makePart(type, { sourcePartId: 'matte', mode: 'clip', enabled: true }));
      const hitArea = screen.getByTestId('matte-editor-hit-area');

      expect(hitArea.getAttribute('data-part-id')).toBe('target');
      expect(hitArea.parentElement?.getAttribute('transform')).toBe('translate(420, 200) rotate(15) scale(2, 0.5)');
      expect(hitArea.getAttribute('pointer-events')).toBe('all');
    },
  );

  it('starts the existing translate interaction for a fully clipped selected target', () => {
    const onTranslateStart = vi.fn();
    renderGizmo(makePart('custom_image', { sourcePartId: 'matte', mode: 'alpha' }), onTranslateStart);

    fireEvent.mouseDown(screen.getByTestId('matte-editor-hit-area'), { button: 0, clientX: 420, clientY: 200 });

    expect(onTranslateStart).toHaveBeenCalledOnce();
    expect(onTranslateStart.mock.calls[0][0]).toBe('target');
  });

  it('uses the evaluated world transform for a parented matte target', () => {
    const part = { ...makePart('custom_box', { sourcePartId: 'matte', mode: 'clip' }), parentId: 'parent' };
    renderGizmo(part);

    expect(screen.getByTestId('matte-editor-hit-area').parentElement?.getAttribute('transform'))
      .toBe('translate(420, 200) rotate(15) scale(2, 0.5)');
  });

  it('does not expose an invisible hit area without a selected part', () => {
    const part = makePart('custom_box', { sourcePartId: 'matte', mode: 'clip' });
    render(
      <svg>
        <SelectionGizmo
          selectedPartIds={[]}
          characterParts={[part]}
          getComputedTransform={() => transform}
          currentFrame={0}
          selectedPart={undefined}
          selectedTransform={null}
          tracks={[]}
          zScale={1}
          onRotateStart={() => {}}
          onScaleStart={() => {}}
          onTranslateStart={() => {}}
        />
      </svg>,
    );
    expect(screen.queryByTestId('matte-editor-hit-area')).toBeNull();
  });

  it.each([
    undefined,
    { sourcePartId: 'matte', mode: 'clip' as const, enabled: false },
    { mode: 'clip' as const, enabled: true },
  ])('does not alter non-matte, disabled, or unresolved-matte interaction', (matte) => {
    renderGizmo(makePart('custom_box', matte));
    expect(screen.queryByTestId('matte-editor-hit-area')).toBeNull();
  });
});

describe('SelectionGizmo — layer group frame', () => {
  const imagePart = (id: string): CharacterPart => ({ ...makePart('custom_image'), id, name: id, type: 'custom_image', width: 100, height: 40, parentId: 'g' });
  const groupPart = (): CharacterPart => ({ ...makePart('custom_freeform'), id: 'g', name: 'Group', isGroup: true });

  const renderGroup = (
    children: CharacterPart[],
    world: Record<string, Transform>,
    zScale = 1,
    onScaleStart: () => void = () => {},
  ) => render(
    <svg>
      <SelectionGizmo
        selectedPartIds={['g']}
        characterParts={[...children, groupPart()]}
        getComputedTransform={(partId) => world[partId]}
        currentFrame={0}
        selectedPart={groupPart()}
        selectedTransform={world.g}
        tracks={[]}
        zScale={zScale}
        onRotateStart={() => {}}
        onScaleStart={onScaleStart}
        onTranslateStart={() => {}}
      />
    </svg>,
  );

  const identity = (x: number, y = 0, rotation = 0): Transform => ({ x, y, rotation, scaleX: 1, scaleY: 1, opacity: 1 });

  it('draws ONE aggregate box around the children instead of per-layer frames', () => {
    renderGroup([imagePart('a'), imagePart('b')], { g: identity(0), a: identity(-100), b: identity(100) });

    expect(screen.getAllByTestId('transform-gizmo')).toHaveLength(1);
    const box = screen.getByTestId('group-aggregate-box');
    const halo = box.querySelector('[data-testid="selection-frame-halo"]')!;

    // Children span -150..150 in the group's own space, whose origin is 0.
    expect(halo.getAttribute('x')).toBe('-150');
    expect(halo.getAttribute('y')).toBe('-20');
    expect(halo.getAttribute('width')).toBe('300');
    expect(halo.getAttribute('height')).toBe('40');
    expect(box.getAttribute('data-group-id')).toBe('g');
  });

  it('keeps the frame decorative: a paired light/dark outline plus accent stroke, and no extra hitboxes', () => {
    renderGroup([imagePart('a'), imagePart('b')], { g: identity(0), a: identity(-100), b: identity(100) }, 2);

    const box = screen.getByTestId('group-aggregate-box');
    const halo = box.querySelector('[data-testid="selection-frame-halo"]')!;
    const keyline = box.querySelector('[data-testid="selection-frame-keyline"]')!;
    const [accent] = [...box.querySelectorAll('rect')].filter((rect) => rect.getAttribute('stroke') === '#4a8fe7');

    expect(halo.getAttribute('pointer-events')).toBe('none');
    expect(halo.getAttribute('style')).toContain('var(--bg-darkest)');
    expect(keyline.getAttribute('pointer-events')).toBe('none');
    // The light half of the pair is the contrast partner of the dark core.
    expect(keyline.getAttribute('style')).toContain('var(--kcs-selection-keyline)');
    // C12 — the frame strokes are non-scaling, so their widths are already
    // screen pixels: they must NOT be multiplied by the zoom compensation as
    // well (at this 0.5 zoom that doubled them; zoomed far out, the dashed
    // frame painted 5 px thick). The pair is thinner than the single black
    // band it replaced (3 + 1 < 2 x 3.5).
    for (const stroke of [keyline, halo]) expect(stroke.getAttribute('vector-effect')).toBe('non-scaling-stroke');
    expect(keyline.getAttribute('stroke-width')).toBe('3');
    expect(halo.getAttribute('stroke-width')).toBe('1');
    expect(accent.getAttribute('pointer-events')).toBe('none');
    expect(accent.getAttribute('vector-effect')).toBe('non-scaling-stroke');
    expect(accent.getAttribute('stroke-width')).toBe('1.5');
    expect(accent.getAttribute('stroke-dasharray')).toBe('5 4');
    // The light keyline frames the dark core, and the accent dash rides on top.
    expect([...box.querySelectorAll('rect')].indexOf(keyline)).toBeLessThan(
      [...box.querySelectorAll('rect')].indexOf(halo),
    );
    // 4 corner + 4 edge + 1 rotation handle: the frame itself adds none.
    expect(screen.getAllByTestId('gizmo-hit-target')).toHaveLength(9);
  });

  it('moves with the container transform so the handles stay on the aggregate bounds', () => {
    renderGroup([imagePart('a'), imagePart('b')], { g: identity(30, -20), a: identity(-70, -20), b: identity(130, -20) });

    const gizmo = screen.getByTestId('transform-gizmo');
    const halo = screen.getByTestId('selection-frame-halo');
    // outputOrigin (300, 240) + the container's own position (30, -20).
    expect(gizmo.getAttribute('transform')).toBe('translate(330, 220) rotate(0)');
    // Local units: the box travels with the container, it is not re-centred.
    expect(halo.getAttribute('x')).toBe('-150');
  });

  it('composes a rotated child into the aggregate box', () => {
    renderGroup([imagePart('a'), imagePart('b')], { g: identity(0), a: identity(-100, 0, 90), b: identity(100) });

    const halo = screen.getByTestId('selection-frame-halo');
    // The 100x40 image rotated 90° spans 40x100 about its own centre, so the
    // left edge is -120 and the whole box is 135 wide around centre 15.
    expect(halo.getAttribute('height')).toBe('100');
    expect(halo.getAttribute('width')).toBe('270');
    expect(halo.getAttribute('x')).toBe('-120');
  });

  it('re-centres the box on the layers when a child moves after grouping', () => {
    renderGroup([imagePart('a'), imagePart('b')], { g: identity(0), a: identity(-300), b: identity(100) });

    const halo = screen.getByTestId('selection-frame-halo');
    const box = screen.getByTestId('group-aggregate-box');
    const accent = [...box.querySelectorAll('rect')].find((rect) => rect.getAttribute('stroke') === '#4a8fe7')!;
    // Box centre is the live aggregate centre (-100), not the container origin.
    expect(Number(accent.getAttribute('x')) + Number(accent.getAttribute('width')) / 2).toBe(-100);
    expect(halo.getAttribute('width')).toBe('500');
  });

  it('hands a corner drag the aggregate box, not the container geometry', () => {
    const onScaleStart = vi.fn();
    renderGroup([imagePart('a'), imagePart('b')], { g: identity(0), a: identity(-100), b: identity(100) }, 1, onScaleStart);

    // A container owns no geometry, so anchoring the drag on its own bounds
    // would scale the frame around the wrong box. The first four hit targets
    // are the corner handles.
    fireEvent.mouseDown(screen.getAllByTestId('gizmo-hit-target')[0], { button: 0 });

    expect(onScaleStart).toHaveBeenCalledTimes(1);
    expect(onScaleStart.mock.calls[0][2]).toEqual({ minX: -150, minY: -20, maxX: 150, maxY: 20 });
  });

  it('draws NOTHING for a group with no measurable layers (no placeholder square)', () => {
    // R2-04: a geometryless container with nothing inside it has no frame to
    // draw. `getPartLocalBounds`'s synthetic ±32 square is never a valid frame.
    renderGroup([], { g: identity(0) });
    expect(screen.queryByTestId('group-aggregate-box')).toBeNull();
    expect(screen.queryByTestId('transform-gizmo')).toBeNull();
    expect(screen.queryByTestId('selection-frame-halo')).toBeNull();
  });

  it('never measures a container as a placeholder square in a multi-selection', () => {
    // The user's scenario: a group plus its descendants selected together.
    render(
      <svg>
        <SelectionGizmo
          selectedPartIds={['g', 'a', 'b']}
          characterParts={[imagePart('a'), imagePart('b'), groupPart()]}
          getComputedTransform={(partId) => ({ g: identity(0), a: identity(-100), b: identity(100) }[partId] as Transform)}
          currentFrame={0}
          selectedPart={groupPart()}
          selectedTransform={identity(0)}
          tracks={[]}
          zScale={1}
          onRotateStart={() => {}}
          onScaleStart={() => {}}
          onTranslateStart={() => {}}
        />
      </svg>,
    );

    // The children draw the envelope; the covered container adds no duplicate.
    expect(screen.getAllByTestId('transform-gizmo')).toHaveLength(2);
    screen.getAllByTestId('selection-frame-halo').forEach((halo) => {
      expect(Math.abs(Number(halo.getAttribute('width'))), 'a placeholder square was drawn').toBeGreaterThan(64);
    });
  });

  it('draws the children-derived box for a selected container in a multi-selection', () => {
    render(
      <svg>
        <SelectionGizmo
          selectedPartIds={['g', 'a']}
          characterParts={[imagePart('a'), imagePart('b'), groupPart()]}
          getComputedTransform={(partId) => ({ g: identity(0), a: identity(-100), b: identity(100) }[partId] as Transform)}
          currentFrame={0}
          selectedPart={groupPart()}
          selectedTransform={identity(0)}
          tracks={[]}
          zScale={1}
          onRotateStart={() => {}}
          onScaleStart={() => {}}
          onTranslateStart={() => {}}
        />
      </svg>,
    );

    // `b` is not selected, so the container's aggregate box is not redundant and
    // must be the union of a and b (-150..150), never a 64px placeholder.
    const widths = screen.getAllByTestId('selection-frame-halo').map((halo) => Number(halo.getAttribute('width')));
    expect(widths).toContain(300);
    expect(widths.every((width) => width > 64)).toBe(true);
  });

  it('lets an empty nested group contribute nothing to its parent envelope', () => {
    const nested = { ...makePart('custom_freeform'), id: 'nested', name: 'Nested', isGroup: true, parentId: 'g' };
    render(
      <svg>
        <SelectionGizmo
          selectedPartIds={['g']}
          characterParts={[imagePart('a'), imagePart('b'), groupPart(), nested]}
          getComputedTransform={(partId) => ({ g: identity(0), nested: identity(0), a: identity(-100), b: identity(100) }[partId] as Transform)}
          currentFrame={0}
          selectedPart={groupPart()}
          selectedTransform={identity(0)}
          tracks={[]}
          zScale={1}
          onRotateStart={() => {}}
          onScaleStart={() => {}}
          onTranslateStart={() => {}}
        />
      </svg>,
    );

    // -150..150 from the two images; the empty container adds no ±32 square.
    const halo = screen.getByTestId('selection-frame-halo');
    expect(halo.getAttribute('width')).toBe('300');
    expect(halo.getAttribute('x')).toBe('-150');
  });
});

/**
 * A selection frame whose world map is not a TRS.
 *
 * A rotated child of an anisotropically scaled container renders as the exact
 * nesting `R(θp)·S(sp)·R(θc)·S(sc)` — a general 2×2 — so the frame is the LOCAL
 * box mapped by the derived affine (a parallelogram), the pivot is that
 * parallelogram's centre, and every TRS layer keeps its historical markup.
 */
const anisotropicGroup: CharacterPart = {
  ...makePart('custom_freeform'),
  id: 'g',
  name: 'Group',
  isGroup: true,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 1, opacity: 1 },
};

const rotatedChild = (id: string, rotation: number): CharacterPart => ({
  ...makePart('custom_rect'),
  id,
  name: id,
  parentId: 'g',
  baseTransform: { x: 40, y: 0, rotation, scaleX: 1, scaleY: 1, opacity: 1 },
});

const worldOf = (parts: CharacterPart[], id: string) => evaluateTransform(parts, [], 'Sequence', id, 0);

/** The evaluated affine, asserted present: a missing one is a failure, not a skip. */
const requiredAffine = (world: Transform & { affine?: WorldAffine }): WorldAffine => {
  if (!world.affine) throw new Error('the evaluated world transform carries no affine');
  return world.affine;
};

const renderSelection = (parts: CharacterPart[], selectedIds: string[], onScaleStart = vi.fn()) => render(
  <svg>
    <SelectionGizmo
      selectedPartIds={selectedIds}
      characterParts={parts}
      getComputedTransform={(partId) => worldOf(parts, partId)}
      currentFrame={0}
      selectedPart={parts.find((part) => part.id === selectedIds[0])}
      selectedTransform={worldOf(parts, selectedIds[0])}
      tracks={[]}
      zScale={1}
      onRotateStart={() => {}}
      onScaleStart={onScaleStart}
      onTranslateStart={() => {}}
    />
  </svg>,
);

describe('SelectionGizmo — a frame whose world map is not a TRS', () => {
  it('draws the exact parallelogram, puts its edge handles on it, and drags the LOCAL box', () => {
    const child = rotatedChild('c30', 30);
    const parts = [anisotropicGroup, child];
    const onScaleStart = vi.fn();
    const { container } = renderSelection(parts, [child.id], onScaleStart);

    const world = worldOf(parts, child.id);
    const affine = requiredAffine(world);
    expect(affineHasShear(affine)).toBe(true);
    const bounds = getSelectionFrameBounds(child, {
      characterParts: parts,
      getComputedTransform: (partId) => worldOf(parts, partId),
      currentFrame: 0,
      transform: world,
    })!;

    // The frame is the LOCAL box under the emitted matrix: the layer's exact map.
    const frame = container.querySelector('[data-testid="transform-gizmo"] > g')!;
    expect(frame.getAttribute('transform')).toBe(
      `translate(${EDITOR_CAMERA_CENTER.x}, ${EDITOR_CAMERA_CENTER.y}) matrix(${affine.a} ${affine.b} ${affine.c} ${affine.d} ${affine.e} ${affine.f})`,
    );
    const halo = container.querySelector('[data-testid="selection-frame-halo"]')!;
    expect(halo.getAttribute('x')).toBe(String(bounds.minX));
    expect(halo.getAttribute('width')).toBe(String(bounds.maxX - bounds.minX));

    // The left edge handle sits on the mapped midpoint of the drawn parallelogram's left edge.
    const leftMid = applyAffine(affine, { x: bounds.minX, y: (bounds.minY + bounds.maxY) / 2 });
    const leftHandle = container.querySelector('circle[fill="#4a8fe7"]')!;
    expect(Number(leftHandle.getAttribute('cx'))).toBeCloseTo(leftMid.x, 6);
    expect(Number(leftHandle.getAttribute('cy'))).toBeCloseTo(leftMid.y, 6);

    // A handle lies on the frame, and the drag it starts still receives the box
    // the frame drew — the LOCAL box, never a pre-scaled one.
    const handle = container.querySelector('rect[fill="#4a8fe7"]')!;
    const onFrame = applyAffine(affine, { x: bounds.minX, y: bounds.minY });
    expect(Number(handle.getAttribute('x')) + Number(handle.getAttribute('width')) / 2).toBeCloseTo(onFrame.x, 6);
    expect(Number(handle.getAttribute('y')) + Number(handle.getAttribute('height')) / 2).toBeCloseTo(onFrame.y, 6);

    fireEvent.mouseDown(container.querySelectorAll('[data-testid="gizmo-hit-target"]')[0], { button: 0 });
    expect(onScaleStart).toHaveBeenCalledTimes(1);
    expect(onScaleStart.mock.calls[0][2]).toEqual({
      minX: bounds.minX, minY: bounds.minY, maxX: bounds.maxX, maxY: bounds.maxY,
    });
  });

  it('draws decorative parallelogram frames for a sheared multi-selection', () => {
    const first = rotatedChild('c30', 30);
    const second = rotatedChild('c60', 60);
    const parts = [anisotropicGroup, first, second];
    const { container } = renderSelection(parts, [first.id, second.id]);

    const frames = [...container.querySelectorAll('[data-testid="transform-gizmo"]')];
    expect(frames).toHaveLength(2);
    frames.forEach((frame) => {
      expect(frame.querySelector('g')!.getAttribute('transform')).toContain('matrix(');
    });
    // Decorative frames add no interactivity of their own.
    expect(container.querySelectorAll('[data-testid="gizmo-hit-target"]')).toHaveLength(0);
    expect(container.querySelectorAll('rect[fill="#4a8fe7"]')).toHaveLength(0);
  });

  it('keeps the historical TRS markup for a single selected layer whose map IS a TRS', () => {
    const { container } = renderGizmo(makePart('custom_triangle'));

    expect(container.innerHTML).not.toContain('matrix(');
    const gizmo = container.querySelector('[data-testid="transform-gizmo"]')!;
    expect(gizmo.getAttribute('transform')).toBe('translate(420, 200) rotate(15)');
    expect(gizmo.querySelector('g')!.getAttribute('transform')).toBe('scale(1, 1)');
  });
});
