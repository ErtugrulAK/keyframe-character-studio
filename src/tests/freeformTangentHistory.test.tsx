import React, { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FreeformTangentOverlay } from '../components/Canvas/overlays/FreeformTangentOverlay';
import { useHistory } from '../hooks/useHistory';
import type { BezierPath, CharacterPart, Track, Transform } from '../types/animator';

const ORIGIN = { x: 0, y: 0 };
const IDENTITY: Transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

const PATH: BezierPath = {
  version: 1,
  coordinateSpace: 'local',
  closed: true,
  points: [
    { id: 'a', x: 0, y: 0, handleOut: { x: 6, y: 0 } },
    { id: 'b', x: 20, y: 0 },
    { id: 'c', x: 20, y: 20 },
  ],
};

const makePart = (): CharacterPart => ({
  id: 'free',
  name: 'Free',
  type: 'custom_freeform',
  zIndex: 1,
  baseTransform: { ...IDENTITY },
  points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }],
  path: PATH,
} as CharacterPart);

/**
 * Wires the overlay to the real `useHistory` authority exactly like StageCanvas
 * does: the drag opens a batch and the batch commit decides whether the drag
 * becomes a single undo entry.
 */
function HistoryHarness() {
  const [characterParts, setCharacterParts] = useState<CharacterPart[]>([makePart()]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const characterPartsRef = useRef(characterParts);
  const tracksRef = useRef(tracks);
  characterPartsRef.current = characterParts;
  tracksRef.current = tracks;

  const { startBatchInteraction, endBatchInteraction, undo, redo, canUndo, canRedo } = useHistory({
    tracks,
    setTracks,
    tracksRef,
    characterParts,
    setCharacterParts,
    characterPartsRef,
  });

  const part = characterParts[0];
  const handleOutX = part.path?.points[0].handleOut?.x ?? Number.NaN;

  return (
    <>
      <FreeformTangentOverlay
        part={part}
        transform={IDENTITY}
        zScale={1}
        toWorld={(clientX, clientY) => ({ svgX: clientX, svgY: clientY })}
        outputOrigin={ORIGIN}
        onPathChange={(next) => setCharacterParts((previous) => previous.map((current) => (
          current.id === part.id ? { ...current, path: next } : current
        )))}
        onBatchStart={startBatchInteraction}
        onBatchEnd={endBatchInteraction}
      />
      <span data-testid="handle-out-x">{handleOutX}</span>
      <button data-testid="undo" onClick={() => undo()}>undo</button>
      <button data-testid="redo" onClick={() => redo()}>redo</button>
      <span data-testid="can-undo">{String(canUndo)}</span>
      <span data-testid="can-redo">{String(canRedo)}</span>
    </>
  );
}

const handleOutX = () => Number(screen.getByTestId('handle-out-x').textContent);

const selectVertexZero = () => {
  fireEvent.pointerDown(screen.getAllByTestId('freeform-vertex-marker')[0], { clientX: 0, clientY: 0, pointerId: 1 });
};

const dragOutHandle = (fromX: number, toX: number) => {
  const handle = screen.getByTestId('freeform-tangent-handle-out');
  fireEvent.pointerDown(handle, { clientX: fromX, clientY: 0, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientX: toX, clientY: 0, pointerId: 1 });
  fireEvent.pointerUp(handle, { clientX: toX, clientY: 0, pointerId: 1 });
};

describe('FreeformTangentOverlay history integration', () => {
  it('creates exactly one undo entry per completed drag and restores it on undo, then redo', () => {
    render(<HistoryHarness />);
    selectVertexZero();
    expect(handleOutX()).toBe(6);

    dragOutHandle(6, 14);
    expect(handleOutX()).toBeCloseTo(14, 6);
    expect(screen.getByTestId('can-undo').textContent).toBe('true');

    fireEvent.click(screen.getByTestId('undo'));
    expect(handleOutX()).toBeCloseTo(6, 6);

    fireEvent.click(screen.getByTestId('redo'));
    expect(handleOutX()).toBeCloseTo(14, 6);
  });

  it('creates no undo entry for an Escape-cancelled drag', () => {
    render(<HistoryHarness />);
    selectVertexZero();

    dragOutHandle(6, 14);
    expect(screen.getByTestId('can-undo').textContent).toBe('true');

    const handle = screen.getByTestId('freeform-tangent-handle-out');
    fireEvent.pointerDown(handle, { clientX: 14, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: -20, clientY: 9, pointerId: 1 });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleOutX()).toBeCloseTo(14, 6);

    // One undo returns to the pre-drag state; the cancelled drag added nothing.
    fireEvent.click(screen.getByTestId('undo'));
    expect(handleOutX()).toBeCloseTo(6, 6);
    expect(screen.getByTestId('can-undo').textContent).toBe('false');
  });

  it('records nothing for a pointerdown followed by Escape with no move, then one entry for a pointercancel commit', () => {
    render(<HistoryHarness />);
    selectVertexZero();

    const handle = screen.getByTestId('freeform-tangent-handle-out');
    fireEvent.pointerDown(handle, { clientX: 6, clientY: 0, pointerId: 1 });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleOutX()).toBe(6);
    expect(screen.getByTestId('can-undo').textContent).toBe('false');

    const moved = screen.getByTestId('freeform-tangent-handle-out');
    fireEvent.pointerDown(moved, { clientX: 6, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(moved, { clientX: 12, clientY: 5, pointerId: 1 });
    fireEvent.pointerCancel(moved, { clientX: 12, clientY: 5, pointerId: 1 });

    expect(screen.getByTestId('can-undo').textContent).toBe('true');
    expect(handleOutX()).toBeCloseTo(12, 6);
    fireEvent.click(screen.getByTestId('undo'));
    expect(handleOutX()).toBeCloseTo(6, 6);
  });
});
