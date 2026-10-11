import React from 'react';
import type { CharacterPart, Track, Transform } from '../../types/animator';
import { getPartLocalBounds } from '../../utils/bounds';
import type { CornerBounds } from '../../utils/cornerResize';
import { deriveBooleanGeometry } from '../../utils/booleanGeometry';
import { getGroupAggregateBounds } from '../../utils/layerGrouping';
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
const withCurrentBooleanGeometry = (
  part: CharacterPart,
  characterParts: CharacterPart[],
  getComputedTransform: (partId: string, frame: number) => Transform,
  currentFrame: number,
): CharacterPart => {
  if (!part.booleanOperandIds?.length || !part.booleanOperation) return part;
  const operands = part.booleanOperandIds
    .map((operandId) => characterParts.find((candidate) => candidate.id === operandId))
    .filter((candidate): candidate is CharacterPart => Boolean(candidate));
  const operandTransforms = Object.fromEntries(
    operands.map((operand) => [operand.id, getComputedTransform(operand.id, currentFrame)]),
  );
  const groupTransform = getComputedTransform(part.id, currentFrame);
  const derived = deriveBooleanGeometry(part.booleanOperation, operands, operandTransforms, groupTransform);
  return {
    ...part,
    booleanContours: derived.localContours,
    points: derived.localContours[0] ?? [],
  };
};


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
  booleanOperandEditingGroupId = null,
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
          if (!part || !transform || track?.editVisible === false || (part.booleanGroupId && part.booleanGroupId !== booleanOperandEditingGroupId)) return null;
          const selectionPart = withCurrentBooleanGeometry(part, characterParts, getComputedTransform, currentFrame);
          if (selectionPart.booleanOperandIds?.length && selectionPart.booleanContours?.length === 0) return null;
          return (
            <TransformGizmo
              key={`multi-selection-${id}`}
              selectedPart={selectionPart}
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
    if (selectedPart.booleanGroupId && selectedPart.booleanGroupId !== booleanOperandEditingGroupId) return null;
    if (selTrack && selTrack.editVisible === false) return null;

    const hasActiveMatte = Boolean(selectedPart.matte?.sourcePartId && selectedPart.matte.enabled !== false);
    const selectionPart = withCurrentBooleanGeometry(selectedPart, characterParts, getComputedTransform, currentFrame);
    if (selectionPart.booleanOperandIds?.length && selectionPart.booleanContours?.length === 0) return null;
    const bounds = getPartLocalBounds(selectionPart, selectedTransform);
    const matteHitArea = hasActiveMatte ? (
      <g
        transform={`translate(${outputOrigin.x + selectedTransform.x}, ${outputOrigin.y + selectedTransform.y}) rotate(${selectedTransform.rotation}) scale(${selectedTransform.scaleX}, ${selectedTransform.scaleY})`}
      >
        <rect
          data-testid="matte-editor-hit-area"
          data-part-id={selectedPart.id}
          x={bounds.minX}
          y={bounds.minY}
          width={bounds.maxX - bounds.minX}
          height={bounds.maxY - bounds.minY}
          fill="transparent"
          pointerEvents="all"
          style={{ cursor: 'move' }}
          onMouseDown={(event) => onTranslateStart(selectedPart.id, event)}
        />
      </g>
    ) : null;

    const isFreeform = !selectedPart.isGroup && selectionPart.type === 'custom_freeform' && !selectionPart.booleanOperandIds?.length;

    // A group owns no geometry, so its frame is ONE aggregate box around the
    // evaluated local bounds of the layers inside it: the container's handles
    // scale and rotate exactly that box, and the frame is decorative
    // (`pointerEvents: none`) like every other selection frame.
    const groupBounds = selectedPart.isGroup
      ? getGroupAggregateBounds(characterParts, selectedPart.id, (partId) => getComputedTransform(partId, currentFrame))
      : null;
    const absoluteScaleX = Math.abs(selectedTransform.scaleX);
    const absoluteScaleY = Math.abs(selectedTransform.scaleY);
    const gizmo = (
      <TransformGizmo
        selectedPart={selectionPart}
        selectedTransform={selectedTransform}
        zScale={zScale}
        onRotateMouseDown={onRotateStart}
        onScaleMouseDown={onScaleStart}
        outputOrigin={outputOrigin}
        {...(groupBounds ? {
          overrideHalfW: groupBounds.halfW * absoluteScaleX,
          overrideHalfH: groupBounds.halfH * absoluteScaleY,
          overrideCenterX: groupBounds.offsetX * absoluteScaleX,
          overrideCenterY: groupBounds.offsetY * absoluteScaleY,
          // The corner drag solves in the container's local units, so the box
          // it anchors on must be the aggregate box the frame draws — the
          // container's own (geometryless) bounds would anchor on nothing.
          overrideBounds: {
            minX: groupBounds.minX,
            minY: groupBounds.minY,
            maxX: groupBounds.maxX,
            maxY: groupBounds.maxY,
          },
        } : {})}
      />
    );

    return (
      <>
        {matteHitArea}
        {!isFreeform && (groupBounds
          ? <g data-testid="group-aggregate-box" data-group-id={selectedPart.id}>{gizmo}</g>
          : gizmo)}
      </>
    );
  }

  return null;
};
