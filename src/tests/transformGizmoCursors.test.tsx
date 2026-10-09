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
import { makeEmptyChannels } from '../utils/defaults';
import type { CharacterPart } from '../types/animator';

const part: CharacterPart = {
  id: 'shape', name: 'Shape', type: 'custom_rect', zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  fillColor: '#fff', strokeColor: '#000',
  width: 200, height: 120,
  channels: makeEmptyChannels(),
} as unknown as CharacterPart;

const renderGizmo = () => render(
  <svg>
    <TransformGizmo
      selectedPart={part}
      selectedTransform={part.baseTransform}
      onScaleMouseDown={vi.fn()}
      onRotateMouseDown={vi.fn()}
      zScale={1}
    />
  </svg>,
);

/** The visible corner handles, in the order the gizmo renders them. */
const cornerCursors = (container: HTMLElement): string[] => Array.from(container.querySelectorAll('rect[fill="#00d2ff"]'))
  .map((handle) => (handle as SVGRectElement).style.cursor);

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
});
