import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import { AnimatorProvider } from '../context/AnimatorContext';

vi.mock('../components/Toolbar/drawers/ProjectDrawer', () => ({ ProjectDrawer: () => <div data-testid="drawer-project" /> }));
vi.mock('../components/Toolbar/drawers/MediaDrawer', () => ({ MediaDrawer: () => <div data-testid="drawer-media" /> }));
vi.mock('../components/Toolbar/drawers/ElementsDrawer', () => ({ ElementsDrawer: () => <div data-testid="drawer-elements" /> }));
vi.mock('../components/Toolbar/drawers/TextsDrawer', () => ({ TextsDrawer: () => <div data-testid="drawer-texts" /> }));

import { LeftToolbar } from '../components/Toolbar/LeftToolbar';

function Harness() {
  const [visible, setVisible] = useState(true);
  return (
    <AnimatorProvider>
      <main className={`main-layout ${visible ? '' : 'left-toolbar-hidden'}`}>
        <button
          type="button"
          className="sidebar-handle left-toolbar-toggle"
          aria-label={visible ? 'Hide Left Toolbar' : 'Show Left Toolbar'}
          onClick={() => setVisible((current) => !current)}
        />
        <LeftToolbar isHidden={!visible} />
        <div data-testid="stage" />
      </main>
    </AnimatorProvider>
  );
}

function renderToolbar() {
  return render(<Harness />);
}

function container() {
  return document.querySelector('.left-toolbar-container') as HTMLElement;
}

describe('LeftToolbar collapse/expand (parent-owned layout state)', () => {
  it('starts expanded with accessible chrome names', () => {
    renderToolbar();
    expect(container().className).not.toContain('hidden');
    expect(screen.getByTestId('drawer-media')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hide Left Toolbar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Media Assets' })).not.toHaveAttribute('title');
  });

  it('moves visibility authority to the parent and removes hidden footprint', () => {
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Hide Left Toolbar' }));
    expect(container()).toHaveClass('hidden');
    expect(container()).toHaveAttribute('aria-hidden', 'true');
    expect(container()).toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: 'Show Left Toolbar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Media Assets' })).toBeNull();
    // The browser contract (zero width/flex footprint) is asserted by the
    // real-layout E2E; jsdom does not evaluate the stylesheet.
    expect(container()).toHaveClass('hidden');
  });

  it('preserves active category across hide/show', () => {
    renderToolbar();
    fireEvent.click(screen.getByText('Texts'));
    fireEvent.click(screen.getByRole('button', { name: 'Hide Left Toolbar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show Left Toolbar' }));
    expect(screen.getByTestId('drawer-texts')).toBeTruthy();
    expect(screen.getByText('Texts').closest('button')).toHaveClass('active');
  });

  it('keeps nav content mounted but inaccessible while hidden', () => {
    renderToolbar();
    const count = document.querySelectorAll('.sidebar-nav-item').length;
    fireEvent.click(screen.getByRole('button', { name: 'Hide Left Toolbar' }));
    expect(document.querySelectorAll('.sidebar-nav-item')).toHaveLength(count);
    expect(screen.queryByRole('button', { name: 'Typography & Headlines' })).toBeNull();
    expect((document.querySelector('.left-drawer-panel') as HTMLElement)).toHaveAttribute('aria-hidden', 'true');
  });
});
