import React from 'react';
import type { CharacterPart, Track, Transform } from '../../types/animator';
import { getPartBounds } from '../../utils/bounds';
import { TransformGizmo, type ScaleMode } from './overlays/TransformGizmo';
import { EDITOR_CAMERA_CENTER, type CoordinatePoint } from '../../utils/projectCoordinates';

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
  outputOrigin?: CoordinatePoint;
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
  outputOrigin = EDITOR_CAMERA_CENTER,
}) => {
  if (selectedPartIds.length > 1) {
    return (
      <>
        {selectedPartIds.map((id) => {
          const part = characterParts.find((candidate) => candidate.id === id);
          const transform = part ? getComputedTransform(id, currentFrame) : null;
          const track = tracks.find((candidate) => candidate.partId === id);
          if (!part || !transform || track?.editVisible === false) return null;
          return (
            <TransformGizmo
              key={`multi-selection-${id}`}
              selectedPart={part}
              selectedTransform={transform}
              zScale={zScale}
              onRotateMouseDown={() => {}}
              onScaleMouseDown={() => {}}
              isGroup={true}
              outputOrigin={outputOrigin}
            />
          );
        })}
      </>
    );
  }

  if (selectedPart && selectedTransform) {
    const selTrack = tracks.find((t) => t.partId === selectedPart.id);
    if (selTrack && selTrack.editVisible === false) return null;

    const hasActiveMatte = Boolean(selectedPart.matte?.sourcePartId && selectedPart.matte.enabled !== false);
    const bounds = getPartBounds(selectedPart, selectedTransform);
    const matteHitArea = hasActiveMatte ? (
      <g
        transform={`translate(${outputOrigin.x + selectedTransform.x}, ${outputOrigin.y + selectedTransform.y}) rotate(${selectedTransform.rotation}) scale(${selectedTransform.scaleX}, ${selectedTransform.scaleY})`}
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
            outputOrigin={outputOrigin}
          />
        )}
      </>
    );
  }

  return null;
};
