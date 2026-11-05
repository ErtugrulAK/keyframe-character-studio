import React from 'react';
import { act, render } from '@testing-library/react';
import { leaveStage, rememberStagePointer } from '../utils/editor/stagePointer';
import { describe, expect, it } from 'vitest';
import type { Transform } from '../types/animator';
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
  visibleRect: { left: number; right: number; top: number; bottom: number } | null = null,
) => render(
  <svg>
    <CanvasCoordinateOverlay
      artX={-660}
      artY={-300}
      width={1920}
      height={1080}
      origin={ORIGIN}
      zScale={1}
      visibleRect={visibleRect}
    />
  </svg>,
);

const points = (polygon: Element | null) => (polygon?.getAttribute('points') ?? '')
  .split(' ').map((pair) => pair.split(',').map(Number));

describe('CanvasCoordinateOverlay', () => {
  it('draws faint white X and Y axes through the editor-camera origin', () => {
    const { getByTestId } = renderOverlay();

    const xAxis = getByTestId('coordinate-overlay').querySelector<SVGLineElement>('[data-axis="x"]');
    const yAxis = getByTestId('coordinate-overlay').querySelector<SVGLineElement>('[data-axis="y"]');
    expect(xAxis?.getAttribute('x1')).toBe('-660');
    expect(xAxis?.getAttribute('x2')).toBe('1260');
    expect(xAxis?.getAttribute('y1')).toBe('240');
    expect(xAxis?.getAttribute('y2')).toBe('240');
    expect(yAxis?.getAttribute('x1')).toBe('300');
    expect(yAxis?.getAttribute('y1')).toBe('-300');
    expect(yAxis?.getAttribute('y2')).toBe('780');
    for (const axis of [xAxis, yAxis]) expect(axis?.getAttribute('stroke')).toMatch(/^rgba\(255, 255, 255, 0\.\d+\)$/);
  });

  it('has no origin marker, no X/Y badges and no selection centre marker', () => {
    const { queryByTestId, getByTestId } = renderOverlay();
    expect(queryByTestId('coordinate-origin')).toBeNull();
    expect(queryByTestId('coordinate-axis-badge-x')).toBeNull();
    expect(queryByTestId('coordinate-selection-marker')).toBeNull();
    expect(getByTestId('coordinate-overlay').querySelector('text')).toBeNull();
  });

  it('puts a small triangle on each visible edge where an axis crosses it, pointing at the origin', () => {
    const view = { left: -100, right: 700, top: 0, bottom: 500 };
    const { getByTestId } = renderOverlay(view);
    const left = points(getByTestId('coordinate-axis-marker-left'));
    const right = points(getByTestId('coordinate-axis-marker-right'));
    const top = points(getByTestId('coordinate-axis-marker-top'));
    const bottom = points(getByTestId('coordinate-axis-marker-bottom'));
    // Base on the edge, tip inwards on the axis.
    expect(left[0][0]).toBe(-100);
    expect(left[1]).toEqual([-95, 240]);
    expect(right[1]).toEqual([695, 240]);
    expect(top[1]).toEqual([300, 5]);
    expect(bottom[1]).toEqual([300, 495]);
    // The axes reach the edges of the view.
    const xAxis = getByTestId('coordinate-overlay').querySelector('[data-axis="x"]');
    expect(xAxis?.getAttribute('x1')).toBe('-660');
  });

  it('the markers follow the axes when the view pans, and hide when an axis is off screen', () => {
    const { getByTestId, queryByTestId, rerender } = renderOverlay({ left: 0, right: 800, top: 100, bottom: 600 });
    expect(points(getByTestId('coordinate-axis-marker-left'))[1]).toEqual([5, 240]);
    rerender(
      <svg>
        <CanvasCoordinateOverlay artX={-660} artY={-300} width={1920} height={1080} origin={ORIGIN} zScale={1} visibleRect={{ left: 0, right: 800, top: 260, bottom: 700 }} />
      </svg>,
    );
    expect(queryByTestId('coordinate-axis-marker-left')).toBeNull();
    expect(points(getByTestId('coordinate-axis-marker-top'))[1]).toEqual([300, 265]);
  });

  it('keeps a constant on-screen marker size at any zoom', () => {
    const { getByTestId } = render(
      <svg>
        <CanvasCoordinateOverlay artX={-660} artY={-300} width={1920} height={1080} origin={ORIGIN} zScale={4} visibleRect={{ left: 0, right: 800, top: 0, bottom: 600 }} />
      </svg>,
    );
    expect(points(getByTestId('coordinate-axis-marker-left'))[1]).toEqual([20, 240]);
  });

  it('the markers follow the pointer over the stage, and return to the axes when it leaves', () => {
    const view = { left: 0, right: 800, top: 0, bottom: 600 };
    const { getByTestId } = renderOverlay(view);
    // World (100, -40) is stage point (400, 200).
    act(() => rememberStagePointer({ x: 100, y: -40 }));
    expect(points(getByTestId('coordinate-axis-marker-top'))[1]).toEqual([400, 5]);
    expect(points(getByTestId('coordinate-axis-marker-left'))[1]).toEqual([5, 200]);
    act(() => leaveStage());
    expect(points(getByTestId('coordinate-axis-marker-top'))[1]).toEqual([300, 5]);
    expect(points(getByTestId('coordinate-axis-marker-left'))[1]).toEqual([5, 240]);
  });

  it('stays decorative and pointer-transparent', () => {
    const { getByTestId } = renderOverlay();
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
