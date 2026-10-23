import { useCallback, useEffect, useRef, useState } from 'react';
import type { BezierPath, FreeformPoint } from '../types/animator';
import { MIN_FREEFORM_POINTS } from '../utils/freeform';
import { isEditableElement } from '../utils/keyboardFocus';
import {
  addPenAnchor,
  dedupePenAnchors,
  dragPenTangent,
  penAnchorsToPath,
  type PenAnchor,
} from '../utils/penDraft';

/** Pointer travel (CSS px) after a press that turns it into a tangent drag. */
export const PEN_DRAG_THRESHOLD_PX = 4;
/** A press within this many CSS px of the first point closes the shape. */
export const FREEFORM_CLOSE_RADIUS_PX = 10;
/** A press within this many CSS px of the last point targets that point (a double-click lands twice). */
const DUPLICATE_CLICK_PX = 3;

/** Why a drawing ended: the user finished it, or switched to another tool. */
export type FreeformFinishReason = 'finish' | 'tool-switch';

interface UseFreeformDrawOptions {
  /** True while the Pen tool is active. */
  enabled: boolean;
  /** Maps client (viewport) coordinates to stage coordinates. */
  getStagePoint: (clientX: number, clientY: number) => FreeformPoint | null;
  /** CSS pixels per stage unit right now (camera zoom), for screen-space hit tests. */
  getPixelsPerStageUnit?: () => number;
  /** Called with the finished closed path (stage space) when the drawing is committed. */
  onComplete: (path: BezierPath, reason: FreeformFinishReason) => void;
  /** Called when a drawing session is cancelled with Escape (`hadDraft`: points were discarded). */
  onCancel?: (hadDraft: boolean) => void;
  /** A tool switch discarded a draft too short to be a shape. */
  onDiscard?: () => void;
}

/** What the press in flight is doing. */
type PenGesture =
  | { kind: 'anchor'; index: number; startX: number; startY: number; dragging: boolean }
  | { kind: 'close'; startX: number; startY: number; dragging: boolean };

/**
 * The Pen tool (C6):
 * - a click places a CORNER point;
 * - press-and-drag places ONE point and pulls its Bézier tangent (a smooth
 *   point): the pointer moves the outgoing handle, the incoming one mirrors it.
 *   Moving the mouse never adds points; the release ends that point and the
 *   next press is a new one;
 * - a press on the first point closes and finishes the shape (dragging that
 *   press shapes the closing tangent); double-click, Enter or the visible
 *   Finish control finish it too;
 * - Escape discards a draft (staying in the tool), or leaves the tool when
 *   there is no draft; switching tools commits a valid draft and reports an
 *   invalid one.
 *
 * The draft keeps its OWN undo/redo stacks: one entry per placed point,
 * including the tangent dragged while placing it. They are transient (never
 * serialized, never scene history); the finished shape is one scene step.
 * Mouse move/up are tracked on `window` while drawing so a drag works even
 * when the cursor leaves the canvas.
 */
