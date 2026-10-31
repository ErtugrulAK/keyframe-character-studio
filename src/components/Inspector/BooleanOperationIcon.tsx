import React from 'react';
import type { BooleanOperation } from '../../utils/geometry/booleanGeometry';

/**
 * Original KCS icons for the four Boolean operations.
 *
 * Two overlapping squares carry the meaning: the fill rule decides which part of
 * the overlap survives, so one geometry serves all four operations and the icons
 * stay visually consistent with each other. Drawn here rather than taken from an
 * icon set — no third-party icon assets are used.
 *
 * Drawn in the toolbar's line language (24-unit grid, 2-unit round
 * stroke, like the Lucide glyphs beside them): both operands are always
 * outlined and only the RESULT of the operation is filled. Solid blocks read
 * as another icon family, and the four blurred into each other at 15 px.
 */

/** The two operands and the region they share, as subpaths of one 24x24 icon. */
const LEFT = 'M3 8 H15 V20 H3 Z';
const RIGHT = 'M9 3 H21 V15 H9 Z';
const OVERLAP = 'M9 8 H15 V15 H9 Z';

const ICONS: Record<BooleanOperation, { d: string; fillRule: 'nonzero' | 'evenodd' }> = {
  // Both operands, painted once where they overlap.
  union: { d: `${LEFT} ${RIGHT}`, fillRule: 'nonzero' },
  // The left operand with the shared region removed.
  subtract: { d: `${LEFT} ${OVERLAP}`, fillRule: 'evenodd' },
  // Only the region the operands share.
  intersect: { d: OVERLAP, fillRule: 'nonzero' },
  // Both operands with the shared region removed.
  exclude: { d: `${LEFT} ${RIGHT}`, fillRule: 'evenodd' },
};

export const BooleanOperationIcon: React.FC<{ operation: BooleanOperation; size?: number }> = ({ operation, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {/* The result region is what tells the four operations apart. */}
    <path data-boolean-result="" d={ICONS[operation].d} fillRule={ICONS[operation].fillRule} fill="currentColor" fillOpacity={0.5} />
    <path d={`${LEFT} ${RIGHT}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
  </svg>
);
