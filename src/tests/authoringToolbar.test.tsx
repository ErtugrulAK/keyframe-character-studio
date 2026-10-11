import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterPart } from '../types/animator';

const shape = (id: string, overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id,
  type: 'custom_rect',
  zIndex: 1,
  fillColor: '#336699',
  fillOpacity: 0.5,
  strokeColor: '#101218',
  strokeOpacity: 1,
  width: 100,
  height: 100,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  ...overrides,
});

const animatorCtx = {
  activeTool: 'select',
  setActiveTool: vi.fn(),
  showGrid: false,
  setShowGrid: vi.fn(),
  selectedPartId: null as string | null,
  selectedPartIds: [] as string[],
  setSelectedPartId: vi.fn(),
  setSelectedPartIds: vi.fn(),
  characterParts: [] as CharacterPart[],
  setCharacterParts: vi.fn(),
  setTracks: vi.fn(),
  tracks: [] as unknown[],
  currentFrame: 0,
  activeTemplateId: 'Sequence',
  updatePropertyKeyframeValue: vi.fn(),
  getComputedTransform: vi.fn(() => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 })),
  showToast: vi.fn(),
  startBatchInteraction: vi.fn(),
  endBatchInteraction: vi.fn(),
  booleanOperandEditingGroupId: null as string | null,
  setBooleanOperandEditingGroupId: vi.fn(),
};

vi.mock('../context/useAnimator', () => ({ useAnimator: () => animatorCtx }));

import { AuthoringToolbar } from '../components/Toolbar/AuthoringToolbar';

const setSelection = (ids: string[], primary: string | null) => {
  animatorCtx.selectedPartIds = ids;
  animatorCtx.selectedPartId = primary;
};

const renderToolbar = () => render(<AuthoringToolbar />);

describe('AuthoringToolbar', () => {
  beforeEach(() => {
    animatorCtx.activeTool = 'select';
    animatorCtx.showGrid = false;
    animatorCtx.characterParts = [];
    animatorCtx.tracks = [];
    setSelection([], null);
    vi.clearAllMocks();
  });

  it('drives the shared tool state and mirrors it back as the active state', () => {
    animatorCtx.activeTool = 'pan';
    renderToolbar();

    expect(screen.getByRole('button', { name: 'Pan' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(animatorCtx.setActiveTool).toHaveBeenCalledWith('select');
  });

  it('toggles the grid through the context flag the rest of the app reads', () => {
    animatorCtx.showGrid = true;
    renderToolbar();

    const grid = screen.getByRole('button', { name: 'Toggle grid' });
    expect(grid).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(grid);
    expect(animatorCtx.setShowGrid).toHaveBeenCalledWith(false);
  });

  it('sends zoom and reset view down the established camera command channel', () => {
    renderToolbar();
    const dispatched: string[] = [];
    const listener = (event: Event) => {
      dispatched.push((event as CustomEvent<{ type: string }>).detail.type);
    };
    window.addEventListener('canvas-viewport-command', listener);
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
      fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));
    } finally {
      window.removeEventListener('canvas-viewport-command', listener);
    }
    expect(dispatched).toEqual(['zoom-out', 'zoom-in', 'reset-view']);
  });

  it('never writes the document for view-only tools', () => {
    renderToolbar();
    for (const name of ['Select', 'Pan', 'Toggle grid', 'Zoom in', 'Zoom out', 'Reset view']) {
      fireEvent.click(screen.getByRole('button', { name }));
    }
    expect(animatorCtx.setCharacterParts).not.toHaveBeenCalled();
    expect(animatorCtx.setTracks).not.toHaveBeenCalled();
  });

  it('offers Fill and Stroke only for a selected layer, on the shared paint write path', () => {
    const part = shape('a');
    animatorCtx.characterParts = [part];
    setSelection(['a'], 'a');
    renderToolbar();

    const fill = screen.getByRole('button', { name: 'Fill Color Preview' });
    expect(fill).toHaveAttribute('title', '#336699 · 50%');
    fireEvent.click(fill);
    expect(screen.getByRole('dialog', { name: 'Fill Color Picker' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Fill R'), { target: { value: '255' } });
    expect(animatorCtx.setCharacterParts).toHaveBeenCalledTimes(1);
    const updater = animatorCtx.setCharacterParts.mock.calls[0][0] as (parts: CharacterPart[]) => CharacterPart[];
    const next = updater([part]);
    // Routed through the shared shape-appearance write path, not a raw patch.
    expect(next[0].fillColor).toBe('#ff6699');
    expect(next[0].fillOpacity).toBe(0.5);
  });

  it('hides the paint group when nothing is selected', () => {
    renderToolbar();
    expect(screen.queryByRole('button', { name: 'Fill Color Preview' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stroke Color Preview' })).toBeNull();
  });

  it('creates a Boolean through the shared authority once two operands are selected', () => {
    animatorCtx.characterParts = [shape('a'), shape('b', { baseTransform: { x: 40, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } })];
    setSelection(['a', 'b'], 'b');
    renderToolbar();

    expect(screen.queryByRole('button', { name: 'Boolean Union' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Boolean Union' }));

    expect(animatorCtx.setCharacterParts).toHaveBeenCalledTimes(1);
    const updater = animatorCtx.setCharacterParts.mock.calls[0][0] as (parts: CharacterPart[]) => CharacterPart[];
    const next = updater(animatorCtx.characterParts);
    const group = next.find((part) => part.booleanOperandIds?.length === 2);
    expect(group).toBeTruthy();
    expect(group?.booleanOperation).toBe('union');
    expect(next.filter((part) => part.booleanGroupId === group?.id)).toHaveLength(2);
    expect(animatorCtx.setTracks).toHaveBeenCalledTimes(1);
  });

  it('switches an existing Boolean operation and shows the current one as pressed', () => {
    const group = shape('group', {
      type: 'custom_freeform',
      booleanOperation: 'union',
      booleanOperandIds: ['a', 'b'],
      booleanContours: [],
    });
    animatorCtx.characterParts = [group, shape('a'), shape('b')];
    setSelection(['group'], 'group');
    renderToolbar();

    expect(screen.getByRole('button', { name: 'Boolean Union' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Boolean Subtract' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Boolean Subtract' }));
    expect(animatorCtx.setCharacterParts).toHaveBeenCalledTimes(1);
    const updater = animatorCtx.setCharacterParts.mock.calls[0][0] as (parts: CharacterPart[]) => CharacterPart[];
    const next = updater(animatorCtx.characterParts);
    expect(next.find((part) => part.id === 'group')?.booleanOperation).toBe('subtract');
  });

  it('exposes an accessible toolbar with tooltips and no stray text labels', () => {
    renderToolbar();
    const toolbar = screen.getByRole('toolbar', { name: 'Authoring tools' });
    expect(toolbar).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Canvas tools' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'View controls' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute('title', 'Select tool (V)');
    expect(screen.getByRole('button', { name: 'Pan' })).toHaveAttribute('title', 'Pan tool (H)');
  });
});
