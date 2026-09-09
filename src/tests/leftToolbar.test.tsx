import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnimatorProvider } from '../context/AnimatorContext';

// Mock the drawers — LeftToolbar collapse/expand is a layout behavior; the
// drawer internals (which need the AnimatorProvider) are irrelevant here.
vi.mock('../components/Toolbar/drawers/ProjectDrawer', () => ({ ProjectDrawer: () => <div data-testid="drawer-project" /> }));
vi.mock('../components/Toolbar/drawers/MediaDrawer', () => ({ MediaDrawer: () => <div data-testid="drawer-media" /> }));
vi.mock('../components/Toolbar/drawers/ElementsDrawer', () => ({ ElementsDrawer: () => <div data-testid="drawer-elements" /> }));
vi.mock('../components/Toolbar/drawers/TextsDrawer', () => ({ TextsDrawer: () => <div data-testid="drawer-texts" /> }));
vi.mock('../components/Toolbar/drawers/TransitionsDrawer', () => ({ TransitionsDrawer: () => <div data-testid="drawer-transitions" /> }));

import { LeftToolbar } from '../components/Toolbar/LeftToolbar';

function renderToolbar() {
  return render(
    <AnimatorProvider>
      <LeftToolbar />
    </AnimatorProvider>,
  );
}

function container() {
  return document.querySelector('.left-toolbar-container') as HTMLElement;
}

describe('LeftToolbar collapse/expand (UI layout only)', () => {
  it('TEST 1 — starts expanded with accessible chrome names', () => {
    renderToolbar();
    expect(container().className).not.toContain('collapsed');
    expect(screen.getByTestId('drawer-media')).toBeTruthy(); // default category drawer
    const handle = screen.getByRole('button', { name: 'Hide Left Toolbar' });
    expect(handle).toBeTruthy();
    expect(handle).not.toHaveAttribute('title');
    expect(screen.getByRole('button', { name: 'Media Assets' })).not.toHaveAttribute('title');
  });

  it('TEST 2 — collapse button preserves the fixed rail (collapsed class)', () => {
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Hide Left Toolbar' }));
    expect(container().className).toContain('collapsed');
    expect(screen.getByRole('button', { name: 'Show Left Toolbar' })).toBeTruthy(); // control stays reachable
  });

  it('TEST 3 — toggling again expands back', () => {
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Hide Left Toolbar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show Left Toolbar' }));
    expect(container().className).not.toContain('collapsed');
    expect(screen.getByRole('button', { name: 'Hide Left Toolbar' })).toBeTruthy();
  });

  it('TEST 4 — active nav category is preserved across collapse (tool state intact)', () => {
    renderToolbar();
    // switch to Texts drawer
    fireEvent.click(screen.getByText('Texts'));
    expect(screen.getByTestId('drawer-texts')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hide Left Toolbar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show Left Toolbar' }));
    // re-expanding restores the exact previous drawer (state preserved)
    expect(screen.getByTestId('drawer-texts')).toBeTruthy();
    // the Texts nav item is still the active one
    const textsItem = screen.getByText('Texts').closest('button')!;
    expect(textsItem.className).toContain('active');
  });

  it('TEST 5 — collapse does not touch selection/playback/timeline state (LeftToolbar has no such state — only UI)', () => {
    // LeftToolbar owns only activeCategory + isCollapsed; toggling must not
    // throw and must not change any other UI state it renders.
    renderToolbar();
    const navItems = document.querySelectorAll('.sidebar-nav-item');
    fireEvent.click(screen.getByRole('button', { name: 'Hide Left Toolbar' }));
    expect(document.querySelectorAll('.sidebar-nav-item').length).toBe(navItems.length); // tool icons preserved
    expect(screen.getByText('Media')).toBeTruthy(); // labels may be hidden via CSS, elements remain
  });

  it('TEST 6 — collapsed class hides mounted drawer via CSS', () => {
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Hide Left Toolbar' }));
    const drawer = document.querySelector('.left-drawer-panel') as HTMLElement;
    // still mounted (smooth transition) — collapsed styling comes from CSS
    expect(drawer).toBeTruthy();
    expect(container().className).toContain('collapsed');
  });
});
