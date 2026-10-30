import React, { useRef } from 'react';
import type { BezierPath, CharacterPart, Track } from '../../../../types/animator';
import { StyleCard } from './StyleCard';
import { BezierPathEditor } from '../../BezierPathEditor';
import { resolveFreeformPath } from '../../../../utils/freeform';
import { convertibleShapeLabel, isConvertibleShapeType, shapeToPathBlockReason } from '../../../../utils/shapeToPath';

interface PathGeometryCardProps {
  selectedPart: CharacterPart;
  tracks: Track[];
  readOnlyReason?: string | null;
  onConvert: (partId: string) => void;
  onChangePath: (partId: string, path: BezierPath) => void;
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

/** The box a local path is shown in: its points AND handles, never thinner than 1 unit. */
const pathBox = (path: BezierPath) => {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const point of path.points) {
    for (const p of [point, point.handleIn, point.handleOut]) {
      if (!p) continue;
      xs.push(p.x);
      ys.push(p.y);
    }
  }
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { minX, minY, width: Math.max(1, Math.max(...xs) - minX), height: Math.max(1, Math.max(...ys) - minY) };
};

const mapPath = (path: BezierPath, map: (p: { x: number; y: number }) => { x: number; y: number }, coordinateSpace: BezierPath['coordinateSpace']): BezierPath => ({
  ...path,
  coordinateSpace,
  points: path.points.map((point) => ({
    ...point,
    ...map(point),
    ...(point.handleIn ? { handleIn: map(point.handleIn) } : {}),
    ...(point.handleOut ? { handleOut: map(point.handleOut) } : {}),
  })),
});

/**
 * C6 — the shape's geometry in the Inspector, stated plainly:
 * - a basic shape is PARAMETRIC (its outline comes from its type): it offers
 *   "Convert to editable path", or says why it cannot be converted;
 * - an editable path lists its points for Corner/Smooth, add/remove and
 *   numeric-free dragging, sharing the selected point with the canvas (where a
 *   double-click on the outline adds a point and Delete removes the selected one).
 */
export const PathGeometryCard: React.FC<PathGeometryCardProps> = ({
  selectedPart,
  tracks,
  readOnlyReason = null,
  onConvert,
  onChangePath,
  selectedIndex,
  onSelectIndex,
  onInteractionStart,
  onInteractionEnd,
}) => {
  if (selectedPart.type === 'custom_freeform') {
    if (selectedPart.booleanOperandIds?.length || selectedPart.booleanContours) return null;
    const path = resolveFreeformPath(selectedPart);
    if (!path || path.coordinateSpace !== 'local') return null;
    return (
      <StyleCard title={`PATH POINTS (${path.points.length})`} collapsible retainKey="path-points">
        <p className="path-geometry-note" data-testid="path-geometry-kind">
          Editable path. On the canvas: drag a point or a handle, double-click the outline to add a point,
          double-click a point to switch Corner/Smooth, Delete removes the selected point.
        </p>
        <PathPointsEditor
          partId={selectedPart.id}
          path={path}
          readOnlyReason={readOnlyReason}
          onChangePath={onChangePath}
          selectedIndex={selectedIndex}
          onSelectIndex={onSelectIndex}
          onInteractionStart={onInteractionStart}
          onInteractionEnd={onInteractionEnd}
        />
      </StyleCard>
    );
  }
  if (!isConvertibleShapeType(selectedPart.type) && selectedPart.type !== 'custom_banner' && selectedPart.type !== 'custom_card') return null;
  const label = convertibleShapeLabel(selectedPart.type);
  const blocked = readOnlyReason ?? shapeToPathBlockReason(selectedPart, tracks);
  return (
    <StyleCard title="SHAPE GEOMETRY" collapsible retainKey="shape-geometry">
      <p className="path-geometry-note" data-testid="path-geometry-kind">
        {isConvertibleShapeType(selectedPart.type) ? `${label}: a parametric shape. Its outline comes from its type; size it with Scale.` : 'A built-in graphic with text: its outline is fixed.'}
      </p>
      <button
        type="button"
        className="btn-secondary path-geometry-convert"
        disabled={Boolean(blocked)}
        title={blocked ?? `Turn this ${label.toLowerCase()} into an editable path: add points, move them, make them Smooth. The look, position, size, rotation, fill, stroke, masks, parent and matte stay. Ctrl+Z brings the ${label.toLowerCase()} back.`}
        onClick={() => onConvert(selectedPart.id)}
      >
        Convert to editable path
      </button>
      {blocked && <p className="path-geometry-reason" role="note">{blocked}</p>}
    </StyleCard>
  );
};

/**
 * The point list editor for a local path. It works in a 0..1 view of the
 * path's own box; the box is frozen for the length of a drag, so a moved
 * point never rescales the view under the pointer.
 */
const PathPointsEditor: React.FC<{
  partId: string;
  path: BezierPath;
  readOnlyReason: string | null;
  onChangePath: (partId: string, path: BezierPath) => void;
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}> = ({ partId, path, readOnlyReason, onChangePath, selectedIndex, onSelectIndex, onInteractionStart, onInteractionEnd }) => {
  const frozenBoxRef = useRef<ReturnType<typeof pathBox> | null>(null);
  // The frozen box is the drag's own coordinate frame (read while rendering the drag).
  // oxlint-disable-next-line react/refs
  const box = frozenBoxRef.current ?? pathBox(path);
  const toUnit = (p: { x: number; y: number }) => ({ x: (p.x - box.minX) / box.width, y: (p.y - box.minY) / box.height });
  const fromUnit = (p: { x: number; y: number }) => ({ x: box.minX + p.x * box.width, y: box.minY + p.y * box.height });
  return (
    <BezierPathEditor
      path={mapPath(path, toUnit, 'normalized')}
      aspectRatio={box.width / box.height}
      onChange={(next) => onChangePath(partId, mapPath(next, fromUnit, 'local'))}
      onInteractionStart={() => {
        frozenBoxRef.current = box;
        onInteractionStart?.();
      }}
      onInteractionEnd={() => {
        frozenBoxRef.current = null;
        onInteractionEnd?.();
      }}
      readOnlyReason={readOnlyReason}
      selectedIndex={selectedIndex}
      onSelectIndex={onSelectIndex}
    />
  );
};
