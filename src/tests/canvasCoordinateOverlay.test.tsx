import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Transform } from '../types/animator';
import type { WorldAffine } from '../utils/geometry/containerMath';
import { CanvasCoordinateOverlay } from '../components/Canvas/overlays/CanvasCoordinateOverlay';
import { CanvasCoordinateReadout } from '../components/Canvas/overlays/CanvasCoordinateReadout';

const ORIGIN = { x: 300, y: 240 };

const transform = (
  overrides: Partial<Transform & { affine?: WorldAffine }> = {},
): Transform & { affine?: WorldAffine } => ({
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  ...overrides,
});

const renderOverlay = (
  selectedTransform: (Transform & { affine?: WorldAffine }) | null = null,
) => render(
  <svg>
    <CanvasCoordinateOverlay
      artX={-660}
      artY={-300}
      width={1920}
      height={1080}
      origin={ORIGIN}
      zScale={1}
      selectedTransform={selectedTransform}
    />
  </svg>,
);

describe('CanvasCoordinateOverlay', () => {
  it('draws X and Y axes through the editor-camera origin', () => {
    const { getByTestId } = renderOverlay();

    const xAxis = getByTestId('coordinate-overlay').querySelector<SVGLineElement>('[data-axis="x"]');
    const yAxis = getByTestId('coordinate-overlay').querySelector<SVGLineElement>('[data-axis="y"]');
    expect(xAxis).not.toBeNull();
    expect(yAxis).not.toBeNull();
    expect(xAxis?.getAttribute('x1')).toBe('-660');
    expect(xAxis?.getAttribute('x2')).toBe('1260');
    expect(xAxis?.getAttribute('y1')).toBe('240');
    expect(xAxis?.getAttribute('y2')).toBe('240');
    expect(yAxis?.getAttribute('x1')).toBe('300');
    expect(yAxis?.getAttribute('x2')).toBe('300');
    expect(yAxis?.getAttribute('y1')).toBe('-300');
    expect(yAxis?.getAttribute('y2')).toBe('780');

    const origin = getByTestId('coordinate-origin').querySelector('circle');
    expect(origin?.getAttribute('cx')).toBe('300');
    expect(origin?.getAttribute('cy')).toBe('240');
  });

  it('marks the selected evaluated world position, not the authored local position', () => {
    const { getByTestId } = renderOverlay(transform({ x: 100, y: -50 }));

    const marker = getByTestId('coordinate-selection-marker');
    expect(marker.getAttribute('data-world-x')).toBe('100');
    expect(marker.getAttribute('data-world-y')).toBe('-50');
    const ring = marker.querySelector('circle');
    expect(ring?.getAttribute('cx')).toBe('400');
    expect(ring?.getAttribute('cy')).toBe('190');
  });

  it('uses the derived world affine for a sheared or parented selection', () => {
    const { getByTestId } = renderOverlay(transform({
      x: 999,
      y: 999,
      affine: { a: 0, b: 1, c: -1, d: 0, e: 120, f: -40 },
    }));

    const marker = getByTestId('coordinate-selection-marker');
    expect(marker.getAttribute('data-world-x')).toBe('120');
    expect(marker.getAttribute('data-world-y')).toBe('-40');
    const ring = marker.querySelector('circle');
    expect(ring?.getAttribute('cx')).toBe('420');
    expect(ring?.getAttribute('cy')).toBe('200');
  });

  it('stays decorative and pointer-transparent', () => {
    const { getByTestId, queryByTestId } = renderOverlay();

    expect(queryByTestId('coordinate-selection-marker')).toBeNull();
    const overlay = getByTestId('coordinate-overlay');
    expect(overlay.getAttribute('pointer-events')).toBe('none');
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('CanvasCoordinateReadout', () => {
  it('uses the Inspector display scale and Y inversion', () => {
    const { getByTestId, rerender } = render(
      <CanvasCoordinateReadout
        transform={transform({ x: 100, y: -50 })}
        coordinateSystem="project-unit-center-v1"
      />,
    );
    expect(getByTestId('coordinate-readout-x')).toHaveTextContent('100');
    expect(getByTestId('coordinate-readout-y')).toHaveTextContent('50');

    rerender(
      <CanvasCoordinateReadout
        transform={transform({ x: 30_000, y: -10_000 })}
        coordinateSystem="legacy-centi-unit-v1"
      />,
    );
    expect(getByTestId('coordinate-readout-x')).toHaveTextContent('300');
    expect(getByTestId('coordinate-readout-y')).toHaveTextContent('100');
  });
});
