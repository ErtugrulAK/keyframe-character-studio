import { useCallback, useEffect, useRef, useState } from 'react';
import type { FreeformPoint } from '../types/animator';
import { MIN_FREEFORM_POINTS, simplifyFreeformPoints } from '../utils/freeform';

/** Mouse movement (CSS px) that switches a click into a freehand stroke. */
const STROKE_THRESHOLD = 4;
/** Minimum distance (stage units) between freehand samples. */
const SAMPLE_MIN_DIST = 3;

interface UseFreeformDrawOptions {
  /** True while the freeform draw tool is active. */
  enabled: boolean;
  /** Maps client (viewport) coordinates to stage coordinates. */
  getStagePoint: (clientX: number, clientY: number) => FreeformPoint | null;
  /** Called with the final stage-space points when the drawing is committed. */
  onComplete: (stagePoints: FreeformPoint[]) => void;
  /** Called when a drawing session is cancelled (Esc / tool switch). */
  onCancel?: () => void;
}

/**
 * Hybrid freeform drawing state machine:
 * - Click adds a vertex (polygon corner).
 * - Drag collects dense freehand samples.
 * - Double-click or Enter commits the shape; Escape cancels it.
 * Mouse move/up are tracked on `window` while drawing so the gesture works
 * even when the cursor leaves the canvas.
 */
export const useFreeformDraw = ({ enabled, getStagePoint, onComplete, onCancel }: UseFreeformDrawOptions) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<FreeformPoint[]>([]);
  const [cursorPoint, setCursorPoint] = useState<FreeformPoint | null>(null);

  const pointsRef = useRef<FreeformPoint[]>([]);
  const strokeStartRef = useRef<FreeformPoint | null>(null);
  const strokeMovedRef = useRef(false);

  const enabledRef = useRef(enabled);
  const getStagePointRef = useRef(getStagePoint);
  const onCompleteRef = useRef(onComplete);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    getStagePointRef.current = getStagePoint;
  });
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });
  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  const reset = useCallback(() => {
    setIsDrawing(false);
    setPoints([]);
    setCursorPoint(null);
    pointsRef.current = [];
    strokeStartRef.current = null;
    strokeMovedRef.current = false;
  }, []);

  const appendPoint = useCallback((p: FreeformPoint) => {
    pointsRef.current = [...pointsRef.current, p];
    setPoints(pointsRef.current);
    setCursorPoint(p);
  }, []);

  const finish = useCallback(() => {
    const raw = pointsRef.current;
    reset();
    const simplified = simplifyFreeformPoints(raw);
    if (simplified.length < MIN_FREEFORM_POINTS) return;
    onCompleteRef.current(simplified);
  }, [reset]);

  const cancel = useCallback(() => {
    const hadPoints = pointsRef.current.length > 0;
    reset();
    if (hadPoints) onCancelRef.current?.();
  }, [reset]);

  // Window-level gesture handlers while drawing.
  useEffect(() => {
    if (!enabled || !isDrawing) return;

    const handleMove = (e: MouseEvent) => {
      const p = getStagePointRef.current(e.clientX, e.clientY);
      if (!p) return;

      if (strokeStartRef.current) {
        const dx = p.x - strokeStartRef.current.x;
        const dy = p.y - strokeStartRef.current.y;
        if (Math.hypot(dx, dy) > STROKE_THRESHOLD) {
          strokeMovedRef.current = true;
        }
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
    };

    const handleUp = (e: MouseEvent) => {
      const p = getStagePointRef.current(e.clientX, e.clientY);
      if (!strokeMovedRef.current && p) {
        appendPoint(p); // click gesture: add a polygon vertex
      }
      strokeStartRef.current = null;
      strokeMovedRef.current = false;
      // The shape stays open: commit with double-click or Enter.
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        finish();
      } else if (e.key === 'Escape') {
        cancel();
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('keydown', handleKey);
    };
  }, [enabled, isDrawing, appendPoint, finish, cancel]);

  // Deactivating the tool mid-draw cancels the session.
  useEffect(() => {
    if (!enabled) {
      cancel();
    }
  }, [enabled, cancel]);

  const beginDraw = useCallback(
    (clientX: number, clientY: number) => {
      const p = getStagePointRef.current(clientX, clientY);
      if (!p) return;
      strokeStartRef.current = p;
      strokeMovedRef.current = false;
      if (!isDrawing) {
        setIsDrawing(true);
        pointsRef.current = [p];
        setPoints([p]);
        setCursorPoint(p);
      }
    },
    [isDrawing]
  );

  const finishDraw = useCallback(() => {
    if (enabledRef.current && isDrawing) {
      finish();
    }
  }, [enabledRef, isDrawing, finish]);

  return { isDrawing, points, cursorPoint, beginDraw, finishDraw };
};
