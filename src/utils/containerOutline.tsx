import React from 'react';
import type { CharacterPart } from '../types/animator';
import { buildFreeformPath } from './freeform';

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
