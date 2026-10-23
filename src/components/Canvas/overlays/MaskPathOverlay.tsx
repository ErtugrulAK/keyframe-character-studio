import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BezierPath, CharacterPart, Transform } from '../../../types/animator';
import type { WorldAffine } from '../../../utils/containerMath';
import { initializeSmoothHandles, type BezierHandleKind, type PathPoint } from '../../../utils/bezierPath';
import { buildLayerMaskPathD } from '../../../utils/layerMasks';
import {
  maskPathDeltaFromWorld,
  maskPathPointToWorld,
  moveMaskHandle,
  moveMaskVertex,
  resolveMaskPathFrame,
  translateMaskPath,
  type MaskPathFrame,
} from '../../../utils/maskPathEditing';
import type { MaskGestureSnapshot } from '../../../hooks/useMaskEditing';
import { isEditableElement, ownsShortcutScope } from '../../../utils/keyboardFocus';
import { isBlockingModalOpen } from '../../../utils/modalBoundary';
import { EDITOR_CAMERA_CENTER } from '../../../utils/projectCoordinates';
import { consumeMaskPointsFocusRequest } from '../../../utils/maskPointFocus';

/** Marker sizes in CSS pixels; multiplied by the canvas zScale so they stay screen-constant. */
const VERTEX_RADIUS = 5;
const VERTEX_HIT_RADIUS = 8;
const HANDLE_RADIUS = 4;
const HANDLE_HIT_RADIUS = 8;
const CONTOUR_HIT_WIDTH = 12;
const CENTER_HANDLE_SIZE = 12;
/** A press becomes a drag only past this many CSS pixels, so a click selects without writing. */
const DRAG_THRESHOLD_PX = 3;
/** Arrow-key nudge in project units (Shift: ×10), along the screen axes. */
const NUDGE_STEP = 1;
const NUDGE_STEP_LARGE = 10;
const NUDGE_KEYS: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};
/** The keyboard model of the point list, read by screen readers with every point. */
const POINT_LIST_HELP = '] and [ go to the next and previous point, Home and End to the first and last. Arrow keys move the point (Shift: 10 units). C switches Corner and Smooth. Delete removes the point. Escape leaves mask editing.';
const OUTLINE_COLOR = '#22d3ee';
const OUTLINE_SHADOW = 'rgba(2, 6, 23, 0.85)';
const VERTEX_FILL = '#0f172a';
const VERTEX_SELECTED_FILL = '#22d3ee';
const HANDLE_FILL = '#facc15';

type GestureKind = 'path' | 'vertex' | 'handle';

interface Gesture {
  kind: GestureKind;
  index: number;
  handle?: BezierHandleKind;
  initialPath: BezierPath;
  frame: MaskPathFrame;
  startWorld: PathPoint;
  startClient: PathPoint;
  snapshot: MaskGestureSnapshot;
  pointerId: number;
  /** True once the pointer crossed the drag threshold and the history batch opened. */
  started: boolean;
}

export interface MaskPathOverlayProps {
  owner: CharacterPart;
  maskId: string;
  /** The mask path evaluated at the edit frame of the active sequence (what the renderer clips with). */
  path: BezierPath;
  /** The owner's evaluated world transform at the edit frame. */
  transform: Transform & { affine?: WorldAffine };
  zScale: number;
  /** Stage pointer mapper owned by StageCanvas (no second coordinate authority). */
  toWorld: (clientX: number, clientY: number) => { svgX: number; svgY: number };
  /** Frame + sequence the gesture is authored at; a change cancels the gesture. */
  editKey: string;
  /** False while editing is refused (locked, procedural pose, singular map): outline only. */
  interactive: boolean;
  onPathChange: (path: BezierPath) => void;
  onBatchStart: () => void;
  onBatchEnd: () => void;
  captureSnapshot: () => MaskGestureSnapshot;
  /** Restores what a cancelled gesture wrote and closes its batch with no history entry. */
  cancelGesture: (snapshot: MaskGestureSnapshot) => void;
  registerGestureCancel: (cancel: (() => void) | null) => void;
  /** The selected vertex (transient editor state owned by the mask-editing hook). */
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
  /** WP-03: double-click on the outline adds a point there (static paths only). */
  onInsertVertex?: (world: PathPoint) => void;
}

