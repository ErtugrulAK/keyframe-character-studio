import React from 'react';
import type { CharacterPart } from '../types/animator';

interface OutlineStyleProps {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  vectorEffect?: string;
}

/**
 * Calculates scaling factors and SVG path/element for a given CharacterPart's
 * actual shape (e.g. circle, star, triangle, diamond, maskShape, or Bezier mask).
 */
export function renderShapeOutline(
  part: CharacterPart,
  halfW: number,
  halfH: number,
  zScale: number,
  overrideMaskShape?: string
): React.ReactNode {
  const commonProps: OutlineStyleProps = {
    stroke: '#00d2ff',
    strokeWidth: 1.5 * zScale,
    strokeDasharray: `${5 * zScale} ${4 * zScale}`,
    vectorEffect: 'non-scaling-stroke',
  };

  const activeMaskShape = overrideMaskShape || (part.enableMaskShape !== false ? part.maskShape : undefined);

  // 1. Bezier Path Mask check
  if (part.mask?.enabled && part.mask.points && part.mask.points.length > 1) {
    const points = part.mask.points;
    let pathD = '';
    
    // Convert normalized or pixel mask points to path
    points.forEach((pt, i) => {
      const px = (pt.x - 0.5) * (halfW * 2);
      const py = (pt.y - 0.5) * (halfH * 2);

      if (i === 0) {
        pathD += `M ${px} ${py}`;
      } else {
        const prevPt = points[i - 1];
        if (prevPt.handleOut || pt.handleIn) {
          const h1x = prevPt.handleOut ? (prevPt.handleOut.x - 0.5) * (halfW * 2) : (prevPt.x - 0.5) * (halfW * 2);
          const h1y = prevPt.handleOut ? (prevPt.handleOut.y - 0.5) * (halfH * 2) : (prevPt.y - 0.5) * (halfH * 2);
          const h2x = pt.handleIn ? (pt.handleIn.x - 0.5) * (halfW * 2) : px;
          const h2y = pt.handleIn ? (pt.handleIn.y - 0.5) * (halfH * 2) : py;
          pathD += ` C ${h1x} ${h1y}, ${h2x} ${h2y}, ${px} ${py}`;
        } else {
          pathD += ` L ${px} ${py}`;
        }
      }
    });

    if (part.mask.closed) {
      const lastPt = points[points.length - 1];
      const firstPt = points[0];
      if (lastPt.handleOut || firstPt.handleIn) {
        const h1x = lastPt.handleOut ? (lastPt.handleOut.x - 0.5) * (halfW * 2) : (lastPt.x - 0.5) * (halfW * 2);
        const h1y = lastPt.handleOut ? (lastPt.handleOut.y - 0.5) * (halfH * 2) : (lastPt.y - 0.5) * (halfH * 2);
        const firstPx = (firstPt.x - 0.5) * (halfW * 2);
        const firstPy = (firstPt.y - 0.5) * (halfH * 2);
        const h2x = firstPt.handleIn ? (firstPt.handleIn.x - 0.5) * (halfW * 2) : firstPx;
        const h2y = firstPt.handleIn ? (firstPt.handleIn.y - 0.5) * (halfH * 2) : firstPy;
        pathD += ` C ${h1x} ${h1y}, ${h2x} ${h2y}, ${firstPx} ${firstPy}`;
      }
      pathD += ' Z';
    }

    return <path d={pathD} fill="none" {...commonProps} />;
  }

  // 2. Canva-Style Mask Shape override or explicit maskShape
  if (activeMaskShape && activeMaskShape !== 'none') {
    switch (activeMaskShape) {
      case 'circle':
        return <ellipse cx={0} cy={0} rx={halfW} ry={halfH} fill="none" {...commonProps} />;

      case 'star': {
        const scaleX = halfW / 35;
        const scaleY = halfH / 32.5;
        const pts = [
          `0,${-35 * scaleY}`,
          `${10 * scaleX},${-10 * scaleY}`,
          `${35 * scaleX},${-10 * scaleY}`,
          `${15 * scaleX},${5 * scaleY}`,
          `${23 * scaleX},${30 * scaleY}`,
          `0,${15 * scaleY}`,
          `${-23 * scaleX},${30 * scaleY}`,
          `${-15 * scaleX},${5 * scaleY}`,
          `${-35 * scaleX},${-10 * scaleY}`,
          `${-10 * scaleX},${-10 * scaleY}`,
        ].join(' ');
        return <polygon points={pts} fill="none" {...commonProps} />;
      }

      case 'triangle': {
        const scaleX = halfW / 35;
        const scaleY = halfH / 30;
        const triPts = `0,${-35 * scaleY} ${35 * scaleX},${25 * scaleY} ${-35 * scaleX},${25 * scaleY}`;
        return <polygon points={triPts} fill="none" {...commonProps} />;
      }

      case 'diamond': {
        const scaleX = halfW / 35;
        const scaleY = halfH / 35;
        const diamondPts = `0,${-35 * scaleY} ${35 * scaleX},0 0,${35 * scaleY} ${-35 * scaleX},0`;
        return <polygon points={diamondPts} fill="none" {...commonProps} />;
      }

      case 'hexagon': {
        const hexPts = [
          `0,${-halfH}`,
          `${halfW},${-0.5 * halfH}`,
          `${halfW},${0.5 * halfH}`,
          `0,${halfH}`,
          `${-halfW},${0.5 * halfH}`,
          `${-halfW},${-0.5 * halfH}`,
        ].join(' ');
        return <polygon points={hexPts} fill="none" {...commonProps} />;
      }

      case 'heart': {
        const heartPath = `M 0 ${-0.4 * halfH} C ${0.5 * halfW} ${-1.1 * halfH}, ${1.1 * halfW} ${0.2 * halfH}, 0 ${halfH} C ${-1.1 * halfW} ${0.2 * halfH}, ${-0.5 * halfW} ${-1.1 * halfH}, 0 ${-0.4 * halfH} Z`;
        return <path d={heartPath} fill="none" {...commonProps} />;
      }

      case 'pill': {
        const radius = Math.min(halfW, halfH);
        return (
          <rect
            x={-halfW}
            y={-halfH}
            width={halfW * 2}
            height={halfH * 2}
            rx={radius}
            ry={radius}
            fill="none"
            {...commonProps}
          />
        );
      }

      case 'rectangle':
      default:
        return (
          <rect
            x={-halfW}
            y={-halfH}
            width={halfW * 2}
            height={halfH * 2}
            rx={part.borderRadius ?? 0}
            fill="none"
            {...commonProps}
          />
        );
    }
  }

  // 3. Body Part Type check (Default shapes)
  switch (part.type) {
    case 'custom_circle':
      return <ellipse cx={0} cy={0} rx={halfW} ry={halfH} fill="none" {...commonProps} />;

    case 'custom_star': {
      const scaleX = halfW / 35;
      const scaleY = halfH / 32.5;
      const pts = [
        `0,${-35 * scaleY}`,
        `${10 * scaleX},${-10 * scaleY}`,
        `${35 * scaleX},${-10 * scaleY}`,
        `${15 * scaleX},${5 * scaleY}`,
        `${23 * scaleX},${30 * scaleY}`,
        `0,${15 * scaleY}`,
        `${-23 * scaleX},${30 * scaleY}`,
        `${-15 * scaleX},${5 * scaleY}`,
        `${-35 * scaleX},${-10 * scaleY}`,
        `${-10 * scaleX},${-10 * scaleY}`,
      ].join(' ');
      return <polygon points={pts} fill="none" {...commonProps} />;
    }

    case 'custom_triangle': {
      const scaleX = halfW / 35;
      const scaleY = halfH / 30;
      const triPts = `0,${-35 * scaleY} ${35 * scaleX},${25 * scaleY} ${-35 * scaleX},${25 * scaleY}`;
      return <polygon points={triPts} fill="none" {...commonProps} />;
    }

    case 'custom_diamond': {
      const scaleX = halfW / 35;
      const scaleY = halfH / 35;
      const diamondPts = `0,${-35 * scaleY} ${35 * scaleX},0 0,${35 * scaleY} ${-35 * scaleX},0`;
      return <polygon points={diamondPts} fill="none" {...commonProps} />;
    }

    case 'custom_parallelogram': {
      const scaleX = halfW / 60;
      const scaleY = halfH / 30;
      const paraPts = `${-35 * scaleX},${-30 * scaleY} ${85 * scaleX},${-30 * scaleY} ${35 * scaleX},${30 * scaleY} ${-85 * scaleX},${30 * scaleY}`;
      return <polygon points={paraPts} fill="none" {...commonProps} />;
    }

    case 'custom_capsule': {
      const rx = Math.min(halfW, halfH);
      return (
        <rect
          x={-halfW}
          y={-halfH}
          width={halfW * 2}
          height={halfH * 2}
          rx={rx}
          ry={rx}
          fill="none"
          {...commonProps}
        />
      );
    }

    case 'custom_box':
    case 'custom_rect':
    case 'custom_card':
    case 'custom_banner':
    case 'custom_text':
    case 'custom_image':
    case 'custom_video':
    default:
      return (
        <rect
          x={-halfW}
          y={-halfH}
          width={halfW * 2}
          height={halfH * 2}
          rx={part.borderRadius ?? 0}
          fill="none"
          {...commonProps}
        />
      );
  }
}
