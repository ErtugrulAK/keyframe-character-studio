import React from 'react';
import type { CharacterPart, Track, Transform } from '../../types/animator';
import { getPartBounds } from '../../utils/bounds';
import { TransformGizmo, type ScaleMode } from './overlays/TransformGizmo';

interface SelectionGizmoProps {
  selectedPartIds: string[];
  characterParts: CharacterPart[];
  getComputedTransform: (partId: string, frame: number) => Transform;
  currentFrame: number;
  selectedPart: CharacterPart | undefined;
  selectedTransform: Transform | null;
  tracks: Track[];
  zScale: number;
  onRotateStart: (e: React.MouseEvent) => void;
  onScaleStart: (e: React.MouseEvent, mode?: ScaleMode) => void;
  onTranslateStart: (partId: string, e: React.MouseEvent) => void;
}

/**
 * Interactive transform gizmo layer for the stage canvas.
 * Renders a group gizmo for multi-selection or a single-part transform gizmo.
 */
export const SelectionGizmo: React.FC<SelectionGizmoProps> = ({
  selectedPartIds,
  characterParts,
  getComputedTransform,
  currentFrame,
  selectedPart,
  selectedTransform,
  tracks,
  zScale,
  onRotateStart,
  onScaleStart,
  onTranslateStart,
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
        selectedPart={characterParts[0]}
        selectedTransform={groupTransform}
        zScale={zScale}
        onRotateMouseDown={() => {}}
        onScaleMouseDown={() => {}}
        isGroup={true}
        overrideHalfW={halfW}
        overrideHalfH={halfH}
      />
    );
  }

  if (selectedPart && selectedTransform) {
    const selTrack = tracks.find((t) => t.partId === selectedPart.id);
    if (selTrack && selTrack.editVisible === false) return null;

    const hasActiveMatte = Boolean(selectedPart.matte?.sourcePartId && selectedPart.matte.enabled !== false);
    const bounds = getPartBounds(selectedPart);
    const matteHitArea = hasActiveMatte ? (
      <g
        transform={`translate(${300 + selectedTransform.x}, ${240 + selectedTransform.y}) rotate(${selectedTransform.rotation}) scale(${selectedTransform.scaleX}, ${selectedTransform.scaleY})`}
      >
        <rect
          data-testid="matte-editor-hit-area"
          data-part-id={selectedPart.id}
          x={-bounds.halfW}
          y={-bounds.halfH}
          width={bounds.halfW * 2}
          height={bounds.halfH * 2}
          fill="transparent"
          pointerEvents="all"
          style={{ cursor: 'move' }}
          onMouseDown={(event) => onTranslateStart(selectedPart.id, event)}
        />
      </g>
    ) : null;

    const isFreeform = selectedPart.type === 'custom_freeform';

    return (
      <>
        {matteHitArea}
        {!isFreeform && (
          <TransformGizmo
            selectedPart={selectedPart}
            selectedTransform={selectedTransform}
            zScale={zScale}
            onRotateMouseDown={onRotateStart}
            onScaleMouseDown={onScaleStart}
          />
        )}
      </>
    );
  }

  return null;
};
