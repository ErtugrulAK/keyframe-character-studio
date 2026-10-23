import { useCallback, useEffect, useRef, useState } from 'react';
import type { FreeformPoint } from '../types/animator';
import { MIN_FREEFORM_POINTS, simplifyFreeformPoints } from '../utils/freeform';
import { isEditableElement } from '../utils/keyboardFocus';

/** Mouse movement (CSS px) that switches a click into a freehand stroke. */
const STROKE_THRESHOLD = 4;
/** Minimum distance (stage units) between freehand samples. */
const SAMPLE_MIN_DIST = 3;
/** A click within this many CSS px of the first point closes and finishes the shape. */
export const FREEFORM_CLOSE_RADIUS_PX = 10;
/** A click within this many CSS px of the previous point adds nothing (a double-click lands twice). */
const DUPLICATE_CLICK_PX = 3;

/** Why a drawing ended: the user finished it, or switched to another tool. */
export type FreeformFinishReason = 'finish' | 'tool-switch';

interface UseFreeformDrawOptions {
  /** True while the freeform draw tool is active. */
  enabled: boolean;
  /** Maps client (viewport) coordinates to stage coordinates. */
  getStagePoint: (clientX: number, clientY: number) => FreeformPoint | null;
  /** CSS pixels per stage unit right now (camera zoom), for screen-space hit tests. */
  getPixelsPerStageUnit?: () => number;
  /** Called with the final stage-space points when the drawing is committed. */
  onComplete: (stagePoints: FreeformPoint[], reason: FreeformFinishReason) => void;
  /** Called when a drawing session is cancelled with Escape (`hadDraft`: points were discarded). */
  onCancel?: (hadDraft: boolean) => void;
  /** A tool switch discarded a draft too short to be a shape. */
  onDiscard?: () => void;
}

