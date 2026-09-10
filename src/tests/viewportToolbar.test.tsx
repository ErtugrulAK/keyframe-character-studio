import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CanvasViewportToolbar } from '../components/Canvas/overlays/CanvasViewportToolbar';

describe('CanvasViewportToolbar', () => {
  it('resets pan while preserving zoom and remains idempotent', () => {
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

    const reset = screen.getByRole('button', { name: 'Reset View Position' });
    fireEvent.click(reset);
    fireEvent.click(reset);

    expect(setPanOffset).toHaveBeenNthCalledWith(1, { x: 0, y: 0 });
    expect(setPanOffset).toHaveBeenNthCalledWith(2, { x: 0, y: 0 });
    expect(setZoomLevel).not.toHaveBeenCalled();
    expect(screen.getByText('50%')).toBeVisible();
  });
});
