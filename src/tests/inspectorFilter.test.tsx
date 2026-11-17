import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { cardMatchesFilter, InspectorFilterContext } from '../components/Inspector/inspectorFilter';
import { StyleCard } from '../components/Inspector/sections/style/StyleCard';

describe('Filter properties', () => {
  it('matches a card by its title or by what it holds, every typed word, any case', () => {
    expect(cardMatchesFilter('APPEARANCE', '')).toBe(true);
    expect(cardMatchesFilter('APPEARANCE', 'appear')).toBe(true);
    expect(cardMatchesFilter('EFFECTS', 'Glow')).toBe(true);
    expect(cardMatchesFilter('TEXT EFFECTS', 'countdown')).toBe(true);
    expect(cardMatchesFilter('TRANSFORM', 'rotation')).toBe(true);
    expect(cardMatchesFilter('TRANSFORM', 'glow')).toBe(false);
    expect(cardMatchesFilter('TRACK MATTE', 'matte feather')).toBe(true);
    expect(cardMatchesFilter('TRACK MATTE', 'matte typewriter')).toBe(false);
  });

  const card = (filter: string) => render(
    <InspectorFilterContext.Provider value={filter}>
      <StyleCard title="EFFECTS" collapsible><span>shadow controls</span></StyleCard>
      <StyleCard title="TRANSFORM" collapsible><span>position controls</span></StyleCard>
    </InspectorFilterContext.Provider>,
  );

  it('leaves out the cards that do not match and opens the ones that do', () => {
    card('glow');
    expect(screen.queryByText('TRANSFORM')).toBeNull();
    expect(screen.getByText('shadow controls')).toBeTruthy();
  });

  it('with no query every card is there, closed as before', () => {
    card('');
    expect(screen.getByText('TRANSFORM')).toBeTruthy();
    expect(screen.queryByText('shadow controls')).toBeNull();
  });
});
