import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FreeformTangentOverlay } from '../components/Canvas/overlays/FreeformTangentOverlay';
import type { CharacterPart, Transform } from '../types/animator';

const ORIGIN = { x: 0, y: 0 };
const IDENTITY: Transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

function makePart(overrides: Partial<CharacterPart> = {}): CharacterPart {
  return {
    id: 'free',
    name: 'Free',
    type: 'custom_freeform',
    zIndex: 1,
    baseTransform: { ...IDENTITY },
    points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }],
    ...overrides,
  } as CharacterPart;
}

interface HarnessProps {
  initialPart: CharacterPart;
  transform?: Transform;
  onBatchStart?: () => void;
  onBatchEnd?: () => void;
}

/** Mirrors how StageCanvas applies a path write back into its part state. */
function Harness({ initialPart, transform = IDENTITY, onBatchStart = () => {}, onBatchEnd = () => {} }: HarnessProps) {
  const [part, setPart] = useState<CharacterPart>(initialPart);
  return (
    <FreeformTangentOverlay
      part={part}
      transform={transform}
      zScale={1}
      toWorld={(clientX, clientY) => ({ svgX: clientX, svgY: clientY })}
      outputOrigin={ORIGIN}
      onPathChange={(next) => setPart((previous) => ({ ...previous, path: next }))}
      onBatchStart={onBatchStart}
      onBatchEnd={onBatchEnd}
    />
  );
}

const openHandlesFor = (index: number) => {
  const markers = screen.getAllByTestId('freeform-vertex-marker');
  fireEvent.pointerDown(markers[index], { clientX: 0, clientY: 0, pointerId: 1 });
};

