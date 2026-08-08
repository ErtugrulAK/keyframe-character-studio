import React from 'react';
import type { CharacterPart } from '../types/animator';
import { buildFreeformPath, getFreeformExtents } from './freeform';

/**
 * Shape types that can act as containers (they have a closed outline we can
 * clip children against).
 */
export const CONTAINER_SHAPE_TYPES = [
  'custom_circle',
  'custom_box',
  'custom_rect',
  'custom_triangle',
  'custom_banner',
  'custom_capsule',
  'custom_diamond',
  'custom_parallelogram',
  'custom_star',
  'custom_freeform',
  'custom_card',
];

/**
 * Returns the LOCAL outline element (in the shape's own coordinate space) for
 * a shape part. Geometry mirrors ShapePartRenderers exactly so the clip
 * matches what the user sees. Used to build container clip paths.
 */
export const getContainerOutlineElement = (part: CharacterPart): React.ReactElement | null => {
  switch (part.type) {
    case 'custom_circle':
      return <circle cx={0} cy={0} r={30} />;
    case 'custom_box':
      return <rect x={-30} y={-30} width={60} height={60} rx={part.borderRadius ?? 0} />;
    case 'custom_rect':
      return <rect x={-60} y={-30} width={120} height={60} rx={part.borderRadius ?? 0} />;
    case 'custom_triangle':
      return <polygon points="0,-35 35,25 -35,25" />;
    case 'custom_banner':
      return <rect x={-80} y={-25} width={160} height={50} rx={part.borderRadius ?? 10} />;
    case 'custom_capsule':
      return <rect x={-50} y={-20} width={100} height={40} rx={20} />;
    case 'custom_diamond':
      return <polygon points="0,-35 35,0 0,35 -35,0" />;
    case 'custom_parallelogram':
      return <polygon points="-35,-30 85,-30 35,30 -85,30" />;
    case 'custom_star':
      return <polygon points="0,-35 10,-10 35,-10 15,5 23,30 0,15 -23,30 -15,5 -35,-10 -10,-10" />;
    case 'custom_freeform': {
      const d = part.points && part.points.length >= 2 ? buildFreeformPath(part.points) : '';
      return d ? <path d={d} /> : null;
    }
    case 'custom_card':
      return <rect x={-90} y={-50} width={180} height={100} rx={part.borderRadius ?? 12} />;
    default:
      return null;
  }
};

/**
 * Local-space bounding box { w, h } of a container shape. Mirrors the geometry
 * in getContainerOutlineElement / getInnerMediaFrame so a child can be framed
 * to COVER the container (like an uploaded photo fills a shape). A child that
 * covers the bbox always overlaps the outline — even for concave freeforms.
 */
export const getContainerBBox = (part: CharacterPart): { w: number; h: number } | null => {
  switch (part.type) {
    case 'custom_circle':
      return { w: 60, h: 60 };
    case 'custom_box':
      return { w: 60, h: 60 };
    case 'custom_rect':
      return { w: 120, h: 60 };
    case 'custom_triangle':
      return { w: 70, h: 60 };
    case 'custom_banner':
      return { w: 160, h: 50 };
    case 'custom_capsule':
      return { w: 100, h: 40 };
    case 'custom_diamond':
      return { w: 70, h: 70 };
    case 'custom_parallelogram':
      return { w: 170, h: 60 };
    case 'custom_star':
      return { w: 70, h: 70 };
    case 'custom_freeform': {
      const ext = getFreeformExtents(part.points || []);
      if (!isFinite(ext.maxX) || !isFinite(ext.maxY)) return null;
      return { w: ext.maxX - ext.minX, h: ext.maxY - ext.minY };
    }
    case 'custom_card':
      return { w: 180, h: 100 };
    default:
      return null;
  }
};
