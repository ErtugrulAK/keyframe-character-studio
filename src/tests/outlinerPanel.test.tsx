import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

/**
 * M22 8A — Outliner matte relationship indicator (UI-only).
 * Derivation: part.matte?.sourcePartId → characterParts.find → source name.
 * Three states: no-matte (no indicator) / valid matte (Scissors + name) /
 * missing source (AlertTriangle + "Missing"). No renderer/geometry/
 * serialization/validation changes — display only.
 */

const animatorCtx = {
  tracks: [] as unknown[],
  characterParts: [] as { id: string; name: string; type: string; matte?: { sourcePartId: string } }[],
  selectedPartId: undefined as string | undefined,
  selectedPartIds: [] as string[],
  handleSelectPart: vi.fn(),
  toggleTrackEditVisibility: vi.fn(),
  sceneTitle: 'Scene',
  reorderParts: vi.fn(),
  activeTool: 'select',
  setActiveTool: vi.fn(),
  focusModeNodeId: undefined as string | undefined,
  setFocusModeNodeId: vi.fn(),
};

vi.mock('../context/AnimatorContext', () => ({
  useAnimator: () => animatorCtx,
}));

import { OutlinerPanel } from '../components/Inspector/OutlinerPanel';

function renderPanel() {
  return render(<OutlinerPanel /> as ReactNode);
}

function part(id: string, name: string, type: string, matte?: { sourcePartId: string }) {
  return { id, name, type, ...(matte ? { matte } : {}) };
}

