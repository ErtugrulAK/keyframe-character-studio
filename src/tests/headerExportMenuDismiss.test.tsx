// The header's Export menu closes like every other menu in the editor: a
// press outside it or Escape. Before, only its own toggle and items closed it,
// so it stayed open over the Details panel and the canvas.

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HeaderBar } from '../components/Header/HeaderBar';

const animatorCtx = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../components/Canvas/GifExportPanel', () => ({ GifExportPanel: () => null }));
vi.mock('../context/useAnimator', () => ({ useAnimator: () => animatorCtx.value }));

function renderHeader() {
  animatorCtx.value = {
    exportProject: () => '{}',
    importProject: vi.fn(),
    resetProject: vi.fn(),
    lastSavedAt: null,
    restoredFromLocalStorage: false,
    autosaveConflict: false,
    manualSaveRejectedAt: null,
    triggerManualSave: vi.fn(),
    showToast: vi.fn(),
    appMode: 'edit',
    setAppMode: vi.fn(),
    sceneTitle: 'Scene',
    projectTemplates: [],
    activeProjectTemplateId: 'Sequence',
    setActiveProjectTemplateId: vi.fn(),
    addProjectTemplate: vi.fn(),
    renameProjectTemplate: vi.fn(),
    deleteProjectTemplate: vi.fn(),
    fps: 60,
    setFps: vi.fn(),
    openShortcutReference: vi.fn(),
    characterParts: [],
    tracks: [],
    coordinateSystem: 'project-unit-center-v1',
    currentFrame: 0,
    isPlaying: false,
  };
  render(
    <>
      <HeaderBar />
      <div data-testid="details-panel">Details</div>
    </>,
  );
}

const menu = () => screen.queryByRole('menu', { name: 'Export options' });
const openMenu = () => fireEvent.click(screen.getByTitle('Export project'));

describe('Export menu dismissal', () => {
  it('closes on a press outside the menu', () => {
    renderHeader();
    openMenu();
    expect(menu()).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByTestId('details-panel'));

    expect(menu()).not.toBeInTheDocument();
  });

  it('closes even when the outside handler stops the event', () => {
    renderHeader();
    openMenu();
    const panel = screen.getByTestId('details-panel');
    panel.addEventListener('pointerdown', (event) => event.stopPropagation());

    fireEvent.pointerDown(panel);

    expect(menu()).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    renderHeader();
    openMenu();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(menu()).not.toBeInTheDocument();
  });

  it('stays open for a press inside it', () => {
    renderHeader();
    openMenu();

    fireEvent.pointerDown(screen.getByRole('menuitem', { name: 'JSON' }));

    expect(menu()).toBeInTheDocument();
  });
});
