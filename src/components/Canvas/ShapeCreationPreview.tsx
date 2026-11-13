import React from 'react';
import type { BodyPartType } from '../../types/animator';
import { getShapeGeometry, polygonPointsToString } from '../../utils/geometry/shapeGeometry';
import { getShapeCreationPlacement, MAX_TEXT_FONT_SIZE, MIN_TEXT_FONT_SIZE, type ShapeCreationBounds } from '../../utils/geometry/viewportMath';
import type { CoordinatePoint } from '../../utils/geometry/projectCoordinates';
import { getTextInkBox, getTextMetrics } from '../../utils/geometry/bounds';

/** The font a new text layer is drawn in (`PartRenderer`'s default). */
const NEW_TEXT_FONT = 'Outfit';

interface ShapeCreationPreviewProps {
  type: BodyPartType;
  bounds: ShapeCreationBounds;
  outputOrigin: CoordinatePoint;
}

export const ShapeCreationPreview: React.FC<ShapeCreationPreviewProps> = ({ type, bounds, outputOrigin }) => {
  if (type === 'custom_text') {
    // The text box being drawn (stage units already), with the text it will
    // hold at the size it will have: the font follows the box height (as
    // `getTextCreationProps` sizes it), and a box too narrow for it shrinks it.
    const NEW_TEXT = 'NEW TEXT';
    const byHeight = Math.min(MAX_TEXT_FONT_SIZE, Math.max(MIN_TEXT_FONT_SIZE, bounds.height / 1.2));
    // The text's real width per font unit, measured in the font the new text
    // gets (bold Outfit, as the stage draws it). A fixed average glyph width
    // underestimated bold capitals, so the preview ran out of its box.
    const widthPerFontUnit = (getTextMetrics(NEW_TEXT, 100, NEW_TEXT_FONT).halfW * 2) / 100;
    const fontSize = Math.max(4, Math.min(byHeight, bounds.width / Math.max(0.1, widthPerFontUnit)));
    // The frame the text will get once placed: it hugs the letters (as the
    // selection frame does), centred in the drawn box. The drawn box stays as
    // a faint area; a dashed border on it read as the text's own frame and
    // looked padded above and below (QA 2026-11-13).
    const ink = getTextInkBox(NEW_TEXT, fontSize, NEW_TEXT_FONT);
    const baselineY = ink ? bounds.centerY - (ink.minY + ink.maxY) / 2 : bounds.centerY;
    return (
      <g data-testid="shape-creation-preview" pointerEvents="none">
        <rect
          data-testid="text-creation-area"
          x={bounds.minX}
          y={bounds.minY}
          width={bounds.width}
          height={bounds.height}
          fill="rgba(56, 189, 248, 0.06)"
          stroke="none"
        />
        {ink && (
          <rect
            data-testid="text-creation-frame"
            x={bounds.centerX + ink.minX}
            y={baselineY + ink.minY}
            width={ink.maxX - ink.minX}
            height={ink.maxY - ink.minY}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={1}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <text
          data-testid="text-creation-preview"
          x={bounds.centerX}
          y={baselineY}
          textAnchor="middle"
          dominantBaseline={ink ? 'alphabetic' : 'central'}
          fontSize={fontSize}
          fontWeight={700}
          fontFamily={NEW_TEXT_FONT}
          fill="rgba(255, 255, 255, 0.55)"
        >
          {NEW_TEXT}
        </text>
      </g>
    );
  }
  const geometry = getShapeGeometry(type);
  const placement = getShapeCreationPlacement(type, bounds);
  if (!geometry || !placement) return null;
  // A non-scaling stroke is already measured in screen pixels; dividing by the
  // zoom as well made the outline swell when zoomed out.
  const strokeWidth = 1.5;
  const fill = 'rgba(56, 189, 248, 0.18)';
  const stroke = '#38bdf8';
  const common = { fill, stroke, strokeWidth, strokeDasharray: '6 4', vectorEffect: 'non-scaling-stroke' as const };

  return (
    <g
      data-testid="shape-creation-preview"
      transform={`translate(${outputOrigin.x + placement.x}, ${outputOrigin.y + placement.y}) rotate(0) scale(${placement.scaleX}, ${placement.scaleY})`}
      pointerEvents="none"
    >
      {geometry.kind === 'rect' && <rect x={geometry.x} y={geometry.y} width={geometry.width} height={geometry.height} rx={geometry.rx} {...common} />}
      {geometry.kind === 'circle' && <circle cx={0} cy={0} r={geometry.r} {...common} />}
      {geometry.kind === 'polygon' && <polygon points={polygonPointsToString(geometry.points)} {...common} />}
    </g>
  );
};
