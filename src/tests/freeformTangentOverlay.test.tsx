import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FreeformTangentOverlay } from '../components/Canvas/overlays/FreeformTangentOverlay';
import { EDITOR_CAMERA_CENTER } from '../utils/projectCoordinates';
import { getFreeformVertexWorldPositions } from '../utils/freeform';
import type { BezierPath, CharacterPart, Transform } from '../types/animator';

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

function makePath(points: BezierPath['points']): BezierPath {
  return { version: 1, coordinateSpace: 'local', closed: true, points };
}

interface HarnessProps {
  initialPart: CharacterPart;
  transform?: Transform;
  outputOrigin?: { x: number; y: number };
  onBatchStart?: () => void;
  onBatchEnd?: () => void;
  onPathChange?: (path: BezierPath) => void;
}

/** Mirrors how StageCanvas applies a path write back into its part state. */
function Harness({
  initialPart,
  transform = IDENTITY,
  outputOrigin = ORIGIN,
  onBatchStart = () => {},
  onBatchEnd = () => {},
  onPathChange,
}: HarnessProps) {
  const [part, setPart] = useState<CharacterPart>(initialPart);
  return (
    <FreeformTangentOverlay
      part={part}
      transform={transform}
      zScale={1}
      toWorld={(clientX, clientY) => ({ svgX: clientX, svgY: clientY })}
      outputOrigin={outputOrigin}
      onPathChange={(next) => {
        onPathChange?.(next);
        setPart((previous) => ({ ...previous, path: next }));
      }}
      onBatchStart={onBatchStart}
      onBatchEnd={onBatchEnd}
    />
  );
}

const openHandlesFor = (index: number) => {
  const markers = screen.getAllByTestId('freeform-vertex-marker');
  fireEvent.pointerDown(markers[index], { clientX: 0, clientY: 0, pointerId: 1 });
};

const attributeOf = (testId: string, name: string) => Number(screen.getByTestId(testId).getAttribute(name));

