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
