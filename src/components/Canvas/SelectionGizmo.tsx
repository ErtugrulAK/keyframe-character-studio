import React from 'react';
import type { CharacterPart, Track, Transform } from '../../types/animator';
import type { CornerBounds } from '../../utils/cornerResize';
import { getGroupChildren } from '../../utils/layerGrouping';
import { getSelectionFrameBounds, selectionFrameGizmoBounds } from '../../utils/selectionFrame';
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
  booleanOperandEditingGroupId?: string | null;
  onRotateStart: (e: React.MouseEvent) => void;
  onScaleStart: (e: React.MouseEvent, mode: ScaleMode, bounds?: CornerBounds) => void;
  onTranslateStart: (partId: string, e: React.MouseEvent) => void;
  outputOrigin?: CoordinatePoint;
}

/**
 * Interactive transform gizmo layer for the stage canvas.
 * Renders one decorative frame per selected layer (a geometryless container
 * draws its children-derived aggregate instead of any geometry of its own), or
 * a single interactive gizmo when exactly one layer is selected.
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
  booleanOperandEditingGroupId = null,
  onRotateStart,
  onScaleStart,
  onTranslateStart,
  outputOrigin = EDITOR_CAMERA_CENTER,
}) => {
  /**
   * A container whose every child is selected adds nothing to a multi-selection:
   * the box it would draw IS the union of the boxes already drawn for those
   * children, so drawing it again would be a duplicate envelope around them.
   */
  const containerIsCoveredBySelection = (part: CharacterPart): boolean => {
    const children = getGroupChildren(characterParts, part.id);
    return children.length > 0 && children.every((child) => selectedPartIds.includes(child.id));
  };

  if (selectedPartIds.length > 1) {
    return (
      <>
        {selectedPartIds.map((id) => {
          const part = characterParts.find((candidate) => candidate.id === id);
          const transform = part ? getComputedTransform(id, currentFrame) : null;
          const track = tracks.find((candidate) => candidate.partId === id);
          if (!part || !transform || track?.editVisible === false || (part.booleanGroupId && part.booleanGroupId !== booleanOperandEditingGroupId)) return null;
          if (part.isGroup && containerIsCoveredBySelection(part)) return null;
          const frameBounds = getSelectionFrameBounds(part, { characterParts, getComputedTransform, currentFrame, transform });
          if (!frameBounds) return null;
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
              {...selectionFrameGizmoBounds(frameBounds, transform)}
            />
          );
        })}
      </>
    );
  }

  if (selectedPart && selectedTransform) {
    const selTrack = tracks.find((t) => t.partId === selectedPart.id);
    if (selectedPart.booleanGroupId && selectedPart.booleanGroupId !== booleanOperandEditingGroupId) return null;
    if (selTrack && selTrack.editVisible === false) return null;

    const frameBounds = getSelectionFrameBounds(selectedPart, {
      characterParts,
      getComputedTransform,
      currentFrame,
      transform: selectedTransform,
    });
    // A geometryless container with nothing measurable inside it draws no frame
    // at all: there is no geometry to frame, so a box would be an invention.
    if (!frameBounds) return null;
    const isFreeform = !selectedPart.isGroup && selectedPart.type === 'custom_freeform' && !selectedPart.booleanOperandIds?.length;

    const hasActiveMatte = Boolean(selectedPart.matte?.sourcePartId && selectedPart.matte.enabled !== false);
    const matteHitArea = hasActiveMatte ? (
      <g
        transform={`translate(${outputOrigin.x + selectedTransform.x}, ${outputOrigin.y + selectedTransform.y}) rotate(${selectedTransform.rotation}) scale(${selectedTransform.scaleX}, ${selectedTransform.scaleY})`}
      >
        <rect
          data-testid="matte-editor-hit-area"
          data-part-id={selectedPart.id}
          x={frameBounds.minX}
          y={frameBounds.minY}
          width={frameBounds.maxX - frameBounds.minX}
          height={frameBounds.maxY - frameBounds.minY}
          fill="transparent"
          pointerEvents="all"
          style={{ cursor: 'move' }}
          onMouseDown={(event) => onTranslateStart(selectedPart.id, event)}
        />
      </g>
    ) : null;

    const gizmo = (
      <TransformGizmo
        selectedPart={selectedPart}
        selectedTransform={selectedTransform}
        zScale={zScale}
        onRotateMouseDown={onRotateStart}
        onScaleMouseDown={onScaleStart}
        outputOrigin={outputOrigin}
        suppressPivotMarker={selectedPart.isGroup === true}
        {...selectionFrameGizmoBounds(frameBounds, selectedTransform)}
      />
    );

    return (
      <>
        {matteHitArea}
        {!isFreeform && (selectedPart.isGroup
          ? <g data-testid="group-aggregate-box" data-group-id={selectedPart.id}>{gizmo}</g>
          : gizmo)}
      </>
    );
  }

  return null;
};
