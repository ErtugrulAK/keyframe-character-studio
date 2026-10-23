import React from 'react';
import type { CharacterPart } from '../../../types/animator';
import type { EvaluatedLayer } from '../../../types/composition';
import { renderShapePart } from './parts/ShapePartRenderers';
import { renderMediaPart } from './parts/MediaPartRenderer';
import { renderTextOrClonerPart } from './parts/TextAndClonerRenderers';
import { EDITOR_CAMERA_CENTER, type CoordinatePoint } from '../../../utils/projectCoordinates';
import { affineSvgTransform, worldAffineOf } from '../../../utils/containerMath';

interface PartRendererProps {
  part: CharacterPart;
  isGhost?: boolean;
  ghostColor?: string;
  isSelected?: boolean;
  currentFrame: number;
  onSelect: (partId: string, event: React.MouseEvent) => void;
  onStartTranslateDrag: (partId: string, e: React.MouseEvent) => void;
  /**
   * R4-09 — the explicit drill-in: a double-click selects THIS layer instead of
   * its group, which is how a grouped child is edited without ungrouping.
   */
  onDrillIn: (partId: string) => void;
  /** Pre-evaluated layer data from the composition engine */
  evaluatedLayer: EvaluatedLayer;
  /** Dynamic Boolean contours evaluated for the current frame. */
  booleanContours?: CharacterPart['booleanContours'];
  /** M11: track matte — id of the world-space clipPath clipping this part */
  matteClipPathId?: string;
  /** M13: track matte — id of the world-space <mask> masking this part
   *  (alpha/luminance/inverted). Never combined with matteClipPathId —
   *  a part's matte mode selects exactly one of clip / mask. */
  matteMaskId?: string;
  /** V6 same-layer mask definitions applied in authored compositor order. */
  layerMaskIds?: string[];
  /** Output origin: edit camera center or project-resolution center. */
  outputOrigin?: CoordinatePoint;
  /** C4 — a locked layer takes no canvas pointer: clicks reach the layer beneath. */
  isLocked?: boolean;
}