describe('FreeformTangentOverlay', () => {
  it('renders one marker per path vertex and shows handles only for the selected vertex', () => {
    const part = makePart({
      path: makePath([
        { id: 'a', x: 0, y: 0, handleOut: { x: 6, y: 0 }, handleIn: { x: -6, y: 0 }, kind: 'smooth' },
        { id: 'b', x: 20, y: 0, handleIn: { x: 14, y: 0 } },
        { id: 'c', x: 20, y: 20 },
      ]),
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
      path: makePath([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 20, y: 0 }, { id: 'c', x: 20, y: 20 }]),
    });
    render(<Harness initialPart={part} />);

    openHandlesFor(1);
    expect(screen.queryByTestId('freeform-tangent-handle-out')).toBeNull();
    expect(screen.queryByTestId('freeform-tangent-handle-in')).toBeNull();
  });

  it('commits the dragged handle and leaves every other vertex and handle untouched', () => {
    const onBatchStart = vi.fn();
    const onBatchEnd = vi.fn();
    const path = makePath([
      { id: 'a', x: 0, y: 0, handleOut: { x: 6, y: 0 }, handleIn: { x: -6, y: 0 }, kind: 'smooth' },
      { id: 'b', x: 20, y: 0, handleOut: { x: 26, y: 0 }, handleIn: { x: 14, y: 0 }, kind: 'smooth' },
      { id: 'c', x: 20, y: 20 },
    ]);
    render(<Harness initialPart={makePart({ path })} onBatchStart={onBatchStart} onBatchEnd={onBatchEnd} />);

    openHandlesFor(0);
    const handle = screen.getByTestId('freeform-tangent-handle-out');
    fireEvent.pointerDown(handle, { clientX: 6, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 11, clientY: -3, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 11, clientY: -3, pointerId: 1 });

    expect(onBatchStart).toHaveBeenCalledTimes(1);
    expect(onBatchEnd).toHaveBeenCalledTimes(1);
    expect(attributeOf('freeform-tangent-handle-out', 'cx')).toBeCloseTo(11, 6);
    expect(attributeOf('freeform-tangent-handle-out', 'cy')).toBeCloseTo(-3, 6);

    // Vertex 1 and its handles are untouched by the drag on vertex 0.
    const markers = screen.getAllByTestId('freeform-vertex-marker');
    expect(markers[1].parentElement?.getAttribute('transform')).toBe('translate(20, 0)');
    expect(markers[2].parentElement?.getAttribute('transform')).toBe('translate(20, 20)');
    expect(markers[0].parentElement?.getAttribute('transform')).toBe('translate(0, 0)');
    fireEvent.pointerDown(markers[1], { clientX: 0, clientY: 0, pointerId: 2 });
    expect(attributeOf('freeform-tangent-handle-out', 'cx')).toBeCloseTo(26, 6);
    expect(attributeOf('freeform-tangent-handle-out', 'cy')).toBeCloseTo(0, 6);
    expect(attributeOf('freeform-tangent-handle-in', 'cx')).toBeCloseTo(14, 6);
    expect(attributeOf('freeform-tangent-handle-in', 'cy')).toBeCloseTo(0, 6);
  });

  it('mirrors the counterpart handle when dragging a smooth vertex', () => {
    const part = makePart({
      path: makePath([
        { id: 'a', x: 0, y: 0, handleOut: { x: 6, y: 0 }, handleIn: { x: -6, y: 0 }, kind: 'smooth' },
        { id: 'b', x: 20, y: 0 },
        { id: 'c', x: 20, y: 20 },
      ]),
    });
    render(<Harness initialPart={part} />);

    openHandlesFor(0);
    const handle = screen.getByTestId('freeform-tangent-handle-out');
    fireEvent.pointerDown(handle, { clientX: 6, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 0, clientY: 8, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 0, clientY: 8, pointerId: 1 });

    // Contract: the counterpart keeps its own length (6) on the opposite direction.
    expect(attributeOf('freeform-tangent-handle-in', 'cx')).toBeCloseTo(0, 6);
    expect(attributeOf('freeform-tangent-handle-in', 'cy')).toBeCloseTo(-6, 6);
  });

  it('keeps the counterpart handle stable when a smooth handle is dragged exactly onto its anchor', () => {
    const part = makePart({
      path: makePath([
        { id: 'a', x: 0, y: 0, handleOut: { x: 6, y: 0 }, handleIn: { x: -6, y: 0 }, kind: 'smooth' },
        { id: 'b', x: 20, y: 0 },
        { id: 'c', x: 20, y: 20 },
      ]),
    });
    render(<Harness initialPart={part} />);

    openHandlesFor(0);
    const handle = screen.getByTestId('freeform-tangent-handle-out');
    fireEvent.pointerDown(handle, { clientX: 6, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 0, clientY: 0, pointerId: 1 });

    const outgoing = screen.getByTestId('freeform-tangent-handle-out');
    const incoming = screen.getByTestId('freeform-tangent-handle-in');
    expect(Number(outgoing.getAttribute('cx'))).toBeCloseTo(0, 6);
    expect(Number(outgoing.getAttribute('cy'))).toBeCloseTo(0, 6);
    // The counterpart keeps its previous length (6) instead of collapsing to the anchor.
    expect(Number(incoming.getAttribute('cx'))).toBeCloseTo(-6, 6);
    expect(Number(incoming.getAttribute('cy'))).toBeCloseTo(0, 6);
    expect(Number.isFinite(Number(incoming.getAttribute('cx')))).toBe(true);
    expect(Number.isFinite(Number(incoming.getAttribute('cy')))).toBe(true);
  });

  it('rolls the drag back on Escape and closes the batch once', () => {
    const onBatchEnd = vi.fn();
    const part = makePart({
      path: makePath([
        { id: 'a', x: 0, y: 0, handleOut: { x: 6, y: 0 } },
        { id: 'b', x: 20, y: 0 },
        { id: 'c', x: 20, y: 20 },
      ]),
    });
    render(<Harness initialPart={part} onBatchEnd={onBatchEnd} />);

    openHandlesFor(0);
    const handle = screen.getByTestId('freeform-tangent-handle-out');
    fireEvent.pointerDown(handle, { clientX: 6, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 16, clientY: 4, pointerId: 1 });
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(attributeOf('freeform-tangent-handle-out', 'cx')).toBeCloseTo(6, 6);
    expect(onBatchEnd).toHaveBeenCalledTimes(1);
  });

  it('closes the batch when Escape follows a pointerdown that never moved', () => {
    const onBatchStart = vi.fn();
    const onBatchEnd = vi.fn();
    const onPathChange = vi.fn();
    const part = makePart({
      path: makePath([
        { id: 'a', x: 0, y: 0, handleOut: { x: 6, y: 0 } },
        { id: 'b', x: 20, y: 0 },
        { id: 'c', x: 20, y: 20 },
      ]),
    });
    render(
      <Harness
        initialPart={part}
        onBatchStart={onBatchStart}
        onBatchEnd={onBatchEnd}
        onPathChange={onPathChange}
      />,
    );

    openHandlesFor(0);
    const handle = screen.getByTestId('freeform-tangent-handle-out');
    fireEvent.pointerDown(handle, { clientX: 6, clientY: 0, pointerId: 1 });
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onBatchStart).toHaveBeenCalledTimes(1);
    expect(onBatchEnd).toHaveBeenCalledTimes(1);
    // The rollback write is the only path write of a drag that never moved.
    expect(onPathChange).toHaveBeenCalledTimes(1);
    expect(onPathChange.mock.calls[0][0]).toEqual(part.path);

    // The Escape listener is gone once the drag ended.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onBatchEnd).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape while no handle drag is in flight', () => {
    const onBatchEnd = vi.fn();
    const onPathChange = vi.fn();
    const part = makePart({
      path: makePath([
        { id: 'a', x: 0, y: 0, handleOut: { x: 6, y: 0 } },
        { id: 'b', x: 20, y: 0 },
        { id: 'c', x: 20, y: 20 },
      ]),
    });
    render(<Harness initialPart={part} onBatchEnd={onBatchEnd} onPathChange={onPathChange} />);

    openHandlesFor(0);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onPathChange).not.toHaveBeenCalled();
    expect(onBatchEnd).not.toHaveBeenCalled();
  });

  it('commits the dragged value on pointercancel and closes the batch', () => {
    const onBatchEnd = vi.fn();
    const part = makePart({
      path: makePath([
        { id: 'a', x: 0, y: 0, handleOut: { x: 6, y: 0 } },
        { id: 'b', x: 20, y: 0 },
        { id: 'c', x: 20, y: 20 },
      ]),
    });
    render(<Harness initialPart={part} onBatchEnd={onBatchEnd} />);

    openHandlesFor(0);
    const handle = screen.getByTestId('freeform-tangent-handle-out');
    fireEvent.pointerDown(handle, { clientX: 6, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 9, clientY: 7, pointerId: 1 });
    fireEvent.pointerCancel(handle, { clientX: 9, clientY: 7, pointerId: 1 });

    expect(attributeOf('freeform-tangent-handle-out', 'cx')).toBeCloseTo(9, 6);
    expect(attributeOf('freeform-tangent-handle-out', 'cy')).toBeCloseTo(7, 6);
    expect(onBatchEnd).toHaveBeenCalledTimes(1);
  });

  it('marks the dragged handle as selected and clears it again when a vertex is clicked', () => {
    const part = makePart({
      path: makePath([
        { id: 'a', x: 0, y: 0, handleOut: { x: 6, y: 0 }, handleIn: { x: -6, y: 0 }, kind: 'smooth' },
        { id: 'b', x: 20, y: 0 },
        { id: 'c', x: 20, y: 20 },
      ]),
    });
    render(<Harness initialPart={part} />);

    openHandlesFor(0);
    const handle = screen.getByTestId('freeform-tangent-handle-out');
    expect(handle.getAttribute('data-selected')).toBe('false');

    fireEvent.pointerDown(handle, { clientX: 6, clientY: 0, pointerId: 1 });
    expect(screen.getByTestId('freeform-tangent-handle-out').getAttribute('data-selected')).toBe('true');
    expect(screen.getByTestId('freeform-tangent-handle-in').getAttribute('data-selected')).toBe('false');
    fireEvent.pointerUp(handle, { clientX: 6, clientY: 0, pointerId: 1 });

    openHandlesFor(0);
    expect(screen.getByTestId('freeform-tangent-handle-out').getAttribute('data-selected')).toBe('false');
  });

  it('drops the overlay selection when the shown layer changes and keeps the app selection untouched', () => {
    const path = makePath([
      { id: 'a', x: 0, y: 0, handleOut: { x: 6, y: 0 }, handleIn: { x: -6, y: 0 }, kind: 'smooth' },
      { id: 'b', x: 20, y: 0 },
      { id: 'c', x: 20, y: 20 },
    ]);

    /** Keeps one mounted overlay and swaps the part it is showing, like selecting another layer. */
    function LayerSwitchingHarness() {
      const [activeId, setActiveId] = useState('free-a');
      return (
        <>
          <FreeformTangentOverlay
            part={makePart({ id: activeId, path })}
            transform={IDENTITY}
            zScale={1}
            toWorld={(clientX, clientY) => ({ svgX: clientX, svgY: clientY })}
            outputOrigin={ORIGIN}
            onPathChange={() => {}}
            onBatchStart={() => {}}
            onBatchEnd={() => {}}
          />
          <button
            data-testid="switch-layer"
            onClick={() => setActiveId((current) => (current === 'free-a' ? 'free-b' : 'free-a'))}
          >
            switch
          </button>
        </>
      );
    }

    render(<LayerSwitchingHarness />);

    openHandlesFor(0);
    expect(screen.getByTestId('freeform-tangent-handle-out')).toBeTruthy();

    fireEvent.click(screen.getByTestId('switch-layer'));

    expect(screen.queryByTestId('freeform-tangent-handle-out')).toBeNull();
    expect(screen.queryByTestId('freeform-tangent-handle-in')).toBeNull();
    expect(screen.getAllByTestId('freeform-vertex-marker')).toHaveLength(3);
  });

  it('drops a selected index that no longer exists after the path loses vertices', () => {
    const full = makePath([
      { id: 'a', x: 0, y: 0, handleOut: { x: 6, y: 0 } },
      { id: 'b', x: 20, y: 0 },
      { id: 'c', x: 20, y: 20, handleOut: { x: 26, y: 20 } },
    ]);

    /** Same layer id, shrinking topology — the overlay must drop the stale index itself. */
    function ShrinkingPathHarness() {
      const [points, setPoints] = useState(full.points);
      return (
        <>
          <FreeformTangentOverlay
            part={makePart({ path: { ...full, points } })}
            transform={IDENTITY}
            zScale={1}
            toWorld={(clientX, clientY) => ({ svgX: clientX, svgY: clientY })}
            outputOrigin={ORIGIN}
            onPathChange={() => {}}
            onBatchStart={() => {}}
            onBatchEnd={() => {}}
          />
          <button data-testid="shrink-path" onClick={() => setPoints((current) => current.slice(0, 2))}>
            shrink
          </button>
        </>
      );
    }

    render(<ShrinkingPathHarness />);

    openHandlesFor(2);
    expect(screen.getByTestId('freeform-tangent-handle-out')).toBeTruthy();

    fireEvent.click(screen.getByTestId('shrink-path'));

    expect(screen.queryByTestId('freeform-tangent-handle-out')).toBeNull();
    expect(screen.getAllByTestId('freeform-vertex-marker')).toHaveLength(2);
  });

  it('keeps its markers and ids when the canonical path wins over differing legacy points', () => {
    const path = makePath([
      { id: 'a', x: 0, y: 0, handleOut: { x: 6, y: 0 } },
      { id: 'b', x: 20, y: 0 },
      { id: 'c', x: 20, y: 20 },
    ]);
    render(<Harness initialPart={makePart({ path, points: [{ x: -80, y: -80 }, { x: -60, y: -80 }, { x: -60, y: -60 }, { x: -80, y: -60 }] })} />);

    const markers = screen.getAllByTestId('freeform-vertex-marker');
    expect(markers).toHaveLength(3);
    expect(markers[0].parentElement?.getAttribute('transform')).toBe('translate(0, 0)');
    expect(markers[1].parentElement?.getAttribute('transform')).toBe('translate(20, 0)');
    expect(markers[2].parentElement?.getAttribute('transform')).toBe('translate(20, 20)');
  });

  it('materializes a local canonical path for a points-only layer without moving the anchors', () => {
    render(<Harness initialPart={makePart()} />);

    openHandlesFor(0);
    expect(screen.queryByTestId('freeform-tangent-handle-out')).toBeNull();
    fireEvent.doubleClick(screen.getAllByTestId('freeform-vertex-marker')[0]);

    const outgoing = screen.getByTestId('freeform-tangent-handle-out');
    // Chord through vertex 0 = (20,0) - (0,20) = (20,-20) → unit (1/√2, -1/√2), reach 5.
    expect(attributeOf('freeform-tangent-handle-out', 'cx')).toBeCloseTo(5 / Math.SQRT2, 6);
    expect(attributeOf('freeform-tangent-handle-out', 'cy')).toBeCloseTo(-5 / Math.SQRT2, 6);
    const anchors = screen.getAllByTestId('freeform-vertex-marker');
    expect(anchors[0].parentElement?.getAttribute('transform')).toBe('translate(0, 0)');
    expect(anchors[2].parentElement?.getAttribute('transform')).toBe('translate(20, 20)');
    expect(outgoing).toBeTruthy();
  });
});