describe('OutlinerPanel — M22 matte relationship indicator', () => {
  it('1. no matte → no matte indicator', () => {
    animatorCtx.characterParts = [part('a', 'Alpha', 'custom_box')];
    renderPanel();
    expect(screen.queryByLabelText(/Matte source/)).toBeNull();
    expect(screen.queryByLabelText('Missing matte source')).toBeNull();
  });

  it('2-3. valid matte → indicator visible with the correct source part name', () => {
    animatorCtx.characterParts = [
      part('src', 'The Cow', 'custom_circle'),
      part('tgt', 'Box', 'custom_box', { sourcePartId: 'src' }),
    ];
    renderPanel();
    expect(screen.getByLabelText('Matte source: The Cow')).toBeTruthy();
    // the name appears both as the source row label AND the matte indicator
    expect(screen.getAllByText('The Cow').length).toBeGreaterThanOrEqual(2);
  });

  it('4. source name uses CharacterPart.name (never track.name)', () => {
    animatorCtx.tracks = [{ id: 't_src', partId: 'src', name: 'Track Name That Must Not Appear' }];
    animatorCtx.characterParts = [
      part('src', 'Part Name', 'custom_circle'),
      part('tgt', 'Box', 'custom_box', { sourcePartId: 'src' }),
    ];
    renderPanel();
    expect(screen.getByLabelText('Matte source: Part Name')).toBeTruthy();
    expect(screen.queryByText('Track Name That Must Not Appear')).toBeNull();
  });

  it('5-6. missing source → warning state, no crash', () => {
    animatorCtx.tracks = [];
    animatorCtx.characterParts = [
      part('tgt', 'Box', 'custom_box', { sourcePartId: 'ghost' }),
    ];
    renderPanel();
    expect(screen.getByLabelText('Missing matte source')).toBeTruthy();
    expect(screen.getByText('Missing')).toBeTruthy();
  });

  it('7. indicator carries an accessible label/title', () => {
    animatorCtx.characterParts = [
      part('src', 'Src', 'custom_star'),
      part('tgt', 'Box', 'custom_box', { sourcePartId: 'src' }),
    ];
    renderPanel();
    const el = screen.getByLabelText('Matte source: Src');
    expect(el.getAttribute('title')).toBe('Matte source: Src');
  });

  it('8. selection state unaffected (rows still render with selected class logic intact)', () => {
    animatorCtx.selectedPartIds = ['tgt'];
    animatorCtx.characterParts = [
      part('src', 'Src', 'custom_star'),
      part('tgt', 'Box', 'custom_box', { sourcePartId: 'src' }),
    ];
    const { container } = renderPanel();
    expect(container.querySelector('.actor-node.selected')).toBeTruthy();
    expect(screen.getByLabelText('Matte source: Src')).toBeTruthy();
  });

  it('9. visible/locked controls unaffected (eye column still renders)', () => {
    animatorCtx.tracks = [{ id: 't_tgt', partId: 'tgt', name: 'T', editVisible: false }];
    animatorCtx.characterParts = [
      part('src', 'Src', 'custom_star'),
      part('tgt', 'Box', 'custom_box', { sourcePartId: 'src' }),
    ];
    const { container } = renderPanel();
    expect(container.querySelector('.col-eye')).toBeTruthy();
    expect(screen.getByLabelText('Matte source: Src')).toBeTruthy();
  });

  it('10. existing non-matte rows unchanged (no indicator injected)', () => {
    animatorCtx.tracks = [];
    animatorCtx.characterParts = [
      part('a', 'Plain', 'custom_box'),
      part('src', 'Src', 'custom_star'),
      part('tgt', 'Box', 'custom_box', { sourcePartId: 'src' }),
    ];
    renderPanel();
    expect(screen.getAllByLabelText(/Matte source/).length).toBe(1);
    expect(screen.getByText('Plain')).toBeTruthy();
  });

  it('11. image/text/shape matte sources display correctly', () => {
    animatorCtx.characterParts = [
      part('img', 'Logo', 'custom_image'),
      part('txt', 'Title', 'custom_text'),
      part('shp', 'Star', 'custom_star'),
      part('t1', 'B1', 'custom_box', { sourcePartId: 'img' }),
      part('t2', 'B2', 'custom_box', { sourcePartId: 'txt' }),
      part('t3', 'B3', 'custom_box', { sourcePartId: 'shp' }),
    ];
    renderPanel();
    expect(screen.getByLabelText('Matte source: Logo')).toBeTruthy();
    expect(screen.getByLabelText('Matte source: Title')).toBeTruthy();
    expect(screen.getByLabelText('Matte source: Star')).toBeTruthy();
  });

  it('12. source switching updates the displayed source name (derived per render)', () => {
    animatorCtx.characterParts = [
      part('src', 'First', 'custom_star'),
      part('src2', 'Second', 'custom_circle'),
      part('tgt', 'Box', 'custom_box', { sourcePartId: 'src' }),
    ];
    const first = renderPanel();
    expect(screen.getByLabelText('Matte source: First')).toBeTruthy();
    first.unmount();
    // user switched the source in the Inspector → sourcePartId changed
    animatorCtx.characterParts[2] = part('tgt', 'Box', 'custom_box', { sourcePartId: 'src2' });
    renderPanel();
    expect(screen.getByLabelText('Matte source: Second')).toBeTruthy();
    expect(screen.queryByLabelText('Matte source: First')).toBeNull();
  });

  it('13. deleted source changes the indicator to missing (no crash)', () => {
    animatorCtx.characterParts = [
      part('src', 'Src', 'custom_star'),
      part('tgt', 'Box', 'custom_box', { sourcePartId: 'src' }),
    ];
    const first = renderPanel();
    expect(screen.getByLabelText('Matte source: Src')).toBeTruthy();
    first.unmount();
    animatorCtx.characterParts = [part('tgt', 'Box', 'custom_box', { sourcePartId: 'src' })];
    renderPanel();
    expect(screen.getByLabelText('Missing matte source')).toBeTruthy();
  });

  it('14. no drag/drop behavior added (rows keep their reorder drag only)', () => {
    animatorCtx.characterParts = [
      part('src', 'Src', 'custom_star'),
      part('tgt', 'Box', 'custom_box', { sourcePartId: 'src' }),
    ];
    const { container } = renderPanel();
    const rows = [...container.querySelectorAll('.actor-node')];
    // every row still has the reorder grip; the indicator is NOT draggable
    for (const row of rows) {
      expect((row as HTMLElement).getAttribute('draggable')).toBe('true');
    }
    const indicator = screen.getByLabelText('Matte source: Src');
    expect(indicator.getAttribute('draggable')).toBeNull();
  });

  it('15. no timeline behavior changed (Outliner render only)', () => {
    // regression guard: the outliner renders its rows with the same structure
    animatorCtx.characterParts = [
      part('src', 'Src', 'custom_star'),
      part('tgt', 'Box', 'custom_box', { sourcePartId: 'src' }),
    ];
    const { container } = renderPanel();
    expect(container.querySelectorAll('.actor-node').length).toBe(2);
    expect(container.querySelectorAll('.col-eye').length).toBe(2);
    expect(screen.getAllByLabelText(/Matte source/).length).toBe(1);
  });

  it('16. renders parent-child parts as a nested tree without a second selection authority', () => {
    animatorCtx.characterParts = [
      part('parent', 'Parent', 'custom_box'),
      { ...part('child', 'Child', 'custom_image'), parentId: 'parent' },
    ];
    animatorCtx.selectedPartId = 'child';
    animatorCtx.selectedPartIds = ['child'];
    const { container } = renderPanel();
    const rows = [...container.querySelectorAll<HTMLElement>('.actor-node')];
    expect(rows.map((row) => row.dataset.treeDepth)).toEqual(['0', '1']);
    expect(rows[1].dataset.parentId).toBe('parent');
    expect(rows[1].classList.contains('selected')).toBe(true);
  });
});
