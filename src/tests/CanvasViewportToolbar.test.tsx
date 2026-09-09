import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CanvasViewportToolbar } from '../components/Canvas/overlays/CanvasViewportToolbar';

describe('CanvasViewportToolbar', () => {
  const renderToolbar = (activeTool: 'select' | 'pan' = 'select') => {
    const setActiveTool = vi.fn();
    render(
      <CanvasViewportToolbar
        showGrid={false}
        setShowGrid={vi.fn()}
        zoomLevel={1}
        setZoomLevel={vi.fn()}
        setPanOffset={vi.fn()}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
      />,
    );
    return setActiveTool;
  };

  it('keeps one roving tab stop and moves with Arrow/Home/End', () => {
    const setActiveTool = renderToolbar('select');
    const select = screen.getByRole('button', { name: 'Select Tool' });
    const pan = screen.getByRole('button', { name: 'Hand / Pan Tool' });

    expect(select).toHaveAttribute('tabindex', '0');
    expect(pan).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(select, { key: 'ArrowRight' });
    expect(setActiveTool).toHaveBeenCalledWith('pan');
    fireEvent.keyDown(select, { key: 'End' });
    expect(setActiveTool).toHaveBeenCalledWith('pan');
  });

  it('preserves pressed semantics and accessible names without native tooltips', () => {
    renderToolbar('pan');
    expect(screen.getByRole('button', { name: 'Hand / Pan Tool' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Select Tool' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Show Grid' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Zoom Out (-)' })).not.toHaveAttribute('title');
    expect(screen.getByRole('button', { name: 'Reset View Position' })).not.toHaveAttribute('title');
  });
});