describe('FreeformTangentOverlay coordinate mapping', () => {
  const transformRows: [string, Transform][] = [
    ['identity', IDENTITY],
    ['rotation only', { ...IDENTITY, rotation: 30 }],
    ['non-uniform scale', { ...IDENTITY, scaleX: 2, scaleY: 0.5 }],
    ['negative scaleX', { ...IDENTITY, scaleX: -1.4, scaleY: 0.75 }],
    ['rotation + non-uniform + negative scale + offset', { x: 12, y: -8, rotation: -37, scaleX: -1.4, scaleY: 0.75, opacity: 1 }],
  ];

  it.each(transformRows)('lands the dragged handle exactly on the pointer under %s', (_label, transform) => {
    const path = makePath([
      { id: 'a', x: 0, y: 0, handleOut: { x: 6, y: 0 } },
      { id: 'b', x: 20, y: 0 },
      { id: 'c', x: 20, y: 20 },
    ]);
    render(<Harness initialPart={makePart({ path })} transform={transform} outputOrigin={EDITOR_CAMERA_CENTER} />);
    const worldOf = (point: { x: number; y: number }) => getFreeformVertexWorldPositions(
      [point],
      EDITOR_CAMERA_CENTER.x + transform.x,
      EDITOR_CAMERA_CENTER.y + transform.y,
      transform.scaleX,
      transform.scaleY,
      transform.rotation,
    )[0];

    openHandlesFor(0);
    const start = worldOf({ x: 6, y: 0 });
    const handle = screen.getByTestId('freeform-tangent-handle-out');
    expect(Number(handle.getAttribute('cx'))).toBeCloseTo(start.x, 6);
    expect(Number(handle.getAttribute('cy'))).toBeCloseTo(start.y, 6);

    const delta = { x: 17, y: -11 };
    fireEvent.pointerDown(handle, { clientX: start.x, clientY: start.y, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: start.x + delta.x, clientY: start.y + delta.y, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: start.x + delta.x, clientY: start.y + delta.y, pointerId: 1 });

    const moved = screen.getByTestId('freeform-tangent-handle-out');
    expect(Number(moved.getAttribute('cx'))).toBeCloseTo(start.x + delta.x, 6);
    expect(Number(moved.getAttribute('cy'))).toBeCloseTo(start.y + delta.y, 6);
  });
});
