import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransformControlPoints } from '../components/Inspector/sections/transform/TransformControlPoints';
import type { CharacterPart, Transform } from '../types/animator';

const transform: Transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
const part = {
  id: 'rect', name: 'Rectangle', type: 'custom_rect', width: 100, height: 60,
  fillColor: '#ff0000', strokeColor: '#101218',
} as CharacterPart;

describe('TransformControlPoints compact matrix', () => {
  it('renders one compact matrix with four rows and editable X/Y fields', () => {
    const { container } = render(
      <TransformControlPoints
        selectedPart={part}
        transform={transform}
        coordinateSystem="project-unit-center-v1"
        onUpdate={vi.fn()}
      />,
    );

    expect(container.querySelectorAll('.control-point-group')).toHaveLength(0);
    expect(container.querySelectorAll('.control-point-matrix-row')).toHaveLength(5);
    expect(container.querySelectorAll('.control-point-matrix-row:not(.control-point-matrix-header)')).toHaveLength(4);
    expect(container.querySelectorAll('.control-point-matrix input.input-control')).toHaveLength(8);
    expect(container.querySelectorAll('.control-point-label[style]')).toHaveLength(0);
    expect(container.querySelectorAll('.control-point-dot')).toHaveLength(4);
    expect(screen.getByLabelText('TOP LEFT X')).toHaveValue(-60);
    expect(screen.getByLabelText('BOTTOM RIGHT Y')).toHaveValue(-30);
  });

  it('preserves all edge point values and mode switching', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <TransformControlPoints
        selectedPart={part}
        transform={transform}
        coordinateSystem="project-unit-center-v1"
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edge Points' }));
    expect(screen.getByRole('grid', { name: 'Edge control points' })).toBeTruthy();
    expect(screen.getByLabelText('LEFT POINT X')).toHaveValue(-60);
    expect(screen.getByLabelText('LEFT POINT Y')).toHaveValue(0);
    expect(screen.getByLabelText('RIGHT POINT X')).toHaveValue(60);
    expect(screen.getByLabelText('RIGHT POINT Y')).toHaveValue(0);
    expect(screen.getByLabelText('TOP POINT X')).toHaveValue(0);
    expect(screen.getByLabelText('TOP POINT Y')).toHaveValue(30);
    expect(screen.getByLabelText('BOTTOM POINT X')).toHaveValue(0);
    expect(screen.getByLabelText('BOTTOM POINT Y')).toHaveValue(-30);

    fireEvent.change(container.querySelector('input[aria-label="LEFT POINT X"]') as HTMLInputElement, { target: { value: '-10' } });
    expect(onUpdate).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Corners' }));
    expect(screen.getByRole('grid', { name: 'Corner control points' })).toBeTruthy();
    expect(Array.from(container.querySelectorAll('.control-point-label')).map((label) => label.textContent?.trim())).toEqual([
      'TOP LEFT',
      'TOP RIGHT',
      'BOTTOM LEFT',
      'BOTTOM RIGHT',
    ]);
    expect(container.textContent).not.toMatch(/\((?:TL|TR|BL|BR)\)/);
    expect(screen.getByLabelText('TOP LEFT X')).toHaveValue(-60);
    expect(screen.getByLabelText('TOP RIGHT X')).toHaveValue(60);
    expect(screen.getByLabelText('BOTTOM LEFT Y')).toHaveValue(-30);
    expect(screen.getByLabelText('BOTTOM RIGHT Y')).toHaveValue(-30);

  });
  it('routes every corner field through the existing update callback', () => {
    const onUpdate = vi.fn();
    render(
      <TransformControlPoints
        selectedPart={part}
        transform={transform}
        coordinateSystem="project-unit-center-v1"
        onUpdate={onUpdate}
      />,
    );

    const inputs = Array.from(document.querySelectorAll('.control-point-matrix input.input-control')) as HTMLInputElement[];
    inputs.forEach((input, index) => fireEvent.change(input, { target: { value: String(index + 1) } }));
    expect(onUpdate).toHaveBeenCalledTimes(8);
  });
});
