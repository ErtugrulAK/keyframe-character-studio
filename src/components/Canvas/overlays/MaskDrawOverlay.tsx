import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { BezierPath, CharacterPart, Transform } from '../../../types/animator';
import type { WorldAffine } from '../../../utils/containerMath';
import type { PathPoint } from '../../../utils/bezierPath';
import { applyAffine } from '../../../utils/containerMath';
import { buildLayerMaskPathD } from '../../../utils/layerMasks';
import { resolveMaskPathFrame } from '../../../utils/maskPathEditing';
import { createEllipseMaskPath, createRectangleMaskPath, MIN_CLOSED_MASK_POINTS } from '../../../utils/maskPathCreation';
import { addPenAnchor, dragPenTangent, penAnchorsToPath, penAnchorIsSmooth, type PenAnchor } from '../../../utils/penDraft';
import { PEN_DRAG_THRESHOLD_PX } from '../../../hooks/useFreeformDraw';
import type { MaskDrawShape } from '../../../hooks/useMaskEditing';
import type { DraftHistoryOwner } from '../../../context/AnimatorContext';
import { isEditableElement } from '../../../utils/keyboardFocus';
import { EDITOR_CAMERA_CENTER } from '../../../utils/projectCoordinates';

/** A drag shorter than this (CSS px, on either axis) is a degenerate box: nothing is created. */
const MIN_BOX_PX = 4;
/**
 * A pen click within this many CSS px of the first point closes the path. It
 * is measured on SCREEN against the first point's position right now, so pan,
 * zoom and resize never leave a stale target.
 */
const MASK_PEN_CLOSE_RADIUS_PX = 12;
/** A pen click within this many CSS px of the previous point adds nothing (a double-click lands twice). */
const DUPLICATE_CLICK_PX = 3;
const PREVIEW_COLOR = '#22d3ee';

/** What the stage banner shows (and can trigger) for an open pen draft. */
export interface MaskPenDraftState {
  count: number;
  canFinish: boolean;
  finish: () => void;
}

interface MaskDrawOverlayProps {
  owner: CharacterPart;
  shape: MaskDrawShape;
  /** The owner's evaluated world transform at the current frame. */
  transform: Transform & { affine?: WorldAffine };
  zScale: number;
  toWorld: (clientX: number, clientY: number) => { svgX: number; svgY: number };
  /** False while drawing is refused (procedural pose, collapsed map, playback). */
  interactive: boolean;
  onCommit: (path: BezierPath) => void;
  /** Reports a degenerate attempt (nothing was created). */
  onDegenerate: (message: string) => void;
  /** An open pen draft claims Undo/Redo (null releases it). */
  registerDraftHistory?: (owner: DraftHistoryOwner | null) => void;
  /** The pen draft's state for the visible Finish control (null: no draft). */
  onPenDraftChange?: (state: MaskPenDraftState | null) => void;
  /**
   * The session ended (Esc, Cancel, another selection or mode) while the
   * pen draft still held points: they were not committed, so the user is told.
   */
  onDiscardDraft?: (pointCount: number) => void;
}

/**
 * Drawing a NEW mask on the owner layer. Points are converted into the
 * owner's normalized mask space through the same frozen map the editor and
 * renderer use, so a rectangle is layer-aligned and the committed path draws
 * exactly where it was previewed. Nothing is written until commit; the draft
 * is transient, so Escape (handled by the editor's Escape chain) leaves no
 * trace.
 *
 * The mask Pen follows the shape Pen: a click is a corner point, a
 * press-and-drag is ONE smooth point whose tangent follows the pointer, and
 * "place + shape its tangent" is one draft undo step.
 *
 * The pen draft keeps its own undo/redo (one step per point) and owns the
 * editor's Undo/Redo while it is open; the first point shows a close target on
 * hover and closes on click; Finish is also a visible control.
 */