export const useFreeformDraw = ({
  enabled,
  getStagePoint,
  getPixelsPerStageUnit = () => 1,
  onComplete,
  onCancel,
  onDiscard,
}: UseFreeformDrawOptions) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [anchors, setAnchors] = useState<PenAnchor[]>([]);
  const [cursorPoint, setCursorPoint] = useState<FreeformPoint | null>(null);
  const [cursorClosesShape, setCursorClosesShape] = useState(false);
  /** The point whose tangent is being dragged right now (the preview shows its handles). */
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [historyDepth, setHistoryDepth] = useState({ past: 0, future: 0 });

  const anchorsRef = useRef<PenAnchor[]>([]);
  const pastRef = useRef<PenAnchor[][]>([]);
  const futureRef = useRef<PenAnchor[][]>([]);
  const gestureRef = useRef<PenGesture | null>(null);
  /** The draft before the gesture in flight, recorded once the gesture changes it. */
  const gestureBaseRef = useRef<PenAnchor[] | null>(null);
  const isDrawingRef = useRef(false);

  const enabledRef = useRef(enabled);
  const getStagePointRef = useRef(getStagePoint);
  const getPixelsPerStageUnitRef = useRef(getPixelsPerStageUnit);
  const onCompleteRef = useRef(onComplete);
  const onCancelRef = useRef(onCancel);
  const onDiscardRef = useRef(onDiscard);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    getStagePointRef.current = getStagePoint;
    getPixelsPerStageUnitRef.current = getPixelsPerStageUnit;
    onCompleteRef.current = onComplete;
    onCancelRef.current = onCancel;
    onDiscardRef.current = onDiscard;
  });

  const syncHistory = useCallback(() => {
    setHistoryDepth({ past: pastRef.current.length, future: futureRef.current.length });
  }, []);

  const setDraft = useCallback((next: PenAnchor[]) => {
    anchorsRef.current = next;
    setAnchors(next);
  }, []);

  const reset = useCallback(() => {
    isDrawingRef.current = false;
    setIsDrawing(false);
    setDraft([]);
    setCursorPoint(null);
    setCursorClosesShape(false);
    setActiveIndex(null);
    pastRef.current = [];
    futureRef.current = [];
    gestureRef.current = null;
    gestureBaseRef.current = null;
    syncHistory();
  }, [setDraft, syncHistory]);

  /** Records the draft before the current gesture's first change (one undo step per gesture). */
  const recordGestureOnce = useCallback(() => {
    if (gestureBaseRef.current === null) return;
    pastRef.current = [...pastRef.current, gestureBaseRef.current];
    futureRef.current = [];
    gestureBaseRef.current = null;
    syncHistory();
  }, [syncHistory]);

  const screenDistance = (a: FreeformPoint, b: FreeformPoint): number =>
    Math.hypot(a.x - b.x, a.y - b.y) * getPixelsPerStageUnitRef.current();

  /** True when a press at `p` would close the shape on its first point. */
  const isOnFirstPoint = useCallback((p: FreeformPoint | null): boolean => {
    const first = anchorsRef.current[0];
    return Boolean(p && first && anchorsRef.current.length >= MIN_FREEFORM_POINTS
      && screenDistance(p, first) <= FREEFORM_CLOSE_RADIUS_PX);
  }, []);

  const finish = useCallback((reason: FreeformFinishReason): boolean => {
    const drawn = dedupePenAnchors(anchorsRef.current);
    reset();
    if (drawn.length < MIN_FREEFORM_POINTS) {
      if (drawn.length > 0 && reason === 'tool-switch') onDiscardRef.current?.();
      return false;
    }
    onCompleteRef.current(penAnchorsToPath(drawn, 'local', true), reason);
    return true;
  }, [reset]);

  const cancel = useCallback(() => {
    const hadDraft = anchorsRef.current.length > 0;
    reset();
    onCancelRef.current?.(hadDraft);
  }, [reset]);

  const undoDraft = useCallback(() => {
    const previous = pastRef.current[pastRef.current.length - 1];
    if (!previous) return;
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, anchorsRef.current];
    setDraft(previous);
    syncHistory();
  }, [setDraft, syncHistory]);

  const redoDraft = useCallback(() => {
    const next = futureRef.current[futureRef.current.length - 1];
    if (!next) return;
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, anchorsRef.current];
    setDraft(next);
    syncHistory();
  }, [setDraft, syncHistory]);

  // Enter commits an in-progress drawing; Escape discards a draft, or leaves
  // the tool when there is none (one level per press).
  useEffect(() => {
    if (!enabled) return;
    const handleKey = (e: KeyboardEvent) => {
      if (isEditableElement(document.activeElement)) return;
      if (e.key === 'Enter' && anchorsRef.current.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        finish('finish');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [enabled, finish, cancel]);

  // Window-level gesture handlers while drawing.
  useEffect(() => {
    if (!enabled || !isDrawing) return;

    const handleMove = (e: MouseEvent) => {
      const p = getStagePointRef.current(e.clientX, e.clientY);
      if (!p) return;
      const gesture = gestureRef.current;
      if (!gesture) {
        // Hover: the live segment from the last point to the cursor.
        setCursorPoint(p);
        setCursorClosesShape(isOnFirstPoint(p));
        return;
      }
      if (!gesture.dragging) {
        if (Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) <= PEN_DRAG_THRESHOLD_PX) return;
        gesture.dragging = true;
      }
      // A drag pulls the tangent of the point this press placed (or of the
      // first point while closing). It never adds a point.
      const index = gesture.kind === 'close' ? 0 : gesture.index;
      recordGestureOnce();
      setDraft(dragPenTangent(anchorsRef.current, index, p));
      setActiveIndex(index);
      setCursorPoint(null);
    };

    const handleUp = (e: MouseEvent) => {
      // Only the release of a primary press that began ON the stage
      // (`beginDraw`) ends a Pen gesture. A right/middle release ends a
      // temporary camera pan, and a click on a toolbar, panel or header button
      // while the draft is open is not a point either.
      const gesture = gestureRef.current;
      if (e.button !== 0 || !gesture) return;
      gestureRef.current = null;
      gestureBaseRef.current = null;
      setActiveIndex(null);
      const p = getStagePointRef.current(e.clientX, e.clientY);
      if (p) setCursorPoint(p);
      if (gesture.kind === 'close') finish('finish');
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [enabled, isDrawing, finish, isOnFirstPoint, recordGestureOnce, setDraft]);

  // Deactivating the tool mid-draw commits a valid draft and reports an
  // invalid one — the drawing is never dropped silently.
  useEffect(() => {
    if (!enabled && isDrawingRef.current) {
      // Tool deactivation is the external signal that ends an active draw session.
      // oxlint-disable-next-line react/set-state-in-effect
      finish('tool-switch');
    }
  }, [enabled, finish]);

  /** A primary press on the stage: places a point, targets the last one, or starts closing. */
  const beginDraw = useCallback(
    (clientX: number, clientY: number) => {
      const p = getStagePointRef.current(clientX, clientY);
      if (!p) return;
      if (!isDrawingRef.current) {
        isDrawingRef.current = true;
        setIsDrawing(true);
      }
      gestureBaseRef.current = anchorsRef.current;
      if (isOnFirstPoint(p)) {
        gestureRef.current = { kind: 'close', startX: clientX, startY: clientY, dragging: false };
        return;
      }
      const lastIndex = anchorsRef.current.length - 1;
      const last = anchorsRef.current[lastIndex];
      if (last && screenDistance(p, last) < DUPLICATE_CLICK_PX) {
        // The second press of a double-click (or a press on the point just
        // placed): no new point; a drag re-pulls that point's tangent.
        gestureRef.current = { kind: 'anchor', index: lastIndex, startX: clientX, startY: clientY, dragging: false };
        return;
      }
      // The point exists from the press on (its own undo step); a drag before
      // the release only shapes its tangent within the same step.
      recordGestureOnce();
      setDraft(addPenAnchor(anchorsRef.current, p));
      setCursorPoint(null);
      setCursorClosesShape(false);
      gestureRef.current = { kind: 'anchor', index: anchorsRef.current.length - 1, startX: clientX, startY: clientY, dragging: false };
    },
    [isOnFirstPoint, recordGestureOnce, setDraft]
  );

  const finishDraw = useCallback(() => {
    if (enabledRef.current && isDrawingRef.current) {
      finish('finish');
    }
  }, [finish]);

  const cancelDraw = useCallback(() => {
    if (isDrawingRef.current) cancel();
  }, [cancel]);

  return {
    isDrawing,
    /** The placed points (stage space), with their tangents once dragged. */
    points: anchors,
    cursorPoint,
    /** The point whose tangent the press in flight is pulling, if any. */
    activeIndex,
    beginDraw,
    finishDraw,
    cancelDraw,
    undoDraft,
    redoDraft,
    canUndoDraft: historyDepth.past > 0,
    canRedoDraft: historyDepth.future > 0,
    /** Whether the cursor is on the first point and a click would close the shape. */
    cursorClosesShape,
    /** Whether the draft has enough points to become a shape. */
    canFinish: dedupePenAnchors(anchors).length >= MIN_FREEFORM_POINTS,
  };
};
