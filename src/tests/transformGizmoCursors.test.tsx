/**
 * Corner resize cursors must follow the handle's own diagonal.
 *
 * Every corner used to carry the same `nwse-resize` cursor, so the top-right and
 * bottom-left handles pointed along the wrong axis. Each corner now owns the
 * cursor for the diagonal it sits on.
 */

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransformGizmo } from '../components/Canvas/overlays/TransformGizmo';
import { makeEmptyChannels } from '../utils/animation/defaults';
import { resizeCursorFor } from '../utils/geometry/transformGizmoMetrics';
import type { CharacterPart } from '../types/animator';

const part: CharacterPart = {
  id: 'shape', name: 'Shape', type: 'custom_rect', zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  fillColor: '#fff', strokeColor: '#000',
  width: 200, height: 120,
  channels: makeEmptyChannels(),
} as unknown as CharacterPart;

const renderGizmo = (rotation = 0) => render(
  <svg>
    <TransformGizmo
      selectedPart={part}
      selectedTransform={{ ...part.baseTransform, rotation }}
      onScaleMouseDown={vi.fn()}
      onRotateMouseDown={vi.fn()}
      zScale={1}
    />
  </svg>,
);

/** The visible corner handles, in the order the gizmo renders them. */
const cornerCursors = (container: HTMLElement): string[] => Array.from(container.querySelectorAll('rect[fill="#4a8fe7"]'))
  .map((handle) => (handle as SVGRectElement).style.cursor);

/** The visible edge handles: left, right, top, bottom. */
const edgeCursors = (container: HTMLElement): string[] => Array.from(container.querySelectorAll('circle:not([data-testid])'))
  .filter((handle) => handle.getAttribute('fill') !== '#ffb700')
  .map((handle) => (handle as SVGCircleElement).style.cursor);

describe('TransformGizmo corner cursors', () => {
  it('gives each corner the cursor of the diagonal it sits on', () => {
    const { container } = renderGizmo();
    const cursors = cornerCursors(container);

    expect(cursors).toHaveLength(4);
    // TL and BR share the NW-SE diagonal; TR and BL share the NE-SW one.
    expect(cursors[0]).toBe('nwse-resize'); // top-left
    expect(cursors[1]).toBe('nesw-resize'); // top-right
    expect(cursors[2]).toBe('nesw-resize'); // bottom-left
    expect(cursors[3]).toBe('nwse-resize'); // bottom-right
  });

  it('does not leave a corner without a cursor', () => {
    const { container } = renderGizmo();
    expect(cornerCursors(container).every((cursor) => cursor.endsWith('-resize'))).toBe(true);
  });

  it('turns the arrows with a rotated frame', () => {
    // 90°: the diagonals swap, and the left/right edges point up and down.
    const quarter = renderGizmo(90).container;
    expect(cornerCursors(quarter)).toEqual(['nesw-resize', 'nwse-resize', 'nwse-resize', 'nesw-resize']);
    expect(edgeCursors(quarter)).toEqual(['ns-resize', 'ns-resize', 'ew-resize', 'ew-resize']);

    // 45°: a corner points straight up or sideways, an edge along a diagonal.
    const eighth = renderGizmo(45).container;
    expect(cornerCursors(eighth)).toEqual(['ns-resize', 'ew-resize', 'ew-resize', 'ns-resize']);
    expect(edgeCursors(eighth)).toEqual(['nwse-resize', 'nwse-resize', 'nesw-resize', 'nesw-resize']);
  });
});

describe('resizeCursorFor', () => {
  it('picks the double arrow nearest the screen direction', () => {
    expect(resizeCursorFor(1, 0)).toBe('ew-resize');
    expect(resizeCursorFor(-1, 0)).toBe('ew-resize');
    expect(resizeCursorFor(0, 1)).toBe('ns-resize');
    expect(resizeCursorFor(1, 1)).toBe('nwse-resize');
    expect(resizeCursorFor(1, -1)).toBe('nesw-resize');
    expect(resizeCursorFor(-1, 1)).toBe('nesw-resize');
  });
});
