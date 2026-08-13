import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock the drawers — LeftToolbar collapse/expand is a layout behavior; the
// drawer internals (which need the AnimatorProvider) are irrelevant here.
vi.mock('../components/Toolbar/drawers/ProjectDrawer', () => ({ ProjectDrawer: () => <div data-testid="drawer-project" /> }));
vi.mock('../components/Toolbar/drawers/MediaDrawer', () => ({ MediaDrawer: () => <div data-testid="drawer-media" /> }));
vi.mock('../components/Toolbar/drawers/ElementsDrawer', () => ({ ElementsDrawer: () => <div data-testid="drawer-elements" /> }));
vi.mock('../components/Toolbar/drawers/TextsDrawer', () => ({ TextsDrawer: () => <div data-testid="drawer-texts" /> }));
vi.mock('../components/Toolbar/drawers/TransitionsDrawer', () => ({ TransitionsDrawer: () => <div data-testid="drawer-transitions" /> }));

import { LeftToolbar } from '../components/Toolbar/LeftToolbar';

function container() {
  return document.querySelector('.left-toolbar-container') as HTMLElement;
}

describe('LeftToolbar collapse/expand (UI layout only)', () => {
  it('TEST 1 — starts expanded (no collapsed class, drawer visible)', () => {
    render(<LeftToolbar />);
    expect(container().className).not.toContain('collapsed');
    expect(screen.getByTestId('drawer-media')).toBeTruthy(); // default category drawer
    expect(screen.getByTitle('Collapse toolbar')).toBeTruthy();
  });

  it('TEST 2 — collapse button narrows the toolbar (collapsed class)', () => {
    render(<LeftToolbar />);
    fireEvent.click(screen.getByTitle('Collapse toolbar'));
    expect(container().className).toContain('collapsed');
    expect(screen.getByTitle('Expand toolbar')).toBeTruthy(); // control stays reachable
  });

  it('TEST 3 — toggling again expands back', () => {
    render(<LeftToolbar />);
    fireEvent.click(screen.getByTitle('Collapse toolbar'));
    fireEvent.click(screen.getByTitle('Expand toolbar'));
    expect(container().className).not.toContain('collapsed');
    expect(screen.getByTitle('Collapse toolbar')).toBeTruthy();
  });

  it('TEST 4 — active nav category is preserved across collapse (tool state intact)', () => {
    render(<LeftToolbar />);
    // switch to Texts drawer
    fireEvent.click(screen.getByText('Texts'));
    expect(screen.getByTestId('drawer-texts')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Collapse toolbar'));
    fireEvent.click(screen.getByTitle('Expand toolbar'));
    // re-expanding restores the exact previous drawer (state preserved)
    expect(screen.getByTestId('drawer-texts')).toBeTruthy();
    // the Texts nav item is still the active one
    const textsItem = screen.getByText('Texts').closest('button')!;
    expect(textsItem.className).toContain('active');
  });

  it('TEST 5 — collapse does not touch selection/playback/timeline state (LeftToolbar has no such state — only UI)', () => {
    // LeftToolbar owns only activeCategory + isCollapsed; toggling must not
    // throw and must not change any other UI state it renders.
    render(<LeftToolbar />);
    const navItems = document.querySelectorAll('.sidebar-nav-item');
    fireEvent.click(screen.getByTitle('Collapse toolbar'));
    expect(document.querySelectorAll('.sidebar-nav-item').length).toBe(navItems.length); // tool icons preserved
    expect(screen.getByText('Media')).toBeTruthy(); // labels may be hidden via CSS, elements remain
  });

  it('TEST 6 — collapsed class hides drawer via CSS width 0 (layout, not display:none removal)', () => {
    render(<LeftToolbar />);
    fireEvent.click(screen.getByTitle('Collapse toolbar'));
    const drawer = document.querySelector('.left-drawer-panel') as HTMLElement;
    // still mounted (smooth width transition) — collapsed styling comes from CSS
    expect(drawer).toBeTruthy();
    expect(container().className).toContain('collapsed');
  });
});
