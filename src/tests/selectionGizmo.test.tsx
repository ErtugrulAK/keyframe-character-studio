import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SelectionGizmo } from '../components/Canvas/SelectionGizmo';
import type { CharacterPart, Transform } from '../types/animator';

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
        onScaleStart={() => {}}
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

  it('keeps the frame decorative: dark halo plus accent stroke, and no extra hitboxes', () => {
    renderGroup([imagePart('a'), imagePart('b')], { g: identity(0), a: identity(-100), b: identity(100) }, 2);

    const box = screen.getByTestId('group-aggregate-box');
    const halo = box.querySelector('[data-testid="selection-frame-halo"]')!;
    const [accent] = [...box.querySelectorAll('rect')].filter((rect) => rect.getAttribute('stroke') === '#00d2ff');

    expect(halo.getAttribute('pointer-events')).toBe('none');
    expect(halo.getAttribute('style')).toContain('var(--bg-darkest)');
    // A decorative stroke never scales with zoom, so its width must compensate.
    expect(halo.getAttribute('stroke-width')).toBe('7');
    expect(accent.getAttribute('pointer-events')).toBe('none');
    expect(accent.getAttribute('stroke-width')).toBe('3');
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
    const accent = [...box.querySelectorAll('rect')].find((rect) => rect.getAttribute('stroke') === '#00d2ff')!;
    // Box centre is the live aggregate centre (-100), not the container origin.
    expect(Number(accent.getAttribute('x')) + Number(accent.getAttribute('width')) / 2).toBe(-100);
    expect(halo.getAttribute('width')).toBe('500');
  });

  it('falls back to the container box for a group with no layers', () => {
    renderGroup([], { g: identity(0) });
    expect(screen.queryByTestId('group-aggregate-box')).toBeNull();
    expect(screen.getAllByTestId('transform-gizmo')).toHaveLength(1);
  });
});
