import React, { useEffect, useRef, useState } from 'react';
import type { BezierPath, BezierVertex, CharacterPart, Transform } from '../../../types/animator';
import { EDITOR_CAMERA_CENTER, type CoordinatePoint } from '../../../utils/projectCoordinates';
import { getFreeformVertexWorldPositions, resolveFreeformPath } from '../../../utils/freeform';
import { initializeSmoothHandles } from '../../../utils/bezierPath';
import { worldToLocal } from '../../../utils/matte';

/** Marker sizes, scaled by the canvas zScale so they stay screen-constant. */
const VERTEX_RADIUS = 7;
const VERTEX_HIT_RADIUS = 9;
const HANDLE_RADIUS = 5;
const HANDLE_HIT_RADIUS = 9;
const MARKER_STROKE = 1.2;
const VERTEX_FILL = '#0f172a';
const VERTEX_STROKE = '#38bdf8';
const VERTEX_SELECTED_FILL = '#38bdf8';
const VERTEX_LABEL_FILL = '#7dd3fc';
const VERTEX_SELECTED_LABEL_FILL = '#0f172a';
const HANDLE_FILL = '#facc15';
const HANDLE_SELECTED_FILL = '#f97316';

type HandleKind = 'in' | 'out';
const HANDLE_KEY: Record<HandleKind, 'handleIn' | 'handleOut'> = { in: 'handleIn', out: 'handleOut' };

interface DragState {
  handle: HandleKind;
  index: number;
  initialPath: BezierPath;
  startLocal: { x: number; y: number };
}

export interface FreeformTangentOverlayProps {
  part: CharacterPart;
  /** Evaluated world transform of the part at the current frame. */
  transform: Transform;
  zScale: number;
  /** Stage pointer mapper owned by StageCanvas (no second coordinate authority). */
  toWorld: (clientX: number, clientY: number) => { svgX: number; svgY: number };
  onPathChange: (next: BezierPath) => void;
  onBatchStart: () => void;
  onBatchEnd: () => void;
  outputOrigin?: CoordinatePoint;
}

/** Below this length a dragged handle vector is treated as zero. */
const HANDLE_VECTOR_EPSILON = 1e-6;

/** Moves one handle, keeping the counterpart mirrored for smooth vertices. */
const withMovedHandle = (
  vertex: BezierVertex,
  handle: HandleKind,
  next: { x: number; y: number },
): BezierVertex => {
  const key = HANDLE_KEY[handle];
  // A non-finite pointer result is never written into the path.
  if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) return vertex;
  if (vertex.kind !== 'smooth') return { ...vertex, [key]: next };

  const counterpartKey = HANDLE_KEY[handle === 'out' ? 'in' : 'out'];
  const counterpart = vertex[counterpartKey];
  if (!counterpart) return { ...vertex, [key]: next };

  const dx = handle === 'out' ? next.x - vertex.x : vertex.x - next.x;
  const dy = handle === 'out' ? next.y - vertex.y : vertex.y - next.y;
  const length = Math.hypot(dx, dy);
  // A handle dragged exactly onto its anchor carries no direction, so the
  // counterpart keeps its own length and direction instead of collapsing.
  if (length <= HANDLE_VECTOR_EPSILON) return { ...vertex, [key]: next };

  const counterpartLength = Math.hypot(counterpart.x - vertex.x, counterpart.y - vertex.y);
  const mirrored = handle === 'out'
    ? { x: vertex.x - (dx / length) * counterpartLength, y: vertex.y - (dy / length) * counterpartLength }
    : { x: vertex.x + (dx / length) * counterpartLength, y: vertex.y + (dy / length) * counterpartLength };
  // Imported coordinates may be finite yet overflow the mirror arithmetic
  // (for example a counterpart at ±1.7e308 makes the hypot infinite). The
  // counterpart then keeps its previous value instead of gaining NaN/Infinity.
  if (!Number.isFinite(mirrored.x) || !Number.isFinite(mirrored.y)) return { ...vertex, [key]: next };
  return { ...vertex, [key]: next, [counterpartKey]: mirrored };
};

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
}) => {
  const path = resolveFreeformPath(part);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
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
  }, [part.id, selectedIndex, vertexCount]);

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
    setPendingCancel(false);
    onBatchEnd();
  }, [pendingCancel, onBatchEnd]);

  // Latest batch-ender, so the unmount cleanup below is bound to unmount only:
  // a re-created callback identity mid-drag must not close the open batch early.
  const onBatchEndRef = useRef(onBatchEnd);
  useEffect(() => {
    onBatchEndRef.current = onBatchEnd;
  }, [onBatchEnd]);

  useEffect(() => () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    onBatchEndRef.current();
  }, []);

  const worldTransform = {
    x: transform.x,
    y: transform.y,
    rotation: transform.rotation,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
    opacity: transform.opacity,
  };

  const toLocal = (point: { x: number; y: number }) => worldToLocal(point, worldTransform, outputOrigin);

  const worldOf = (points: { x: number; y: number }[]) => getFreeformVertexWorldPositions(
    points,
    outputOrigin.x + transform.x,
    outputOrigin.y + transform.y,
    transform.scaleX,
    transform.scaleY,
    transform.rotation,
  );

  if (!path || path.points.length < 2) return null;

  const vertices = worldOf(path.points);
  const drag = (event: React.PointerEvent<SVGElement>, index: number, handle: HandleKind) => {
    event.stopPropagation();
    event.preventDefault();
    const { svgX, svgY } = toWorld(event.clientX, event.clientY);
    dragRef.current = { handle, index, initialPath: path, startLocal: toLocal({ x: svgX, y: svgY }) };
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    setSelectedIndex(index);
    setSelectedHandle(handle);
    setIsDraggingHandle(true);
    onBatchStart();
  };

  const move = (event: React.PointerEvent<SVGElement>) => {
    const active = dragRef.current;
    if (!active) return;
    event.stopPropagation();
    const startHandle = active.initialPath.points[active.index][HANDLE_KEY[active.handle]];
    if (!startHandle) return;
    const { svgX, svgY } = toWorld(event.clientX, event.clientY);
    const currentLocal = toLocal({ x: svgX, y: svgY });
    const next = {
      x: startHandle.x + (currentLocal.x - active.startLocal.x),
      y: startHandle.y + (currentLocal.y - active.startLocal.y),
    };
    onPathChange({
      ...active.initialPath,
      points: active.initialPath.points.map((vertex, index) => (
        index === active.index ? withMovedHandle(vertex, active.handle, next) : vertex
      )),
    });
  };

  const end = (event: React.PointerEvent<SVGElement>) => {
    if (!dragRef.current) return;
    event.stopPropagation();
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    setIsDraggingHandle(false);
    onBatchEnd();
  };

  const toggleKind = (event: React.MouseEvent<SVGElement>, index: number) => {
    event.stopPropagation();
    if (path.points[index]?.kind === 'smooth') {
      onPathChange({
        ...path,
        points: path.points.map((vertex, vertexIndex) => (
          vertexIndex === index ? { ...vertex, kind: 'corner' } : vertex
        )),
      });
      return;
    }
    onPathChange(initializeSmoothHandles(path, index));
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

  return (
    <g data-testid="freeform-tangent-overlay">
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
              onPointerDown={(event) => {
                event.stopPropagation();
                setSelectedHandle(null);
                selectVertex(index);
              }}
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
