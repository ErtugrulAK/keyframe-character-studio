import React from 'react';
import type { CharacterPart, Transform } from '../../../types/animator';

import { getPartLocalBounds } from '../../../utils/bounds';
import type { CornerBounds } from '../../../utils/cornerResize';
import { applyAffine, affineSvgTransform, type WorldAffine } from '../../../utils/containerMath';
import { getTransformGizmoMetrics } from '../../../utils/transformGizmoMetrics';
import { EDITOR_CAMERA_CENTER, type CoordinatePoint } from '../../../utils/projectCoordinates';

export type ScaleMode =
  | 'scale_corner_tl'
  | 'scale_corner_tr'
  | 'scale_corner_bl'
  | 'scale_corner_br'
  | 'scale_x'
  | 'scale_y'
  | 'scale_left'
  | 'scale_right'
  | 'scale_top'
  | 'scale_bottom';

/**
 * The four corner handles, in the order the gizmo renders them. The cursor is
 * the diagonal the corner sits on, and `x`/`y` select the local box edge the
 * handle belongs to (0 = min, 1 = max) — each frame branch decides what those
 * edges are in its own drawing space, so cursor/mode can never drift between
 * the TRS frame and the affine frame.
 */
const CORNER_HANDLES = [
  { key: 'top-left', cursor: 'nwse-resize', mode: 'scale_corner_tl', x: 0, y: 0 },
  { key: 'top-right', cursor: 'nesw-resize', mode: 'scale_corner_tr', x: 1, y: 0 },
  { key: 'bottom-left', cursor: 'nesw-resize', mode: 'scale_corner_bl', x: 0, y: 1 },
  { key: 'bottom-right', cursor: 'nwse-resize', mode: 'scale_corner_br', x: 1, y: 1 },
] as const;

interface TransformGizmoProps {
  selectedPart: CharacterPart;
  selectedTransform: Transform & { affine?: WorldAffine };
  zScale: number;
  onRotateMouseDown: (e: React.MouseEvent) => void;
  onScaleMouseDown: (e: React.MouseEvent, mode: ScaleMode, bounds?: CornerBounds) => void;
  isGroup?: boolean;
  overrideHalfW?: number;
  overrideHalfH?: number;
  /** Box centre in local units; used with the override extents (a group's own origin is not its centre). */
  overrideCenterX?: number;
  overrideCenterY?: number;
  /**
   * The local box a corner drag solves against, when the drawn frame is not the
   * part's own geometry bounds (a layer group draws its aggregate box).
   */
  overrideBounds?: { minX: number; minY: number; maxX: number; maxY: number };
  /**
   * The EXACT world map of the frame, present only when a TRS cannot re-create
   * it (a rotated child of an anisotropically scaled container). With it, the
   * frame is a parallelogram and the gizmo takes the affine branch below.
   */
  affine?: WorldAffine;
  /** The LOCAL box the affine maps — the rect the affine frame draws. */
  affineBounds?: { minX: number; minY: number; maxX: number; maxY: number };
  outputOrigin?: CoordinatePoint;
}

