import React from 'react';
import type { CharacterPart, Track, Transform } from '../../types/animator';
import { affineSvgTransform, worldAffineOf, type WorldAffine } from '../../utils/geometry/containerMath';
import type { CornerBounds } from '../../utils/geometry/cornerResize';
import { getGroupChildren, getLayerWorldBounds } from '../../utils/layers/layerGrouping';
import { unionWorldBounds } from '../../utils/geometry/layoutGeometry';

/** Above this many selected layers the selection is framed by one box, not one per layer. */
export const LARGE_SELECTION = 200;
import { suppressedMatteSourceIds } from '../../utils/layers/matte';
import { getSelectionFrameBounds, selectionFrameGizmoBounds } from '../../utils/geometry/selectionFrame';
import { TransformGizmo, type ScaleMode } from './overlays/TransformGizmo';
import { EDITOR_CAMERA_CENTER, type CoordinatePoint } from '../../utils/geometry/projectCoordinates';

/**
 * A layer's evaluated world pose. The DERIVED `affine` rides along on every
 * evaluated transform (see `utils/geometry/containerMath`) and every frame below draws
 * through it, so the type has to carry it: a frame whose map a TRS cannot
 * express is drawn by the gizmo's affine branch instead of the TRS one.
 */
type EvaluatedTransform = Transform & { affine?: WorldAffine };

interface SelectionGizmoProps {
  selectedPartIds: string[];
  characterParts: CharacterPart[];
  getComputedTransform: (partId: string, frame: number) => EvaluatedTransform;
  currentFrame: number;
  selectedPart: CharacterPart | undefined;
  selectedTransform: EvaluatedTransform | null;
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
  const containerIsCoveredBySelection = (part: CharacterPart, selected: Set<string>): boolean => {
    const children = getGroupChildren(characterParts, part.id);
    return children.length > 0 && children.every((child) => selected.has(child.id));
  };

  if (selectedPartIds.length > 1) {
    // One lookup per id: a list scan per selected layer made Select All quadratic.
    const selected = new Set(selectedPartIds);
    const partById = new Map(characterParts.map((part) => [part.id, part]));
    const trackByPart = new Map<string, Track>();
    for (const track of tracks) if (!trackByPart.has(track.partId)) trackByPart.set(track.partId, track);
    const framed = (id: string): CharacterPart | null => {
      const part = partById.get(id);
      if (!part || trackByPart.get(id)?.editVisible === false || (part.booleanGroupId && part.booleanGroupId !== booleanOperandEditingGroupId)) return null;
      return part.isGroup && containerIsCoveredBySelection(part, selected) ? null : part;
    };
    // A very large selection is framed by ONE box around all of it: a frame per
    // layer is thousands of gizmos redrawn on every frame of a drag or playback.
    if (selectedPartIds.length > LARGE_SELECTION) {
      const boxes = selectedPartIds
        .map((id) => (framed(id) ? getLayerWorldBounds(characterParts, id, (partId) => getComputedTransform(partId, currentFrame)) : null))
        .filter((box): box is NonNullable<typeof box> => box !== null);
      const first = selectedPartIds.map(framed).find((part): part is CharacterPart => part !== null);
      if (boxes.length === 0 || !first) return null;
      const union = unionWorldBounds(boxes);
      const halfW = (union.maxX - union.minX) / 2;
      const halfH = (union.maxY - union.minY) / 2;
      return (
        <TransformGizmo
          key="multi-selection-union"
          selectedPart={first}
          selectedTransform={{ x: (union.minX + union.maxX) / 2, y: (union.minY + union.maxY) / 2, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }}
          zScale={zScale}
          onRotateMouseDown={() => {}}
          onScaleMouseDown={() => {}}
          isGroup={true}
          outputOrigin={outputOrigin}
          overrideHalfW={halfW}
          overrideHalfH={halfH}
          overrideCenterX={0}
          overrideCenterY={0}
          overrideBounds={{ minX: -halfW, minY: -halfH, maxX: halfW, maxY: halfH }}
        />
      );
    }
    return (
      <>
        {selectedPartIds.map((id) => {
          const part = framed(id);
          const transform = part ? getComputedTransform(id, currentFrame) : null;
          if (!part || !transform) return null;
          const frameBounds = getSelectionFrameBounds(part, { characterParts, getComputedTransform, currentFrame, transform });
          if (!frameBounds) return null;
          // Decorative frames only: the spread carries the frame's own box AND —
          // when the layer's world map is not a TRS (a rotated child of an
          // anisotropically scaled container) — the affine the gizmo draws that
          // box with, so a sheared layer is framed by its exact parallelogram
          // and not by a box a TRS cannot produce.
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
    // A Track Matte source hidden from the composition is not painted,
    // so it has no body to press. While it is selected it gets an edit-only
    // move area and a label — its visibility setting is never touched.
    const isHiddenMatteSource = suppressedMatteSourceIds(characterParts).has(selectedPart.id);
    const matteHitArea = hasActiveMatte || isHiddenMatteSource ? (
      <g
        // The hit area must cover what is actually drawn: through the world
        // affine, so a sheared target (a rotated child of an anisotropically
        // scaled container) gets the exact parallelogram instead of the TRS
        // reading that cannot express it. TRS layers emit the identical string.
        transform={affineSvgTransform(worldAffineOf(selectedTransform), selectedTransform, outputOrigin)}
      >
        <rect
          data-testid="matte-editor-hit-area"
          data-part-id={selectedPart.id}
          data-hidden-matte-source={isHiddenMatteSource ? 'true' : undefined}
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