/**
 * WP-02 — on-canvas editing of one existing layer mask.
 *
 * The outline is the renderer's own contour (`buildLayerMaskPathD` with the
 * owner's evaluated world map); pointer input goes through the inverse of that
 * same map (`resolveMaskPathFrame`). A press on the path area moves the whole
 * path, a vertex moves itself and its handles, a tangent handle moves alone (a
 * smooth vertex mirrors its counterpart). Each drag writes the gesture's
 * INITIAL path plus one absolute delta through the existing `authorMaskPath`
 * writer, bracketed by one history batch: one drag is one undo entry, and a
 * cancelled drag (Escape, pointer cancel, a frame or sequence change, leaving
 * the mode) restores the owner's masks and path channels inside the batch, so
 * it records nothing.
 * The owner layer's transform is never written.
 */
export const MaskPathOverlay: React.FC<MaskPathOverlayProps> = ({
  owner,
  maskId,
  path,
  transform,
  zScale,
  toWorld,
  editKey,
  interactive,
  onPathChange,
  onBatchStart,
  onBatchEnd,
  captureSnapshot,
  cancelGesture,
  registerGestureCancel,
  selectedIndex: requestedIndex,
  onSelectIndex,
  onInsertVertex,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const gestureRef = useRef<Gesture | null>(null);
  const overlayRef = useRef<SVGGElement | null>(null);
  /** The point that had keyboard focus last (kept while focus is inside the overlay). */
  const focusRef = useRef<{ inside: boolean; index: number | null }>({ inside: false, index: null });
  // A selection past the end of a shorter path points at nothing.
  const selectedIndex = requestedIndex !== null && requestedIndex < path.points.length ? requestedIndex : null;

  /** Ends the gesture; a started one is rolled back first when `rollback`. */
  const finishGesture = (rollback: boolean) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gestureRef.current = null;
    registerGestureCancel(null);
    setIsDragging(false);
    if (!gesture.started) return;
    if (rollback) cancelGesture(gesture.snapshot);
    else onBatchEnd();
  };
  const finishGestureRef = useRef(finishGesture);
  useEffect(() => {
    finishGestureRef.current = finishGesture;
  });

  // A gesture is authored at ONE frame of ONE sequence: playback, a seek or a
  // sequence switch mid-drag cancels it instead of writing to a moving target.
  useEffect(() => {
    if (gestureRef.current) finishGestureRef.current(true);
  }, [editKey]);

  // Unmount (target left or deleted) mid-gesture: never leave a batch open.
  useEffect(() => () => {
    if (gestureRef.current) finishGestureRef.current(true);
  }, []);

  /**
   * WP-06 — keyboard alternative to dragging: the arrow keys nudge the
   * selected point (or the whole path when no point is selected) by one
   * project unit along the screen axes, Shift by ten. A held key is ONE undo
   * entry (the batch closes on keyup or blur). Text fields, open dialogs and
   * the focused timeline keep their own arrow keys.
   */
  const nudgeRef = useRef<{ active: boolean }>({ active: false });
  const latestNudge = useRef({ interactive, path, owner, transform, selectedIndex: requestedIndex, onPathChange, onBatchStart, onBatchEnd, onSelectIndex });
  useEffect(() => {
    latestNudge.current = { interactive, path, owner, transform, selectedIndex: requestedIndex, onPathChange, onBatchStart, onBatchEnd, onSelectIndex };
  });
  useEffect(() => {
    const endNudge = () => {
      if (!nudgeRef.current.active) return;
      nudgeRef.current.active = false;
      latestNudge.current.onBatchEnd();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const latest = latestNudge.current;
      // C4 — in the keyboard model focus IS the selection: a focused point is
      // the point the keys act on even before the selection caught up with it.
      const focusedIndex = overlayRef.current?.contains(document.activeElement)
        ? Number(document.activeElement?.getAttribute('data-index'))
        : Number.NaN;
      const current = latest.selectedIndex === null && Number.isInteger(focusedIndex)
        ? { ...latest, selectedIndex: focusedIndex }
        : latest;
      // C2-F — `]` / `[` walk the selected point forward / back along the path
      // (wrapping), so a point can be picked and then nudged without a pointer.
      if ((event.key === ']' || event.key === '[') && current.interactive && !gestureRef.current
        && !event.altKey && !event.ctrlKey && !event.metaKey
        && !isBlockingModalOpen() && !isEditableElement(document.activeElement) && !ownsShortcutScope('timeline')) {
        const count = current.path.points.length;
        if (count === 0) return;
        event.preventDefault();
        const index = current.selectedIndex !== null && current.selectedIndex < count ? current.selectedIndex : null;
        const step = event.key === ']' ? 1 : -1;
        current.onSelectIndex(index === null ? (step > 0 ? 0 : count - 1) : (index + step + count) % count);
        return;
      }
      // C4 — with a point FOCUSED (keyboard model): Home/End reach the first and
      // last point, C switches the point between Corner and Smooth (one undo step).
      const focusedInside = overlayRef.current?.contains(document.activeElement) ?? false;
      if (focusedInside && current.interactive && !gestureRef.current && !event.altKey && !event.ctrlKey && !event.metaKey) {
        const count = current.path.points.length;
        if ((event.key === 'Home' || event.key === 'End') && count > 0) {
          event.preventDefault();
          current.onSelectIndex(event.key === 'Home' ? 0 : count - 1);
          return;
        }
        if ((event.key === 'c' || event.key === 'C') && current.selectedIndex !== null && current.selectedIndex < count) {
          event.preventDefault();
          event.stopPropagation();
          const index = current.selectedIndex;
          const point = current.path.points[index];
          const next = point.kind === 'smooth'
            ? { ...current.path, points: current.path.points.map((candidate, at) => (at === index ? { ...candidate, kind: 'corner' as const } : candidate)) }
            : initializeSmoothHandles(current.path, index);
          current.onBatchStart();
          current.onPathChange(next);
          current.onBatchEnd();
          return;
        }
      }
      const direction = NUDGE_KEYS[event.key];
      if (!direction || !current.interactive || gestureRef.current || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isBlockingModalOpen() || isEditableElement(document.activeElement) || ownsShortcutScope('timeline')) return;
      const frame = resolveMaskPathFrame(current.owner, current.path.coordinateSpace, current.transform);
      if (!frame) return;
      event.preventDefault();
      const step = event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
      const delta = maskPathDeltaFromWorld(frame, { x: 0, y: 0 }, { x: direction.x * step, y: direction.y * step });
      if (!nudgeRef.current.active) {
        nudgeRef.current.active = true;
        current.onBatchStart();
      }
      const index = current.selectedIndex;
      current.onPathChange(index !== null && index < current.path.points.length
        ? moveMaskVertex(current.path, index, delta)
        : translateMaskPath(current.path, delta));
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (NUDGE_KEYS[event.key]) endNudge();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', endNudge);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', endNudge);
      endNudge();
    };
  }, []);

  // C4 — focus follows the selection while the keyboard is in the point list
  // (]/[, Home/End), and a deleted focused point hands focus to its neighbour.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !focusRef.current.inside) return;
    const active = document.activeElement;
    const lostFocus = !active || active === document.body || !overlay.contains(active);
    const count = path.points.length;
    if (count === 0) return;
    if (lostFocus && selectedIndex === null) {
      onSelectIndex(Math.min(focusRef.current.index ?? 0, count - 1));
      return;
    }
    if (selectedIndex === null) return;
    const target = overlay.querySelector<SVGElement>(`[data-testid="mask-vertex"][data-index="${selectedIndex}"]`);
    if (target && target !== active) target.focus();
  }, [selectedIndex, path.points.length, onSelectIndex]);

  useEffect(() => {
    if (!consumeMaskPointsFocusRequest()) return;
    const target = overlayRef.current?.querySelector<SVGElement>('[data-testid="mask-vertex"][tabindex="0"]');
    if (!target) return;
    focusRef.current = { inside: true, index: Number(target.getAttribute('data-index')) };
    target.focus();
  }, []);

  // Leaving mask editing (Esc, another layer) with focus on a point: focus goes
  // back to the control that entered it, else to the owner's layer row.
  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    return () => {
      if (!overlay || !overlay.contains(document.activeElement)) return;
      queueMicrotask(() => {
        if (document.activeElement && document.activeElement !== document.body) return;
        const entry = document.querySelector<HTMLElement>('[data-mask-edit-entry]:not([disabled])')
          ?? document.querySelector<HTMLElement>(`[role="treeitem"][data-layer-id="${CSS.escape(owner.id)}"]`);
        entry?.focus();
      });
    };
  }, [owner.id]);

  const worldPoint = (clientX: number, clientY: number): PathPoint => {
    const { svgX, svgY } = toWorld(clientX, clientY);
    return { x: svgX - EDITOR_CAMERA_CENTER.x, y: svgY - EDITOR_CAMERA_CENTER.y };
  };

  const frame = resolveMaskPathFrame(owner, path.coordinateSpace, transform);
  const contourD = buildLayerMaskPathD(path, owner, transform, EDITOR_CAMERA_CENTER);
  const toScreen = (point: PathPoint): PathPoint => {
    const world = frame ? maskPathPointToWorld(frame, point) : point;
    return { x: world.x + EDITOR_CAMERA_CENTER.x, y: world.y + EDITOR_CAMERA_CENTER.y };
  };

  const begin = (event: React.PointerEvent<SVGElement>, kind: GestureKind, index: number, handle?: BezierHandleKind) => {
    if (!interactive || !frame || event.button !== 0 || gestureRef.current) return;
    // Cancelling pointerdown suppresses the compatibility mouse events, so the
    // owner layer underneath never starts its own translate drag.
    event.preventDefault();
    event.stopPropagation();
    if (isEditableElement(document.activeElement)) (document.activeElement as HTMLElement).blur();
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    if (kind !== 'path') onSelectIndex(index);
    gestureRef.current = {
      kind,
      index,
      handle,
      initialPath: path,
      frame,
      startWorld: worldPoint(event.clientX, event.clientY),
      startClient: { x: event.clientX, y: event.clientY },
      snapshot: captureSnapshot(),
      pointerId: event.pointerId,
      started: false,
    };
    registerGestureCancel(() => finishGestureRef.current(true));
    setIsDragging(true);
  };

  const move = (event: React.PointerEvent<SVGElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    event.stopPropagation();
    if (!gesture.started) {
      const travel = Math.hypot(event.clientX - gesture.startClient.x, event.clientY - gesture.startClient.y);
      if (travel < DRAG_THRESHOLD_PX) return;
      gesture.started = true;
      onBatchStart();
    }
    const delta = maskPathDeltaFromWorld(gesture.frame, gesture.startWorld, worldPoint(event.clientX, event.clientY));
    const next = gesture.kind === 'path'
      ? translateMaskPath(gesture.initialPath, delta)
      : gesture.kind === 'vertex'
        ? moveMaskVertex(gesture.initialPath, gesture.index, delta)
        : moveMaskHandle(gesture.initialPath, gesture.index, gesture.handle ?? 'out', delta);
    onPathChange(next);
  };

  const end = (event: React.PointerEvent<SVGElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    event.stopPropagation();
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
    finishGesture(false);
  };

  const cancel = (event: React.PointerEvent<SVGElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    finishGesture(true);
  };

  const gestureHandlers = {
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: cancel,
  };

  if (!contourD) return null;

  const vertices = path.points.map((vertex) => toScreen(vertex));
  const center = vertices.length > 0
    ? {
      x: (Math.min(...vertices.map((point) => point.x)) + Math.max(...vertices.map((point) => point.x))) / 2,
      y: (Math.min(...vertices.map((point) => point.y)) + Math.max(...vertices.map((point) => point.y))) / 2,
    }
    : null;
  const selectedVertex = selectedIndex !== null ? path.points[selectedIndex] : undefined;
  const editable = interactive && Boolean(frame);
  const maskName = owner.masks?.find((candidate) => candidate.id === maskId)?.name ?? maskId;
  const helpId = `mask-points-help-${owner.id}-${maskId}`;

  const renderHandle = (handle: BezierHandleKind) => {
    if (!selectedVertex || selectedIndex === null) return null;
    const source = handle === 'in' ? selectedVertex.handleIn : selectedVertex.handleOut;
    if (!source) return null;
    const anchor = vertices[selectedIndex];
    const point = toScreen(source);
    return (
      <g key={`mask-handle-${handle}`}>
        <line x1={anchor.x} y1={anchor.y} x2={point.x} y2={point.y} stroke={HANDLE_FILL} strokeWidth={1.2 * zScale} pointerEvents="none" />
        <circle cx={point.x} cy={point.y} r={HANDLE_RADIUS * zScale} fill={HANDLE_FILL} stroke={VERTEX_FILL} strokeWidth={1.2 * zScale} pointerEvents="none" />
        {editable && (
          <circle
            data-testid={`mask-tangent-handle-${handle}`}
            cx={point.x}
            cy={point.y}
            r={HANDLE_HIT_RADIUS * zScale}
            fill="transparent"
            style={{ cursor: 'crosshair' }}
            onPointerDown={(event) => begin(event, 'handle', selectedIndex, handle)}
            {...gestureHandlers}
          />
        )}
      </g>
    );
  };

  return (
    <g
      ref={overlayRef}
      className={`mask-path-overlay${isDragging ? ' is-dragging' : ''}`}
      data-testid="mask-path-overlay"
      onFocus={(event) => {
        const index = Number((event.target as Element).getAttribute('data-index'));
        focusRef.current = { inside: true, index: Number.isFinite(index) ? index : focusRef.current.index };
      }}
      onBlur={(event) => {
        if (!overlayRef.current?.contains(event.relatedTarget as Node | null)) focusRef.current.inside = false;
      }}
      data-mask-owner={owner.id}
      data-mask-id={maskId}
      data-interactive={editable ? 'true' : 'false'}
    >
      <path d={contourD} fill="none" stroke={OUTLINE_SHADOW} strokeWidth={3 * zScale} pointerEvents="none" />
      <path
        data-testid="mask-path-outline"
        d={contourD}
        fill="none"
        stroke={OUTLINE_COLOR}
        strokeWidth={1.5 * zScale}
        strokeDasharray={`${6 * zScale} ${4 * zScale}`}
        pointerEvents="none"
      />
      {/* C4 — an OPEN mask still fills as if its ends were joined by a straight
          line (the SVG fill rule KCS renders); that implied edge is drawn
          finely dotted so the outline never suggests an unfilled path. */}
      {!path.closed && vertices.length >= 2 && (
        <line
          data-testid="mask-path-implied-edge"
          x1={vertices[vertices.length - 1].x}
          y1={vertices[vertices.length - 1].y}
          x2={vertices[0].x}
          y2={vertices[0].y}
          stroke={OUTLINE_COLOR}
          strokeOpacity={0.6}
          strokeWidth={1 * zScale}
          strokeDasharray={`${1.5 * zScale} ${3 * zScale}`}
          pointerEvents="none"
        />
      )}
      {editable && (
        <path
          data-testid="mask-path-hit-area"
          d={contourD}
          fill={path.closed ? 'transparent' : 'none'}
          stroke="transparent"
          strokeWidth={CONTOUR_HIT_WIDTH * zScale}
          style={{ cursor: 'move' }}
          onPointerDown={(event) => begin(event, 'path', -1)}
          onDoubleClick={(event) => {
            if (!onInsertVertex) return;
            event.stopPropagation();
            onInsertVertex(worldPoint(event.clientX, event.clientY));
          }}
          {...gestureHandlers}
        />
      )}
      {editable && center && (
        <rect
          data-testid="mask-path-move-handle"
          x={center.x - (CENTER_HANDLE_SIZE / 2) * zScale}
          y={center.y - (CENTER_HANDLE_SIZE / 2) * zScale}
          width={CENTER_HANDLE_SIZE * zScale}
          height={CENTER_HANDLE_SIZE * zScale}
          rx={2 * zScale}
          fill="rgba(34, 211, 238, 0.25)"
          stroke={OUTLINE_COLOR}
          strokeWidth={1.2 * zScale}
          style={{ cursor: 'move' }}
          onPointerDown={(event) => begin(event, 'path', -1)}
          {...gestureHandlers}
        />
      )}
      {renderHandle('in')}
      {renderHandle('out')}
      {editable && <desc id={helpId}>{POINT_LIST_HELP}</desc>}
      <g
        role={editable ? 'listbox' : undefined}
        aria-label={editable ? `Points of mask “${maskName}” on “${owner.name}”` : undefined}
        aria-describedby={editable ? helpId : undefined}
      >
      {vertices.map((point, index) => {
        const selected = selectedIndex === index;
        const vertex = path.points[index];
        return (
          <g key={`mask-vertex-${path.points[index].id || index}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r={VERTEX_RADIUS * zScale}
              fill={selected ? VERTEX_SELECTED_FILL : VERTEX_FILL}
              stroke={OUTLINE_COLOR}
              strokeWidth={1.4 * zScale}
              pointerEvents="none"
            />
            {editable && (
              <circle
                data-testid="mask-vertex"
                className="mask-vertex-hit"
                data-index={index}
                data-selected={selected ? 'true' : 'false'}
                // One Tab stop for the whole point list (roving): the selected
                // point, else the first. Tab again leaves the list — no trap.
                role="option"
                tabIndex={index === (selectedIndex ?? 0) ? 0 : -1}
                aria-selected={selected}
                aria-label={`Point ${index + 1} of ${path.points.length}, ${vertex.kind === 'smooth' ? 'smooth' : 'corner'}${index === 0 ? ', first point' : ''}`}
                cx={point.x}
                cy={point.y}
                r={VERTEX_HIT_RADIUS * zScale}
                fill="transparent"
                style={{ cursor: 'crosshair' }}
                onFocus={() => {
                  if (!selected) onSelectIndex(index);
                }}
                onPointerDown={(event) => begin(event, 'vertex', index)}
                {...gestureHandlers}
              />
            )}
          </g>
        );
      })}
      </g>
    </g>
  );
};