describe('FreeformTangentOverlay', () => {
  it('renders one marker per path vertex and shows handles only for the selected vertex', () => {
    const part = makePart({
      path: {
        version: 1,
        coordinateSpace: 'local',
        closed: true,
        points: [
          { id: 'a', x: 0, y: 0, handleOut: { x: 6, y: 0 }, handleIn: { x: -6, y: 0 }, kind: 'smooth' },
          { id: 'b', x: 20, y: 0, handleIn: { x: 14, y: 0 } },
          { id: 'c', x: 20, y: 20 },
        ],
      },
    });
    render(<Harness initialPart={part} />);

    expect(screen.getAllByTestId('freeform-vertex-marker')).toHaveLength(3);
    expect(screen.queryByTestId('freeform-tangent-handle-out')).toBeNull();
    expect(screen.queryByTestId('freeform-tangent-handle-in')).toBeNull();

    openHandlesFor(0);
    expect(screen.getByTestId('freeform-tangent-handle-out')).toBeTruthy();
    expect(screen.getByTestId('freeform-tangent-handle-in')).toBeTruthy();
  });

  it('shows no handle for a corner vertex that has none', () => {
    const part = makePart({
      path: {
        version: 1,
        coordinateSpace: 'local',
        closed: true,
        points: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 20, y: 0 }, { id: 'c', x: 20, y: 20 }],
      },
    });
    render(<Harness initialPart={part} />);

    openHandlesFor(1);
    expect(screen.queryByTestId('freeform-tangent-handle-out')).toBeNull();
    expect(screen.queryByTestId('freeform-tangent-handle-in')).toBeNull();
  });

  it('drags one handle through the existing write path and leaves other vertices identical', () => {
    const onBatchStart = vi.fn();
    const onBatchEnd = vi.fn();
    const part = makePart({
      path: {
        version: 1,
        coordinateSpace: 'local',
        closed: true,
        points: [
          { id: 'a', x: 0, y: 0, handleOut: { x: 6, y: 0 }, kind: 'corner' },
          { id: 'b', x: 20, y: 0 },
          { id: 'c', x: 20, y: 20 },
        ],
      },
    });
    render(<Harness initialPart={part} onBatchStart={onBatchStart} onBatchEnd={onBatchEnd} />);

    openHandlesFor(0);
    const handle = screen.getByTestId('freeform-tangent-handle-out');
    fireEvent.pointerDown(handle, { clientX: 6, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 11, clientY: -3, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 11, clientY: -3, pointerId: 1 });

    expect(onBatchStart).toHaveBeenCalledTimes(1);
    expect(onBatchEnd).toHaveBeenCalledTimes(1);
    // The marker circle is re-rendered from the new path; read the committed path
    // through the next render instead of reaching into component state.
    const marker = screen.getAllByTestId('freeform-vertex-marker')[0];
    fireEvent.pointerDown(marker, { clientX: 0, clientY: 0, pointerId: 2 });
    const moved = screen.getByTestId('freeform-tangent-handle-out');
    expect(Number(moved.getAttribute('cx'))).toBeCloseTo(11, 6);
    expect(Number(moved.getAttribute('cy'))).toBeCloseTo(-3, 6);
  });

  it('mirrors the counterpart handle when dragging a smooth vertex', () => {
    const part = makePart({
      path: {
        version: 1,
        coordinateSpace: 'local',
        closed: true,
        points: [
          { id: 'a', x: 0, y: 0, handleOut: { x: 6, y: 0 }, handleIn: { x: -6, y: 0 }, kind: 'smooth' },
          { id: 'b', x: 20, y: 0 },
          { id: 'c', x: 20, y: 20 },
        ],
      },
    });
    render(<Harness initialPart={part} />);

    openHandlesFor(0);
    const handle = screen.getByTestId('freeform-tangent-handle-out');
    fireEvent.pointerDown(handle, { clientX: 6, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 0, clientY: 8, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 0, clientY: 8, pointerId: 1 });

    const incoming = screen.getByTestId('freeform-tangent-handle-in');
    // Contract: the counterpart keeps its own length (6) on the opposite direction.
    expect(Number(incoming.getAttribute('cx'))).toBeCloseTo(0, 6);
    expect(Number(incoming.getAttribute('cy'))).toBeCloseTo(-6, 6);
  });

  it('rolls the drag back on Escape and closes the batch once', () => {
    const onBatchEnd = vi.fn();
    const part = makePart({
      path: {
        version: 1,
        coordinateSpace: 'local',
        closed: true,
        points: [
          { id: 'a', x: 0, y: 0, handleOut: { x: 6, y: 0 } },
          { id: 'b', x: 20, y: 0 },
          { id: 'c', x: 20, y: 20 },
        ],
      },
    });
    render(<Harness initialPart={part} onBatchEnd={onBatchEnd} />);

    openHandlesFor(0);
    const handle = screen.getByTestId('freeform-tangent-handle-out');
    fireEvent.pointerDown(handle, { clientX: 6, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 16, clientY: 4, pointerId: 1 });
    fireEvent.keyDown(window, { key: 'Escape' });

    const restored = screen.getByTestId('freeform-tangent-handle-out');
    expect(Number(restored.getAttribute('cx'))).toBeCloseTo(6, 6);
    expect(onBatchEnd).toHaveBeenCalledTimes(1);
  });

  it('materializes a local canonical path for a points-only layer without moving the anchors', () => {
    render(<Harness initialPart={makePart()} />);

    openHandlesFor(0);
    expect(screen.queryByTestId('freeform-tangent-handle-out')).toBeNull();
    // Double-click turns the vertex smooth and creates the handles.
    fireEvent.doubleClick(screen.getAllByTestId('freeform-vertex-marker')[0]);

    const outgoing = screen.getByTestId('freeform-tangent-handle-out');
    // Chord through vertex 0 = (20,0) - (0,20) = (20,-20) → unit (1/√2, -1/√2), reach 5.
    expect(Number(outgoing.getAttribute('cx'))).toBeCloseTo(5 / Math.SQRT2, 6);
    expect(Number(outgoing.getAttribute('cy'))).toBeCloseTo(-5 / Math.SQRT2, 6);
    const anchors = screen.getAllByTestId('freeform-vertex-marker');
    expect(anchors[0].parentElement?.getAttribute('transform')).toBe('translate(0, 0)');
    expect(anchors[2].parentElement?.getAttribute('transform')).toBe('translate(20, 20)');
  });
});
