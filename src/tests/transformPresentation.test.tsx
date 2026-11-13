import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransformTab } from '../components/Inspector/sections/TransformTab';
import type { CharacterPart, Transform } from '../types/animator';

const transform: Transform = { x: 10, y: -20, rotation: 15, scaleX: 1, scaleY: 1, opacity: 1 };
const part = {
  id: 'rect', name: 'Rectangle', type: 'custom_rect', width: 100, height: 60,
  x: 10, y: -20, rotation: 15, scaleX: 1, scaleY: 1, opacity: 1,
  fillColor: '#ff0000', strokeColor: '#101218', zIndex: 3,
} as CharacterPart;

const setIsScaleLocked = vi.fn();
vi.mock('../context/useAnimator', () => ({
  useAnimator: () => ({ isScaleLocked: true, setIsScaleLocked }),
  useAnimatorSlice: () => ({ isScaleLocked: true, setIsScaleLocked }),
}));

describe('TransformTab compact presentation', () => {
  const renderTab = (onUpdate = vi.fn()) => render(
    <TransformTab
      selectedPart={part}
      transform={transform}
      coordinateSystem="project-unit-center-v1"
      currentFrame={0}
      updateCurrentTransform={onUpdate}
      customPresets={[]}
      onSavePreset={vi.fn()}
      onUpdatePreset={vi.fn()}
      onDeletePreset={vi.fn()}
    />,
  );

  const expandTransform = () => fireEvent.click(screen.getByRole('button', { name: 'Expand TRANSFORM' }));

  it('starts Transform and Control Points closed without authored mutations', () => {
    const onUpdate = vi.fn();
    const { container } = renderTab(onUpdate);

    expect(screen.getByRole('button', { name: 'Expand TRANSFORM' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Expand CONTROL POINTS' })).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelector('input[aria-label="Position X"]')).toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();

    expandTransform();
    expect(screen.getByLabelText('Position X')).toHaveValue(10);
    expect(screen.getByLabelText('Position Y')).toHaveValue(20);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('R5-14 — Position is one two-column row followed by one compact trio row', () => {
    const { container } = renderTab();
    expandTransform();

    // Position keeps its own row and its two columns.
    const positionRow = container.querySelector('.transform-position-row');
    expect(positionRow).not.toBeNull();
    expect(positionRow!.querySelectorAll('input')).toHaveLength(2);

    // Rotation, Scale and Opacity are cells of ONE grid.
    const trio = container.querySelector('.transform-compact-grid');
    expect(trio).not.toBeNull();
    const cells = trio!.querySelectorAll('.transform-compact-cell');
    expect(cells).toHaveLength(3);
    expect([...cells].map((cell) => cell.querySelector('.transform-property-title')?.textContent))
      .toEqual(['Rotation', 'Scale', 'Layer opacity']);
    expect(screen.getByLabelText('Rotation')).toHaveValue(15);
    expect(screen.getByLabelText('Scale')).toHaveValue(100);
    expect(screen.getByLabelText('Layer opacity')).toHaveValue(100);
  });

  it('R5-14 — Details no longer duplicates the reset, the labelled lock or keyframing', () => {
    const onUpdate = vi.fn();
    const { container } = renderTab(onUpdate);
    expandTransform();

    expect(screen.queryByRole('button', { name: 'Reset 0°' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Locked|Free/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Keyframe/ })).toBeNull();
    // ...and the removed actions write nothing on their own.
    expect(onUpdate).not.toHaveBeenCalled();
    expect(container.querySelector('.transform-layer-value')).toBeNull();
  });

  it('R5-14 — the aspect lock stays reachable as one compact glyph', () => {
    renderTab();
    expandTransform();

    const lock = screen.getByRole('button', { name: 'Lock aspect ratio' });
    expect(lock).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(lock);
    expect(setIsScaleLocked).toHaveBeenCalledWith(false);
  });

  it('R5-14 — Scale still writes both channels together, and rotation stays editable', () => {
    const onUpdate = vi.fn();
    renderTab(onUpdate);
    expandTransform();

    fireEvent.change(screen.getByLabelText('Scale'), { target: { value: '150' } });
    expect(onUpdate).toHaveBeenCalledWith({ scaleX: 1.5, scaleY: 1.5 });
    fireEvent.change(screen.getByLabelText('Rotation'), { target: { value: '45' } });
    expect(onUpdate).toHaveBeenCalledWith({ rotation: 45 });
  });

  it('opens the matrix separately and preserves edge labels', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Expand CONTROL POINTS' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edge Points' }));

    expect(screen.getByRole('grid', { name: 'Edge control points' })).toBeTruthy();
    expect(screen.getByLabelText('LEFT POINT X')).toHaveValue(-50);
    expect(screen.getByLabelText('RIGHT POINT X')).toHaveValue(70);
    expect(screen.getByLabelText('TOP POINT Y')).toHaveValue(50);
    expect(screen.getAllByRole('row')).toHaveLength(5);
  });
});
