import React from 'react';
import type { CharacterPart, Track, Transform } from '../../types/animator';
import { getPartBounds } from '../../utils/bounds';
import { CANVAS_CENTER_X, CANVAS_CENTER_Y } from '../../utils/viewportMath';
import { TransformGizmo, type ScaleMode } from './overlays/TransformGizmo';
import { MaskGizmo } from './overlays/MaskGizmo';

interface SelectionGizmoProps {
  selectedPartIds: string[];
  characterParts: CharacterPart[];
  getComputedTransform: (partId: string, frame: number) => Transform;
  currentFrame: number;
  selectedPart: CharacterPart | undefined;
  selectedTransform: Transform | null;
  tracks: Track[];
  activeTool: string | null;
  zScale: number;
  onRotateStart: (e: React.MouseEvent) => void;
  onScaleStart: (e: React.MouseEvent, mode?: ScaleMode) => void;
  onMaskPointDragStart: (e: React.MouseEvent, index: number, handleType: 'point' | 'in' | 'out') => void;
}

/**
 * Interactive transform gizmo layer for the stage canvas.
 * Renders a group gizmo for multi-selection, a transform gizmo for a single
 * part, or the mask gizmo when the mask tool is active.
 */
export const SelectionGizmo: React.FC<SelectionGizmoProps> = ({
  selectedPartIds,
  characterParts,
  getComputedTransform,
  currentFrame,
  selectedPart,
  selectedTransform,
  tracks,
  activeTool,
  zScale,
  onRotateStart,
  onScaleStart,
  onMaskPointDragStart,
}) => {
  if (selectedPartIds.length > 1) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    selectedPartIds.forEach((id) => {
      const part = characterParts.find((p) => p.id === id);
      if (!part) return;
      const t = getComputedTransform(id, currentFrame);
      const b = getPartBounds(part);
      const left = t.x - b.halfW * Math.abs(t.scaleX);
      const right = t.x + b.halfW * Math.abs(t.scaleX);
      const top = t.y - b.halfH * Math.abs(t.scaleY);
      const bottom = t.y + b.halfH * Math.abs(t.scaleY);
      if (left < minX) minX = left;
      if (right > maxX) maxX = right;
      if (top < minY) minY = top;
      if (bottom > maxY) maxY = bottom;
    });

    if (minX === Infinity) return null;

    const groupTransform: Transform = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
    };

    const halfW = (maxX - minX) / 2;
    const halfH = (maxY - minY) / 2;

    return (
      <TransformGizmo
        selectedPart={characterParts[0]} // dummy
        selectedTransform={groupTransform}
        zScale={zScale}
        onRotateMouseDown={() => {}} // disabled for groups
        onScaleMouseDown={() => {}} // disabled for groups
        isGroup={true}
        overrideHalfW={halfW}
        overrideHalfH={halfH}
      />
    );
  }

  if (selectedPart && selectedTransform) {
    const selTrack = tracks.find((t) => t.partId === selectedPart.id);
    if (selTrack && selTrack.editVisible === false) return null;
    // Freeform shapes use the numbered vertex markers instead of the transform
    // gizmo (no dashed outline, no corner squares, no edge midpoint circles).
    const isFreeform = selectedPart.type === 'custom_freeform';
    return (
      <>
        {!isFreeform && activeTool !== 'mask' && (
          <TransformGizmo
            selectedPart={selectedPart}
            selectedTransform={selectedTransform}
            zScale={zScale}
            onRotateMouseDown={onRotateStart}
            onScaleMouseDown={onScaleStart}
          />
        )}
        {activeTool === 'mask' && selectedPart.mask && selectedPart.mask.enabled && (
          <g transform={`translate(${CANVAS_CENTER_X + selectedTransform.x}, ${CANVAS_CENTER_Y + selectedTransform.y}) rotate(${selectedTransform.rotation})`}>
            <MaskGizmo
              part={selectedPart}
              transform={selectedTransform}
              zoomLevel={zScale}
              onPointDragStart={onMaskPointDragStart}
            />
          </g>
        )}
      </>
    );
  }

  return null;
};
