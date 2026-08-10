import React from 'react';
import type { CharacterPart } from '../../../types/animator';
import type { EvaluatedLayer } from '../../../types/composition';
import { renderShapePart } from './parts/ShapePartRenderers';
import { renderMediaPart } from './parts/MediaPartRenderer';
import { renderTextOrClonerPart } from './parts/TextAndClonerRenderers';
import { CANVAS_CENTER } from '../../../utils/constants';

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
}

const CANVAS_CX = CANVAS_CENTER.x;
const CANVAS_CY = CANVAS_CENTER.y;

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
    strokeColor: stroke,
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
      transform={`translate(${CANVAS_CX + el.transform.x}, ${CANVAS_CY + el.transform.y}) rotate(${el.transform.rotation}) scale(${el.transform.scaleX}, ${el.transform.scaleY})`}
      clipPath={matteClipPathId ? `url(#${matteClipPathId})` : undefined}
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
  );
};