export const MaskDrawOverlay: React.FC<MaskDrawOverlayProps> = ({
  owner,
  shape,
  transform,
  zScale,
  toWorld,
  interactive,
  onCommit,
  onDegenerate,
  registerDraftHistory,
  onPenDraftChange,
  onDiscardDraft,
}) => {
  const frame = resolveMaskPathFrame(owner, 'normalized', transform);
  const groupRef = useRef<SVGGElement>(null);
  const [box, setBox] = useState<{ from: PathPoint; to: PathPoint; fromClient: PathPoint; pointerId: number } | null>(null);
  const [draft, setDraft] = useState<{ points: PenAnchor[]; past: PenAnchor[][]; future: PenAnchor[][] }>({ points: [], past: [], future: [] });
  /** The pen press in flight: which point it shapes, and whether it closes the path. */
  const penGestureRef = useRef<{ pointerId: number; index: number; closing: boolean; startX: number; startY: number; dragging: boolean; recorded: boolean } | null>(null);
  const [shapingIndex, setShapingIndex] = useState<number | null>(null);
  const [cursor, setCursor] = useState<PathPoint | null>(null);
  const [closeReady, setCloseReady] = useState(false);
  const penPoints = draft.points;

  const toPathPoint = (clientX: number, clientY: number): PathPoint | null => {
    if (!frame) return null;
    const { svgX, svgY } = toWorld(clientX, clientY);
    return applyAffine(frame.toPath, { x: svgX - EDITOR_CAMERA_CENTER.x, y: svgY - EDITOR_CAMERA_CENTER.y });
  };

  /** A path point's position in CSS pixels NOW (current camera, pan and layout). */
  const toClientPoint = (point: PathPoint): PathPoint | null => {
    const matrix = groupRef.current?.ownerSVGElement?.getScreenCTM?.();
    if (!frame || !matrix) return null;
    const world = applyAffine(frame.toWorld, point);
    const svgPoint = new DOMPoint(world.x + EDITOR_CAMERA_CENTER.x, world.y + EDITOR_CAMERA_CENTER.y).matrixTransform(matrix);
    return { x: svgPoint.x, y: svgPoint.y };
  };
  const screenDistanceTo = (point: PathPoint | undefined, clientX: number, clientY: number): number => {
    const client = point ? toClientPoint(point) : null;
    return client ? Math.hypot(client.x - clientX, client.y - clientY) : Number.POSITIVE_INFINITY;
  };
  const closesAt = (clientX: number, clientY: number): boolean =>
    penPoints.length >= MIN_CLOSED_MASK_POINTS && screenDistanceTo(penPoints[0], clientX, clientY) <= MASK_PEN_CLOSE_RADIUS_PX;

  const pushPoint = (point: PathPoint) => setDraft((current) => ({
    points: addPenAnchor(current.points, point),
    past: [...current.past, current.points],
    future: [],
  }));
  /** Pulls the tangent of one draft point; `record` makes it a new draft step. */
  const shapeTangent = (index: number, pointer: PathPoint, record: boolean) => setDraft((current) => ({
    points: dragPenTangent(current.points, index, pointer),
    past: record ? [...current.past, current.points] : current.past,
    future: record ? [] : current.future,
  }));
  const undoPoint = useCallback(() => setDraft((current) => (current.past.length === 0 ? current : {
    points: current.past[current.past.length - 1],
    past: current.past.slice(0, -1),
    future: [...current.future, current.points],
  })), []);
  const redoPoint = useCallback(() => setDraft((current) => (current.future.length === 0 ? current : {
    points: current.future[current.future.length - 1],
    past: [...current.past, current.points],
    future: current.future.slice(0, -1),
  })), []);

  // An uncommitted pen draft is never dropped silently: when the overlay
  // goes away (the session ended) with points still open, the user is told.
  const committedRef = useRef(false);
  const openPointsRef = useRef(0);
  const discardRef = useRef(onDiscardDraft);
  useEffect(() => {
    openPointsRef.current = shape === 'pen' ? penPoints.length : 0;
    discardRef.current = onDiscardDraft;
  });
  useEffect(() => () => {
    if (!committedRef.current && openPointsRef.current > 0) discardRef.current?.(openPointsRef.current);
  }, []);
  const finishPen = () => {
    if (penPoints.length < MIN_CLOSED_MASK_POINTS) {
      onDegenerate('A pen mask needs at least three points.');
      return;
    }
    committedRef.current = true;
    onCommit(penAnchorsToPath(penPoints, 'normalized', true));
    setDraft({ points: [], past: [], future: [] });
  };
  const finishPenRef = useRef(finishPen);
  useEffect(() => {
    finishPenRef.current = finishPen;
  });

  // The pen draft owns Undo/Redo while it has been started (even once undone
  // back to empty), so a mis-click never reverts a finished scene edit.
  const draftStarted = shape === 'pen' && (draft.points.length > 0 || draft.past.length > 0 || draft.future.length > 0);
  useEffect(() => {
    if (!registerDraftHistory || !draftStarted) return undefined;
    registerDraftHistory({ undo: undoPoint, redo: redoPoint, canUndo: draft.past.length > 0, canRedo: draft.future.length > 0 });
    return () => registerDraftHistory(null);
  }, [registerDraftHistory, draftStarted, undoPoint, redoPoint, draft.past.length, draft.future.length]);

  useEffect(() => {
    if (!onPenDraftChange) return undefined;
    onPenDraftChange(draftStarted
      ? { count: penPoints.length, canFinish: penPoints.length >= MIN_CLOSED_MASK_POINTS, finish: () => finishPenRef.current() }
      : null);
    return undefined;
  }, [onPenDraftChange, draftStarted, penPoints.length]);
  useEffect(() => () => onPenDraftChange?.(null), [onPenDraftChange]);

  // Pen keys: Enter commits, Backspace removes the last point (as Undo does).
  // Escape belongs to the editor's Escape chain, which ends the whole session.
  useEffect(() => {
    if (shape !== 'pen') return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(document.activeElement)) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        finishPenRef.current();
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        undoPoint();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shape, undoPoint]);

  const onPointerDown = (event: React.PointerEvent<SVGRectElement>) => {
    if (!interactive || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (isEditableElement(document.activeElement)) (document.activeElement as HTMLElement).blur();
    const point = toPathPoint(event.clientX, event.clientY);
    if (!point) return;
    if (shape === 'pen') {
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
      const base = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, dragging: false };
      if (closesAt(event.clientX, event.clientY)) {
        // Closes on release; a drag first shapes the first point's tangent.
        penGestureRef.current = { ...base, index: 0, closing: true, recorded: false };
        return;
      }
      if (screenDistanceTo(penPoints[penPoints.length - 1], event.clientX, event.clientY) < DUPLICATE_CLICK_PX) {
        // The second press of a double-click: no new point; a drag re-shapes it.
        penGestureRef.current = { ...base, index: penPoints.length - 1, closing: false, recorded: false };
        return;
      }
      pushPoint(point);
      penGestureRef.current = { ...base, index: penPoints.length, closing: false, recorded: true };
      return;
    }
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    setBox({ from: point, to: point, fromClient: { x: event.clientX, y: event.clientY }, pointerId: event.pointerId });
  };

  const onPointerMove = (event: React.PointerEvent<SVGRectElement>) => {
    const point = toPathPoint(event.clientX, event.clientY);
    if (!point) return;
    if (shape === 'pen') {
      const gesture = penGestureRef.current;
      if (gesture && event.pointerId === gesture.pointerId) {
        if (!gesture.dragging && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) <= PEN_DRAG_THRESHOLD_PX) return;
        // A drag shapes the tangent of the pressed point; it never adds points.
        shapeTangent(gesture.index, point, !gesture.recorded);
        gesture.dragging = true;
        gesture.recorded = true;
        setShapingIndex(gesture.index);
        setCursor(null);
        return;
      }
      setCursor(point);
      setCloseReady(closesAt(event.clientX, event.clientY));
      return;
    }
    if (box && event.pointerId === box.pointerId) setBox({ ...box, to: point });
  };

  const onPointerUp = (event: React.PointerEvent<SVGRectElement>) => {
    const penGesture = penGestureRef.current;
    if (shape === 'pen' && penGesture && event.pointerId === penGesture.pointerId) {
      event.stopPropagation();
      (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
      penGestureRef.current = null;
      setShapingIndex(null);
      if (penGesture.closing) finishPen();
      return;
    }
    if (!box || event.pointerId !== box.pointerId) return;
    event.stopPropagation();
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
    const current = box;
    setBox(null);
    const point = toPathPoint(event.clientX, event.clientY) ?? current.to;
    if (Math.abs(event.clientX - current.fromClient.x) < MIN_BOX_PX || Math.abs(event.clientY - current.fromClient.y) < MIN_BOX_PX) {
      onDegenerate('Drag a larger box to draw the mask.');
      return;
    }
    onCommit(shape === 'ellipse'
      ? createEllipseMaskPath('normalized', current.from, point)
      : createRectangleMaskPath('normalized', current.from, point));
  };

  const preview: BezierPath | null = (() => {
    if (shape === 'pen') {
      const points: PenAnchor[] = [...penPoints, ...(cursor && penPoints.length > 0 && !closeReady ? [cursor] : [])];
      if (points.length < 2) return null;
      return penAnchorsToPath(points, 'normalized', closeReady);
    }
    if (!box) return null;
    return shape === 'ellipse'
      ? createEllipseMaskPath('normalized', box.from, box.to)
      : createRectangleMaskPath('normalized', box.from, box.to);
  })();
  const previewD = preview ? buildLayerMaskPathD(preview, owner, transform, EDITOR_CAMERA_CENTER) : '';
  const toStage = (point: PathPoint) => {
    const world = applyAffine(frame!.toWorld, point);
    return { x: world.x + EDITOR_CAMERA_CENTER.x, y: world.y + EDITOR_CAMERA_CENTER.y };
  };
  const penMarkers = frame
    ? penPoints.map((point) => ({
      ...toStage(point),
      smooth: penAnchorIsSmooth(point),
      handles: [point.handleIn, point.handleOut].filter((handle): handle is PathPoint => Boolean(handle)).map(toStage),
    }))
    : [];
  const shapedMarker = shapingIndex ?? (penMarkers.length > 0 ? penMarkers.length - 1 : null);

  return (
    <g ref={groupRef} data-testid="mask-draw-overlay" data-shape={shape} data-interactive={interactive && frame ? 'true' : 'false'}>
      {interactive && frame && (
        <rect
          data-testid="mask-draw-surface"
          x={-100000}
          y={-100000}
          width={200000}
          height={200000}
          fill="transparent"
          style={{ cursor: closeReady ? 'pointer' : 'crosshair' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            setBox(null);
            penGestureRef.current = null;
            setShapingIndex(null);
          }}
          onDoubleClick={(event) => {
            if (shape !== 'pen') return;
            event.stopPropagation();
            finishPen();
          }}
        />
      )}
      {previewD && (
        <path
          data-testid="mask-draw-preview"
          d={previewD}
          fill="rgba(34, 211, 238, 0.12)"
          stroke={PREVIEW_COLOR}
          strokeWidth={1.5 * zScale}
          strokeDasharray={`${6 * zScale} ${4 * zScale}`}
          pointerEvents="none"
        />
      )}
      {penMarkers.map((marker, index) => {
        const isCloseTarget = index === 0 && closeReady;
        return (
          <g key={`pen-point-${index}`} pointerEvents="none">
            {index === shapedMarker && marker.handles.map((handle, side) => (
              <g key={`pen-handle-${side}`} data-testid="mask-draw-handle">
                <line x1={marker.x} y1={marker.y} x2={handle.x} y2={handle.y} stroke="#facc15" strokeWidth={1.2 * zScale} />
                <circle cx={handle.x} cy={handle.y} r={3.5 * zScale} fill="#facc15" stroke="#0f172a" strokeWidth={1 * zScale} />
              </g>
            ))}
            {isCloseTarget && (
              <circle cx={marker.x} cy={marker.y} r={MASK_PEN_CLOSE_RADIUS_PX * zScale} fill="rgba(34, 211, 238, 0.18)" stroke={PREVIEW_COLOR} strokeWidth={1 * zScale} />
            )}
            <circle
              data-testid="mask-draw-point"
              data-close-target={isCloseTarget ? 'true' : undefined}
              data-point-kind={marker.smooth ? 'smooth' : 'corner'}
              cx={marker.x}
              cy={marker.y}
              r={(index === 0 ? 6 : 4) * zScale}
              fill={index === 0 && !isCloseTarget ? PREVIEW_COLOR : '#0f172a'}
              stroke={PREVIEW_COLOR}
              strokeWidth={1.4 * zScale}
            />
          </g>
        );
      })}
    </g>
  );
};
