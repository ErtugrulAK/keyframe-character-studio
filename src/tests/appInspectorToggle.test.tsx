import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';

vi.mock('../context/AnimatorContext', () => ({
  AnimatorProvider: ({ children }: { children: React.ReactNode }) => children,
  useAnimator: () => ({ appMode: 'edit', setIsPlaying: vi.fn() }),
}));
vi.mock('../components/Header/HeaderBar', () => ({ HeaderBar: () => <header /> }));
vi.mock('../components/Toolbar/LeftToolbar', () => ({ LeftToolbar: () => <nav /> }));
vi.mock('../components/Canvas/StageCanvas', () => ({ StageCanvas: () => <main data-testid="stage" /> }));
vi.mock('../components/Timeline/SequencerTimeline', () => ({ SequencerTimeline: () => <footer /> }));
vi.mock('../components/Broadcast/LiveDirectorPanel', () => ({ LiveDirectorPanel: () => <footer /> }));
vi.mock('../components/Inspector/PropertyInspector', () => ({
  PropertyInspector: ({ isHidden }: { isHidden: boolean }) => <aside data-testid="inspector" data-hidden={isHidden} />,
}));

describe('App Inspector visibility', () => {
  it('uses one stable dock-edge toggle for hide and show', () => {
    render(<App />);
    const toggle = () => screen.getByRole('button', { name: /Inspector/ });

    expect(toggle()).toHaveAccessibleName('Hide Inspector');
    expect(toggle()).toHaveClass('inspector-dock-toggle');
    expect(toggle().parentElement).toHaveClass('main-layout');
    expect(screen.getAllByRole('button', { name: /Inspector/ })).toHaveLength(1);
    fireEvent.click(toggle());
    expect(toggle()).toHaveAccessibleName('Show Inspector');
    expect(screen.getByTestId('inspector')).toHaveAttribute('data-hidden', 'true');
    expect(screen.getAllByRole('button', { name: /Inspector/ })).toHaveLength(1);

    fireEvent.click(toggle());
    expect(toggle()).toHaveAccessibleName('Hide Inspector');
    expect(screen.getByTestId('inspector')).toHaveAttribute('data-hidden', 'false');
  });
});
