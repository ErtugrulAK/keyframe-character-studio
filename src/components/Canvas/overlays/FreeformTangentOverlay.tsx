import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { BezierPath, CharacterPart, Transform } from '../../../types/animator';
import { EDITOR_CAMERA_CENTER, type CoordinatePoint } from '../../../utils/projectCoordinates';
import { getFreeformVertexWorldPositions, resolveFreeformPath } from '../../../utils/freeform';
import { buildBezierPathD, altMoveVertexHandle, moveVertexHandle, pullVertexHandles, toggleVertexKind, type BezierHandleKind } from '../../../utils/bezierPath';
import { isEditableElement, ownsShortcutScope } from '../../../utils/keyboardFocus';
import { isBlockingModalOpen } from '../../../utils/modalBoundary';
import { insertMaskVertex, nearestMaskPathSegment } from '../../../utils/maskPathCreation';
import { worldAffineOf } from '../../../utils/containerMath';
import { worldToLocal } from '../../../utils/matte';
import type { WorldAffine } from '../../../utils/containerMath';

/** Marker sizes, scaled by the canvas zScale so they stay screen-constant. */
const VERTEX_RADIUS = 7;
const VERTEX_HIT_RADIUS = 9;
const HANDLE_RADIUS = 5;
const HANDLE_HIT_RADIUS = 9;
const MARKER_STROKE = 1.2;
const VERTEX_FILL = '#0f172a';
const VERTEX_STROKE = '#4a8fe7';
const VERTEX_SELECTED_FILL = '#4a8fe7';
const VERTEX_LABEL_FILL = '#7dd3fc';
const VERTEX_SELECTED_LABEL_FILL = '#0f172a';
const HANDLE_FILL = '#facc15';
const HANDLE_SELECTED_FILL = '#f97316';

type HandleKind = BezierHandleKind;
const HANDLE_KEY: Record<HandleKind, 'handleIn' | 'handleOut'> = { in: 'handleIn', out: 'handleOut' };

interface DragState {
  /** A tangent handle, or the point itself (which carries its handles along). */
  handle: HandleKind | 'vertex';
  index: number;
  initialPath: BezierPath;
  startLocal: { x: number; y: number };
  /** The press position on screen; a point drag starts only after a real move. */
  startClient: { x: number; y: number };
  /** False until the gesture changes something: a plain click on a point opens no history batch. */
  started: boolean;
  /** C10 — Alt held at the press: a handle breaks or relinks, a point pulls out new handles. */
  alt: boolean;
}

/** Pointer travel (CSS px) before a press on a point becomes a drag of that point. */
const VERTEX_DRAG_THRESHOLD_PX = 3;

interface FreeformTangentOverlayProps {
  part: CharacterPart;
  /** Evaluated world transform of the part at the current frame. */
  transform: Transform & { affine?: WorldAffine };
  zScale: number;
  /** Stage pointer mapper owned by StageCanvas (no second coordinate authority). */
  toWorld: (clientX: number, clientY: number) => { svgX: number; svgY: number };
  onPathChange: (next: BezierPath) => void;
  onBatchStart: () => void;
  onBatchEnd: () => void;
  outputOrigin?: CoordinatePoint;
  /** C6 — the selected point, shared with the Inspector (controlled when given). */
  selectedIndex?: number | null;
  onSelectIndex?: (index: number | null) => void;
}

/** Moves one handle, keeping the counterpart mirrored for smooth vertices. */
const withMovedHandle = moveVertexHandle;

/**
 * Direct tangent-handle authoring for the selected freeform layer.
 *
 * Renders in world coordinates above the rest of the stage; every write goes
 * through the caller's part update path and is bracketed by the existing history
 * batch API, so a drag produces exactly one undo entry.
 */
