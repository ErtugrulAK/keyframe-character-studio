import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
  snapEnabled: true,
  setSnapEnabled: vi.fn(),
  cropMode: false,
  setCropMode: vi.fn(),
  cropRegion: null as { x: number; y: number; width: number; height: number } | null,
  setCropRegion: vi.fn(),
  clearStageCropRegion: vi.fn(),
  applyStageCrop: vi.fn(() => true),
  cropStageToSelection: vi.fn(() => true),
  cropStageToVisibleContent: vi.fn(() => true),
  stageCropBlockReason: null as string | null,
  canCropStageToSelection: false,
  canCropStageToVisibleContent: false,
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
  getComputedTransform: vi.fn((partId: string) => animatorCtx.characterParts
    .find((part) => part.id === partId)?.baseTransform
    ?? { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }),
  showToast: vi.fn(),
  startBatchInteraction: vi.fn(),
  endBatchInteraction: vi.fn(),
  booleanOperandEditingGroupId: null as string | null,
  setBooleanOperandEditingGroupId: vi.fn(),
  armShapeCreation: vi.fn(),
  addCustomPart: vi.fn(),
  updateCurrentTransform: vi.fn(),
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
    animatorCtx.cropMode = false;
    animatorCtx.cropRegion = null;
    animatorCtx.stageCropBlockReason = null;
    animatorCtx.canCropStageToSelection = false;
    animatorCtx.canCropStageToVisibleContent = false;
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

  it('toggles canvas snapping through the shared context flag the stage reads', () => {
    animatorCtx.snapEnabled = true;
    renderToolbar();

    const snap = screen.getByRole('button', { name: 'Toggle snapping' });
    expect(snap).toHaveAttribute('aria-pressed', 'true');
    // It lives in the View band beside the grid, as presentation state.
    expect(within(screen.getByRole('group', { name: 'View controls' })).getByRole('button', { name: 'Toggle snapping' })).toBe(snap);

    fireEvent.click(snap);
    expect(animatorCtx.setSnapEnabled).toHaveBeenCalledWith(false);
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
    for (const name of ['Select', 'Pan', 'Toggle grid', 'Toggle snapping', 'Zoom in', 'Zoom out', 'Reset view']) {
      fireEvent.click(screen.getByRole('button', { name }));
    }
    expect(animatorCtx.setCharacterParts).not.toHaveBeenCalled();
    expect(animatorCtx.setTracks).not.toHaveBeenCalled();
  });

  it('leaves fill and stroke to the Inspector instead of owning a second paint entry', () => {
    const part = shape('a');
    animatorCtx.characterParts = [part];
    setSelection(['a'], 'a');
    renderToolbar();

    // No paint group at all — not with a layer selected, and not without one.
    expect(screen.queryByRole('group', { name: 'Fill and stroke' })).toBeNull();
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

  it('groups the selection through the shared layer-group authority', () => {
    animatorCtx.characterParts = [shape('a'), shape('b', { baseTransform: { x: 40, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } })];
    setSelection(['a', 'b'], 'b');
    renderToolbar();

    const groupButton = screen.getByRole('button', { name: 'Group layers' });
    expect(groupButton).not.toBeDisabled();
    expect(screen.getByRole('group', { name: 'Layer group' })).toBeTruthy();
    fireEvent.click(groupButton);

    expect(animatorCtx.setCharacterParts).toHaveBeenCalledTimes(1);
    expect(animatorCtx.setTracks).toHaveBeenCalledTimes(1);
    const next = animatorCtx.setCharacterParts.mock.calls[0][0] as CharacterPart[];
    const container = next.find((part) => part.isGroup)!;
    expect(next.filter((part) => part.parentId === container.id).map((part) => part.id)).toEqual(['a', 'b']);
  });

  it('keeps the group actions on screen but disabled until the selection can use them', () => {
    const view = renderToolbar();
    expect(screen.getByRole('button', { name: 'Group layers' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ungroup layers' })).toBeDisabled();

    animatorCtx.characterParts = [shape('a')];
    setSelection(['a'], 'a');
    view.rerender(<AuthoringToolbar />);
    expect(screen.getByRole('group', { name: 'Layer group' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Group layers' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ungroup layers' })).toBeDisabled();
  });

  it('keeps the Boolean group visible and enables it only for a compatible selection', () => {
    const view = renderToolbar();
    expect(screen.getByRole('button', { name: 'Boolean Union' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Boolean Subtract' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Boolean Intersect' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Boolean Exclude' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dissolve Boolean' })).toBeDisabled();

    // One eligible layer is still not a Boolean.
    animatorCtx.characterParts = [shape('a')];
    setSelection(['a'], 'a');
    view.rerender(<AuthoringToolbar />);
    expect(screen.getByRole('button', { name: 'Boolean Union' })).toBeDisabled();

    // Two compatible operands enable the whole group.
    animatorCtx.characterParts = [shape('a'), shape('b')];
    setSelection(['a', 'b'], 'b');
    view.rerender(<AuthoringToolbar />);
    expect(screen.getByRole('button', { name: 'Boolean Union' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Boolean Exclude' })).not.toBeDisabled();
  });

  it('presents the command bands in one order and offers no bond control', () => {
    animatorCtx.characterParts = [shape('a')];
    setSelection(['a'], 'a');
    renderToolbar();

    // The bands are announced, so the strip's structure is readable and testable
    // rather than implied by pixels.
    const bands = [
      'Canvas tools', 'Create', 'Boolean operations', 'Layer group',
      'Align', 'Distribute', 'Rotate and flip', 'Arrange', 'Crop', 'Crop to content', 'View controls',
    ];
    expect(screen.getAllByRole('group').map((group) => group.getAttribute('aria-label'))).toEqual(bands);

    // R4-10 — Bind/Unbind left the toolbar. The bond model is untouched, so the
    // strip simply has no control for it.
    expect(screen.queryByRole('button', { name: 'Bind selected layers' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Unbind selected layer' })).toBeNull();
  });


  it('arranges the selected layer through the shared z-index path', () => {
    const part = shape('a');
    animatorCtx.characterParts = [part];
    setSelection(['a'], 'a');
    renderToolbar();

    fireEvent.click(screen.getByRole('button', { name: 'Bring forward' }));
    expect(animatorCtx.setCharacterParts).toHaveBeenCalledTimes(1);
    const forward = animatorCtx.setCharacterParts.mock.calls[0][0] as (parts: CharacterPart[]) => CharacterPart[];
    expect(forward([part])[0].zIndex).toBe(part.zIndex + 1);

    fireEvent.click(screen.getByRole('button', { name: 'Send backward' }));
    const backward = animatorCtx.setCharacterParts.mock.calls[1][0] as (parts: CharacterPart[]) => CharacterPart[];
    expect(backward([part])[0].zIndex).toBe(1);
  });


  it('rotates and flips the selection with the same authority, disabled without one', () => {
    const part = shape('a');
    animatorCtx.characterParts = [part];
    setSelection([], null);
    const view = renderToolbar();
    expect(screen.getByRole('button', { name: 'Rotate clockwise' })).toBeDisabled();

    setSelection(['a'], 'a');
    view.rerender(<AuthoringToolbar />);
    const rotate = screen.getByRole('button', { name: 'Rotate clockwise' });
    expect(rotate).not.toBeDisabled();
    fireEvent.click(rotate);
    expect(animatorCtx.startBatchInteraction).toHaveBeenCalledTimes(1);
    const [rotatedPatch, rotatedId] = animatorCtx.updateCurrentTransform.mock.calls[0];
    expect(rotatedId).toBe('a');
    expect(rotatedPatch.rotation).toBe(90);
    expect(rotatedPatch.x).toBeCloseTo(0, 6);
    expect(rotatedPatch.y).toBeCloseTo(0, 6);

    fireEvent.click(screen.getByRole('button', { name: 'Flip vertical' }));
    expect(animatorCtx.updateCurrentTransform).toHaveBeenCalledTimes(2);
    const [flippedPatch, flippedId] = animatorCtx.updateCurrentTransform.mock.calls[1];
    expect(flippedId).toBe('a');
    expect(flippedPatch).toMatchObject({ scaleX: 1, scaleY: -1 });
    expect(flippedPatch.y).toBeCloseTo(0, 6);
    expect(flippedPatch.rotation).toBeCloseTo(0, 6);
  });

  it('creates shapes, text and the freeform path through the existing authorities', () => {
    const view = renderToolbar();

    fireEvent.click(screen.getByRole('button', { name: 'Add rectangle' }));
    expect(animatorCtx.armShapeCreation).toHaveBeenCalledWith('custom_rect', 'Rectangle');
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));
    expect(animatorCtx.armShapeCreation).toHaveBeenCalledWith('custom_circle', 'Circle');

    fireEvent.click(screen.getByRole('button', { name: 'Add text' }));
    expect(animatorCtx.addCustomPart).toHaveBeenCalledWith('custom_text', 'Text');

    const pen = screen.getByRole('button', { name: 'Pen' });
    fireEvent.click(pen);
    expect(animatorCtx.setActiveTool).toHaveBeenCalledWith('freeform_draw');
    animatorCtx.activeTool = 'freeform_draw';
    view.rerender(<AuthoringToolbar />);
    expect(screen.getByRole('button', { name: 'Pen' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps one roving Tab stop on the tool pair and moves it with the arrow keys', () => {
    const view = renderToolbar();
    const select = screen.getByRole('button', { name: 'Select' });
    const pan = screen.getByRole('button', { name: 'Pan' });
    expect(select).toHaveAttribute('tabindex', '0');
    expect(pan).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(select, { key: 'ArrowRight' });
    expect(animatorCtx.setActiveTool).toHaveBeenCalledWith('pan');

    animatorCtx.activeTool = 'pan';
    view.rerender(<AuthoringToolbar />);
    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('button', { name: 'Pan' })).toHaveAttribute('tabindex', '0');

    animatorCtx.activeTool = 'freeform_draw';
    view.rerender(<AuthoringToolbar />);
    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute('tabindex', '0');
  });

  it('sends reset view down the camera channel without touching the zoom', () => {
    renderToolbar();
    const dispatched: string[] = [];
    const listener = (event: Event) => { dispatched.push((event as CustomEvent<{ type: string }>).detail.type); };
    window.addEventListener('canvas-viewport-command', listener);
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));
      fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));
    } finally {
      window.removeEventListener('canvas-viewport-command', listener);
    }
    // Reset is idempotent and never carries a zoom step with it.
    expect(dispatched).toEqual(['reset-view', 'reset-view']);
  });

  it('arms crop mode, applies the region and runs both crop-to-content commands', () => {
    animatorCtx.characterParts = [shape('a')];
    setSelection(['a'], 'a');
    animatorCtx.canCropStageToSelection = true;
    animatorCtx.canCropStageToVisibleContent = true;

    const view = renderToolbar();
    const mode = screen.getByRole('button', { name: 'Crop / region of interest' });
    expect(mode).toHaveAttribute('aria-pressed', 'false');
    // Nothing to apply or clear until a region exists.
    expect(screen.getByRole('button', { name: 'Apply crop' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear crop region' })).toBeDisabled();

    fireEvent.click(mode);
    expect(animatorCtx.setCropMode).toHaveBeenCalledWith(true);

    animatorCtx.cropMode = true;
    animatorCtx.cropRegion = { x: 100, y: 50, width: 400, height: 300 };
    view.rerender(<AuthoringToolbar />);
    expect(screen.getByRole('button', { name: 'Crop / region of interest' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Apply crop' }));
    expect(animatorCtx.applyStageCrop).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Clear crop region' }));
    expect(animatorCtx.clearStageCropRegion).toHaveBeenCalledTimes(1);

    // Both auto-crop modes are offered, explicitly naming the frame they measure.
    fireEvent.click(screen.getByRole('button', { name: 'Crop to content' }));
    const menu = screen.getByRole('menu', { name: 'Crop to content' });
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Crop to current selection at current frame',
      'Crop to visible content at current frame',
    ]);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Crop to current selection at current frame' }));
    expect(animatorCtx.cropStageToSelection).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Crop to content' }));
    fireEvent.click(within(screen.getByRole('menu', { name: 'Crop to content' }))
      .getByRole('menuitem', { name: 'Crop to visible content at current frame' }));
    expect(animatorCtx.cropStageToVisibleContent).toHaveBeenCalledTimes(1);
  });

  it('disables a crop that cannot move a stage-anchored layer and explains why', () => {
    animatorCtx.characterParts = [shape('a', { anchor: 'top-left' })];
    setSelection(['a'], 'a');
    animatorCtx.stageCropBlockReason = 'A layer pinned by a stage anchor cannot be moved by a crop. Set its anchor to None first.';
    animatorCtx.cropRegion = { x: 100, y: 50, width: 400, height: 300 };
    renderToolbar();

    const apply = screen.getByRole('button', { name: 'Apply crop' });
    expect(apply).toBeDisabled();
    expect(apply).toHaveAttribute('title', animatorCtx.stageCropBlockReason);
    expect(screen.getByRole('button', { name: 'Crop to content' })).toBeDisabled();
  });

  it('offers Ungroup for a container and keeps Group disabled while only one layer is selected', () => {
    animatorCtx.characterParts = [
      shape('a', { parentId: 'g' }),
      shape('g', { isGroup: true, type: 'custom_freeform' }),
    ];
    setSelection(['g'], 'g');
    renderToolbar();

    expect(screen.getByRole('button', { name: 'Group layers' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ungroup layers' })).not.toBeDisabled();
  });

  it('ungroups the selected container from the toolbar', () => {
    animatorCtx.characterParts = [
      shape('a', { parentId: 'g' }),
      shape('g', { isGroup: true, type: 'custom_freeform' }),
    ];
    setSelection(['g'], 'g');
    renderToolbar();

    fireEvent.click(screen.getByRole('button', { name: 'Ungroup layers' }));
    const next = animatorCtx.setCharacterParts.mock.calls[0][0] as CharacterPart[];
    expect(next.map((part) => part.id)).toEqual(['a']);
    expect(next[0].parentId).toBeUndefined();
  });
});
