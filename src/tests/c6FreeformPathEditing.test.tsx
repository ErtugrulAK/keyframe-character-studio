import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FreeformTangentOverlay } from '../components/Canvas/overlays/FreeformTangentOverlay';
import type { BezierPath, CharacterPart, Transform } from '../types/animator';

/**
 * C6 — editing a path layer on the canvas: a point drags with its handles as
 * one history batch (a plain click opens none), and a double-click on the
 * outline inserts a point there without changing the curve.
 */

const IDENTITY: Transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
const rect: BezierPath = {
  version: 1,
  coordinateSpace: 'local',
  closed: true,
  points: [
    { id: 'a', x: 0, y: 0, kind: 'corner' },
    { id: 'b', x: 100, y: 0, kind: 'smooth', handleIn: { x: 90, y: -10 }, handleOut: { x: 110, y: 10 } },
    { id: 'c', x: 100, y: 50, kind: 'corner' },
    { id: 'd', x: 0, y: 50, kind: 'corner' },
  ],
};

function Harness({ onBatchStart, onBatchEnd, onPath }: { onBatchStart: () => void; onBatchEnd: () => void; onPath: (path: BezierPath) => void }) {
  const [part, setPart] = useState<CharacterPart>({ id: 'p', name: 'P', type: 'custom_freeform', zIndex: 1, baseTransform: { ...IDENTITY }, path: rect } as CharacterPart);
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <FreeformTangentOverlay
      part={part}
      transform={IDENTITY}
      zScale={1}
      toWorld={(clientX, clientY) => ({ svgX: clientX, svgY: clientY })}
      outputOrigin={{ x: 0, y: 0 }}
      onPathChange={(next) => {
        onPath(next);
        setPart((previous) => ({ ...previous, path: next }));
      }}
      onBatchStart={onBatchStart}
      onBatchEnd={onBatchEnd}
      selectedIndex={selected}
      onSelectIndex={setSelected}
    />
  );
}

const setup = () => {
  const onBatchStart = vi.fn();
  const onBatchEnd = vi.fn();
  const onPath = vi.fn<(path: BezierPath) => void>();
  render(<svg><Harness onBatchStart={onBatchStart} onBatchEnd={onBatchEnd} onPath={onPath} /></svg>);
  return { onBatchStart, onBatchEnd, onPath, lastPath: () => onPath.mock.calls.at(-1)?.[0] };
};

describe('C6 canvas path editing', () => {
  it('a click on a point selects it without opening a history batch', () => {
    const { onBatchStart, onBatchEnd, onPath } = setup();
    const marker = screen.getAllByTestId('freeform-vertex-marker')[1];
    fireEvent.pointerDown(marker, { clientX: 100, clientY: 0, pointerId: 1, button: 0 });
    fireEvent.pointerUp(marker, { clientX: 100, clientY: 0, pointerId: 1, button: 0 });
    expect(onBatchStart).not.toHaveBeenCalled();
    expect(onBatchEnd).not.toHaveBeenCalled();
    expect(onPath).not.toHaveBeenCalled();
    expect(screen.getAllByTestId(/freeform-tangent-handle-/)).toHaveLength(2); // the selected point shows its handles
  });

  it('dragging a point moves it AND its handles, as one batch', () => {
    const { onBatchStart, onBatchEnd, lastPath } = setup();
    const marker = screen.getAllByTestId('freeform-vertex-marker')[1];
    fireEvent.pointerDown(marker, { clientX: 100, clientY: 0, pointerId: 1, button: 0 });
    fireEvent.pointerMove(marker, { clientX: 110, clientY: -20, pointerId: 1 });
    fireEvent.pointerMove(marker, { clientX: 120, clientY: -40, pointerId: 1 });
    fireEvent.pointerUp(marker, { clientX: 120, clientY: -40, pointerId: 1 });
    expect(onBatchStart).toHaveBeenCalledTimes(1);
    expect(onBatchEnd).toHaveBeenCalledTimes(1);
    expect(lastPath()?.points[1]).toMatchObject({ x: 120, y: -40, handleIn: { x: 110, y: -50 }, handleOut: { x: 130, y: -30 } });
    expect(lastPath()?.points[0]).toEqual(rect.points[0]);
  });

  it('a double-click on the outline inserts a point there and keeps the shape', () => {
    const { lastPath } = setup();
    fireEvent.doubleClick(screen.getByTestId('freeform-path-hit-area'), { clientX: 50, clientY: 50 });
    const next = lastPath();
    expect(next?.points).toHaveLength(5);
    // The bottom edge (c → d) is straight: the new corner lies on it.
    const inserted = next!.points[3];
    expect(inserted.x).toBeCloseTo(50, 3);
    expect(inserted.y).toBeCloseTo(50, 3);
    expect(inserted.kind).toBe('corner');
    expect(next!.points.map((point) => point.id).filter((id) => ['a', 'b', 'c', 'd'].includes(id))).toEqual(['a', 'b', 'c', 'd']);
  });
});