export const FreeformTangentOverlay: React.FC<FreeformTangentOverlayProps> = ({
  part,
  transform,
  zScale,
  toWorld,
  onPathChange,
  onBatchStart,
  onBatchEnd,
  outputOrigin = EDITOR_CAMERA_CENTER,
  selectedIndex: controlledIndex,
  onSelectIndex,
}) => {
  const path = resolveFreeformPath(part);
  const [localIndex, setLocalIndex] = useState<number | null>(null);
  const selectedIndex = controlledIndex !== undefined ? controlledIndex : localIndex;
  const setSelectedIndex = useCallback((next: number | null | ((current: number | null) => number | null)) => {
    const value = typeof next === 'function' ? next(selectedIndex) : next;
    if (onSelectIndex) onSelectIndex(value);
    else setLocalIndex(value);
  }, [onSelectIndex, selectedIndex]);
  const [selectedHandle, setSelectedHandle] = useState<HandleKind | null>(null);
  const [isDraggingHandle, setIsDraggingHandle] = useState<boolean>(false);
  const [pendingCancel, setPendingCancel] = useState<boolean>(false);
  const dragRef = useRef<DragState | null>(null);
  const partIdRef = useRef<string>(part.id);
  const vertexCount = path?.points.length ?? 0;

  // The overlay owns a selection only for the layer it is showing: switching
  // layer or losing a vertex resets it instead of carrying a stale index over.
  useEffect(() => {
    if (partIdRef.current === part.id && selectedIndex !== null && selectedIndex >= vertexCount) {
      setSelectedIndex(null);
      setSelectedHandle(null);
      return;
    }
    if (partIdRef.current !== part.id) {
      partIdRef.current = part.id;
      setSelectedIndex(null);
      setSelectedHandle(null);
    }
  }, [part.id, selectedIndex, setSelectedIndex, vertexCount]);

  // Escape cancels an in-flight drag. The rollback is written first and the batch
  // is closed by the effect below once the write has committed, so history never
  // captures the mid-drag snapshot — including a drag that never moved.
  useEffect(() => {
    if (!isDraggingHandle) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      const drag = dragRef.current;
      if (!drag || event.key !== 'Escape') return;
      event.preventDefault();
      dragRef.current = null;
      setIsDraggingHandle(false);
      setPendingCancel(true);
      onPathChange(drag.initialPath);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDraggingHandle, onPathChange]);

  useEffect(() => {
    if (!pendingCancel) return;
    // The pending flag sequences Escape restoration before closing the history batch.
    // oxlint-disable-next-line react/set-state-in-effect
    setPendingCancel(false);
    onBatchEnd();
  }, [pendingCancel, onBatchEnd]);

  // C10 — C switches the selected point between Corner and Smooth, as in mask
  // editing (one write, one undo step).
  const latestKey = useRef({ path, selectedIndex, onPathChange });
  useEffect(() => {
    latestKey.current = { path, selectedIndex, onPathChange };
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'c' && event.key !== 'C') return;
      if (event.altKey || event.ctrlKey || event.metaKey || dragRef.current) return;
      const { path: current, selectedIndex: index, onPathChange: write } = latestKey.current;
      if (!current || index === null || index >= current.points.length) return;
      if (isBlockingModalOpen() || isEditableElement(document.activeElement) || ownsShortcutScope('timeline')) return;
      event.preventDefault();
      event.stopPropagation();
      write(toggleVertexKind(current, index));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Latest batch-ender, so the unmount cleanup below is bound to unmount only:
  // a re-created callback identity mid-drag must not close the open batch early.
  const onBatchEndRef = useRef(onBatchEnd);
  useEffect(() => {
    onBatchEndRef.current = onBatchEnd;
  }, [onBatchEnd]);

  useEffect(() => () => {
    if (!dragRef.current?.started) return;
    dragRef.current = null;
    onBatchEndRef.current();
  }, []);

  // The overlay maps with the SAME world transform the renderer draws with, so
  // the derived affine rides along here: dropping it (a hand-built TRS object)
  // would shear every marker/handle away from the drawn shape in a container
  // whose nesting is not a TRS.
  const worldTransform = { ...transform };

  const toLocal = (point: { x: number; y: number }) => worldToLocal(point, worldTransform, outputOrigin);

  const worldOf = (points: { x: number; y: number }[]) =>
    getFreeformVertexWorldPositions(points, transform, outputOrigin);

  if (!path || path.points.length < 2) return null;

  const vertices = worldOf(path.points);
  const drag = (event: React.PointerEvent<SVGElement>, index: number, handle: HandleKind | 'vertex') => {
    event.stopPropagation();
    event.preventDefault();
    const { svgX, svgY } = toWorld(event.clientX, event.clientY);
    const started = handle !== 'vertex';
    dragRef.current = { handle, index, initialPath: path, startLocal: toLocal({ x: svgX, y: svgY }), startClient: { x: event.clientX, y: event.clientY }, started, alt: event.altKey };
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    setSelectedIndex(index);
    setSelectedHandle(handle === 'vertex' ? null : handle);
    if (!started) return;
    setIsDraggingHandle(true);
    onBatchStart();
  };

  const move = (event: React.PointerEvent<SVGElement>) => {
    const active = dragRef.current;
    if (!active) return;
    event.stopPropagation();
    if (!active.started) {
      if (Math.hypot(event.clientX - active.startClient.x, event.clientY - active.startClient.y) < VERTEX_DRAG_THRESHOLD_PX) return;
      active.started = true;
      setIsDraggingHandle(true);
      onBatchStart();
    }
    const { svgX, svgY } = toWorld(event.clientX, event.clientY);
    const currentLocal = toLocal({ x: svgX, y: svgY });
    if (active.handle === 'vertex' && active.alt) {
      // C10 — Alt-drag from a point pulls out new mirrored handles; the point stays.
      const offset = { x: currentLocal.x - active.startLocal.x, y: currentLocal.y - active.startLocal.y };
      onPathChange({
        ...active.initialPath,
        points: active.initialPath.points.map((vertex, index) => (index === active.index ? pullVertexHandles(vertex, offset) : vertex)),
      });
      return;
    }
    if (active.handle === 'vertex') {
      // The point moves and carries its own handles with it (the curve keeps its shape).
      const dx = currentLocal.x - active.startLocal.x;
      const dy = currentLocal.y - active.startLocal.y;
      onPathChange({
        ...active.initialPath,
        points: active.initialPath.points.map((vertex, index) => (index !== active.index ? vertex : {
          ...vertex,
          x: vertex.x + dx,
          y: vertex.y + dy,
          ...(vertex.handleIn ? { handleIn: { x: vertex.handleIn.x + dx, y: vertex.handleIn.y + dy } } : {}),
          ...(vertex.handleOut ? { handleOut: { x: vertex.handleOut.x + dx, y: vertex.handleOut.y + dy } } : {}),
        })),
      });
      return;
    }
    const handle = active.handle;
    const startHandle = active.initialPath.points[active.index][HANDLE_KEY[handle]];
    if (!startHandle) return;
    const next = {
      x: startHandle.x + (currentLocal.x - active.startLocal.x),
      y: startHandle.y + (currentLocal.y - active.startLocal.y),
    };
    onPathChange({
      ...active.initialPath,
      points: active.initialPath.points.map((vertex, index) => (
        index === active.index ? (active.alt ? altMoveVertexHandle(vertex, handle, next) : withMovedHandle(vertex, handle, next)) : vertex
      )),
    });
  };

  const end = (event: React.PointerEvent<SVGElement>) => {
    if (!dragRef.current) return;
    event.stopPropagation();
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
    const { started } = dragRef.current;
    dragRef.current = null;
    if (!started) return;
    setIsDraggingHandle(false);
    onBatchEnd();
  };

  const toggleKind = (event: React.MouseEvent<SVGElement>, index: number) => {
    event.stopPropagation();
    onPathChange(toggleVertexKind(path, index));
  };

  const selectVertex = (index: number) => setSelectedIndex((current) => (current === index ? current : index));

  const renderHandle = (index: number, handle: HandleKind) => {
    const vertex = path.points[index];
    const source = vertex[HANDLE_KEY[handle]];
    if (!source) return null;
    const world = worldOf([source])[0];
    if (!world) return null;
    const isSelectedHandle = selectedHandle === handle;
    return (
      <g key={`handle-${handle}-${index}`}>
        <line
          x1={vertices[index].x}
          y1={vertices[index].y}
          x2={world.x}
          y2={world.y}
          stroke={HANDLE_FILL}
          strokeWidth={MARKER_STROKE * zScale}
          pointerEvents="none"
        />
        <circle
          data-testid={`freeform-tangent-handle-${handle}`}
          data-selected={isSelectedHandle}
          cx={world.x}
          cy={world.y}
          r={HANDLE_HIT_RADIUS * zScale}
          fill="transparent"
          style={{ cursor: 'grab' }}
          onPointerDown={(event) => drag(event, index, handle)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
        <circle
          cx={world.x}
          cy={world.y}
          r={HANDLE_RADIUS * zScale}
          fill={isSelectedHandle ? HANDLE_SELECTED_FILL : HANDLE_FILL}
          stroke={VERTEX_FILL}
          strokeWidth={MARKER_STROKE * zScale}
          pointerEvents="none"
        />
      </g>
    );
  };

  // The outline in world space: a double-click on it inserts a point there
  // without changing the drawn curve (De Casteljau split).
  const worldPoint = (point: { x: number; y: number }) => worldOf([point])[0] ?? point;
  const contourD = buildBezierPathD(path, worldPoint);
  const insertAt = (event: React.MouseEvent<SVGElement>) => {
    event.stopPropagation();
    const { svgX, svgY } = toWorld(event.clientX, event.clientY);
    const frame = { toWorld: { ...worldAffineOf(worldTransform), e: worldAffineOf(worldTransform).e + outputOrigin.x, f: worldAffineOf(worldTransform).f + outputOrigin.y }, toPath: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } };
    const nearest = nearestMaskPathSegment(path, frame, { x: svgX, y: svgY });
    if (!nearest) return;
    const next = insertMaskVertex(path, nearest.segmentIndex, nearest.t);
    if (!next) return;
    onPathChange(next);
    setSelectedIndex(nearest.segmentIndex + 1);
    setSelectedHandle(null);
  };

  return (
    <g data-testid="freeform-tangent-overlay">
      <path
        data-testid="freeform-path-hit-area"
        d={contourD}
        fill="none"
        stroke="transparent"
        strokeWidth={10 * zScale}
        style={{ cursor: 'copy' }}
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={insertAt}
      >
        <title>Double-click to add a point here</title>
      </path>
      {selectedIndex !== null && selectedIndex < path.points.length && (
        <>
          {renderHandle(selectedIndex, 'in')}
          {renderHandle(selectedIndex, 'out')}
        </>
      )}
      {vertices.map((world, index) => {
        const isSelected = selectedIndex === index;
        return (
          <g key={`tangent-vertex-${path.points[index].id || index}`} transform={`translate(${world.x}, ${world.y})`}>
            <circle
              data-testid="freeform-vertex-marker"
              r={VERTEX_HIT_RADIUS * zScale}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              data-vertex-index={index}
              data-point-kind={path.points[index].kind === 'smooth' ? 'smooth' : 'corner'}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                selectVertex(index);
                drag(event, index, 'vertex');
              }}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              onDoubleClick={(event) => toggleKind(event, index)}
            />
            <circle
              r={VERTEX_RADIUS * zScale}
              fill={isSelected ? VERTEX_SELECTED_FILL : VERTEX_FILL}
              stroke={VERTEX_STROKE}
              strokeWidth={MARKER_STROKE * zScale}
              pointerEvents="none"
            />
            <text
              y={3 * zScale}
              fontSize={8.5 * zScale}
              fontWeight={700}
              textAnchor="middle"
              fill={isSelected ? VERTEX_SELECTED_LABEL_FILL : VERTEX_LABEL_FILL}
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {index + 1}
            </text>
          </g>
        );
      })}
    </g>
  );
};
