import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Transform } from '../types/animator';
import { TransformPositionRotationCard } from '../components/Inspector/sections/transform/TransformPositionRotationCard';

const transform: Transform = { x: 0, y: 0, rotation: 10, scaleX: 1, scaleY: 1, opacity: 1 };

const editPosition = (coordinateSystem: 'legacy-unknown' | 'project-unit-center-v1', value: string) => {
  const onUpdate = vi.fn();
  const { container } = render(
    <TransformPositionRotationCard
      transform={transform}
      coordinateSystem={coordinateSystem}
      onUpdate={onUpdate}
    />,
  );
  const inputs = container.querySelectorAll('input');
  fireEvent.change(inputs[0], { target: { value } });
  fireEvent.change(inputs[1], { target: { value } });
  return onUpdate;
};

describe('coordinate V2 transform authoring boundary', () => {
  it('uses raw project units for project-unit scenes', () => {
    const onUpdate = editPosition('project-unit-center-v1', '300');
    expect(onUpdate).toHaveBeenNthCalledWith(1, { x: 300 });
  });

  it('preserves the legacy 0.01 Inspector conversion for legacy-unknown scenes', () => {
    const onUpdate = editPosition('legacy-unknown', '300');
    expect(onUpdate).toHaveBeenNthCalledWith(1, { x: 30000 });
  });

  it('keeps the positive-up Inspector Y convention while storing SVG-positive-down', () => {
    const rawUpdate = vi.fn();

    const { container } = render(
      <TransformPositionRotationCard
        transform={transform}
        coordinateSystem="project-unit-center-v1"
        onUpdate={rawUpdate}
      />,
    );
    fireEvent.change(container.querySelectorAll('input')[1], { target: { value: '100' } });
    expect(rawUpdate).toHaveBeenCalledWith({ y: -100 });
  });
});
