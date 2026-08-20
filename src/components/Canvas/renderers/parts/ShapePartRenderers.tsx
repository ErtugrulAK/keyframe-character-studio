import React from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { buildFreeformPath, getFreeformPerimeter } from '../../../../utils/freeform';
import { getShapeGeometry, polygonPointsToString } from '../../../../utils/shapeGeometry';
import { isShapeAppearanceEligible, resolveShapeAppearance, type ResolvedShapeAppearance } from '../../../../utils/shapeAppearance';

interface ShapePartProps {
  part: CharacterPart;
  fill: string;
  stroke: string;
  isSelected: boolean;
  isGhost: boolean;
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

const renderModernShape = (
  part: CharacterPart,
  appearance: ResolvedShapeAppearance,
  geo: ReturnType<typeof getShapeGeometry>,
): React.ReactNode => {
  const fill = appearance.fillEnabled ? appearance.fillColor : 'none';
  const stroke = appearance.strokeEnabled ? appearance.strokeColor : 'none';
  const common = {
    fill,
    fillOpacity: appearance.fillOpacity,
    stroke,
    strokeOpacity: appearance.strokeOpacity,
    strokeWidth: appearance.strokeWidth,
    vectorEffect: 'non-scaling-stroke' as const,
  };

  switch (part.type) {
    case 'custom_circle': {
      const r = geo && geo.kind === 'circle' ? geo.r : 30;
      return <circle cx={0} cy={0} r={r} {...common} {...getStrokeDashProps(part, 188.5)} />;
    }
    case 'custom_box':
    case 'custom_rect':
    case 'custom_capsule': {
      const fallback = part.type === 'custom_capsule'
        ? { kind: 'rect' as const, x: -50, y: -20, width: 100, height: 40, rx: 20 }
        : part.type === 'custom_box'
          ? { kind: 'rect' as const, x: -30, y: -30, width: 60, height: 60, rx: 0 }
          : { kind: 'rect' as const, x: -60, y: -30, width: 120, height: 60, rx: 0 };
      const g = geo && geo.kind === 'rect' ? geo : fallback;
      const rx = part.type === 'custom_capsule' ? g.rx : part.borderRadius ?? g.rx;
      const perimeter = part.type === 'custom_capsule' ? 280 : part.type === 'custom_box' ? 240 : 360;
      return <rect x={g.x} y={g.y} width={g.width} height={g.height} rx={rx} {...common} {...getStrokeDashProps(part, perimeter)} />;
    }
    case 'custom_star':
    case 'custom_triangle':
    case 'custom_diamond':
    case 'custom_parallelogram': {
      const points = geo && geo.kind === 'polygon' ? polygonPointsToString(geo.points) : '';
      const perimeter = part.type === 'custom_star' ? 300
        : part.type === 'custom_triangle' ? 209
          : part.type === 'custom_diamond' ? 198 : 340;
      return <polygon points={points} {...common} {...getStrokeDashProps(part, perimeter)} />;
    }
    case 'custom_freeform': {
      const points = part.points && part.points.length >= 2 ? part.points : undefined;
      const d = points ? buildFreeformPath(points) : '';
      if (!d) return null;
      return <path d={d} strokeLinejoin="round" {...common} {...getStrokeDashProps(part, getFreeformPerimeter(points))} />;
    }
    default:
      return null;
  }
};

export const renderShapePart = ({ part, fill, stroke, isSelected }: ShapePartProps): React.ReactNode => {
  const appearance = resolveShapeAppearance(part);
  const useModernAppearance = isShapeAppearanceEligible(part.type) && appearance.isModernAppearance;
  const isCustomStroke = Boolean(part.strokeColor && part.strokeColor !== '#101218' && part.strokeColor !== 'none' && part.strokeColor !== 'transparent');
  const hasStroke = (part.strokeProgress === undefined || part.strokeProgress > 0) && !isCustomStroke;
  const strokeToUse = hasStroke ? stroke : (isSelected ? '#38bdf8' : 'none');

  // M11 Step 2A: single source of truth for local-space shape geometry.
  const geo = getShapeGeometry(part.type);

  if (useModernAppearance) return renderModernShape(part, appearance, geo);

  switch (part.type) {
    case 'custom_star': {
      const pts = geo && geo.kind === 'polygon' ? polygonPointsToString(geo.points) : '';
      return (
        <g>
          <polygon points={pts} fill="rgba(0,0,0,0.001)" />
          <polygon
            points={pts}
            fill={fill}
            stroke={strokeToUse}
            strokeWidth={isSelected ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
            {...getStrokeDashProps(part, 300)}
          />
        </g>
      );
    }

    case 'custom_circle': {
      const r = geo && geo.kind === 'circle' ? geo.r : 30;
      return (
        <g>
          <circle cx={0} cy={0} r={r} fill="rgba(0,0,0,0.001)" />
          <circle cx={0} cy={0} r={r} fill={fill} />
          <circle
            cx={0}
            cy={0}
            r={r}
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
      const g = geo && geo.kind === 'rect' ? geo : { kind: 'rect' as const, x: -30, y: -30, width: 60, height: 60, rx: 0 };
      const rx = part.borderRadius ?? g.rx;
      return (
        <g>
          <rect x={g.x} y={g.y} width={g.width} height={g.height} rx={rx} fill="rgba(0,0,0,0.001)" />
          <rect x={g.x} y={g.y} width={g.width} height={g.height} rx={rx} fill={fill} />
          <rect
            x={g.x}
            y={g.y}
            width={g.width}
            height={g.height}
            rx={rx}
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
      const g = geo && geo.kind === 'rect' ? geo : { kind: 'rect' as const, x: -60, y: -30, width: 120, height: 60, rx: 0 };
      const rx = part.borderRadius ?? g.rx;
      return (
        <g>
          <rect x={g.x} y={g.y} width={g.width} height={g.height} rx={rx} fill="rgba(0,0,0,0.001)" />
          <rect x={g.x} y={g.y} width={g.width} height={g.height} rx={rx} fill={fill} />
          <rect
            x={g.x}
            y={g.y}
            width={g.width}
            height={g.height}
            rx={rx}
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
      const pts = geo && geo.kind === 'polygon' ? polygonPointsToString(geo.points) : '';
      return (
        <g>
          <polygon points={pts} fill="rgba(0,0,0,0.001)" />
          <polygon points={pts} fill={fill} />
          <polygon
            points={pts}
            fill="none"
            stroke={strokeToUse}
            strokeWidth={isSelected ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
            {...getStrokeDashProps(part, 209)}
          />
        </g>
      );
    }

    case 'custom_parallelogram': {
      const pts = geo && geo.kind === 'polygon' ? polygonPointsToString(geo.points) : '';
      return (
        <g>
          <polygon points={pts} fill="rgba(0,0,0,0.001)" />
          <polygon points={pts} fill={fill} />
          <polygon
            points={pts}
            fill="none"
            stroke={strokeToUse}
            strokeWidth={isSelected ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
            {...getStrokeDashProps(part, 340)}
          />
        </g>
      );
    }

    case 'custom_banner': {
      const g = geo && geo.kind === 'rect' ? geo : { kind: 'rect' as const, x: -80, y: -25, width: 160, height: 50, rx: 10 };
      return (
        <g>
          <rect
            x={g.x}
            y={g.y}
            width={g.width}
            height={g.height}
            rx={part.borderRadius ?? g.rx}
            fill={fill === 'none' || fill === 'transparent' ? 'rgba(0,0,0,0.001)' : fill}
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
            style={{ pointerEvents: 'none' }}
          >
            {part.textValue || 'BANNER LABEL'}
          </text>
        </g>
      );
    }

    case 'custom_capsule': {
      const g = geo && geo.kind === 'rect' ? geo : { kind: 'rect' as const, x: -50, y: -20, width: 100, height: 40, rx: 20 };
      return (
        <g>
          <rect x={g.x} y={g.y} width={g.width} height={g.height} rx={g.rx} fill="rgba(0,0,0,0.001)" />
          <rect
            x={g.x}
            y={g.y}
            width={g.width}
            height={g.height}
            rx={g.rx}
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
            {...getStrokeDashProps(part, 280)}
          />
        </g>
      );
    }

    case 'custom_diamond': {
      const pts = geo && geo.kind === 'polygon' ? polygonPointsToString(geo.points) : '';
      return (
        <g>
          <polygon points={pts} fill="rgba(0,0,0,0.001)" />
          <polygon
            points={pts}
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
            {...getStrokeDashProps(part, 198)}
          />
        </g>
      );
    }

    case 'custom_freeform': {
      const points = part.points && part.points.length >= 2 ? part.points : undefined;
      const d = points ? buildFreeformPath(points) : '';
      if (!d) return null;
      return (
        <g>
          <path d={d} fill="rgba(0,0,0,0.001)" />
          <path
            d={d}
            fill={fill}
            stroke={strokeToUse}
            strokeWidth={isSelected ? 2 : 1.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            {...getStrokeDashProps(part, points ? getFreeformPerimeter(points) : 0)}
          />
        </g>
      );
    }

    case 'custom_card': {
      const g = geo && geo.kind === 'rect' ? geo : { kind: 'rect' as const, x: -90, y: -50, width: 180, height: 100, rx: 12 };
      return (
        <g>
          <rect
            x={g.x}
            y={g.y}
            width={g.width}
            height={g.height}
            rx={part.borderRadius ?? g.rx}
            fill={fill === 'none' || fill === 'transparent' ? 'rgba(0,0,0,0.001)' : fill}
            stroke={stroke}
            strokeWidth={isSelected ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
            {...getStrokeDashProps(part, 560)}
          />
          <rect x={-80} y={-40} width={160} height={22} rx={6} fill="#0d0f14" opacity={0.7} style={{ pointerEvents: 'none' }} />
          <circle cx={-68} cy={-29} r={4} fill="#00d2ff" style={{ pointerEvents: 'none' }} />
          <text x={-58} y={-29} dominantBaseline="middle" fill="#00d2ff" fontSize={11} fontWeight="800" fontFamily="Outfit, sans-serif" style={{ pointerEvents: 'none' }}>
            {part.cardCategory || part.textValue || 'STUDIO CARD'}
          </text>
          <text x={-80} y={0} dominantBaseline="middle" fill="#f8fafc" fontSize={13} fontWeight="700" fontFamily="Outfit, sans-serif" style={{ pointerEvents: 'none' }}>
            {part.cardTitle || 'MOTION GRAPHIC'}
          </text>
          <rect x={-80} y={16} width={64} height={22} rx={11} fill="#00d2ff" style={{ pointerEvents: 'none' }} />
          <text x={-48} y={27} textAnchor="middle" dominantBaseline="middle" fill="#0f172a" fontSize={10} fontWeight="800" fontFamily="Outfit, sans-serif" style={{ pointerEvents: 'none' }}>
            {part.cardButtonText || 'ACTIVE'}
          </text>
        </g>
      );
    }

    default:
      return null;
  }
};
