import React from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { buildFreeformPath, getFreeformPerimeter } from '../../../../utils/freeform';
import { getShapeGeometry, polygonPointsToString } from '../../../../utils/shapeGeometry';
import { isShapeAppearanceEligible, resolveShapeAppearance, type ResolvedShapeAppearance } from '../../../../utils/shapeAppearance';
import { getTrimPathDashProps, resolveTrimPath } from '../../../../utils/trimPath';

interface ShapePartProps {
  part: CharacterPart;
  fill: string;
  stroke: string;
  isSelected: boolean;
  isGhost: boolean;
  trimPath?: Pick<CharacterPart, 'trimPathEnabled' | 'trimPathStart' | 'trimPathEnd' | 'trimPathOffset'>;
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

const getShapeDashProps = (part: CharacterPart, totalPerimeter: number) => {
  const trim = resolveTrimPath(part);
  if (trim.isModern) return getTrimPathDashProps(trim) ?? {};
  return getStrokeDashProps(part, totalPerimeter);
};

type SvgShapeProps = Record<string, string | number | undefined>;

const renderModernGeometry = (
  part: CharacterPart,
  geo: ReturnType<typeof getShapeGeometry>,
  props: SvgShapeProps,
): React.ReactNode => {
  switch (part.type) {
    case 'custom_circle': {
      const r = geo && geo.kind === 'circle' ? geo.r : 30;
      return <circle cx={0} cy={0} r={r} {...props} />;
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
      return <rect x={g.x} y={g.y} width={g.width} height={g.height} rx={rx} {...props} />;
    }
    case 'custom_star':
    case 'custom_triangle':
    case 'custom_diamond':
    case 'custom_parallelogram': {
      const points = geo && geo.kind === 'polygon' ? polygonPointsToString(geo.points) : '';
      return <polygon points={points} {...props} />;
    }
    case 'custom_freeform': {
      const points = part.points && part.points.length >= 2 ? part.points : undefined;
      const d = points ? buildFreeformPath(points) : '';
      return d ? <path d={d} strokeLinejoin="round" {...props} /> : null;
    }
    default:
      return null;
  }
};


const renderModernShape = (
  part: CharacterPart,
  appearance: ResolvedShapeAppearance,
  geo: ReturnType<typeof getShapeGeometry>,
  dashProps: Record<string, string | number | undefined>,
  isGhost: boolean,
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
    ...dashProps,
  };

  if (appearance.strokeAlignment === 'center' || !appearance.strokeEnabled || appearance.strokeWidth <= 0) {
    return renderModernGeometry(part, geo, common);
  }

  // SVG has no reliable cross-browser stroke-alignment property. Mask the
  // centered stroke paint against the same authored geometry: outside keeps
  // the exterior half; inside keeps the interior half. Fill, canonical
  // geometry, non-scaling-stroke, and Trim Path dash semantics stay shared.
  const alignment = appearance.strokeAlignment;
  const maskId = `${alignment}-stroke-${part.id.replace(/[^a-zA-Z0-9_-]/g, '_')}${isGhost ? '-ghost' : ''}`;
  const fillProps: SvgShapeProps = { ...common, stroke: 'none', strokeWidth: 0 };
  const strokeProps: SvgShapeProps = {
    ...common,
    fill: 'none',
    strokeWidth: alignment === 'inside' ? appearance.strokeWidth * 2 : appearance.strokeWidth,
    mask: `url(#${maskId})`,
  };
  const maskGeometry = renderModernGeometry(part, geo, {
    fill: alignment === 'inside' ? 'white' : 'black',
    stroke: 'none',
  });
  return (
    <g>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
          <rect x={-1000000} y={-1000000} width={2000000} height={2000000} fill={alignment === 'inside' ? 'black' : 'white'} />
          {maskGeometry}
        </mask>
      </defs>
      {renderModernGeometry(part, geo, fillProps)}
      {renderModernGeometry(part, geo, strokeProps)}
    </g>
  );
};

export const renderShapePart = ({ part, fill, stroke, isSelected, isGhost, trimPath }: ShapePartProps): React.ReactNode => {
  const renderPart = trimPath ? { ...part, ...trimPath } : part;
  const appearance = resolveShapeAppearance(renderPart);
  const useModernAppearance = isShapeAppearanceEligible(part.type) && appearance.isModernAppearance;
  const isCustomStroke = Boolean(part.strokeColor && part.strokeColor !== '#101218' && part.strokeColor !== 'none' && part.strokeColor !== 'transparent');
  const hasStroke = (part.strokeProgress === undefined || part.strokeProgress > 0) && !isCustomStroke;
  const strokeToUse = hasStroke ? stroke : (isSelected ? '#38bdf8' : 'none');

  // M11 Step 2A: single source of truth for local-space shape geometry.
  const geo = getShapeGeometry(part.type);

  if (useModernAppearance) return renderModernShape(renderPart, appearance, geo, getShapeDashProps(renderPart, 0), isGhost);

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
            {...getShapeDashProps(renderPart, 300)}
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
            {...getShapeDashProps(renderPart, 188.5)}
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
            {...getShapeDashProps(renderPart, 240)}
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
            {...getShapeDashProps(renderPart, 360)}
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
            {...getShapeDashProps(renderPart, 209)}
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
            {...getShapeDashProps(renderPart, 340)}
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
            fill={fill === 'none' || fill === 'transparent' ? 'rgba(0,0,0,0.001)' : fill}
            fillOpacity={part.fillOpacity}
            stroke={stroke}
            strokeOpacity={part.strokeOpacity}
            strokeWidth={isSelected ? 2 : 1.5}
            {...getShapeDashProps(renderPart, 420)}
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
            {...getShapeDashProps(renderPart, 280)}
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
            {...getShapeDashProps(renderPart, 198)}
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
            {...getShapeDashProps(renderPart, points ? getFreeformPerimeter(points) : 0)}
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
            fill={fill === 'none' || fill === 'transparent' ? 'rgba(0,0,0,0.001)' : fill}
            fillOpacity={part.fillOpacity}
            stroke={stroke}
            strokeOpacity={part.strokeOpacity}
            strokeWidth={isSelected ? 2 : 1.5}
            {...getShapeDashProps(renderPart, 560)}
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
