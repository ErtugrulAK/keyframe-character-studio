import React from 'react';
import type { CharacterPart } from '../../../types/animator';
import type { EvaluatedLayer } from '../../../types/composition';
import { renderShapePart } from './parts/ShapePartRenderers';
import { renderMediaPart } from './parts/MediaPartRenderer';
import { renderTextOrClonerPart } from './parts/TextAndClonerRenderers';
import { EDITOR_CAMERA_CENTER, type CoordinatePoint } from '../../../utils/projectCoordinates';

interface PartRendererProps {
  part: CharacterPart;
  isGhost?: boolean;
  ghostColor?: string;
  isSelected?: boolean;
  currentFrame: number;
  onSelect: (partId: string) => void;
  onStartTranslateDrag: (partId: string, e: React.MouseEvent) => void;
  /** Pre-evaluated layer data from the composition engine */
  evaluatedLayer: EvaluatedLayer;
  /** M11: track matte — id of the world-space clipPath clipping this part */
  matteClipPathId?: string;
  /** M13: track matte — id of the world-space <mask> masking this part
   *  (alpha/luminance/inverted). Never combined with matteClipPathId —
   *  a part's matte mode selects exactly one of clip / mask. */
  matteMaskId?: string;
  /** Output origin: edit camera center or project-resolution center. */
  outputOrigin?: CoordinatePoint;
}

export const PartRenderer: React.FC<PartRendererProps> = ({
  part,
  isGhost = false,
  ghostColor,
  isSelected = false,
  currentFrame,
  onSelect,
  onStartTranslateDrag,
  evaluatedLayer,
  matteClipPathId,
  matteMaskId,
  outputOrigin = EDITOR_CAMERA_CENTER,
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
    imageUrl: el.content.imageUrl ?? part.imageUrl,
    videoUrl: el.content.videoUrl ?? part.videoUrl,
    textValue: el.content.textValue ?? part.textValue,
    fontSize: el.content.fontSize ?? part.fontSize,
    points: el.content.points ?? part.points,
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
  };

  let pathContent: React.ReactNode = null;
  if (rp.type === 'custom_video' || rp.type === 'custom_image') {
    pathContent = renderMediaPart({ part: rp, fill, stroke, isSelected });
  } else if (rp.type === 'custom_text' || rp.type === 'mograph_cloner') {
    pathContent = renderTextOrClonerPart({ part: rp, fill, stroke, isSelected, currentFrame });
  } else {
    pathContent = renderShapePart({ part: rp, fill, stroke, isSelected, isGhost });
  }

  return (
    <g
      key={`${part.id}${isGhost ? '-ghost-' + ghostColor : ''}`}
      // M13 Step 2E fix — coordinate-space bug: clipPath/mask with
      // clipPathUnits/maskUnits="userSpaceOnUse" resolve in the "user
      // coordinate system in place at the time the def is REFERENCED", which
      // for a transformed target <g> is the target's LOCAL space. Our matte
      // paths are WORLD-space, so they must live on a TRANSFORM-LESS outer
      // <g> — then the referenced system is the viewBox/world space and the
      // world-space geometry lands exactly on the target. All interactive /
      // visual behavior (transform, opacity, cursor, filter, events) stays on
      // the inner <g>, unchanged.
      clipPath={matteClipPathId ? `url(#${matteClipPathId})` : undefined}
      mask={matteMaskId ? `url(#${matteMaskId})` : undefined}
    >
      <g
        transform={`translate(${outputOrigin.x + el.transform.x}, ${outputOrigin.y + el.transform.y}) rotate(${el.transform.rotation}) scale(${el.transform.scaleX}, ${el.transform.scaleY})`}
        style={{ opacity: finalOpacity, cursor: isGhost ? 'default' : 'pointer', filter: filterId ? `url(#${filterId})` : undefined }}
        onClick={(e) => { if (!isGhost && e.button === 0) { e.stopPropagation(); onSelect(part.id); } }}
        onMouseDown={(e) => { if (!isGhost && e.button === 0) { e.stopPropagation(); onStartTranslateDrag(part.id, e); } }}
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
    </g>
  );
};