export const PartRenderer: React.FC<PartRendererProps> = ({
  part,
  isGhost = false,
  ghostColor,
  isSelected = false,
  currentFrame,
  onSelect,
  onStartTranslateDrag,
  onDrillIn,
  evaluatedLayer,
  booleanContours,
  matteClipPathId,
  matteMaskId,
  layerMaskIds,
  outputOrigin = EDITOR_CAMERA_CENTER,
  isLocked = false,
}) => {
  const el = evaluatedLayer;
  if (!el.visible) return null;

  const finalOpacity = isGhost ? 0.35 : el.opacity;
  const fill = (isGhost && ghostColor ? ghostColor : el.content.fillColor) || '#ffffff';
  const stroke = (isGhost && ghostColor ? ghostColor : isSelected ? '#00d2ff' : el.content.strokeColor) || '#101218';
  const filterId = !isGhost && el.content.shadowColor ? `drop-shadow-${part.id}` : undefined;

  // Build synthetic part for sub-renderers
  const rp: CharacterPart = {
    ...part,
    fillColor: fill,
    // Keep authored stroke color on the synthetic part. Modern eligible
    // shapes must not receive the legacy selection-color override.
    strokeColor: isGhost && ghostColor ? ghostColor : (el.content.strokeColor ?? part.strokeColor),
    fillEnabled: el.content.fillEnabled ?? part.fillEnabled,
    fillOpacity: el.content.fillOpacity ?? part.fillOpacity,
    strokeEnabled: el.content.strokeEnabled ?? part.strokeEnabled,
    strokeWidth: el.content.strokeWidth ?? part.strokeWidth,
    strokeOpacity: el.content.strokeOpacity ?? part.strokeOpacity,
    strokeAlignment: el.content.strokeAlignment ?? part.strokeAlignment,
    imageUrl: el.content.imageUrl ?? part.imageUrl,
    videoUrl: el.content.videoUrl ?? part.videoUrl,
    textValue: el.content.textValue ?? part.textValue,
    fontSize: el.content.fontSize ?? part.fontSize,
    points: el.content.points ?? part.points,
    path: el.content.path ?? part.path,
    width: el.content.width ?? part.width,
    height: el.content.height ?? part.height,
    shadowColor: el.content.shadowColor ?? part.shadowColor,
    shadowBlur: el.content.shadowBlur ?? part.shadowBlur,
    shadowOffsetX: el.content.shadowOffsetX ?? part.shadowOffsetX,
    shadowOffsetY: el.content.shadowOffsetY ?? part.shadowOffsetY,
    borderRadius: el.content.borderRadius ?? part.borderRadius,
    trimPathEnabled: el.content.trimPathEnabled ?? part.trimPathEnabled,
    trimPathStart: el.content.trimPathStart ?? part.trimPathStart,
    trimPathEnd: el.content.trimPathEnd ?? part.trimPathEnd,
    trimPathOffset: el.content.trimPathOffset ?? part.trimPathOffset,
    clonerConfig: el.content.clonerConfig ?? part.clonerConfig,
    particleConfig: el.content.particleConfig ?? part.particleConfig,
    booleanContours: booleanContours ?? part.booleanContours,
  };

  let pathContent: React.ReactNode = null;
  if (rp.type === 'custom_video' || rp.type === 'custom_image') {
    pathContent = renderMediaPart({ part: rp, fill, stroke, isSelected });
  } else if (rp.type === 'custom_text' || rp.type === 'mograph_cloner') {
    pathContent = renderTextOrClonerPart({ part: rp, fill, stroke, isSelected, currentFrame });
  } else {
    pathContent = renderShapePart({ part: rp, fill, stroke, isSelected, isGhost });
  }

  /**
   * R4-09 — the canvas pointer contract of one layer.
   *
   * A single click and the drag it may become are resolved by the canvas
   * (`StageCanvas`): they target the layer's GROUP, so clicking a child selects
   * the container. The double-click is the EXPLICIT drill-in of the vector
   * editor: the completed sequence selects this very layer, which is how a
   * grouped child is edited without ungrouping. `StageCanvas` still targets the
   * clicked layer while the selection already lives inside its group, so the
   * drilled-in layer stays draggable.
   */
  const layerPointerHandlers = {
    onClick: (e: React.MouseEvent) => { if (!isGhost && e.button === 0) { e.stopPropagation(); onSelect(part.id, e); } },
    onMouseDown: (e: React.MouseEvent) => { if (!isGhost && e.button === 0) { e.stopPropagation(); onStartTranslateDrag(part.id, e); } },
    onDoubleClick: (e: React.MouseEvent) => { if (!isGhost && e.button === 0) { e.stopPropagation(); onDrillIn(part.id); } },
  };

  const transformedContent = (
    <g
      // The world map through the DERIVED affine: an anisotropic container
      // nesting that is not a TRS (a rotated child of a stretched group) renders
      // exactly what the group frame shows. Every TRS layer keeps the historical
      // `translate(...) rotate(...) scale(...)` spelling, character for character.
      transform={affineSvgTransform(worldAffineOf(el.transform), el.transform, outputOrigin)}
      style={{ opacity: finalOpacity, cursor: isGhost ? 'default' : 'pointer', filter: filterId ? `url(#${filterId})` : undefined, pointerEvents: isLocked ? 'none' : undefined }}
      {...layerPointerHandlers}
    >
      <defs>
        {!isGhost && el.content.shadowColor && (
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow
              dx={el.content.shadowOffsetX || 0}
              dy={el.content.shadowOffsetY || 4}
              stdDeviation={el.content.shadowBlur || 8}
              floodColor={el.content.shadowColor || 'rgba(0,0,0,0.5)'}
              floodOpacity="0.85"
            />
          </filter>
        )}
      </defs>
      {pathContent}
    </g>
  );
  const maskedContent = (layerMaskIds ?? []).reduceRight<React.ReactNode>(
    (content, maskId) => <g key={`${part.id}-${maskId}`} mask={`url(#${maskId})`}>{content}</g>,
    transformedContent,
  );

  return (
    <g
      key={`${part.id}${isGhost ? '-ghost-' + ghostColor : ''}`}
      data-part-id={part.id}
      // clipPath/mask defs are world-space and therefore live on this
      // transform-less outer group. Interactive behavior remains on the
      // transformed content group.
      clipPath={matteClipPathId ? `url(#${matteClipPathId})` : undefined}
      mask={matteMaskId ? `url(#${matteMaskId})` : undefined}
    >
      {maskedContent}
    </g>
  );
};
