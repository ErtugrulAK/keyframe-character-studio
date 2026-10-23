import React, { useMemo, useState } from 'react';
import type { BezierPath, BezierVertex } from '../../types/animator';
import { buildBezierPathD, initializeSmoothHandles } from '../../utils/bezierPath';
import { generateId } from '../../utils/idGenerator';
import { MIN_CLOSED_MASK_POINTS, MIN_OPEN_MASK_POINTS } from '../../utils/maskPathCreation';
import { applyPathOrderEdit, planPathOrderEdit, type PathOrderCommand } from '../../utils/maskPathOrder';

interface BezierPathEditorProps {
  path: BezierPath;
  onChange: (path: BezierPath) => void;
  /** Width / height of the shape the path belongs to; the editor keeps that proportion. */
  aspectRatio?: number;
  /** Opens/closes ONE undo entry around a continuous vertex or handle drag. */
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  /**
   * When set, adding, deleting, reordering points and opening/closing the path
   * are refused with this reason (an animated path interpolates key to key by
   * vertex identity — D-08). Moving points and handles stays available.
   */
  topologyLockReason?: string | null;
  /**
   * C4 — when set (a locked mask, or a locked layer), the path is shown and its
   * points can be selected for inspection, but nothing changes it: no drag, no
   * nudge, no point type, no add/delete/reorder/open-close. The reason is shown.
   */
  readOnlyReason?: string | null;
  /**
   * C4 — runs a path structure command through the editor's authority (it also
   * rewrites every keyframe of an animated path). Returns the selected point's
   * new index, or undefined when the command was refused. Without it the
   * command is applied to `path` and reported through `onChange`.
   */
  onOrderCommand?: (command: PathOrderCommand, selectedIndex: number | null) => number | null | undefined;
  /** The selected point, shared with the canvas when given (controlled). */
  selectedIndex?: number | null;
  onSelectIndex?: (index: number | null) => void;
}

type DragTarget = { type: 'point' | 'handleIn' | 'handleOut'; index: number };

/** The editor shows the path's 0..1 box plus this margin, so geometry past the edge stays visible and editable. */
const VIEW_MARGIN = 0.1;
const VIEW_WIDTH = 300;
const noSelectionReasonText = 'Select a point first';
const clampToView = (value: number): number => Math.max(-VIEW_MARGIN, Math.min(1 + VIEW_MARGIN, value));

/**
 * Numeric/visual support surface for a mask path (the canvas is the primary
 * editor). The view keeps the owner's proportions, can be expanded, and shows
 * the selected point's real type. Point-type changes reuse the canvas rule
 * (`initializeSmoothHandles`), so the two editors never disagree.
 */
