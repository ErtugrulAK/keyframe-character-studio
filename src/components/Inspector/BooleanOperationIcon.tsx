import React from 'react';
import type { BooleanOperation } from '../../utils/booleanGeometry';

/**
 * Original KCS icons for the four Boolean operations.
 *
 * Two overlapping squares carry the meaning: the fill rule decides which part of
 * the overlap survives, so one geometry serves all four operations and the icons
 * stay visually consistent with each other. Drawn here rather than taken from an
 * icon set — no third-party icon assets are used.
 */

/** The two operands and the region they share, as subpaths of one 16x16 icon. */
const LEFT = 'M1 4 H10 V13 H1 Z';
const RIGHT = 'M6 1 H15 V10 H6 Z';
const OVERLAP = 'M6 4 H10 V10 H6 Z';

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
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d={ICONS[operation].d} fillRule={ICONS[operation].fillRule} fill="currentColor" />
  </svg>
);
