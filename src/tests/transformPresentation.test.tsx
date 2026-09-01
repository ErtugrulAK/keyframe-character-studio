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

vi.mock('../context/AnimatorContext', () => ({
  useAnimator: () => ({
    isScaleLocked: true,
    setIsScaleLocked: vi.fn(),
  }),
}));

describe('TransformTab compact presentation', () => {
  const renderTab = (onUpdate = vi.fn(), onZIndexChange = vi.fn()) => render(
    <TransformTab
      selectedPart={part}
      transform={transform}
      coordinateSystem="project-unit-center-v1"
      currentFrame={0}
      updateCurrentTransform={onUpdate}
      handleZIndexChange={onZIndexChange}
      customPresets={[]}
      onSavePreset={vi.fn()}
      onUpdatePreset={vi.fn()}
      onDeletePreset={vi.fn()}
    />,
  );

  it('starts Transform and Control Points closed without authored mutations', () => {
    const onUpdate = vi.fn();
    const { container } = renderTab(onUpdate);

    expect(screen.getByRole('button', { name: 'Expand TRANSFORM' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Expand CONTROL POINTS' })).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelector('input[aria-label="Position X"]')).toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Expand TRANSFORM' }));
    expect(screen.getByLabelText('Position X')).toHaveValue(10);
    expect(screen.getByLabelText('Position Y')).toHaveValue(20);
    expect(screen.getByLabelText('Rotation')).toHaveValue(15);
    expect(screen.getByLabelText('Layer index')).toHaveTextContent('3');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('keeps rotation reset and layer callbacks unchanged', () => {
    const onUpdate = vi.fn();
    const onZIndexChange = vi.fn();
    renderTab(onUpdate, onZIndexChange);
    fireEvent.click(screen.getByRole('button', { name: 'Expand TRANSFORM' }));

    fireEvent.click(screen.getByRole('button', { name: 'Reset 0°' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bring Forward (+1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send Backward (-1)' }));

    expect(onUpdate).toHaveBeenCalledWith({ rotation: 0 });
    expect(onZIndexChange).toHaveBeenNthCalledWith(1, 4);
    expect(onZIndexChange).toHaveBeenNthCalledWith(2, 2);
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