export const BezierPathEditor: React.FC<BezierPathEditorProps> = ({
  path,
  onChange,
  aspectRatio = 260 / 160,
  onInteractionStart,
  onInteractionEnd,
  topologyLockReason = null,
  readOnlyReason = null,
  onOrderCommand,
  selectedIndex: controlledIndex,
  onSelectIndex,
}) => {
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [localIndex, setLocalIndex] = useState<number | null>(0);
  const [expanded, setExpanded] = useState(false);
  const rawIndex = controlledIndex !== undefined ? controlledIndex : localIndex;
  const selectedIndex = rawIndex !== null && rawIndex < path.points.length ? rawIndex : null;
  const selectIndex = (index: number | null) => {
    setLocalIndex(index);
    onSelectIndex?.(index);
  };

  const safeAspect = Number.isFinite(aspectRatio) && aspectRatio > 0 ? Math.max(0.5, Math.min(3, aspectRatio)) : 260 / 160;
  const width = VIEW_WIDTH;
  const height = Math.round(VIEW_WIDTH / safeAspect);
  const span = 1 + VIEW_MARGIN * 2;

  /** Path space → view units. Local paths are shown around the centre at a 1:1 layer scale. */
  const toView = (point: { x: number; y: number }) => {
    const unit = path.coordinateSpace === 'normalized' ? point : { x: 0.5 + point.x / width, y: 0.5 + point.y / height };
    return { x: ((unit.x + VIEW_MARGIN) / span) * width, y: ((unit.y + VIEW_MARGIN) / span) * height };
  };
  const viewPoints = useMemo(() => path.points.map((point) => toView(point)),
    // toView depends only on these inputs.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [path.points, path.coordinateSpace, width, height]);

  const toPathPoint = (event: React.MouseEvent<SVGSVGElement>): { x: number; y: number } => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clampToView(((event.clientX - rect.left) / rect.width) * span - VIEW_MARGIN);
    const y = clampToView(((event.clientY - rect.top) / rect.height) * span - VIEW_MARGIN);
    return path.coordinateSpace === 'normalized'
      ? { x, y }
      : { x: (x - 0.5) * width, y: (y - 0.5) * height };
  };

  const updateVertex = (index: number, target: DragTarget['type'], value: { x: number; y: number }) => {
    const nextPoints = path.points.map((point, pointIndex) => {
      if (pointIndex !== index) return point;
      if (target === 'point') {
        // A vertex carries its own absolute handles along.
        const dx = value.x - point.x;
        const dy = value.y - point.y;
        return {
          ...point,
          ...value,
          ...(point.handleIn ? { handleIn: { x: point.handleIn.x + dx, y: point.handleIn.y + dy } } : {}),
          ...(point.handleOut ? { handleOut: { x: point.handleOut.x + dx, y: point.handleOut.y + dy } } : {}),
        };
      }
      return { ...point, [target]: value } as BezierVertex;
    });
    onChange({ ...path, points: nextPoints });
  };

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!dragTarget) return;
    updateVertex(dragTarget.index, dragTarget.type, toPathPoint(event));
  };
  const handleVertexKeyDown = (event: React.KeyboardEvent<SVGCircleElement>, index: number, target: DragTarget['type']) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    if (readOnly) return;
    event.preventDefault();
    const point = path.points[index];
    const targetPoint = target === 'point' ? point : point[target];
    if (!targetPoint) return;
    const step = (path.coordinateSpace === 'normalized' ? 0.01 : 1) * (event.shiftKey ? 10 : 1);
    const delta = {
      x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
      y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
    };
    updateVertex(index, target, { x: targetPoint.x + delta.x, y: targetPoint.y + delta.y });
  };

  const minimumPoints = path.closed ? MIN_CLOSED_MASK_POINTS : MIN_OPEN_MASK_POINTS;
  const readOnly = Boolean(readOnlyReason);
  const topologyLocked = readOnly || Boolean(topologyLockReason);
  const structureReason = readOnlyReason ?? topologyLockReason;

  const addVertex = () => {
    const last = path.points[path.points.length - 1];
    const first = path.points[0];
    const point = {
      x: (last.x + first.x) / 2,
      y: (last.y + first.y) / 2,
    };
    const newIndex = path.points.length;
    const existingIds = new Set(path.points.map((candidate) => candidate.id));
    let id = generateId('vertex');
    while (existingIds.has(id)) id = generateId('vertex');
    onChange({
      ...path,
      points: [...path.points, { id, ...point, kind: 'corner' }],
    });
    selectIndex(newIndex);
  };
  const deleteVertex = () => {
    if (selectedIndex === null) return;
    const nextPoints = path.points.filter((_, pointIndex) => pointIndex !== selectedIndex);
    onChange({ ...path, points: nextPoints });
    selectIndex(Math.min(selectedIndex, nextPoints.length - 1));
    setDragTarget(null);
  };

  /** A structure command: the authority when given, else this path only. */
  const runOrder = (command: PathOrderCommand) => {
    setDragTarget(null);
    if (onOrderCommand) {
      const next = onOrderCommand(command, selectedIndex);
      if (next !== undefined) selectIndex(next);
      return;
    }
    const plan = planPathOrderEdit(path, command, selectedIndex);
    if (!plan.ok) return;
    const next = applyPathOrderEdit(path, plan.edit);
    if (!next) return;
    onChange(next);
    selectIndex(plan.selectedIndex);
  };
  // With an authority, order commands keep an animated path's keyframes in
  // step, so only adding/removing points is refused by the topology lock.
  const orderLocked = readOnly || (!onOrderCommand && topologyLocked);
  const orderReason = readOnlyReason ?? (!onOrderCommand ? topologyLockReason : null);
  const firstPointReason = !path.closed
    ? 'An open path starts at one of its two ends: reverse its direction to start at the other end'
    : selectedIndex === null ? noSelectionReasonText : selectedIndex === 0 ? 'This point is already the first point' : null;

  const selectedKind = selectedIndex !== null ? (path.points[selectedIndex].kind === 'smooth' ? 'smooth' : 'corner') : null;
  const setPointKind = (kind: 'corner' | 'smooth') => {
    if (selectedIndex === null || selectedKind === kind) return;
    if (kind === 'smooth') {
      // The canvas rule: handles from the neighbours' chord; existing handles kept.
      onChange(initializeSmoothHandles(path, selectedIndex));
      return;
    }
    onChange({
      ...path,
      points: path.points.map((candidate, pointIndex) => (pointIndex === selectedIndex ? { ...candidate, kind: 'corner' } : candidate)),
    });
  };

  /**
   * A dragged vertex or handle is one continuous gesture: the transaction opens on
   * the press and closes when the drag ends, so the whole sweep is one undo entry.
   */
  const endVertexDrag = () => {
    if (!dragTarget) return;
    setDragTarget(null);
    onInteractionEnd?.();
  };

  const pathD = buildBezierPathD(path, (point) => toView(point));
  const noSelectionReason = noSelectionReasonText;

  return (
    <div className={`bezier-path-editor${expanded ? ' is-expanded' : ''}`} data-testid="bezier-path-editor">
      <div className="bezier-path-editor__header">
        <span className="bezier-path-editor__status" aria-live="polite">
          {selectedIndex !== null ? `Point ${selectedIndex + 1} of ${path.points.length}` : `${path.points.length} points — select one to edit`}
        </span>
        <button
          type="button"
          className="btn-secondary"
          aria-pressed={expanded}
          onClick={() => setExpanded((value) => !value)}
          title={expanded ? 'Show the editor at its compact size' : 'Show the editor larger'}
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      <svg
        className="bezier-path-editor__canvas"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="application"
        aria-label="Bezier path editor"
        onMouseMove={handleMouseMove}
        onMouseUp={endVertexDrag}
        onMouseLeave={endVertexDrag}
        onPointerCancel={endVertexDrag}
        onLostPointerCapture={endVertexDrag}
      >
        <rect x={0} y={0} width={width} height={height} fill="rgba(15,23,42,0.65)" stroke="var(--border-color)" />
        {/* The layer's own 0..1 box, so geometry past the edge reads as such. */}
        <rect
          x={(VIEW_MARGIN / span) * width}
          y={(VIEW_MARGIN / span) * height}
          width={(1 / span) * width}
          height={(1 / span) * height}
          fill="none"
          stroke="rgba(148,163,184,0.35)"
          strokeDasharray="4 3"
          pointerEvents="none"
        />
        <path d={pathD} fill="rgba(56,189,248,0.12)" stroke="#38bdf8" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {path.points.map((point, index) => {
          const viewPoint = viewPoints[index];
          const handleIn = point.handleIn ? toView(point.handleIn) : null;
          const handleOut = point.handleOut ? toView(point.handleOut) : null;
          const startDrag = (type: DragTarget['type']) => (event: React.MouseEvent) => {
            event.stopPropagation();
            selectIndex(index);
            if (readOnly) return;
            setDragTarget({ type, index });
            onInteractionStart?.();
          };
          return (
            <g key={point.id}>
              {handleIn && <line x1={viewPoint.x} y1={viewPoint.y} x2={handleIn.x} y2={handleIn.y} stroke="#fbbf24" strokeWidth={1} />}
              {handleOut && <line x1={viewPoint.x} y1={viewPoint.y} x2={handleOut.x} y2={handleOut.y} stroke="#fbbf24" strokeWidth={1} />}
              {handleIn && <circle cx={handleIn.x} cy={handleIn.y} r={5} fill="#fbbf24" tabIndex={0} role="button" aria-label={`Vertex ${index + 1} incoming handle`} onKeyDown={(event) => handleVertexKeyDown(event, index, 'handleIn')} onMouseDown={startDrag('handleIn')} />}
              {handleOut && <circle cx={handleOut.x} cy={handleOut.y} r={5} fill="#fbbf24" tabIndex={0} role="button" aria-label={`Vertex ${index + 1} outgoing handle`} onKeyDown={(event) => handleVertexKeyDown(event, index, 'handleOut')} onMouseDown={startDrag('handleOut')} />}
              <circle
                cx={viewPoint.x}
                cy={viewPoint.y}
                r={7}
                fill={index === selectedIndex ? '#f8fafc' : '#38bdf8'}
                stroke="#0f172a"
                strokeWidth={1.5}
                tabIndex={0}
                role="button"
                aria-pressed={index === selectedIndex}
                onFocus={() => selectIndex(index)}
                onKeyDown={(event) => handleVertexKeyDown(event, index, 'point')}
                onMouseDown={startDrag('point')}
                aria-label={`Vertex ${index + 1}`}
              />
            </g>
          );
        })}
      </svg>
      <div className="bezier-path-editor__row" role="radiogroup" aria-label="Selected point type">
        <span className="form-label">POINT TYPE</span>
        {(['corner', 'smooth'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={selectedKind === kind}
            className={selectedKind === kind ? 'btn-primary' : 'btn-secondary'}
            disabled={readOnly || selectedIndex === null}
            title={readOnlyReason ?? (selectedIndex === null ? noSelectionReason : kind === 'smooth' ? 'Smooth: the two handles stay aligned' : 'Corner: the handles move independently')}
            onClick={() => setPointKind(kind)}
          >
            {kind === 'corner' ? 'Corner' : 'Smooth'}
          </button>
        ))}
      </div>
      <div className="bezier-path-editor__row bezier-path-editor__controls" role="group" aria-label="Path shape">
        <button
          type="button"
          role="switch"
          aria-checked={path.closed}
          className={path.closed ? 'btn-primary' : 'btn-secondary'}
          onClick={() => runOrder(path.closed ? 'open' : 'close')}
          disabled={orderLocked || (!path.closed && path.points.length < MIN_CLOSED_MASK_POINTS)}
          title={orderReason ?? (path.closed ? 'Closed: the last point joins the first. Click to open the path' : 'Open: the mask still fills, as if a straight line joined the last point to the first (dashed on the canvas). Click to close the path')}
        >
          Closed path
        </button>
        <button type="button" className="btn-secondary" onClick={() => runOrder('reverse')} disabled={orderLocked} title={orderReason ?? 'Trace the same shape the other way round (the first point of a closed path stays first)'}>
          Reverse direction
        </button>
        <button type="button" className="btn-secondary" onClick={() => runOrder('first')} disabled={orderLocked || firstPointReason !== null} title={orderReason ?? firstPointReason ?? 'Make the selected point the first point of the path; a closed path keeps its shape'}>
          Make first point
        </button>
      </div>
      <div className="bezier-path-editor__row bezier-path-editor__controls" role="group" aria-label="Point order in the path">
        <span className="form-label">POINT ORDER</span>
        <button type="button" className="btn-secondary" aria-label="Move point earlier in the path order" onClick={() => runOrder('earlier')} disabled={orderLocked || selectedIndex === null || selectedIndex <= 0} title={orderReason ?? 'Swap the selected point with the previous one in the path order: the outline changes (not the layer order)'}>◀ Earlier</button>
        <button type="button" className="btn-secondary" aria-label="Move point later in the path order" onClick={() => runOrder('later')} disabled={orderLocked || selectedIndex === null || selectedIndex >= path.points.length - 1} title={orderReason ?? 'Swap the selected point with the next one in the path order: the outline changes (not the layer order)'}>Later ▶</button>
      </div>
      <div className="bezier-path-editor__row bezier-path-editor__controls" role="group" aria-label="Path points">
        <button type="button" className="btn-secondary" onClick={addVertex} disabled={topologyLocked} title={structureReason ?? 'Add a point between the last and the first'}>Add vertex</button>
        <button
          type="button"
          className="btn-secondary"
          onClick={deleteVertex}
          disabled={topologyLocked || selectedIndex === null || path.points.length <= minimumPoints}
          title={structureReason ?? (selectedIndex === null ? noSelectionReason : path.points.length <= minimumPoints ? `A ${path.closed ? 'closed' : 'open'} path keeps at least ${minimumPoints} points` : 'Delete the selected point')}
        >
          Delete vertex
        </button>
      </div>
      {readOnlyReason
        ? <p className="bezier-path-editor__note">{readOnlyReason}</p>
        : topologyLockReason && <p className="bezier-path-editor__note">{topologyLockReason} {onOrderCommand ? 'Moving points and handles, the point order and opening/closing still work.' : 'Moving points and handles still works.'}</p>}
      {!path.closed && !readOnlyReason && (
        <p className="bezier-path-editor__note" data-testid="open-path-note">Open path: the mask still fills, as if a straight line joined the last point to the first.</p>
      )}
    </div>
  );
};
