import React from 'react';
import type { CharacterPart } from '../../../../types/animator';

interface ShapePartProps {
  part: CharacterPart;
  fill: string;
  stroke: string;
  isSelected: boolean;
  isGhost: boolean;
  renderInnerMedia: (shapeWidth: number, shapeHeight: number, xOff?: number, yOff?: number) => React.ReactNode;
}

const getStrokeDashProps = (part: CharacterPart, totalPerimeter: number) => {
  const progress = part.strokeProgress !== undefined ? Math.max(0, Math.min(1, part.strokeProgress)) : 1;
  if (progress <= 0) {
    return {
      strokeDasharray: `0 ${totalPerimeter * 2}`,
      strokeDashoffset: totalPerimeter,
    };
  }
  if (progress >= 1) {
    return {};
  }
  return {
    strokeDasharray: totalPerimeter,
    strokeDashoffset: totalPerimeter * (1 - progress),
  };
};

export const renderShapePart = ({ part, fill, stroke, isSelected, renderInnerMedia }: ShapePartProps): React.ReactNode => {
  const isCustomStroke = Boolean(part.strokeColor && part.strokeColor !== '#101218' && part.strokeColor !== 'none' && part.strokeColor !== 'transparent');
  const hasStroke = (part.strokeProgress === undefined || part.strokeProgress > 0) && (!part.innerMediaUrl || isCustomStroke);
  const strokeToUse = hasStroke ? stroke : (isSelected ? '#38bdf8' : 'none');

  switch (part.type) {
    case 'custom_star':
      return (
        <polygon
          points="0,-35 10,-10 35,-10 15,5 23,30 0,15 -23,30 -15,5 -35,-10 -10,-10"
          fill={fill}
          stroke={strokeToUse}
          strokeWidth={isSelected ? 2 : 1.5}
          vectorEffect="non-scaling-stroke"
          {...getStrokeDashProps(part, 300)}
        />
      );

    case 'custom_circle': {
      const clipId = `clip-circle-${part.id}`;
      return (
        <g>
          {part.innerMediaUrl && (
            <defs>
              <clipPath id={clipId}>
                <circle cx={0} cy={0} r={30} />
              </clipPath>
            </defs>
          )}
          {part.innerMediaUrl ? (
            <g clipPath={`url(#${clipId})`}>
              {renderInnerMedia(60, 60, -30, -30)}
            </g>
          ) : (
            <circle cx={0} cy={0} r={30} fill={fill} />
          )}
          <circle
            cx={0}
            cy={0}
            r={30}
            fill="none"
            stroke={strokeToUse}
            strokeWidth={isSelected ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
            {...getStrokeDashProps(part, 188.5)}
          />
        </g>
      );
    }

    case 'custom_box': {
      const clipId = `clip-box-${part.id}`;
      return (
        <g>
          {part.innerMediaUrl && (
            <defs>
              <clipPath id={clipId}>
                <rect x={-30} y={-30} width={60} height={60} rx={part.borderRadius ?? 0} />
              </clipPath>
            </defs>
          )}
          {part.innerMediaUrl ? (
            <g clipPath={`url(#${clipId})`}>
              {renderInnerMedia(60, 60, -30, -30)}
            </g>
          ) : (
            <rect x={-30} y={-30} width={60} height={60} rx={part.borderRadius ?? 0} fill={fill} />
          )}
          <rect
            x={-30}
            y={-30}
            width={60}
            height={60}
            rx={part.borderRadius ?? 0}
            fill="none"
            stroke={strokeToUse}
            strokeWidth={isSelected ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
            {...getStrokeDashProps(part, 240)}
          />
        </g>
      );
    }

    case 'custom_rect': {
      const clipId = `clip-rect-${part.id}`;
      return (
        <g>
          {part.innerMediaUrl && (
            <defs>
              <clipPath id={clipId}>
                <rect x={-60} y={-30} width={120} height={60} rx={part.borderRadius ?? 0} />
              </clipPath>
            </defs>
          )}
          {part.innerMediaUrl ? (
            <g clipPath={`url(#${clipId})`}>
              {renderInnerMedia(120, 60, -60, -30)}
            </g>
          ) : (
            <rect x={-60} y={-30} width={120} height={60} rx={part.borderRadius ?? 0} fill={fill} />
          )}
          <rect
            x={-60}
            y={-30}
            width={120}
            height={60}
            rx={part.borderRadius ?? 0}
            fill="none"
            stroke={strokeToUse}
            strokeWidth={isSelected ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
            {...getStrokeDashProps(part, 360)}
          />
        </g>
      );
    }

    case 'custom_triangle': {
      const clipId = `clip-tri-${part.id}`;
      return (
        <g>
          {part.innerMediaUrl && (
            <defs>
              <clipPath id={clipId}>
                <polygon points="0,-35 35,25 -35,25" />
              </clipPath>
            </defs>
          )}
          {part.innerMediaUrl ? (
            <g clipPath={`url(#${clipId})`}>
              {renderInnerMedia(70, 60, -35, -35)}
            </g>
          ) : (
            <polygon points="0,-35 35,25 -35,25" fill={fill} />
          )}
          <polygon
            points="0,-35 35,25 -35,25"
            fill="none"
            stroke={strokeToUse}
            strokeWidth={isSelected ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
            {...getStrokeDashProps(part, 209)}
          />
        </g>
      );
    }

    case 'custom_banner':
      return (
        <g>
          <rect
            x={-80}
            y={-25}
            width={160}
            height={50}
            rx={part.borderRadius ?? 10}
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
            {...getStrokeDashProps(part, 420)}
          />
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={part.strokeColor || '#ffffff'}
            fontSize={part.fontSize || 16}
            fontWeight="700"
            fontFamily={part.fontFamily || 'Outfit'}
          >
            {part.textValue || 'BANNER LABEL'}
          </text>
        </g>
      );

    case 'custom_capsule':
      return (
        <rect
          x={-50}
          y={-20}
          width={100}
          height={40}
          rx={20}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 2 : 1.5}
          vectorEffect="non-scaling-stroke"
          {...getStrokeDashProps(part, 280)}
        />
      );

    case 'custom_diamond':
      return (
        <polygon
          points="0,-35 35,0 0,35 -35,0"
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 2 : 1.5}
          vectorEffect="non-scaling-stroke"
          {...getStrokeDashProps(part, 198)}
        />
      );

    case 'custom_card':
      return (
        <g>
          <rect
            x={-90}
            y={-50}
            width={180}
            height={100}
            rx={part.borderRadius ?? 12}
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
            {...getStrokeDashProps(part, 560)}
          />
          <rect x={-80} y={-40} width={160} height={22} rx={6} fill="#0d0f14" opacity={0.7} />
          <circle cx={-68} cy={-29} r={4} fill="#00d2ff" />
          <text x={-58} y={-29} dominantBaseline="middle" fill="#00d2ff" fontSize={11} fontWeight="800" fontFamily="Outfit, sans-serif">
            {part.cardCategory || part.textValue || 'STUDIO CARD'}
          </text>
          <text x={-80} y={0} dominantBaseline="middle" fill="#f8fafc" fontSize={13} fontWeight="700" fontFamily="Outfit, sans-serif">
            {part.cardTitle || 'MOTION GRAPHIC'}
          </text>
          <rect x={-80} y={16} width={64} height={22} rx={11} fill="#00d2ff" />
          <text x={-48} y={27} textAnchor="middle" dominantBaseline="middle" fill="#0f172a" fontSize={10} fontWeight="800" fontFamily="Outfit, sans-serif">
            {part.cardButtonText || 'ACTIVE'}
          </text>
        </g>
      );

    default:
      return null;
  }
};
