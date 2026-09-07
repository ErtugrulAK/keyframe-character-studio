import React, { useMemo, useState } from 'react';
import type { BezierPath, BezierVertex } from '../../types/animator';
import { buildBezierPathD } from '../../utils/bezierPath';
import { generateId } from '../../utils/idGenerator';
interface BezierPathEditorProps {
  path: BezierPath;
  onChange: (path: BezierPath) => void;
  width?: number;
  height?: number;
}

type DragTarget = { type: 'point' | 'handleIn' | 'handleOut'; index: number };

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

export const BezierPathEditor: React.FC<BezierPathEditorProps> = ({
  path,
  onChange,
  width = 260,
  height = 160,
}) => {
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const viewPoints = useMemo(() => path.points.map((point) => ({
    x: path.coordinateSpace === 'normalized' ? point.x : 0.5 + point.x / Math.max(width, 1),
    y: path.coordinateSpace === 'normalized' ? point.y : 0.5 + point.y / Math.max(height, 1),
  })), [height, path.coordinateSpace, path.points, width]);

  const toPathPoint = (event: React.MouseEvent<SVGSVGElement>): { x: number; y: number } => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width);
    const y = clamp((event.clientY - rect.top) / rect.height);
    return path.coordinateSpace === 'normalized'
      ? { x, y }
      : { x: (x - 0.5) * width, y: (y - 0.5) * height };
  };

  const updateVertex = (index: number, target: DragTarget['type'], value: { x: number; y: number }) => {
    const nextPoints = path.points.map((point, pointIndex) => {
      if (pointIndex !== index) return point;
      if (target === 'point') return { ...point, ...value };
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
    event.preventDefault();
    const point = path.points[index];
    const targetPoint = target === 'point' ? point : point[target];
    if (!targetPoint) return;
    const step = path.coordinateSpace === 'normalized' ? 0.01 : 1;
    const delta = {
      x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
      y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
    };
    updateVertex(index, target, { x: targetPoint.x + delta.x, y: targetPoint.y + delta.y });
  };

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
    setSelectedIndex(newIndex);
  };
  const deleteVertex = () => {
    const index = Math.min(selectedIndex, path.points.length - 1);
    const nextPoints = path.points.filter((_, pointIndex) => pointIndex !== index);
    onChange({ ...path, points: nextPoints });
    setSelectedIndex(Math.min(index, nextPoints.length - 1));
    setDragTarget(null);
  };

  const reorder = (direction: -1 | 1) => {
    const index = Math.min(selectedIndex, path.points.length - 1);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= path.points.length) return;
    const points = [...path.points];
    [points[index], points[nextIndex]] = [points[nextIndex], points[index]];
    onChange({ ...path, points });
    setSelectedIndex(nextIndex);
    setDragTarget(null);
  };

  const toggleSmooth = () => {
    const index = Math.min(selectedIndex, path.points.length - 1);
    const point = path.points[index];
    const shouldSmooth = point.kind !== 'smooth';
    const handleLength = path.coordinateSpace === 'normalized' ? 0.08 : Math.min(width, height) * 0.08;
    onChange({
      ...path,
      points: path.points.map((candidate, pointIndex) => pointIndex === index
        ? {
          ...candidate,
          kind: shouldSmooth ? 'smooth' : 'corner',
          ...(shouldSmooth && !candidate.handleIn && !candidate.handleOut
            ? {
              handleIn: { x: candidate.x - handleLength, y: candidate.y },
              handleOut: { x: candidate.x + handleLength, y: candidate.y },
            }
            : {}),
        }
        : candidate),
    });
  };

  const pathD = buildBezierPathD(path, (point) => path.coordinateSpace === 'normalized'
    ? { x: point.x * width, y: point.y * height }
    : { x: (0.5 + point.x / width) * width, y: (0.5 + point.y / height) * height });

  return (
    <div className="bezier-path-editor" data-testid="bezier-path-editor">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="application"
        aria-label="Bezier path editor"
        onMouseMove={handleMouseMove}
        onMouseUp={() => setDragTarget(null)}
        onMouseLeave={() => setDragTarget(null)}
      >
        <rect x={0} y={0} width={width} height={height} fill="rgba(15,23,42,0.65)" stroke="var(--border-color)" />
        <path d={pathD} fill="rgba(56,189,248,0.12)" stroke="#38bdf8" strokeWidth={1.5} />
        {path.points.map((point, index) => {
          const viewPoint = viewPoints[index];
          const toView = (handle: { x: number; y: number }) => path.coordinateSpace === 'normalized'
            ? { x: handle.x * width, y: handle.y * height }
            : { x: (0.5 + handle.x / width) * width, y: (0.5 + handle.y / height) * height };
          return (
            <g key={point.id}>
              {point.handleIn && <line x1={viewPoint.x * width} y1={viewPoint.y * height} x2={toView(point.handleIn).x} y2={toView(point.handleIn).y} stroke="#fbbf24" strokeWidth={1} />}
              {point.handleIn && <circle cx={toView(point.handleIn).x} cy={toView(point.handleIn).y} r={4} fill="#fbbf24" tabIndex={0} role="button" aria-label={`Vertex ${index + 1} incoming handle`} onKeyDown={(event) => handleVertexKeyDown(event, index, 'handleIn')} onMouseDown={(event) => { event.stopPropagation(); setSelectedIndex(index); setDragTarget({ type: 'handleIn', index }); }} />}
              {point.handleOut && <circle cx={toView(point.handleOut).x} cy={toView(point.handleOut).y} r={4} fill="#fbbf24" tabIndex={0} role="button" aria-label={`Vertex ${index + 1} outgoing handle`} onKeyDown={(event) => handleVertexKeyDown(event, index, 'handleOut')} onMouseDown={(event) => { event.stopPropagation(); setSelectedIndex(index); setDragTarget({ type: 'handleOut', index }); }} />}
              <circle
                cx={viewPoint.x * width}
                cy={viewPoint.y * height}
                r={6}
                fill={index === selectedIndex ? '#f8fafc' : '#38bdf8'}
                stroke="#0f172a"
                tabIndex={0}
                role="button"
                onKeyDown={(event) => handleVertexKeyDown(event, index, 'point')}
                onMouseDown={(event) => { event.stopPropagation(); setSelectedIndex(index); setDragTarget({ type: 'point', index }); }}
                aria-label={`Vertex ${index + 1}`}
              />
            </g>
          );
        })}
      </svg>
      <div className="bezier-path-editor__controls" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
        <button type="button" className="btn-secondary" onClick={addVertex}>Add vertex</button>
        <button type="button" className="btn-secondary" onClick={deleteVertex} disabled={path.points.length <= 2}>Delete vertex</button>
        <button type="button" className="btn-secondary" onClick={() => reorder(-1)} disabled={selectedIndex <= 0}>Move left</button>
        <button type="button" className="btn-secondary" onClick={() => reorder(1)} disabled={selectedIndex >= path.points.length - 1}>Move right</button>
        <button type="button" className="btn-secondary" onClick={toggleSmooth}>Toggle corner/smooth</button>
        <button type="button" className="btn-secondary" onClick={() => onChange({ ...path, closed: !path.closed })}>{path.closed ? 'Open path' : 'Close path'}</button>
      </div>
    </div>
  );
};