/**
 * Hybrid freeform drawing state machine:
 * - Click adds a vertex (polygon corner); a click on the FIRST point closes
 *   and finishes the shape (with at least three points).
 * - Drag collects dense freehand samples; the whole stroke is one step.
 * - Double-click, Enter or the visible Finish control commits the shape.
 * - Escape discards a draft (staying in the tool), or leaves the tool when
 *   there is no draft.
 * - Switching tools commits a valid draft and reports an invalid one, never
 *   losing it silently.
 *
 * The draft keeps its OWN undo/redo stacks (one entry per click or stroke).
 * They are transient: never serialized and never part of scene history; the
 * shape is one scene step only when committed.
 *
 * Mouse move/up are tracked on `window` while drawing so the gesture works
 * even when the cursor leaves the canvas.
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
  const [points, setPoints] = useState<FreeformPoint[]>([]);
  const [cursorPoint, setCursorPoint] = useState<FreeformPoint | null>(null);
  const [cursorClosesShape, setCursorClosesShape] = useState(false);
  const [historyDepth, setHistoryDepth] = useState({ past: 0, future: 0 });

  const pointsRef = useRef<FreeformPoint[]>([]);
  const pastRef = useRef<FreeformPoint[][]>([]);
  const futureRef = useRef<FreeformPoint[][]>([]);
  const strokeStartRef = useRef<FreeformPoint | null>(null);
  const strokeMovedRef = useRef(false);
  /** The draft before the gesture in flight, recorded once the gesture changes it. */
  const gestureBaseRef = useRef<FreeformPoint[] | null>(null);
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

  const setDraft = useCallback((next: FreeformPoint[]) => {
    pointsRef.current = next;
    setPoints(next);
  }, []);

  const reset = useCallback(() => {
    isDrawingRef.current = false;
    setIsDrawing(false);
    setDraft([]);
    setCursorPoint(null);
    setCursorClosesShape(false);
    pastRef.current = [];
    futureRef.current = [];
    strokeStartRef.current = null;
    strokeMovedRef.current = false;
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

  const appendPoint = useCallback((p: FreeformPoint) => {
    recordGestureOnce();
    setDraft([...pointsRef.current, p]);
    setCursorPoint(p);
  }, [recordGestureOnce, setDraft]);

  const screenDistance = (a: FreeformPoint, b: FreeformPoint): number =>
    Math.hypot(a.x - b.x, a.y - b.y) * getPixelsPerStageUnitRef.current();

  /** True when a click at `p` would close the shape on its first point. */
  const isOnFirstPoint = useCallback((p: FreeformPoint | null): boolean => {
    const first = pointsRef.current[0];
    return Boolean(p && first && pointsRef.current.length >= MIN_FREEFORM_POINTS
      && screenDistance(p, first) <= FREEFORM_CLOSE_RADIUS_PX);
  }, []);

  const finish = useCallback((reason: FreeformFinishReason): boolean => {
    const raw = pointsRef.current;
    const simplified = simplifyFreeformPoints(raw);
    reset();
    if (simplified.length < MIN_FREEFORM_POINTS) {
      if (raw.length > 0 && reason === 'tool-switch') onDiscardRef.current?.();
      return false;
    }
    onCompleteRef.current(simplified, reason);
    return true;
  }, [reset]);

  const cancel = useCallback(() => {
    const hadDraft = pointsRef.current.length > 0;
    reset();
    onCancelRef.current?.(hadDraft);
  }, [reset]);

  const undoDraft = useCallback(() => {
    const previous = pastRef.current[pastRef.current.length - 1];
    if (!previous) return;
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, pointsRef.current];
    setDraft(previous);
    syncHistory();
  }, [setDraft, syncHistory]);

  const redoDraft = useCallback(() => {
    const next = futureRef.current[futureRef.current.length - 1];
    if (!next) return;
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, pointsRef.current];
    setDraft(next);
    syncHistory();
  }, [setDraft, syncHistory]);

  // Enter commits an in-progress drawing; Escape discards a draft, or leaves
  // the tool when there is none (one level per press).
  useEffect(() => {
    if (!enabled) return;
    const handleKey = (e: KeyboardEvent) => {
      if (isEditableElement(document.activeElement)) return;
      if (e.key === 'Enter' && pointsRef.current.length > 0) {
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
      const start = strokeStartRef.current;
      if (start && !strokeMovedRef.current && screenDistance(p, start) > STROKE_THRESHOLD) {
        // A freehand stroke starts at the press point; the whole stroke is ONE draft step.
        strokeMovedRef.current = true;
        appendPoint(start);
      }
      if (strokeMovedRef.current) {
        const last = pointsRef.current[pointsRef.current.length - 1];
        if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= SAMPLE_MIN_DIST) {
          appendPoint(p);
        } else {
          setCursorPoint(p);
        }
      } else {
        setCursorPoint(p); // live preview line from the last vertex to the cursor
      }
      setCursorClosesShape(!strokeMovedRef.current && isOnFirstPoint(p));
    };

    const handleUp = (e: MouseEvent) => {
      // Only the release of a primary press that began ON the stage
      // (`beginDraw`) draws. A right/middle release ends a temporary camera
      // pan, and a click on a toolbar, panel or header button while the draft
      // is open is not a vertex either.
      if (e.button !== 0 || !strokeStartRef.current) return;
      const p = getStagePointRef.current(e.clientX, e.clientY);
      const wasStroke = strokeMovedRef.current;
      strokeStartRef.current = null;
      strokeMovedRef.current = false;
      if (wasStroke || !p) {
        gestureBaseRef.current = null;
        return;
      }
      // A click on the first point closes and finishes the shape.
      if (isOnFirstPoint(p)) {
        gestureBaseRef.current = null;
        finish('finish');
        return;
      }
      const last = pointsRef.current[pointsRef.current.length - 1];
      if (last && screenDistance(p, last) < DUPLICATE_CLICK_PX) {
        gestureBaseRef.current = null;
        return;
      }
      appendPoint(p); // click gesture: add a polygon vertex
      gestureBaseRef.current = null;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [enabled, isDrawing, appendPoint, finish, isOnFirstPoint]);

  // Deactivating the tool mid-draw commits a valid draft and reports an
  // invalid one — the drawing is never dropped silently.
  useEffect(() => {
    if (!enabled && isDrawingRef.current) {
      // Tool deactivation is the external signal that ends an active draw session.
      // oxlint-disable-next-line react/set-state-in-effect
      finish('tool-switch');
    }
  }, [enabled, finish]);

  const beginDraw = useCallback(
    (clientX: number, clientY: number) => {
      const p = getStagePointRef.current(clientX, clientY);
      if (!p) return;
      strokeStartRef.current = p;
      strokeMovedRef.current = false;
      gestureBaseRef.current = pointsRef.current;
      if (!isDrawingRef.current) {
        isDrawingRef.current = true;
        setIsDrawing(true);
        setCursorPoint(p);
      }
    },
    []
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
    points,
    cursorPoint,
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
    canFinish: simplifyFreeformPoints(points).length >= MIN_FREEFORM_POINTS,
  };
};
