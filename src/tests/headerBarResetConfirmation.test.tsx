// SAFE-03-A — reset requires confirmation before the document is replaced.
//
// The reset button previously called `resetProject` on a single click, so one
// stray click discarded every authored layer and track with no chance to
// reconsider. The contract pinned here:
//   * meaningful content + click            -> ConfirmationDialog, zero reset;
//   * Cancel / Escape                       -> zero reset, dialog gone;
//   * Confirm                               -> resetProject runs EXACTLY once;
//   * already-default document + click      -> immediate no-op reset, NO dialog;
//   * dialog keyboard model                 -> Cancel focused on open, dialog role.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { HeaderBar } from '../components/Header/HeaderBar';
import type { CharacterPart, Track } from '../types/animator';

const part: CharacterPart = {
  id: 'cow',
  name: 'Cow',
  type: 'custom_box',
  zIndex: 1,
  pivot: { x: 0, y: 0 },
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  fillColor: '#ff0000',
  strokeColor: '#101218',
  strokeWidth: 2,
};

const track: Track = {
  id: 'track_cow',
  partId: 'cow',
  name: 'Cow',
  color: '#fff',
  visible: true,
  locked: false,
  channels: {
    x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
    maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
    trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
  },
} as Track;

const animatorCtx = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}));
vi.mock('../components/Canvas/GifExportPanel', () => ({ GifExportPanel: () => null }));

vi.mock('../context/useAnimator', () => ({ useAnimator: () => animatorCtx.value, useAnimatorSlice: () => animatorCtx.value, useAnimatorReader: () => () => animatorCtx.value }));

function useContext(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
  return animatorCtx.value;
}

const resetButton = () => screen.getByTitle('Reset Canvas Project');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SAFE-03-A — reset confirmation', () => {
  it('asks for confirmation instead of resetting when the document has content', () => {
    const ctx = useContext({ characterParts: [part], tracks: [track] });
    render(<HeaderBar />);

    fireEvent.click(resetButton());

    expect(ctx.resetProject).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Cancel closes the dialog with zero reset calls', () => {
    const ctx = useContext({ characterParts: [part], tracks: [track] });
    render(<HeaderBar />);
    fireEvent.click(resetButton());

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(ctx.resetProject).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Escape closes the dialog with zero reset calls', () => {
    const ctx = useContext({ characterParts: [part], tracks: [track] });
    render(<HeaderBar />);
    fireEvent.click(resetButton());

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(ctx.resetProject).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Confirm runs the existing reset exactly once and closes the dialog', () => {
    const ctx = useContext({ characterParts: [part], tracks: [track] });
    render(<HeaderBar />);
    fireEvent.click(resetButton());

    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /reset/i }));

    expect(ctx.resetProject).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('the confirmation warns that the current project content will be replaced', () => {
    useContext({ characterParts: [part], tracks: [track] });
    render(<HeaderBar />);
    fireEvent.click(resetButton());

    expect(screen.getByRole('dialog').textContent).toMatch(/replaced/i);
  });

  it('focus starts on Cancel so Enter cannot destroy work by default', () => {
    useContext({ characterParts: [part], tracks: [track] });
    render(<HeaderBar />);
    fireEvent.click(resetButton());

    expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus();
  });

  it('an already-default document resets as an immediate no-op without a dialog', () => {
    const ctx = useContext();
    render(<HeaderBar />);

    fireEvent.click(resetButton());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(ctx.resetProject).toHaveBeenCalledTimes(1);
  });
});

describe('SAFE-03-A — replacement-set completeness (review repair)', () => {
  it('a legacy coordinate system makes the reset meaningful even with empty parts and tracks', () => {
    const ctx = useContext({ coordinateSystem: 'legacy-centi-unit' });
    render(<HeaderBar />);

    fireEvent.click(resetButton());

    expect(ctx.resetProject).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('an off-zero frame cursor makes the reset meaningful', () => {
    const ctx = useContext({ currentFrame: 24 });
    render(<HeaderBar />);
    fireEvent.click(resetButton());
    expect(ctx.resetProject).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('playing transport makes the reset meaningful (it stops and homes playback)', () => {
    const ctx = useContext({ isPlaying: true });
    render(<HeaderBar />);
    fireEvent.click(resetButton());
    expect(ctx.resetProject).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('fields reset does NOT replace (title, fps) do not fabricate a destructive prompt', () => {
    const ctx = useContext({ sceneTitle: 'My Masterpiece', fps: 24 });
    render(<HeaderBar />);

    fireEvent.click(resetButton());

    // Reset preserves title/fps; with every replaced field at its default the
    // operation is the existing no-op and a dialog would be noise.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(ctx.resetProject).toHaveBeenCalledTimes(1);
  });

  it('the dialog focus trap wraps at both ends (keyboard access repair)', () => {
    useContext({ characterParts: [part], tracks: [track] });
    render(<HeaderBar />);
    fireEvent.click(resetButton());

    const dialog = screen.getByRole('dialog');
    const cancel = within(dialog).getByRole('button', { name: /cancel/i });
    const confirm = within(dialog).getByRole('button', { name: /reset/i });
    expect(cancel).toHaveFocus();

    // From the LAST stop, Tab wraps to the first focusable element.
    confirm.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(cancel).toHaveFocus();

    // From the FIRST stop, Shift+Tab wraps to the last.
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();
  });
});
