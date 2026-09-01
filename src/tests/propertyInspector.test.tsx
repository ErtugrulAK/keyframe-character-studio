import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PropertyInspector } from '../components/Inspector/PropertyInspector';

vi.mock('../components/Inspector/OutlinerPanel', () => ({
  OutlinerPanel: () => <div data-testid="outliner-panel">Outliner</div>,
}));

vi.mock('../components/Inspector/DetailsPanel', () => ({
  DetailsPanel: () => <div data-testid="details-panel">Details</div>,
}));

describe('PropertyInspector shell', () => {
  it('keeps the fixed-width shell and vertical dock divider visible', () => {
    const { container } = render(<PropertyInspector isHidden={false} />);
    const inspector = container.querySelector('.motion-design-right-sidebar');

    expect(inspector).toBeTruthy();
    expect(inspector).not.toHaveClass('is-hidden');
    expect(screen.getByTestId('outliner-panel')).toBeTruthy();
    expect(screen.getByTestId('details-panel')).toBeTruthy();
    expect(container.querySelector('.sidebar-pane-divider')).toBeTruthy();
    expect(container.querySelector('.sidebar-left-resizer')).toBeNull();
    expect(container.querySelectorAll('.inspector-dock-toggle')).toHaveLength(0);
  });

  it('retains the dock content while hidden so selection state can survive reopening', () => {
    const { container } = render(<PropertyInspector isHidden />);
    const inspector = container.querySelector('.motion-design-right-sidebar');

    expect(inspector).toHaveClass('is-hidden');
    expect(inspector).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('outliner-panel')).toBeTruthy();
    expect(screen.getByTestId('details-panel')).toBeTruthy();
  });

});
