import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Spline } from 'lucide-react';
import type { CharacterPart } from '../../../../types/animator';
import { trackMattePickVerdict, type TrackMattePickVerdict } from '../../../../utils/trackMattePick';

interface TrackMattePickWhipProps {
  target: CharacterPart;
  characterParts: CharacterPart[];
  /** Writes the relationship (the same writer the source list uses: one undo step). */
  onPick: (sourceLayerId: string) => void;
  /** Keyboard path: Enter/Space moves focus to the source list, the equivalent of dragging. */
  onKeyboardActivate: () => void;
  /** Explains a refused drop on a layer (an empty-area drop says nothing and writes nothing). */
  onRefused: (reason: string) => void;
}

interface Drag {
  pointerId: number;
  origin: { x: number; y: number };
  pointer: { x: number; y: number };
  candidateId: string | null;
  verdict: TrackMattePickVerdict | null;
}

/** The layer a point is over: a layer-list row, a timeline layer row or a canvas layer. */
const layerAt = (x: number, y: number): { id: string; element: Element } | null => {
  const hit = document.elementFromPoint(x, y);
  if (!hit) return null;
  const row = hit.closest('[role="treeitem"][data-layer-id]');
  if (row) return { id: row.getAttribute('data-layer-id')!, element: row };
  const track = hit.closest('[data-track-row-id][data-track-part-id]');
  if (track) return { id: track.getAttribute('data-track-part-id')!, element: track };
  const stage = hit.closest('.stage-svg [data-part-id]');
  if (stage) return { id: stage.getAttribute('data-part-id')!, element: stage };
  return null;
};

/**
 * C4 — the Track Matte pick-whip (After Effects' parent/matte pick-whip
 * gesture): drag from the handle to a layer in the layer list, the timeline or
 * the canvas. While dragging, a line follows the pointer and the layer under it
 * is marked as a valid or refused source, with the reason. Releasing on a valid
 * layer writes `target.trackMatte` once; Escape, an empty area or a refused
 * layer write nothing. The source's visibility and stack position are never
 * touched.
 */
export const TrackMattePickWhip: React.FC<TrackMattePickWhipProps> = ({ target, characterParts, onPick, onKeyboardActivate, onRefused }) => {
  const [drag, setDrag] = useState<Drag | null>(null);
  const markedRef = useRef<Element | null>(null);
  const latest = useRef({ target, characterParts, onPick, onRefused });
  useEffect(() => {
    latest.current = { target, characterParts, onPick, onRefused };
  });

  const mark = (element: Element | null, state: 'valid' | 'invalid' | null) => {
    if (markedRef.current && markedRef.current !== element) markedRef.current.removeAttribute('data-pick-whip');
    markedRef.current = element;
    if (element && state) element.setAttribute('data-pick-whip', state);
  };

  const active = drag !== null;
  useEffect(() => {
    if (!active) return undefined;
    const update = (event: PointerEvent) => {
      const hit = layerAt(event.clientX, event.clientY);
      const verdict = hit ? trackMattePickVerdict(latest.current.characterParts, latest.current.target.id, hit.id) : null;
      mark(hit?.element ?? null, verdict ? (verdict.ok ? 'valid' : 'invalid') : null);
      setDrag((previous) => (previous ? { ...previous, pointer: { x: event.clientX, y: event.clientY }, candidateId: hit?.id ?? null, verdict } : previous));
    };
    const finish = (event: PointerEvent) => {
      const hit = layerAt(event.clientX, event.clientY);
      mark(null, null);
      setDrag(null);
      if (!hit) return;
      const verdict = trackMattePickVerdict(latest.current.characterParts, latest.current.target.id, hit.id);
      if (verdict.ok) latest.current.onPick(hit.id);
      else latest.current.onRefused(verdict.reason);
    };
    const cancel = () => {
      mark(null, null);
      setDrag(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      cancel();
    };
    window.addEventListener('pointermove', update);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointermove', update);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [active]);

  useEffect(() => () => mark(null, null), []);

  return (
    <>
      <button
        type="button"
        className={`track-matte-pick-whip${active ? ' is-dragging' : ''}`}
        aria-label="Pick the track matte source: drag to a layer, or press Enter to choose from the list"
        title="Drag to a layer in the layer list, the timeline or the canvas to use it as this layer's matte"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          const box = event.currentTarget.getBoundingClientRect();
          setDrag({
            pointerId: event.pointerId,
            origin: { x: box.left + box.width / 2, y: box.top + box.height / 2 },
            pointer: { x: event.clientX, y: event.clientY },
            candidateId: null,
            verdict: null,
          });
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onKeyboardActivate();
        }}
      >
        <Spline size={13} aria-hidden="true" />
      </button>
      {drag && createPortal(
        <div className="track-matte-pick-overlay" aria-hidden="true">
          <svg width="100%" height="100%">
            <line
              x1={drag.origin.x}
              y1={drag.origin.y}
              x2={drag.pointer.x}
              y2={drag.pointer.y}
              className={drag.verdict ? (drag.verdict.ok ? 'is-valid' : 'is-invalid') : ''}
            />
            <circle cx={drag.pointer.x} cy={drag.pointer.y} r={5} className={drag.verdict ? (drag.verdict.ok ? 'is-valid' : 'is-invalid') : ''} />
          </svg>
          <div
            className={`track-matte-pick-label${drag.verdict ? (drag.verdict.ok ? ' is-valid' : ' is-invalid') : ''}`}
            data-testid="track-matte-pick-label"
            style={{ left: drag.pointer.x + 14, top: drag.pointer.y + 12 }}
          >
            {drag.verdict
              ? (drag.verdict.ok ? `Use “${drag.verdict.sourceName}” as the matte` : drag.verdict.reason)
              : 'Drop on a layer · Esc cancels'}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
