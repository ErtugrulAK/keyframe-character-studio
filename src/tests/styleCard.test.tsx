import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StyleCard } from '../components/Inspector/sections/style/StyleCard';

describe('StyleCard unified Inspector disclosure', () => {
  it('renders neutral peer headers without leading decorative content', () => {
    const { container } = render(
      <>
        <StyleCard title="TRANSFORM" collapsible>Transform content</StyleCard>
        <StyleCard title="APPEARANCE" collapsible>Appearance content</StyleCard>
        <StyleCard title="EFFECTS" collapsible>Effects content</StyleCard>
        <StyleCard title="MASK / TRACK MATTE" collapsible>Matte content</StyleCard>
      </>,
    );

    expect(container.querySelectorAll('.inspector-section-title')).toHaveLength(4);
    expect(container.querySelectorAll('.inspector-section-title > *')).toHaveLength(0);
    expect(container.querySelectorAll('.inspector-disclosure-button')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Expand APPEARANCE' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps disclosure state local and does not alter child content on toggle', () => {
    render(
      <StyleCard title="TRIM PATH" collapsible>
        <span>Trim content</span>
      </StyleCard>,
    );

    const disclosure = screen.getByRole('button', { name: 'Expand TRIM PATH' });
    expect(screen.queryByText('Trim content')).toBeNull();
    fireEvent.click(disclosure);
    expect(screen.getByRole('button', { name: 'Collapse TRIM PATH' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Trim content')).toBeVisible();
  });

  it('C3 — a card with a retainKey keeps its open state across an unmount (Broadcast round trip); keys are independent', () => {
    const cards = () => (
      <>
        <StyleCard title="APPEARANCE" collapsible retainKey="appearance">A</StyleCard>
        <StyleCard title="APPEARANCE" collapsible retainKey="text-appearance">T</StyleCard>
        <StyleCard title="EFFECTS" collapsible>E</StyleCard>
      </>
    );
    const first = render(cards());
    fireEvent.click(screen.getAllByRole('button', { name: 'Expand APPEARANCE' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Expand EFFECTS' }));
    first.unmount();

    render(cards());
    // The retained card is still open; the same title under another key is not.
    expect(screen.getByText('A')).toBeVisible();
    expect(screen.queryByText('T')).toBeNull();
    // A card without a key keeps the per-mount default.
    expect(screen.queryByText('E')).toBeNull();
    // Closing is retained too.
    fireEvent.click(screen.getByRole('button', { name: 'Collapse APPEARANCE' }));
    expect(screen.queryByText('A')).toBeNull();
  });
});