export const TransformGizmo: React.FC<TransformGizmoProps> = ({
  selectedPart,
  selectedTransform,
  zScale,
  onRotateMouseDown,
  onScaleMouseDown,
  isGroup = false,
  overrideHalfW,
  overrideHalfH,
  overrideCenterX = 0,
  overrideCenterY = 0,
  overrideBounds,
  affine,
  affineBounds,
  outputOrigin = EDITOR_CAMERA_CENTER,
}) => {
  // A geometryless container (a layer group) owns no geometry: without the
  // aggregate box its caller measured (`utils/selectionFrame`), there is nothing
  // to draw. Fabricating a frame out of `getPartLocalBounds`'s placeholder square
  // is what put a stray empty selection square on the stage.
  if (selectedPart.isGroup === true && overrideBounds === undefined) return null;

  const baseBounds = getPartLocalBounds(selectedPart, selectedTransform);
  // The corner drag re-expresses pointer travel through this box, so a frame
  // drawn from an override box must hand the drag the box it actually drew.
  const resizeBounds = overrideBounds ?? baseBounds;

  // Keep the authored transform origin, but draw the selection frame around
  // the actual local geometry. This preserves asymmetric polygon bounds while
  // retaining the existing transform/scale semantics.
  const halfW = overrideHalfW ?? ((baseBounds.maxX - baseBounds.minX) / 2) * Math.abs(selectedTransform.scaleX);
  const halfH = overrideHalfH ?? ((baseBounds.maxY - baseBounds.minY) / 2) * Math.abs(selectedTransform.scaleY);
  const centerX = overrideHalfW === undefined ? ((baseBounds.minX + baseBounds.maxX) / 2) * Math.abs(selectedTransform.scaleX) : overrideCenterX;
  const centerY = overrideHalfH === undefined ? ((baseBounds.minY + baseBounds.maxY) / 2) * Math.abs(selectedTransform.scaleY) : overrideCenterY;
  const left = centerX - halfW;
  const right = centerX + halfW;
  const top = centerY - halfH;
  const bottom = centerY + halfH;
  const orientationScaleX = selectedTransform.scaleX < 0 ? -1 : 1;
  const orientationScaleY = selectedTransform.scaleY < 0 ? -1 : 1;
  const metrics = getTransformGizmoMetrics(halfW * 2, halfH * 2, zScale);

  /**
   * The selection frame is a paired light/dark outline under the accent dash.
   *
   * A single accent stroke vanished over accent-like artwork, and a wide black
   * backing made the frame read as a heavy halo. The pair is the thinner
   * alternative: a light keyline (outer) keeps the frame readable over dark
   * artwork, a dark core keeps it readable over light artwork, and the accent
   * dash stays on top. Every stroke is non-interactive, so the frame never
   * changes what the pointer hits.
   *
   * `rect` is the box in the frame's own drawing space: the scaled local box for
   * the TRS frame, the LOCAL box for the affine frame — whose emitted
   * `matrix(...)` already carries the scale, so the rect is never pre-scaled.
   */
  const renderFrameOutlines = (rect: { x: number; y: number; width: number; height: number }) => (
    <>
      <rect
        data-testid="selection-frame-keyline"
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill="none"
        pointerEvents="none"
        style={{ stroke: 'var(--kcs-selection-keyline)' }}
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
      />
      <rect
        data-testid="selection-frame-halo"
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill="none"
        pointerEvents="none"
        style={{ stroke: 'var(--bg-darkest)' }}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill="none"
        pointerEvents="none"
        stroke="#4a8fe7"
        strokeWidth={1.5}
        strokeDasharray="5 4"
        vectorEffect="non-scaling-stroke"
      />
    </>
  );

  /** One corner handle (plus its hit target) at a point of the frame's own space. */
  const renderCornerHandle = (point: { x: number; y: number }, corner: typeof CORNER_HANDLES[number]) => (
    <g key={`corner-${corner.key}`}>
      <rect
        x={point.x - metrics.cornerSize / 2}
        y={point.y - metrics.cornerSize / 2}
        width={metrics.cornerSize}
        height={metrics.cornerSize}
        fill="#4a8fe7"
        stroke="#ffffff"
        strokeWidth={1.5 * zScale}
        style={{ cursor: corner.cursor, pointerEvents: 'auto' }}
        onMouseDown={(e) => onScaleMouseDown(e, corner.mode, resizeBounds)}
      />
      <rect
        data-testid="gizmo-hit-target"
        x={point.x - metrics.hitRadius}
        y={point.y - metrics.hitRadius}
        width={metrics.hitRadius * 2}
        height={metrics.hitRadius * 2}
        fill="transparent"
        pointerEvents="auto"
        style={{ cursor: corner.cursor }}
        onMouseDown={(e) => onScaleMouseDown(e, corner.mode, resizeBounds)}
      />
    </g>
  );

  /** One edge handle (plus its hit target) at a point of the frame's own space. */
  const renderEdgeHandle = (point: { x: number; y: number }, cursor: string, mode: ScaleMode, fill: string) => (
    <g>
      <circle cx={point.x} cy={point.y} r={metrics.edgeRadius} fill={fill} stroke="#ffffff" strokeWidth={1.5 * zScale} style={{ cursor, pointerEvents: 'auto' }} onMouseDown={(e) => onScaleMouseDown(e, mode, resizeBounds)} />
      <circle data-testid="gizmo-hit-target" cx={point.x} cy={point.y} r={metrics.hitRadius} fill="transparent" pointerEvents="auto" style={{ cursor }} onMouseDown={(e) => onScaleMouseDown(e, mode, resizeBounds)} />
    </g>
  );

  /** The rotation stem and handle, drawn from the frame's top edge to `point`. */
  const renderRotationHandle = (stemStart: { x: number; y: number }, point: { x: number; y: number }) => (
    <>
      <line
        x1={stemStart.x}
        y1={stemStart.y}
        x2={point.x}
        y2={point.y}
        stroke="#4a8fe7"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={point.x}
        cy={point.y}
        r={metrics.rotationRadius}
        fill="#ffb700"
        stroke="#ffffff"
        strokeWidth={2 * zScale}
        style={{ cursor: 'grab', pointerEvents: 'auto' }}
        onMouseDown={onRotateMouseDown}
      />
      <circle
        data-testid="gizmo-hit-target"
        cx={point.x}
        cy={point.y}
        r={metrics.hitRadius}
        fill="transparent"
        pointerEvents="auto"
        style={{ cursor: 'grab' }}
        onMouseDown={onRotateMouseDown}
      />
    </>
  );

  /**
   * THE AFFINE FRAME — the frame a TRS cannot draw.
   *
   * A rotated child of an anisotropically scaled container renders as a
   * parallelogram: its exact world map is a general 2×2, so the frame is the
   * LOCAL box mapped by that affine. `affineSvgTransform` keeps the historical
   * `translate(...) rotate(...) scale(...)` spelling whenever it reproduces the
   * map, and emits `matrix(...)` otherwise; either way the rect is drawn in
   * local units, because that spelling carries the scale itself.
   *
   * Handles are placed at the affine image of their own local-box point, in
   * OUTPUT space: the emitted spelling already carries the frame's scale (a
   * shear can only be a matrix), so a marker drawn inside it would be stretched
   * with the frame and its hit area would sit off the handle. Layer groups
   * (decorative multi-selection frames) draw the outline only, exactly as the
   * TRS branch does.
   */
  if (affine !== undefined && affineBounds !== undefined) {
    const box = affineBounds;
    const boxCenterX = (box.minX + box.maxX) / 2;
    const boxCenterY = (box.minY + box.maxY) / 2;
    const topEdgeCenter = applyAffine(affine, { x: boxCenterX, y: box.minY });
    // The rotation handle keeps the output-space distance the TRS frame gives it,
    // measured along the frame's own up axis: the affine's up axis is
    // `hypot(c, d)` output units long per local unit.
    const upAxisLength = Math.hypot(affine.c, affine.d);
    const rotationOffsetLocal = upAxisLength > 0 ? metrics.rotationOffset / upAxisLength : metrics.rotationOffset;

    return (
      <g data-testid="transform-gizmo" style={{ pointerEvents: 'none' }}>
        <g transform={affineSvgTransform(affine, selectedTransform, outputOrigin)}>
          {renderFrameOutlines({ x: box.minX, y: box.minY, width: box.maxX - box.minX, height: box.maxY - box.minY })}
        </g>
        <g transform={`translate(${outputOrigin.x}, ${outputOrigin.y})`}>
          {!isGroup && (
            <>
              {CORNER_HANDLES.map((corner) => renderCornerHandle(
                applyAffine(affine, { x: corner.x === 0 ? box.minX : box.maxX, y: corner.y === 0 ? box.minY : box.maxY }),
                corner,
              ))}
            </>
          )}

          {!isGroup && (
            <>
              {renderRotationHandle(topEdgeCenter, applyAffine(affine, { x: boxCenterX, y: box.minY - rotationOffsetLocal }))}
              {renderEdgeHandle(applyAffine(affine, { x: box.minX, y: boxCenterY }), 'ew-resize', 'scale_left', '#4a8fe7')}
              {renderEdgeHandle(applyAffine(affine, { x: box.maxX, y: boxCenterY }), 'ew-resize', 'scale_right', '#4a8fe7')}
              {renderEdgeHandle(topEdgeCenter, 'ns-resize', 'scale_top', '#c084fc')}
              {renderEdgeHandle(applyAffine(affine, { x: boxCenterX, y: box.maxY }), 'ns-resize', 'scale_bottom', '#c084fc')}
            </>
          )}
        </g>
      </g>
    );
  }

  const rotationY = top - metrics.rotationOffset;

  return (
    <g
      transform={`translate(${outputOrigin.x + selectedTransform.x}, ${outputOrigin.y + selectedTransform.y}) rotate(${selectedTransform.rotation})`}
      data-testid="transform-gizmo"
      style={{ pointerEvents: 'none' }}
    >
      <g transform={`scale(${orientationScaleX}, ${orientationScaleY})`}>
        {renderFrameOutlines({ x: left, y: top, width: halfW * 2, height: halfH * 2 })}

        {!isGroup && (
          <>
            {CORNER_HANDLES.map((corner) => renderCornerHandle(
              { x: corner.x === 0 ? left : right, y: corner.y === 0 ? top : bottom },
              corner,
            ))}
          </>
        )}

        {!isGroup && (
          <>
            {renderRotationHandle({ x: centerX, y: top }, { x: centerX, y: rotationY })}
            {renderEdgeHandle({ x: left, y: centerY }, 'ew-resize', 'scale_left', '#4a8fe7')}
            {renderEdgeHandle({ x: right, y: centerY }, 'ew-resize', 'scale_right', '#4a8fe7')}
            {renderEdgeHandle({ x: centerX, y: top }, 'ns-resize', 'scale_top', '#c084fc')}
            {renderEdgeHandle({ x: centerX, y: bottom }, 'ns-resize', 'scale_bottom', '#c084fc')}
          </>
        )}
      </g>
    </g>
  );
};
