import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StyleCard } from '../components/Inspector/sections/style/StyleCard';

describe('StyleCard unified Inspector disclosure', () => {
  it('renders neutral peer headers without leading decorative content', () => {
    const { container } = render(
      <>
        <StyleCard title="TRANSFORM" collapsible defaultOpen={false}>Transform content</StyleCard>
        <StyleCard title="APPEARANCE" collapsible defaultOpen={false}>Appearance content</StyleCard>
        <StyleCard title="EFFECTS" collapsible defaultOpen={false}>Effects content</StyleCard>
        <StyleCard title="MASK / TRACK MATTE" collapsible defaultOpen={false}>Matte content</StyleCard>
      </>,
    );

    expect(container.querySelectorAll('.inspector-section-title')).toHaveLength(4);
    expect(container.querySelectorAll('.inspector-section-title > *')).toHaveLength(0);
    expect(container.querySelectorAll('.inspector-disclosure-button')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Expand APPEARANCE' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps disclosure state local and does not alter child content on toggle', () => {
    render(
      <StyleCard title="TRIM PATH" collapsible defaultOpen={false}>
        <span>Trim content</span>
      </StyleCard>,
    );

    const disclosure = screen.getByRole('button', { name: 'Expand TRIM PATH' });
    expect(screen.queryByText('Trim content')).toBeNull();
    fireEvent.click(disclosure);
    expect(screen.getByRole('button', { name: 'Collapse TRIM PATH' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Trim content')).toBeVisible();
  });
});
