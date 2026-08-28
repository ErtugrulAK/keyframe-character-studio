import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CanvasViewportToolbar } from '../components/Canvas/overlays/CanvasViewportToolbar';

describe('CanvasViewportToolbar', () => {
  it('resets pan while preserving the current zoom level', () => {
    const setZoomLevel = vi.fn();
    const setPanOffset = vi.fn();

    render(
      <CanvasViewportToolbar
        showGrid
        setShowGrid={vi.fn()}
        zoomLevel={0.5}
        setZoomLevel={setZoomLevel}
        setPanOffset={setPanOffset}
        activeTool="select"
        setActiveTool={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset View Position' }));

    expect(setPanOffset).toHaveBeenCalledWith({ x: 0, y: 0 });
    expect(setZoomLevel).not.toHaveBeenCalled();
  });
});
